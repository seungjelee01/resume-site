import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createReadingService } from '../server/reading-service.js';

async function temporaryService() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'reading-service-'));
  return { directory, service: createReadingService(directory) };
}

const completedBook = {
  title: '피터 드러커 자기경영노트',
  author: '피터 드러커',
  category: '태도·성장',
  status: 'completed',
  completedDate: '2026-10-05',
  tags: ['Leadership'],
};

test('only explicitly published completed books are available by public slug', async (t) => {
  const { directory, service } = await temporaryService();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));

  await service.save({ ...completedBook, publicSlug: 'private-book' });
  const published = await service.save({ ...completedBook, title: '공개 기록', published: 'on', publicSlug: 'effective-executive' });

  assert.deepEqual((await service.listPublished()).map((book) => book.id), [published.id]);
  assert.equal((await service.loadPublishedBySlug('effective-executive')).title, '공개 기록');
  assert.equal(await service.loadPublishedBySlug('../private-book'), null);
  await assert.rejects(() => service.save({ ...completedBook, title: '중복 주소', published: true, publicSlug: 'effective-executive' }), /이미 사용 중/);
});

test('publication requires a completed book and a safe slug', async (t) => {
  const { directory, service } = await temporaryService();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));

  await assert.rejects(() => service.save({ ...completedBook, status: 'reading', published: 'on', publicSlug: 'reading-now' }), /완독한 책/);
  await assert.rejects(() => service.save({ ...completedBook, published: 'on', publicSlug: '' }), /공개 주소/);
  await assert.rejects(() => service.save({ ...completedBook, published: 'on', publicSlug: 'Bad Slug' }), /영문 소문자/);
});
