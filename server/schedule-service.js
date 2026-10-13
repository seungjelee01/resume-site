import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const SCHEDULE_CATEGORIES = Object.freeze(['Oracle', 'SQL·PL/SQL', 'Linux', 'Python', '컴퓨터 구조', '알고리즘', '포트폴리오', '기타']);
export const SCHEDULE_STATUSES = Object.freeze(['planned', 'completed', 'canceled']);
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function validDate(value) {
  if (!datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function normalizeText(value, label, max, required = false) {
  const result = String(value || '').trim();
  if ((required && !result) || result.length > max || /\0/.test(result)) throw new Error(`${label}을 확인하세요.`);
  return result;
}

export function createScheduleService(directory) {
  const root = path.resolve(directory);
  const filePath = (id) => {
    if (!idPattern.test(String(id || ''))) throw new Error('일정 주소를 확인하세요.');
    return path.join(root, `${id}.json`);
  };
  const ensureDirectory = async () => {
    await fs.mkdir(root, { recursive: true, mode: 0o700 });
    await fs.chmod(root, 0o700);
  };
  const load = async (id) => {
    try { return JSON.parse(await fs.readFile(filePath(id), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  };
  const list = async () => {
    try {
      const names = (await fs.readdir(root)).filter((name) => idPattern.test(name.slice(0, -5)) && name.endsWith('.json'));
      const records = (await Promise.all(names.map((name) => load(name.slice(0, -5))))).filter(Boolean);
      return records.sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || '') || a.createdAt.localeCompare(b.createdAt));
    } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  };
  const save = async (input, id = crypto.randomUUID()) => {
    const destination = filePath(id);
    const title = normalizeText(input.title, '일정 제목', 150, true);
    const date = String(input.date || '');
    if (!validDate(date)) throw new Error('일정 날짜를 확인하세요.');
    const startTime = String(input.startTime || '');
    const endTime = String(input.endTime || '');
    if (Boolean(startTime) !== Boolean(endTime) || (startTime && (!timePattern.test(startTime) || !timePattern.test(endTime) || startTime >= endTime))) {
      throw new Error('시작 시간과 종료 시간을 확인하세요.');
    }
    const category = String(input.category || '');
    if (!SCHEDULE_CATEGORIES.includes(category)) throw new Error('학습 분야를 확인하세요.');
    const status = String(input.status || 'planned');
    if (!SCHEDULE_STATUSES.includes(status)) throw new Error('일정 상태를 확인하세요.');
    const existing = await load(id);
    const now = new Date().toISOString();
    const record = {
      id, title, date, startTime, endTime, category, status,
      notes: normalizeText(input.notes, '메모', 3000),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    await ensureDirectory();
    const temporary = path.join(root, `.${crypto.randomUUID()}.tmp`);
    await fs.writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
    await fs.rename(temporary, destination);
    await fs.chmod(destination, 0o600);
    return record;
  };
  const remove = async (id) => {
    try { await fs.rm(filePath(id)); return true; }
    catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  };
  return { list, load, save, remove };
}
