import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const JOURNAL_TAGS = Object.freeze([
  'Learning',
  'Problem Solving',
  'Communication',
  'Teamwork',
  'Achievement',
  'Reflection',
]);

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const fields = ['learning', 'difficulty', 'resolution', 'communication', 'achievement', 'improvement', 'reflection'];

function validDate(value) {
  if (!datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function normalizeText(value, label, maxLength, required = false) {
  const text = String(value || '').trim();
  if (required && !text) throw new Error(`${label}을 입력하세요.`);
  if (text.length > maxLength) throw new Error(`${label}은 ${maxLength}자 이내로 입력하세요.`);
  return text;
}

export function createJournalService(directory) {
  const journalDir = path.resolve(directory);

  const filePath = (date) => {
    if (!validDate(date)) throw new Error('날짜를 확인하세요.');
    return path.join(journalDir, `${date}.json`);
  };

  const ensureDirectory = async () => {
    await fs.mkdir(journalDir, { recursive: true, mode: 0o700 });
    await fs.chmod(journalDir, 0o700);
  };

  const normalizeRecord = (input, existing = {}) => {
    const date = String(input.date || '');
    if (!validDate(date)) throw new Error('날짜를 확인하세요.');
    const requestedTags = Array.isArray(input.tags) ? input.tags : input.tags ? [input.tags] : [];
    const record = {
      date,
      title: normalizeText(input.title, '제목', 100),
      tags: JOURNAL_TAGS.filter((tag) => requestedTags.includes(tag)),
    };
    for (const field of fields) {
      record[field] = normalizeText(input[field], field === 'learning' ? '오늘 배운 내용' : '본문', 5000, field === 'learning');
    }
    const now = new Date().toISOString();
    return { ...record, createdAt: existing.createdAt || now, updatedAt: now };
  };

  const load = async (date) => {
    try {
      const record = JSON.parse(await fs.readFile(filePath(date), 'utf8'));
      return validDate(record.date) ? record : null;
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  };

  const list = async () => {
    try {
      const names = await fs.readdir(journalDir);
      const records = await Promise.all(names.filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).map((name) => load(name.slice(0, 10))));
      return records.filter(Boolean).sort((a, b) => b.date.localeCompare(a.date));
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  };

  const save = async (input, previousDate = '') => {
    const existing = previousDate ? await load(previousDate) : await load(String(input.date || ''));
    const record = normalizeRecord(input, existing || {});
    if (previousDate && previousDate !== record.date && await load(record.date)) throw new Error('해당 날짜의 일기가 이미 있습니다.');
    await ensureDirectory();
    const temporaryFile = path.join(journalDir, `.${crypto.randomUUID()}.tmp`);
    await fs.writeFile(temporaryFile, `${JSON.stringify(record, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await fs.rename(temporaryFile, filePath(record.date));
    await fs.chmod(filePath(record.date), 0o600);
    if (previousDate && previousDate !== record.date) await fs.rm(filePath(previousDate), { force: true });
    return record;
  };

  const remove = async (date) => fs.rm(filePath(date), { force: true });

  return { list, load, save, remove };
}
