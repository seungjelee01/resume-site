import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const READING_CATEGORIES = Object.freeze([
  '태도·성장',
  '데이터베이스',
  '데이터 분석',
  '소프트웨어 개발',
  '커리어',
  '기타',
]);

export const READING_STATUSES = Object.freeze({
  planned: '읽을 예정',
  reading: '읽는 중',
  completed: '완독',
  stopped: '중단',
});

export const READING_TAGS = Object.freeze([
  'Habit',
  'Problem Solving',
  'Communication',
  'Teamwork',
  'Leadership',
  'Data',
  'SQL',
  'Database',
  'Career',
]);

const idPattern = /^[0-9a-f-]{36}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const textFields = [
  ['reason', '이 책을 읽는 이유'],
  ['keyPoints', '기억할 핵심 내용'],
  ['memorable', '인상 깊었던 부분'],
  ['reflection', '배운 점'],
  ['application', '적용할 점'],
];

function validDate(value) {
  if (!value) return true;
  if (!datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function text(value, label, maxLength, required = false) {
  const normalized = String(value || '').trim();
  if (required && !normalized) throw new Error(`${label}을 입력하세요.`);
  if (normalized.length > maxLength) throw new Error(`${label}은 ${maxLength}자 이내로 입력하세요.`);
  return normalized;
}

function pageNumber(value, label) {
  if (value === '' || value === undefined || value === null) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 100000) throw new Error(`${label}를 확인하세요.`);
  return number;
}

export function createReadingService(directory) {
  const readingDir = path.resolve(directory);

  const filePath = (id) => {
    if (!idPattern.test(id)) throw new Error('독서 기록 주소를 확인하세요.');
    return path.join(readingDir, `${id}.json`);
  };

  const ensureDirectory = async () => {
    await fs.mkdir(readingDir, { recursive: true, mode: 0o700 });
    await fs.chmod(readingDir, 0o700);
  };

  const normalize = (input, existing = {}) => {
    const category = READING_CATEGORIES.includes(String(input.category || '')) ? String(input.category) : '';
    const status = Object.hasOwn(READING_STATUSES, String(input.status || '')) ? String(input.status) : '';
    if (!category) throw new Error('독서 분야를 선택하세요.');
    if (!status) throw new Error('독서 상태를 선택하세요.');
    const startDate = String(input.startDate || '');
    const completedDate = String(input.completedDate || '');
    if (!validDate(startDate) || !validDate(completedDate)) throw new Error('독서 기간을 확인하세요.');
    if (startDate && completedDate && completedDate < startDate) throw new Error('완독일은 시작일보다 빠를 수 없습니다.');
    if (status === 'completed' && !completedDate) throw new Error('완독한 책은 완독일을 입력하세요.');
    const currentPage = pageNumber(input.currentPage, '현재 페이지');
    const totalPages = pageNumber(input.totalPages, '전체 페이지');
    if (currentPage !== null && totalPages !== null && currentPage > totalPages) throw new Error('현재 페이지는 전체 페이지보다 클 수 없습니다.');
    const requestedTags = Array.isArray(input.tags) ? input.tags : input.tags ? [input.tags] : [];
    const record = {
      id: existing.id || crypto.randomUUID(),
      title: text(input.title, '책 제목', 150, true),
      author: text(input.author, '저자', 100, true),
      publisher: text(input.publisher, '출판사', 100),
      category,
      status,
      startDate,
      completedDate,
      currentPage,
      totalPages,
      tags: READING_TAGS.filter((tag) => requestedTags.includes(tag)),
    };
    for (const [field, label] of textFields) record[field] = text(input[field], label, 5000);
    const now = new Date().toISOString();
    return { ...record, createdAt: existing.createdAt || now, updatedAt: now };
  };

  const load = async (id) => {
    try {
      const record = JSON.parse(await fs.readFile(filePath(id), 'utf8'));
      return record.id === id ? record : null;
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  };

  const list = async () => {
    try {
      const names = await fs.readdir(readingDir);
      const records = await Promise.all(names.filter((name) => /^[0-9a-f-]{36}\.json$/i.test(name)).map((name) => load(name.slice(0, -5))));
      return records.filter(Boolean).sort((a, b) => (b.completedDate || b.startDate || b.createdAt).localeCompare(a.completedDate || a.startDate || a.createdAt));
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  };

  const save = async (input, id = '') => {
    const existing = id ? await load(id) : null;
    if (id && !existing) return null;
    const record = normalize(input, existing || {});
    await ensureDirectory();
    const temporaryFile = path.join(readingDir, `.${crypto.randomUUID()}.tmp`);
    await fs.writeFile(temporaryFile, `${JSON.stringify(record, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await fs.rename(temporaryFile, filePath(record.id));
    await fs.chmod(filePath(record.id), 0o600);
    return record;
  };

  const remove = async (id) => fs.rm(filePath(id), { force: true });

  return { list, load, save, remove };
}
