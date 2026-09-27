import { readFileSync } from 'node:fs';

export function createUnifiedAuth(env = process.env) {
  const origin = new URL(env.AI_CHAT_INTERNAL_URL || 'http://127.0.0.1:3100');
  if (origin.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(origin.hostname) || origin.pathname !== '/' || origin.username || origin.password || origin.search || origin.hash) throw new Error('AI_CHAT_INTERNAL_URL must be a loopback HTTP origin');
  const secret = env.INTERNAL_API_SECRET || (env.INTERNAL_API_SECRET_FILE ? readFileSync(env.INTERNAL_API_SECRET_FILE, 'utf8').trim() : '');
  async function internal(path, cookie = '', options = {}) {
    if (secret.length < 64) throw new Error('Internal authentication is not configured');
    const headers = { Authorization: `Bearer ${secret}`, Cookie: cookie };
    if (options.body) headers['Content-Type'] = 'application/json';
    const response = await fetch(new URL(path, origin), {
      method: options.method || 'GET', headers,
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      redirect: 'error', signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error('Internal authentication unavailable');
    return response.json();
  }
  const portalCookie = (cookies) => Object.entries(cookies)
    .filter(([key]) => ['portal_session', '__Host-portal_session'].includes(key))
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('; ');
  return {
    internal,
    async attachUser(req, res, next) {
      try {
        const session = await internal('/internal/session', req.get('Cookie') || '');
        if (session.study && session.user && typeof session.user.id === 'string' && typeof session.user.name === 'string') {
          const id = session.user.id.trim().slice(0, 100);
          const name = session.user.name.trim().slice(0, 30);
          if (id && name) {
            req.portalUser = { id, name };
            res.locals.portalUser = req.portalUser;
          }
        }
      } catch { /* Public and share-link access remain available while login lookup is unavailable. */ }
      next();
    },
    async userFromCookies(cookies) {
      try {
        const session = await internal('/internal/session', portalCookie(cookies));
        if (!session.study || !session.user || typeof session.user.id !== 'string' || typeof session.user.name !== 'string') return null;
        const id = session.user.id.trim().slice(0, 100);
        const name = session.user.name.trim().slice(0, 30);
        return id && name ? { id, name } : null;
      } catch { return null; }
    },
  };
}
