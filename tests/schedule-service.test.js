import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createScheduleService } from '../server/schedule-service.js';

test('schedule service creates, updates, lists and removes private study schedules', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'schedule-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const service = createScheduleService(directory);
  const first = await service.save({ title: 'Oracle 복습', date: '2026-10-13', startTime: '19:00', endTime: '20:30', category: 'Oracle', status: 'planned', notes: 'SGA 복습' });
  await service.save({ title: 'Python 복습', date: '2026-10-12', category: 'Python', status: 'completed' });
  assert.deepEqual((await service.list()).map((item) => item.title), ['Python 복습', 'Oracle 복습']);
  const updated = await service.save({ ...first, title: 'Oracle 메모리 복습', status: 'completed' }, first.id);
  assert.equal(updated.createdAt, first.createdAt);
  assert.equal((await service.load(first.id)).status, 'completed');
  assert.equal((await fs.stat(directory)).mode & 0o777, 0o700);
  assert.equal((await fs.stat(path.join(directory, `${first.id}.json`))).mode & 0o777, 0o600);
  assert.equal(await service.remove(first.id), true);
  assert.equal(await service.load(first.id), null);
});

test('schedule service rejects invalid fields and time ranges', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'schedule-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const service = createScheduleService(directory);
  const valid = { title: '학습', date: '2026-10-13', category: 'Oracle', status: 'planned' };
  await assert.rejects(() => service.save({ ...valid, date: '2026-02-30' }), /날짜/);
  await assert.rejects(() => service.save({ ...valid, startTime: '20:00' }), /시간/);
  await assert.rejects(() => service.save({ ...valid, startTime: '20:00', endTime: '19:00' }), /시간/);
  await assert.rejects(() => service.save({ ...valid, category: '잘못된 분야' }), /분야/);
  await assert.rejects(() => service.load('../invalid'), /주소/);
});
