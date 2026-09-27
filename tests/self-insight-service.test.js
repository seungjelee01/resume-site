import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createSelfInsightService } from '../server/self-insight-service.js';

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'self-insight-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return { directory, service: createSelfInsightService(directory) };
}

const experience = {
  title: '장애 원인 분석', category: '문제 해결', startDate: '2026-01-01', endDate: '2026-01-02',
  tags: 'Oracle, 문제 해결, Oracle', relatedFields: ['strengths', 'personality'],
  situation: '서비스 장애가 발생했다.', task: '원인을 찾아 복구해야 했다.', action: '로그와 지표를 분석했다.',
  result: '원인을 제거하고 서비스를 복구했다.', learning: '근거를 순서대로 확인하는 태도를 배웠다.',
};

test('profile supports optional fields and uses private atomic storage', async (t) => {
  const { directory, service } = await fixture(t);
  assert.equal((await service.loadProfile()).strengths, '');
  const saved = await service.saveProfile({ oneLineIntro: ' 데이터베이스 문제를 구조적으로 해결합니다. ', strengths: '분석력' });
  assert.equal(saved.oneLineIntro, '데이터베이스 문제를 구조적으로 해결합니다.');
  assert.equal((await service.loadProfile()).strengths, '분석력');
  assert.equal((await fs.stat(directory)).mode & 0o777, 0o700);
  assert.equal((await fs.stat(path.join(directory, 'profile.json'))).mode & 0o777, 0o600);
});

test('experience CRUD normalizes tags and preserves STAR fields', async (t) => {
  const { directory, service } = await fixture(t);
  const created = await service.saveExperience(experience);
  assert.deepEqual(created.tags, ['Oracle', '문제 해결']);
  assert.deepEqual(created.relatedFields, ['strengths', 'personality']);
  assert.equal((await service.listExperiences()).length, 1);
  const updated = await service.saveExperience({ ...experience, title: '수정한 경험' }, created.id);
  assert.equal(updated.title, '수정한 경험');
  assert.equal(updated.createdAt, created.createdAt);
  assert.equal((await fs.stat(path.join(directory, 'experiences', `${created.id}.json`))).mode & 0o777, 0o600);
  await service.removeExperience(created.id);
  assert.equal(await service.loadExperience(created.id), null);
});

test('experience rejects invalid identifiers, dates, categories, tags and required STAR fields', async (t) => {
  const { service } = await fixture(t);
  await assert.rejects(() => service.loadExperience('../bad'), /주소/);
  await assert.rejects(() => service.loadExperience('------------------------------------'), /주소/);
  await assert.rejects(() => service.saveExperience({ ...experience, category: '잘못된 분류' }), /분류/);
  await assert.rejects(() => service.saveExperience({ ...experience, endDate: '2025-12-31' }), /기간/);
  await assert.rejects(() => service.saveExperience({ ...experience, tags: Array.from({ length: 11 }, (_, i) => `태그${i}`) }), /최대 10개/);
  await assert.rejects(() => service.saveExperience({ ...experience, relatedFields: ['strengths', 'invalid'] }), /연결 항목/);
  await assert.rejects(() => service.saveExperience({ ...experience, action: '' }), /행동/);
});
