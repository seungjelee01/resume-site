import { createRemoteJWKSet, jwtVerify } from 'jose';

export function createCloudflareAccess(env = process.env) {
  const teamDomainValue = String(env.CF_ACCESS_TEAM_DOMAIN || '').trim();
  const audience = String(env.CF_ACCESS_AUD || '').trim();
  let issuer;
  try {
    const url = new URL(teamDomainValue);
    const productionDomain = url.protocol === 'https:' && url.hostname.endsWith('.cloudflareaccess.com');
    const testDomain = env.NODE_ENV === 'test' && url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname);
    if ((!productionDomain && !testDomain) || url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error();
    issuer = url.origin;
  } catch { issuer = null; }
  const configured = Boolean(issuer && /^[A-Za-z0-9_-]{20,200}$/.test(audience));
  const jwks = configured ? createRemoteJWKSet(new URL('/cdn-cgi/access/certs', issuer)) : null;

  async function verify(token) {
    if (!configured || !jwks || typeof token !== 'string') throw new Error('Cloudflare Access authentication is not configured');
    const { payload } = await jwtVerify(token, jwks, { issuer, audience, algorithms: ['RS256'] });
    if (typeof payload.email !== 'string' || !payload.email.trim()) throw new Error('Cloudflare Access email claim is missing');
    return { email: payload.email.trim().toLowerCase() };
  }

  return { configured, verify };
}
