import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';

const idPattern = /^[0-9a-f-]{36}$/i;

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
    visitorLabel: `방문자 #${conversation.id.slice(0, 4).toUpperCase()}`,
    messages: conversation.messages,
  };
}

export function createChatService({ directory, production, allowLocalAdmin, canAccessStudy, notify }) {
  const clients = new Map();
  const adminListClients = new Set();
  const pendingSessions = new Map();
  const writeQueues = new Map();
  const rateLimits = new Map();
  const sessionRateLimits = new Map();

  const filePath = (id) => path.join(directory, `${id}.json`);
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
  const normalize = (value) => {
    const content = String(value || '').trim();
    if (!content || content.length > 1000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(content)) throw new Error('메시지는 1~1000자로 입력하세요.');
    return content;
  };
  const broadcast = (id, payload) => {
    for (const socket of clients.get(id) || []) {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
    }
  };
  const roomSummary = (conversation) => ({
    id: conversation.id,
    visitorLabel: `방문자 #${conversation.id.slice(0, 4).toUpperCase()}`,
    preview: conversation.messages.at(-1)?.content || '아직 메시지가 없습니다.',
    updatedAt: conversation.updatedAt,
    unread: conversation.unread || 0,
    ipMasked: conversation.ipMasked,
  });
  const broadcastRoom = (conversation) => {
    const payload = JSON.stringify({ type: 'room', room: roomSummary(conversation) });
    for (const socket of adminListClients) if (socket.readyState === WebSocket.OPEN) socket.send(payload);
  };

  async function session(req, res) {
    let conversation = await authenticate(req.get('Cookie'));
    if (!conversation) {
      const address = production ? req.get('Cf-Connecting-Ip') || req.ip : req.ip;
      const nowTime = Date.now();
      if (sessionRateLimits.size > 1000) {
        for (const [candidate, times] of sessionRateLimits) if (!times.some((time) => nowTime - time < 10 * 60 * 1000)) sessionRateLimits.delete(candidate);
      }
      for (const [id, pending] of pendingSessions) {
        if (nowTime - new Date(pending.createdAt).getTime() > 30 * 60 * 1000) pendingSessions.delete(id);
      }
      if (pendingSessions.size >= 1000) return res.status(503).json({ error: '현재 새 문의를 시작할 수 없습니다.' });
      const recentSessions = (sessionRateLimits.get(address) || []).filter((time) => nowTime - time < 10 * 60 * 1000);
      if (recentSessions.length >= 5) return res.status(429).json({ error: '잠시 후 다시 시도하세요.' });
      recentSessions.push(nowTime);
      sessionRateLimits.set(address, recentSessions);
      const id = crypto.randomUUID();
      const token = crypto.randomBytes(32).toString('base64url');
      const now = new Date().toISOString();
      conversation = {
        id,
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
    await fs.mkdir(directory, { recursive: true });
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
    try {
      await fs.rm(filePath(id));
      const payload = JSON.stringify({ type: 'room-deleted', id });
      for (const socket of adminListClients) if (socket.readyState === WebSocket.OPEN) socket.send(payload);
      return true;
    } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  }

  function attach(server) {
    const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 4096 });
    server.on('upgrade', async (request, socket, head) => {
      try {
        const url = new URL(request.url, `http://${request.headers.host}`);
        if (!['/study/ws/chat', '/admin/ws/chat', '/admin/ws/chat-list'].includes(url.pathname)) return socket.destroy();
        const origin = new URL(request.headers.origin || 'invalid:');
        if (origin.host !== request.headers.host) return socket.destroy();
        const isAdminList = url.pathname === '/admin/ws/chat-list';
        const isAdmin = url.pathname.startsWith('/admin/ws/');
        let conversation;
        if (isAdmin) {
          const isLocal = ['127.0.0.1', '::1'].includes(request.socket.remoteAddress);
          if (!request.headers['cf-access-authenticated-user-email'] && !(allowLocalAdmin && isLocal)) return socket.destroy();
          if (!isAdminList) conversation = await get(url.searchParams.get('conversation'));
        } else {
          if (!(await canAccessStudy(parseCookies(request.headers.cookie)))) return socket.destroy();
          conversation = await authenticate(request.headers.cookie);
        }
        if (!isAdminList && !conversation) return socket.destroy();
        webSocketServer.handleUpgrade(request, socket, head, (webSocket) => webSocketServer.emit('connection', webSocket, { conversation, isAdmin, isAdminList }));
      } catch { socket.destroy(); }
    });
    webSocketServer.on('connection', async (socket, { conversation, isAdmin, isAdminList }) => {
      if (isAdminList) {
        adminListClients.add(socket);
        socket.on('close', () => adminListClients.delete(socket));
        return;
      }
      const id = conversation.id;
      if (!clients.has(id)) clients.set(id, new Set());
      clients.get(id).add(socket);
      socket.isAdmin = isAdmin;
      if (isAdmin && conversation.unread) await update(id, async () => { const current = await load(id); current.unread = 0; await save(current); broadcastRoom(current); });
      socket.send(JSON.stringify({ type: 'ready', ...publicConversation(await loadAvailable(id)) }));
      socket.on('message', async (data) => {
        try {
          const input = JSON.parse(data.toString());
          if (input.type !== 'message') return;
          enforceRate(`${id}:${isAdmin ? 'admin' : 'visitor'}`);
          const message = { id: crypto.randomUUID(), sender: isAdmin ? 'admin' : 'visitor', content: normalize(input.content), createdAt: new Date().toISOString() };
          const saved = await update(id, async () => {
            const current = await loadAvailable(id);
            if (!current) throw new Error('문의 세션이 만료되었습니다. 채팅창을 다시 열어 주세요.');
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

  return { attach, get, list, remove, session };
}
