import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const PRACTICE_TIME_CATEGORIES = Object.freeze(['업무', '학습', '휴식', '생활', '기타']);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const backlogIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const PRACTICE_BACKLOG_CATEGORIES = Object.freeze(['Oracle', 'Python', '컴퓨터 구조', '알고리즘', '기타']);
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function validDate(value) {
  if (!datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
function text(value, label, max = 3000) {
  const result = String(value || '').trim();
  if (result.length > max || /\0/.test(result)) throw new Error(`${label}은 ${max}자 이내로 입력하세요.`);
  return result;
}
function array(value) { return Array.isArray(value) ? value : value === undefined ? [] : [value]; }
function minutes(value) { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute; }

export function createPracticeService(directory) {
  const root = path.resolve(directory);
  const backlogPath = path.join(root, 'backlog.json');
  const filePath = (date) => {
    if (!validDate(date)) throw new Error('실천 기록 날짜를 확인하세요.');
    return path.join(root, `${date}.json`);
  };
  const ensureDirectory = async () => { await fs.mkdir(root, { recursive: true, mode: 0o700 }); await fs.chmod(root, 0o700); };
  const load = async (date) => {
    try { return JSON.parse(await fs.readFile(filePath(date), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  };
  const list = async () => {
    try {
      const names = (await fs.readdir(root)).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort().reverse();
      return (await Promise.all(names.map((name) => load(name.slice(0, -5))))).filter(Boolean);
    } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  };
  const save = async (date, input) => {
    filePath(date);
    const starts = array(input.timeStart); const ends = array(input.timeEnd); const categories = array(input.timeCategory); const descriptions = array(input.timeDescription);
    const timeBlocks = [];
    for (let index = 0; index < Math.max(starts.length, ends.length, categories.length, descriptions.length); index += 1) {
      const start = String(starts[index] || ''); const end = String(ends[index] || ''); const category = String(categories[index] || ''); const description = text(descriptions[index], '시간 기록 내용', 200);
      if (!start && !end && !description) continue;
      if (!timePattern.test(start) || !timePattern.test(end) || !PRACTICE_TIME_CATEGORIES.includes(category)) throw new Error('시간 기록을 확인하세요.');
      const duration = minutes(end) - minutes(start);
      if (duration <= 0 || duration % 30) throw new Error('시간 기록은 30분 단위로 입력하세요.');
      timeBlocks.push({ start, end, category, description });
    }
    const sorted = [...timeBlocks].sort((a, b) => a.start.localeCompare(b.start));
    if (sorted.some((block, i) => i && block.start < sorted[i - 1].end)) throw new Error('겹치는 시간 기록이 있습니다.');
    const existing = await load(date); const now = new Date().toISOString();
    const record = {
      date,
      keyOutcome: text(input.keyOutcome, '오늘의 핵심 결과'),
      outcomeStatus: ['planned', 'completed', 'carried'].includes(String(input.outcomeStatus)) ? String(input.outcomeStatus) : 'planned',
      recoveryGoal: text(input.recoveryGoal, '회복 목표'),
      coreLearning: text(input.coreLearning, '핵심 학습'),
      extraWork: text(input.extraWork, '부가 개선'),
      stopDoing: text(input.stopDoing, '줄이거나 중단할 일'),
      weeklyReview: text(input.weeklyReview, '주간 점검'),
      timeBlocks: sorted,
      sourceBookId: 'e0ae65c9-cba7-4ac7-b019-3ac6545018b8',
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    await ensureDirectory();
    const temporary = path.join(root, `.${date}.${process.pid}.tmp`);
    await fs.writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
    await fs.rename(temporary, filePath(date)); await fs.chmod(filePath(date), 0o600);
    return record;
  };
  const loadBacklog = async () => {
    try {
      const items = JSON.parse(await fs.readFile(backlogPath, 'utf8'));
      return Array.isArray(items) ? items : [];
    } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  };
  const writeBacklog = async (items) => {
    await ensureDirectory();
    const temporary = path.join(root, `.${crypto.randomUUID()}.tmp`);
    await fs.writeFile(temporary, `${JSON.stringify(items, null, 2)}\n`, { mode: 0o600 });
    await fs.rename(temporary, backlogPath); await fs.chmod(backlogPath, 0o600);
  };
  const addBacklog = async (input) => {
    const category = String(input.category || '');
    if (!PRACTICE_BACKLOG_CATEGORIES.includes(category)) throw new Error('백로그 분류를 확인하세요.');
    const title = text(input.title, '백로그 제목', 150);
    if (!title) throw new Error('백로그 제목을 입력하세요.');
    const items = await loadBacklog(); const now = new Date().toISOString();
    const item = { id: crypto.randomUUID(), title, category, notes: text(input.notes, '백로그 메모', 1000), completed: false, createdAt: now, updatedAt: now };
    items.push(item); await writeBacklog(items); return item;
  };
  const toggleBacklog = async (id) => {
    if (!backlogIdPattern.test(String(id || ''))) throw new Error('백로그 주소를 확인하세요.');
    const items = await loadBacklog(); const item = items.find((entry) => entry.id === id);
    if (!item) return null;
    item.completed = !item.completed; item.updatedAt = new Date().toISOString(); await writeBacklog(items); return item;
  };
  const removeBacklog = async (id) => {
    if (!backlogIdPattern.test(String(id || ''))) throw new Error('백로그 주소를 확인하세요.');
    const items = await loadBacklog(); const filtered = items.filter((entry) => entry.id !== id);
    if (filtered.length === items.length) return false;
    await writeBacklog(filtered); return true;
  };
  return { load, list, save, loadBacklog, addBacklog, toggleBacklog, removeBacklog };
}
