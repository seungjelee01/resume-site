import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const SELF_INSIGHT_PROFILE_FIELDS = Object.freeze([
  ['oneLineIntro', '한 줄 소개'],
  ['introduction', '자기소개'],
  ['personality', '성격'],
  ['strengths', '장점'],
  ['weaknesses', '단점과 보완 노력'],
  ['hobbies', '취미·관심사'],
  ['values', '가치관'],
  ['careerDirection', '직업관·경력 방향'],
]);

export const SELF_INSIGHT_CATEGORIES = Object.freeze([
  '성취',
  '문제 해결',
  '협업·소통',
  '갈등',
  '실패·개선',
  '도전·학습',
  '책임감',
  '기타',
]);

export const SELF_INSIGHT_STAR_FIELDS = Object.freeze([
  ['situation', '상황'],
  ['task', '과제'],
  ['action', '행동'],
  ['result', '결과'],
  ['learning', '배운 점'],
]);

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const experienceFilenamePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const profileKeys = new Set(SELF_INSIGHT_PROFILE_FIELDS.map(([key]) => key));

function text(value, label, maxLength, required = false) {
  const normalized = String(value || '').trim();
  if (required && !normalized) throw new Error(`${label}을 입력하세요.`);
  if (normalized.length > maxLength || /\0/.test(normalized)) throw new Error(`${label}은 ${maxLength}자 이내로 입력하세요.`);
  return normalized;
}

function validDate(value) {
  if (!value) return true;
  if (!datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function values(input) {
  if (Array.isArray(input)) return input;
  return input === undefined || input === null || input === '' ? [] : [input];
}

function normalizeTags(input) {
  const source = values(input).flatMap((item) => String(item).split(','));
  const tags = [...new Set(source.map((tag) => tag.trim()).filter(Boolean))];
  if (tags.length > 10) throw new Error('태그는 최대 10개까지 입력하세요.');
  if (tags.some((tag) => tag.length > 30 || /\0/.test(tag))) throw new Error('태그는 각각 30자 이내로 입력하세요.');
  return tags;
}

export function createSelfInsightService(directory) {
  const rootDir = path.resolve(directory);
  const experiencesDir = path.join(rootDir, 'experiences');
  const profilePath = path.join(rootDir, 'profile.json');

  const experiencePath = (id) => {
    if (!idPattern.test(String(id || ''))) throw new Error('경험 기록 주소를 확인하세요.');
    return path.join(experiencesDir, `${id}.json`);
  };

  const ensureDirectory = async () => {
    await fs.mkdir(experiencesDir, { recursive: true, mode: 0o700 });
    await fs.chmod(rootDir, 0o700);
    await fs.chmod(experiencesDir, 0o700);
  };

  const writeJson = async (target, record) => {
    await ensureDirectory();
    const temporary = path.join(path.dirname(target), `.${crypto.randomUUID()}.tmp`);
    try {
      await fs.writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
      await fs.rename(temporary, target);
      await fs.chmod(target, 0o600);
    } catch (error) {
      await fs.rm(temporary, { force: true });
      throw error;
    }
  };

  const emptyProfile = () => Object.fromEntries(SELF_INSIGHT_PROFILE_FIELDS.map(([key]) => [key, '']));

  const loadProfile = async () => {
    try {
      const stored = JSON.parse(await fs.readFile(profilePath, 'utf8'));
      const profile = emptyProfile();
      for (const [key] of SELF_INSIGHT_PROFILE_FIELDS) profile[key] = typeof stored[key] === 'string' ? stored[key] : '';
      return { ...profile, createdAt: stored.createdAt || '', updatedAt: stored.updatedAt || '' };
    } catch (error) {
      if (error.code === 'ENOENT') return { ...emptyProfile(), createdAt: '', updatedAt: '' };
      throw error;
    }
  };

  const saveProfile = async (input) => {
    const existing = await loadProfile();
    const record = {};
    for (const [key, label] of SELF_INSIGHT_PROFILE_FIELDS) record[key] = text(input[key], label, key === 'oneLineIntro' ? 200 : 5000);
    const now = new Date().toISOString();
    const saved = { ...record, createdAt: existing.createdAt || now, updatedAt: now };
    await writeJson(profilePath, saved);
    return saved;
  };

  const loadExperience = async (id) => {
    try {
      const record = JSON.parse(await fs.readFile(experiencePath(id), 'utf8'));
      return record.id === id ? record : null;
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  };

  const listExperiences = async () => {
    try {
      const names = await fs.readdir(experiencesDir);
      const records = await Promise.all(names.filter((name) => experienceFilenamePattern.test(name)).map((name) => loadExperience(name.slice(0, -5))));
      return records.filter(Boolean).sort((a, b) => (b.endDate || b.startDate || b.updatedAt).localeCompare(a.endDate || a.startDate || a.updatedAt));
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  };

  const saveExperience = async (input, id = '') => {
    const existing = id ? await loadExperience(id) : null;
    if (id && !existing) return null;
    const category = String(input.category || '');
    if (!SELF_INSIGHT_CATEGORIES.includes(category)) throw new Error('경험 분류를 선택하세요.');
    const startDate = String(input.startDate || '');
    const endDate = String(input.endDate || '');
    if (!validDate(startDate) || !validDate(endDate) || (startDate && endDate && endDate < startDate)) throw new Error('경험 기간을 확인하세요.');
    const relatedFields = [...new Set(values(input.relatedFields).map(String))];
    if (relatedFields.some((field) => !profileKeys.has(field))) throw new Error('연결 항목을 확인하세요.');
    const record = {
      id: existing?.id || crypto.randomUUID(),
      title: text(input.title, '경험 제목', 150, true),
      category,
      startDate,
      endDate,
      tags: normalizeTags(input.tags),
      relatedFields,
    };
    for (const [key, label] of SELF_INSIGHT_STAR_FIELDS) record[key] = text(input[key], label, 5000, true);
    const now = new Date().toISOString();
    const saved = { ...record, createdAt: existing?.createdAt || now, updatedAt: now };
    await writeJson(experiencePath(saved.id), saved);
    return saved;
  };

  const removeExperience = async (id) => fs.rm(experiencePath(id), { force: true });

  return { loadProfile, saveProfile, loadExperience, listExperiences, saveExperience, removeExperience };
}
