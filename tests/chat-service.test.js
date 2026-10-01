import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createChatService } from '../server/chat-service.js';

const limits = {
  maxMessages: 100,
  maxRooms: 100,
  retentionDays: 90,
  maxConnections: 100,
  maxVisitorConnectionsPerRoom: 3,
};

function response() {
  const result = { body: null, cookies: [] };
  return {
    result,
    cookie: (...args) => result.cookies.push(args),
    setHeader: () => {},
    json: (body) => { result.body = body; },
  };
}

test('an existing account inquiry takes priority over a newer empty pending session', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'resume-chat-'));
  const account = { id: 'user-1', name: 'Visitor' };
  const existing = {
    id: '11111111-1111-4111-8111-111111111111',
    visitorName: account.name,
    tokenHash: 'legacy-token',
    ipMasked: '127.0.0.*',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    unread: 0,
    messages: [{ id: '22222222-2222-4222-8222-222222222222', sender: 'admin', content: 'saved reply', createdAt: '2026-09-01T00:00:00.000Z' }],
  };
  const file = path.join(directory, `${existing.id}.json`);
  await fs.writeFile(file, JSON.stringify(existing));
  const service = createChatService({
    directory,
    production: false,
    allowLocalAdmin: true,
    verifyAdmin: async () => {},
    canAccessStudy: async () => true,
    getPortalUser: async () => account,
    notify: () => {},
    limits,
  });

  const first = response();
  await service.session({ get: () => '', portalUser: account, ip: '127.0.0.1' }, first);
  assert.equal(first.result.body.messages.length, 0);

  existing.portalUserId = account.id;
  await fs.writeFile(file, JSON.stringify(existing));

  const second = response();
  await service.session({ get: () => '', portalUser: account, ip: '127.0.0.1' }, second);
  assert.equal(second.result.body.id, existing.id);
  assert.equal(second.result.body.messages.length, 1);

  await fs.rm(directory, { recursive: true, force: true });
});


test('admin can upload and download a disk image in ordered chunks', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'resume-chat-file-'));
  const conversation = {
    id: '33333333-3333-4333-8333-333333333333',
    tokenHash: 'token', ipMasked: '127.0.0.*', createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(), unread: 0,
    messages: [{ id: '44444444-4444-4444-8444-444444444444', sender: 'visitor', content: 'send image', createdAt: new Date().toISOString() }],
  };
  await fs.writeFile(path.join(directory, `${conversation.id}.json`), JSON.stringify(conversation));
  const service = createChatService({
    directory, production: false, allowLocalAdmin: true, verifyAdmin: async () => {},
    canAccessStudy: async () => true, getPortalUser: async () => null, notify: () => {}, limits,
  });

  const maximum = await service.beginAdminUpload(conversation.id, { name: 'maximum-size.img', size: 5 * 1024 * 1024 * 1024 });
  await service.cancelAdminUpload(conversation.id, maximum.uploadId);
  await assert.rejects(() => service.beginAdminUpload(conversation.id, { name: 'too-large.img', size: 5 * 1024 * 1024 * 1024 + 1 }), /5GB/);

  const upload = await service.beginAdminUpload(conversation.id, { name: 'database-disk.iso', size: 9 });
  assert.equal(upload.received, 0);
  assert.deepEqual(await service.appendAdminUploadChunk(conversation.id, upload.uploadId, 0, Buffer.from('disk')), { received: 4, size: 9 });
  assert.deepEqual(await service.appendAdminUploadChunk(conversation.id, upload.uploadId, 4, Buffer.from('image')), { received: 9, size: 9 });
  const message = await service.completeAdminUpload(conversation.id, upload.uploadId);
  assert.equal(message.attachment.name, 'database-disk.iso');
  assert.equal(message.attachment.size, 9);
  const downloaded = await service.getAttachment(conversation.id, message.id);
  assert.equal(await fs.readFile(downloaded.path, 'utf8'), 'diskimage');
  assert.equal(downloaded.name, 'database-disk.iso');

  await fs.rm(directory, { recursive: true, force: true });
});
