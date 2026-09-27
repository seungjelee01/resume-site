import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createPracticeService } from '../server/practice-service.js';

test('practice records daily outcomes and private 30-minute time blocks', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'practice-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const service = createPracticeService(dir);
  const saved = await service.save('2026-09-27', { keyOutcome: 'Oracle 복습', outcomeStatus: 'completed', timeStart: ['09:00'], timeEnd: ['10:30'], timeCategory: ['학습'], timeDescription: ['복습'] });
  assert.equal(saved.timeBlocks[0].description, '복습');
  assert.equal((await fs.stat(dir)).mode & 0o777, 0o700);
  assert.equal((await fs.stat(path.join(dir, '2026-09-27.json'))).mode & 0o777, 0o600);
});

test('practice rejects invalid dates, non-30-minute and overlapping blocks', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'practice-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const service = createPracticeService(dir);
  await assert.rejects(() => service.save('bad', {}), /날짜/);
  await assert.rejects(() => service.save('2026-09-27', { timeStart: '09:00', timeEnd: '09:20', timeCategory: '학습', timeDescription: 'x' }), /30분/);
  await assert.rejects(() => service.save('2026-09-27', { timeStart: ['09:00','09:30'], timeEnd: ['10:00','10:30'], timeCategory: ['학습','업무'], timeDescription: ['a','b'] }), /겹치는/);
});
