import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';

const idPattern = /^[0-9a-f-]{36}$/i;
const visitorMessageMaxLength = 1000;
const adminMessageMaxLength = 5000;
const adminTextFileMaxSize = 2 * 1024 * 1024;
const visitorZipFileMaxSize = 2 * 1024 * 1024 * 1024;
const visitorZipChunkMaxSize = 8 * 1024 * 1024;
const visitorZipFileNamePattern = /^[\p{L}\p{N}][\p{L}\p{N} ._()-]{0,179}\.zip$/iu;
const textFileNamePattern = /^[\p{L}\p{N}][\p{L}\p{N} ._()-]{0,179}\.txt$/iu;
const visitorLabel = (conversation) => conversation.visitorName || `방문자 #${conversation.id.slice(0, 4).toUpperCase()}`;

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => part.trim().split('=').map(decodeURIComponent)).filter(([key, value]) => key && value));
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function safeEqual(left, right) {
  if (!left || !right) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function publicConversation(conversation) {
  return {
    id: conversation.id,
    visitorLabel: visitorLabel(conversation),
    messages: conversation.messages,
  };
}

export function createChatService({ directory, production, allowLocalAdmin, verifyAdmin, canAccessStudy, notify, limits }) {
  const clients = new Map();
  const adminListClients = new Set();
  const pendingSessions = new Map();
  const writeQueues = new Map();
  const rateLimits = new Map();
  const sessionRateLimits = new Map();
  const visitorUploads = new Map();
  let lastRetentionCleanup = 0;

  const filePath = (id) => path.join(directory, `${id}.json`);
  const attachmentDirectory = (id) => path.join(directory, `${id}.files`);
  const attachmentPath = (id, messageId, attachment) => {
    const extension = path.extname(attachment?.name || '').toLowerCase() === '.zip' ? '.zip' : '.txt';
    return path.join(attachmentDirectory(id), `${messageId}${extension}`);
  };
  const uploadPath = (id, uploadId) => path.join(attachmentDirectory(id), `.${uploadId}.upload`);
  const purgeStaleUploads = async () => {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    await Promise.all([...visitorUploads.entries()].map(async ([uploadId, upload]) => {
      if (upload.updatedAt >= cutoff) return;
      visitorUploads.delete(uploadId);
      await fs.rm(uploadPath(upload.conversationId, uploadId), { force: true });
    }));
  };
  const load = async (id) => JSON.parse(await fs.readFile(filePath(id), 'utf8'));
  const save = async (conversation) => {
    await fs.mkdir(directory, { recursive: true });
    const temporary = path.join(directory, `.${crypto.randomUUID()}.tmp`);
    await fs.writeFile(temporary, `${JSON.stringify(conversation, null, 2)}\n`, { encoding: 'utf8', mode: 0o640 });
    await fs.rename(temporary, filePath(conversation.id));
  };
  const update = (id, task) => {
    const previous = writeQueues.get(id) || Promise.resolve();
    const result = previous.then(task, task);
    writeQueues.set(id, result.catch(() => {}));
    return result;
  };
  const loadAvailable = async (id) => {
    try { return await load(id); } catch (error) { if (error.code === 'ENOENT') return pendingSessions.get(id) || null; throw error; }
  };
  const authenticate = async (cookieHeader) => {
    const value = parseCookies(cookieHeader).tech_chat || '';
    const separator = value.indexOf('.');
    if (separator < 1) return null;
    const id = value.slice(0, separator);
    const token = value.slice(separator + 1);
    if (!idPattern.test(id) || !token) return null;
    try { const conversation = await loadAvailable(id); return conversation && safeEqual(tokenHash(token), conversation.tokenHash) ? conversation : null; } catch { return null; }
  };
  const maskIp = (value = '') => value.includes(':')
    ? `${value.split(':').slice(0, 3).join(':')}::/48`
    : value.split('.').length === 4 ? `${value.split('.').slice(0, 3).join('.')}.*` : 'unknown';
  const enforceRate = (key) => {
    const now = Date.now();
    if (rateLimits.size > 1000) {
      for (const [candidate, times] of rateLimits) if (!times.some((time) => now - time < 10 * 60 * 1000)) rateLimits.delete(candidate);
    }
    const recent = (rateLimits.get(key) || []).filter((time) => now - time < 10 * 60 * 1000);
    if (recent.length >= 20) throw new Error('메시지는 10분에 20개까지 보낼 수 있습니다.');
    recent.push(now);
    rateLimits.set(key, recent);
  };
  const normalize = (value, maxLength) => {
    const content = String(value || '').trim();
    if (!content || content.length > maxLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(content)) throw new Error(`메시지는 1~${maxLength.toLocaleString('ko-KR')}자로 입력하세요.`);
    return content;
  };
  const broadcast = (id, payload) => {
    for (const socket of clients.get(id) || []) {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
    }
  };
  const roomSummary = (conversation) => ({
    id: conversation.id,
    visitorLabel: visitorLabel(conversation),
    preview: conversation.messages.at(-1)?.content || '아직 메시지가 없습니다.',
    lastSender: conversation.messages.at(-1)?.sender || '',
    updatedAt: conversation.updatedAt,
    unread: conversation.unread || 0,
    ipMasked: conversation.ipMasked,
  });
  const broadcastRoom = (conversation) => {
    const payload = JSON.stringify({ type: 'room', room: roomSummary(conversation) });
    for (const socket of adminListClients) if (socket.readyState === WebSocket.OPEN) socket.send(payload);
  };
  const cleanupExpired = async () => {
    const now = Date.now();
    if (now - lastRetentionCleanup < 60 * 60 * 1000) return;
    lastRetentionCleanup = now;
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    await fs.chmod(directory, 0o700);
    const cutoff = now - limits.retentionDays * 24 * 60 * 60 * 1000;
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json') && idPattern.test(entry.name.slice(0, -5))).map((entry) => entry.name);
    const uploadCutoff = now - 2 * 60 * 60 * 1000;
    await Promise.all(entries.filter((entry) => entry.isDirectory() && entry.name.endsWith('.files')).map(async (entry) => {
      const uploadDirectory = path.join(directory, entry.name);
      const names = await fs.readdir(uploadDirectory);
      await Promise.all(names.filter((name) => name.startsWith('.') && name.endsWith('.upload')).map(async (name) => {
        const target = path.join(uploadDirectory, name);
        const stats = await fs.stat(target);
        if (stats.mtimeMs < uploadCutoff) await fs.rm(target, { force: true });
      }));
    }));
    await Promise.all(files.map(async (name) => {
      const id = name.slice(0, -5);
      try {
        const conversation = await load(id);
        if (new Date(conversation.updatedAt).getTime() >= cutoff) return;
        for (const socket of clients.get(id) || []) socket.close(1008, 'conversation expired');
        clients.delete(id);
        await fs.rm(filePath(id));
        await fs.rm(attachmentDirectory(id), { recursive: true, force: true });
        const payload = JSON.stringify({ type: 'room-deleted', id });
        for (const socket of adminListClients) if (socket.readyState === WebSocket.OPEN) socket.send(payload);
      } catch (error) { if (error.code !== 'ENOENT') console.error('Chat retention cleanup failed:', error.message); }
    }));
  };

  async function session(req, res) {
    await cleanupExpired();
    let conversation = await authenticate(req.get('Cookie'));
    if (conversation && req.portalUser?.name && conversation.visitorName !== req.portalUser.name) {
      conversation.visitorName = req.portalUser.name;
      if (pendingSessions.has(conversation.id)) pendingSessions.set(conversation.id, conversation);
      else await save(conversation);
    }
    if (!conversation) {
      const address = production ? req.get('Cf-Connecting-Ip') || req.ip : req.ip;
      const nowTime = Date.now();
      if (sessionRateLimits.size > 1000) {
        for (const [candidate, times] of sessionRateLimits) if (!times.some((time) => nowTime - time < 10 * 60 * 1000)) sessionRateLimits.delete(candidate);
      }
      for (const [id, pending] of pendingSessions) {
        if (nowTime - new Date(pending.createdAt).getTime() > 30 * 60 * 1000) pendingSessions.delete(id);
      }
      if (pendingSessions.size >= limits.maxRooms) return res.status(503).json({ error: '현재 새 문의를 시작할 수 없습니다.' });
      const storedRooms = (await fs.readdir(directory)).filter((name) => name.endsWith('.json') && idPattern.test(name.slice(0, -5))).length;
      if (storedRooms + pendingSessions.size >= limits.maxRooms) return res.status(503).json({ error: '현재 새 문의를 시작할 수 없습니다.' });
      const recentSessions = (sessionRateLimits.get(address) || []).filter((time) => nowTime - time < 10 * 60 * 1000);
      if (recentSessions.length >= 5) return res.status(429).json({ error: '잠시 후 다시 시도하세요.' });
      recentSessions.push(nowTime);
      sessionRateLimits.set(address, recentSessions);
      const id = crypto.randomUUID();
      const token = crypto.randomBytes(32).toString('base64url');
      const now = new Date().toISOString();
      conversation = {
        id,
        ...(req.portalUser?.name ? { visitorName: req.portalUser.name } : {}),
        tokenHash: tokenHash(token),
        ipMasked: maskIp(address),
        createdAt: now,
        updatedAt: now,
        unread: 0,
        messages: [],
      };
      pendingSessions.set(id, conversation);
      res.cookie('tech_chat', `${id}.${token}`, { httpOnly: true, secure: production, sameSite: 'strict', path: '/study', maxAge: 30 * 24 * 60 * 60 * 1000 });
    }
    res.setHeader('Cache-Control', 'private, no-store');
    res.json(publicConversation(conversation));
  }

  async function list() {
    await cleanupExpired();
    const files = (await fs.readdir(directory)).filter((name) => idPattern.test(name.slice(0, -5)) && name.endsWith('.json'));
    const conversations = await Promise.all(files.map(async (name) => load(name.slice(0, -5))));
    return conversations.filter((conversation) => conversation.messages.length > 0).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async function get(id) {
    if (!idPattern.test(id)) return null;
    try { const conversation = await load(id); return conversation.messages.length ? conversation : null; } catch { return null; }
  }

  async function remove(id) {
    if (!idPattern.test(id)) return false;
    for (const socket of clients.get(id) || []) socket.close(1008, 'conversation deleted');
    clients.delete(id);
    for (const [uploadId, upload] of visitorUploads) if (upload.conversationId === id) visitorUploads.delete(uploadId);
    try {
      await fs.rm(filePath(id));
      await fs.rm(attachmentDirectory(id), { recursive: true, force: true });
      const payload = JSON.stringify({ type: 'room-deleted', id });
      for (const socket of adminListClients) if (socket.readyState === WebSocket.OPEN) socket.send(payload);
      return true;
    } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  }

  async function sendAdminFile(id, file) {
    if (!idPattern.test(id)) return null;
    const name = String(file?.originalname || '').normalize('NFC');
    const buffer = file?.buffer;
    if (!textFileNamePattern.test(name) || !Buffer.isBuffer(buffer) || !buffer.length || buffer.length > adminTextFileMaxSize) {
      throw new Error('2MB 이하의 .txt 파일만 전송할 수 있습니다.');
    }
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); } catch { throw new Error('UTF-8로 저장된 텍스트 파일만 전송할 수 있습니다.'); }
    if (/\u0000|[\u0001-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) throw new Error('텍스트 파일 내용을 확인해 주세요.');
    enforceRate(`${id}:admin`);
    const message = {
      id: crypto.randomUUID(),
      sender: 'admin',
      content: `파일: ${name}`,
      attachment: { name, size: buffer.length },
      createdAt: new Date().toISOString(),
    };
    const saved = await update(id, async () => {
      const current = await load(id);
      if (current.messages.length >= limits.maxMessages) throw new Error(`한 문의에서는 메시지를 ${limits.maxMessages}개까지 보낼 수 있습니다.`);
      await fs.mkdir(attachmentDirectory(id), { recursive: true, mode: 0o700 });
      await fs.chmod(attachmentDirectory(id), 0o700);
      const target = attachmentPath(id, message.id, message.attachment);
      try {
        await fs.writeFile(target, buffer, { mode: 0o640, flag: 'wx' });
        current.messages.push(message);
        current.updatedAt = message.createdAt;
        await save(current);
      } catch (error) {
        await fs.rm(target, { force: true });
        throw error;
      }
      return current;
    });
    broadcast(id, { type: 'message', message });
    broadcastRoom(saved);
    return message;
  }

  async function getAttachment(id, messageId) {
    if (![id, messageId].every((value) => idPattern.test(String(value || '')))) return null;
    try {
      const conversation = await load(id);
      const message = conversation.messages.find((item) => item.id === messageId && item.attachment);
      if (!message) return null;
      await fs.access(attachmentPath(id, messageId, message.attachment));
      return { path: attachmentPath(id, messageId, message.attachment), name: message.attachment.name };
    } catch { return null; }
  }

  async function getVisitorAttachment(cookieHeader, id, messageId) {
    const conversation = await authenticate(cookieHeader);
    if (!conversation || conversation.id !== id) return null;
    return getAttachment(id, messageId);
  }

  async function beginVisitorUpload(cookieHeader, input) {
    await purgeStaleUploads();
    const conversation = await authenticate(cookieHeader);
    if (!conversation) throw new Error('문의 세션이 만료되었습니다. 채팅창을 다시 열어 주세요.');
    const name = String(input?.name || '').normalize('NFC');
    const size = Number(input?.size);
    if (!visitorZipFileNamePattern.test(name) || !Number.isSafeInteger(size) || size < 1 || size > visitorZipFileMaxSize) throw new Error('2GB 이하의 .zip 파일만 전송할 수 있습니다.');
    if (conversation.messages.filter((message) => message.sender === 'visitor' && message.attachment?.name?.toLowerCase().endsWith('.zip')).length >= 2) throw new Error('한 문의에서는 ZIP 파일을 두 개까지 전송할 수 있습니다.');
    if ([...visitorUploads.values()].some((upload) => upload.conversationId === conversation.id)) throw new Error('이미 전송 중인 파일이 있습니다.');
    if (visitorUploads.size >= 3) throw new Error('다른 파일을 처리 중입니다. 잠시 후 다시 시도하세요.');
    const disk = await fs.statfs(directory);
    if (Number(disk.bavail) * Number(disk.bsize) < size + 2 * 1024 * 1024 * 1024) throw new Error('서버 저장 공간이 부족합니다. 관리자에게 문의해 주세요.');
    enforceRate(`${conversation.id}:visitor`);
    const uploadId = crypto.randomUUID();
    await fs.mkdir(attachmentDirectory(conversation.id), { recursive: true, mode: 0o700 });
    await fs.chmod(attachmentDirectory(conversation.id), 0o700);
    await fs.writeFile(uploadPath(conversation.id, uploadId), Buffer.alloc(0), { mode: 0o640, flag: 'wx' });
    visitorUploads.set(uploadId, { conversationId: conversation.id, name, size, received: 0, updatedAt: Date.now() });
    return { uploadId, chunkSize: visitorZipChunkMaxSize };
  }

  async function appendVisitorUpload(cookieHeader, uploadId, offset, buffer) {
    const conversation = await authenticate(cookieHeader);
    const upload = visitorUploads.get(uploadId);
    if (!conversation || !upload || upload.conversationId !== conversation.id) throw new Error('업로드 세션을 찾을 수 없습니다.');
    if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > visitorZipChunkMaxSize) throw new Error('파일 조각의 크기가 올바르지 않습니다.');
    if (!Number.isSafeInteger(offset) || offset < 0 || offset + buffer.length > upload.size) throw new Error('파일 전송 순서가 올바르지 않습니다.');
    if (offset < upload.received && offset + buffer.length <= upload.received) return { received: upload.received, size: upload.size };
    if (offset !== upload.received) throw new Error('파일 전송 순서가 올바르지 않습니다.');
    if (offset === 0 && !['504b0304', '504b0506', '504b0708'].includes(buffer.subarray(0, 4).toString('hex'))) throw new Error('올바른 ZIP 파일이 아닙니다.');
    await fs.appendFile(uploadPath(conversation.id, uploadId), buffer);
    upload.received += buffer.length;
    upload.updatedAt = Date.now();
    return { received: upload.received, size: upload.size };
  }

  async function completeVisitorUpload(cookieHeader, uploadId) {
    const conversation = await authenticate(cookieHeader);
    const upload = visitorUploads.get(uploadId);
    if (!conversation || !upload || upload.conversationId !== conversation.id) throw new Error('업로드 세션을 찾을 수 없습니다.');
    if (upload.received !== upload.size) throw new Error('파일 전송이 완료되지 않았습니다.');
    const message = { id: crypto.randomUUID(), sender: 'visitor', content: `파일: ${upload.name}`, attachment: { name: upload.name, size: upload.size }, createdAt: new Date().toISOString() };
    const finalPath = attachmentPath(conversation.id, message.id, message.attachment);
    let saved;
    try {
      saved = await update(conversation.id, async () => {
        const current = await loadAvailable(conversation.id);
        if (!current) throw new Error('문의 세션이 만료되었습니다.');
        if (current.messages.length >= limits.maxMessages) throw new Error(`한 문의에서는 메시지를 ${limits.maxMessages}개까지 보낼 수 있습니다.`);
        await fs.rename(uploadPath(conversation.id, uploadId), finalPath);
        current.messages.push(message);
        current.updatedAt = message.createdAt;
        const adminIsViewing = [...(clients.get(conversation.id) || [])].some((client) => client.isAdmin && client.readyState === WebSocket.OPEN);
        if (!adminIsViewing) current.unread = (current.unread || 0) + 1;
        await save(current);
        pendingSessions.delete(conversation.id);
        return current;
      });
    } catch (error) {
      visitorUploads.delete(uploadId);
      await fs.rm(uploadPath(conversation.id, uploadId), { force: true });
      await fs.rm(finalPath, { force: true });
      throw error;
    }
    visitorUploads.delete(uploadId);
    broadcast(conversation.id, { type: 'message', message });
    broadcastRoom(saved);
    notify(saved, message);
    return message;
  }

  async function abortVisitorUpload(cookieHeader, uploadId) {
    const conversation = await authenticate(cookieHeader);
    const upload = visitorUploads.get(uploadId);
    if (!conversation || !upload || upload.conversationId !== conversation.id) return false;
    visitorUploads.delete(uploadId);
    await fs.rm(uploadPath(conversation.id, uploadId), { force: true });
    return true;
  }

  function attach(server) {
    const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 32 * 1024 });
    server.on('upgrade', async (request, socket, head) => {
      try {
        const url = new URL(request.url, `http://${request.headers.host}`);
        if (!['/study/ws/chat', '/admin/ws/chat', '/admin/ws/chat-list'].includes(url.pathname)) return socket.destroy();
        const origin = new URL(request.headers.origin || 'invalid:');
        if (origin.host !== request.headers.host) return socket.destroy();
        if (webSocketServer.clients.size >= limits.maxConnections) return socket.destroy();
        const isAdminList = url.pathname === '/admin/ws/chat-list';
        const isAdmin = url.pathname.startsWith('/admin/ws/');
        let conversation;
        if (isAdmin) {
          const isLocal = ['127.0.0.1', '::1'].includes(request.socket.remoteAddress);
          if (!(allowLocalAdmin && isLocal && !request.headers['cf-access-jwt-assertion'])) {
            await verifyAdmin(request.headers['cf-access-jwt-assertion']);
          }
          if (!isAdminList) conversation = await get(url.searchParams.get('conversation'));
        } else {
          if (!(await canAccessStudy(parseCookies(request.headers.cookie)))) return socket.destroy();
          conversation = await authenticate(request.headers.cookie);
        }
        if (!isAdminList && !conversation) return socket.destroy();
        webSocketServer.handleUpgrade(request, socket, head, (webSocket) => webSocketServer.emit('connection', webSocket, { conversation, isAdmin, isAdminList, cookies: parseCookies(request.headers.cookie) }));
      } catch { socket.destroy(); }
    });
    webSocketServer.on('connection', async (socket, { conversation, isAdmin, isAdminList, cookies }) => {
      if (isAdminList) {
        adminListClients.add(socket);
        socket.send(JSON.stringify({ type: 'rooms', rooms: (await list()).map(roomSummary) }));
        socket.on('close', () => adminListClients.delete(socket));
        return;
      }
      const id = conversation.id;
      if (!isAdmin && [...(clients.get(id) || [])].filter((client) => !client.isAdmin).length >= limits.maxVisitorConnectionsPerRoom) {
        socket.close(1013, 'too many connections');
        return;
      }
      if (!clients.has(id)) clients.set(id, new Set());
      clients.get(id).add(socket);
      socket.isAdmin = isAdmin;
      if (isAdmin && conversation.unread) await update(id, async () => { const current = await load(id); current.unread = 0; await save(current); broadcastRoom(current); });
      socket.send(JSON.stringify({ type: 'ready', ...publicConversation(await loadAvailable(id)) }));
      socket.on('message', async (data) => {
        try {
          const input = JSON.parse(data.toString());
          if (input.type === 'delete-message') {
            if (!isAdmin || !idPattern.test(String(input.messageId || ''))) throw new Error('삭제할 수 없는 메시지입니다.');
            const saved = await update(id, async () => {
              const current = await loadAvailable(id);
              if (!current) throw new Error('문의 세션을 찾을 수 없습니다.');
              const index = current.messages.findIndex((message) => message.id === input.messageId && (message.sender === 'admin' || message.attachment));
              if (index < 0) throw new Error('삭제할 수 없는 메시지입니다.');
              const [removed] = current.messages.splice(index, 1);
              current.updatedAt = current.messages.at(-1)?.createdAt || current.createdAt;
              await save(current);
              if (removed.attachment) await fs.rm(attachmentPath(id, removed.id, removed.attachment), { force: true });
              return current;
            });
            broadcast(id, { type: 'message-deleted', messageId: input.messageId });
            broadcastRoom(saved);
            return;
          }
          if (input.type !== 'message') return;
          if (!isAdmin && !(await canAccessStudy(cookies))) return socket.close(1008, 'login required');
          enforceRate(`${id}:${isAdmin ? 'admin' : 'visitor'}`);
          const maxLength = isAdmin ? adminMessageMaxLength : visitorMessageMaxLength;
          const message = { id: crypto.randomUUID(), sender: isAdmin ? 'admin' : 'visitor', content: normalize(input.content, maxLength), createdAt: new Date().toISOString() };
          const saved = await update(id, async () => {
            const current = await loadAvailable(id);
            if (!current) throw new Error('문의 세션이 만료되었습니다. 채팅창을 다시 열어 주세요.');
            if (current.messages.length >= limits.maxMessages) throw new Error(`한 문의에서는 메시지를 ${limits.maxMessages}개까지 보낼 수 있습니다.`);
            current.messages.push(message);
            current.updatedAt = message.createdAt;
            const adminIsViewing = [...(clients.get(id) || [])].some((client) => client.isAdmin && client.readyState === WebSocket.OPEN);
            if (!isAdmin && !adminIsViewing) current.unread = (current.unread || 0) + 1;
            await save(current);
            pendingSessions.delete(id);
            return current;
          });
          broadcast(id, { type: 'message', message });
          broadcastRoom(saved);
          if (!isAdmin) notify(saved, message);
        } catch (error) { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'error', message: error.message })); }
      });
      socket.on('close', () => { clients.get(id)?.delete(socket); if (!clients.get(id)?.size) clients.delete(id); });
    });
  }

  return { abortVisitorUpload, appendVisitorUpload, attach, beginVisitorUpload, completeVisitorUpload, get, getAttachment, getVisitorAttachment, list, remove, sendAdminFile, session };
}
