import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const botPattern = /bot|crawler|spider|slurp|facebookexternalhit|preview|uptime|monitor|curl|wget/i;

function seoulDate(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
}

function recentDates(days) {
  const result = [];
  const now = new Date();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - offset);
    result.push(seoulDate(date));
  }
  return result;
}

export function createAnalyticsService({ directory, production }) {
  const dataFile = path.join(directory, 'analytics.json');
  const keyFile = path.join(directory, '.analytics-key');
  const activeVisitors = new Map();
  let writeQueue = Promise.resolve();
  let secret;

  async function ensureStorage() {
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    await fs.chmod(directory, 0o700);
    if (!secret) {
      try { secret = await fs.readFile(keyFile, 'utf8'); } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        secret = crypto.randomBytes(32).toString('base64url');
        await fs.writeFile(keyFile, secret, { encoding: 'utf8', mode: 0o600, flag: 'wx' }).catch(async (writeError) => {
          if (writeError.code !== 'EEXIST') throw writeError;
          secret = await fs.readFile(keyFile, 'utf8');
        });
      }
    }
  }

  async function load() {
    await ensureStorage();
    try {
      const parsed = JSON.parse(await fs.readFile(dataFile, 'utf8'));
      return parsed && typeof parsed.days === 'object' ? parsed : { days: {} };
    } catch (error) { if (error.code === 'ENOENT') return { days: {} }; throw error; }
  }

  async function save(data) {
    const temporary = path.join(directory, `.${crypto.randomUUID()}.tmp`);
    await fs.writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await fs.rename(temporary, dataFile);
  }

  function visitorHash(req, date) {
    const address = production ? req.get('Cf-Connecting-Ip') || req.ip : req.ip;
    const userAgent = req.get('User-Agent') || '';
    return crypto.createHmac('sha256', secret).update(`${date}\0${address}\0${userAgent}`).digest('base64url');
  }

  function countryCode(req) {
    const value = String(req.get('Cf-IpCountry') || '').trim().toUpperCase();
    return /^[A-Z]{2}$/.test(value) || value === 'T1' ? value : 'XX';
  }

  function track(req, page) {
    const userAgent = req.get('User-Agent') || '';
    if (botPattern.test(userAgent) || req.method !== 'GET') return Promise.resolve();
    const task = async () => {
      const data = await load();
      const date = seoulDate();
      const hash = visitorHash(req, date);
      const day = data.days[date] || { views: 0, uniqueVisitors: 0, visitors: [], posts: {}, countries: {} };
      day.views += 1;
      day.countries ||= {};
      if (!day.visitors.includes(hash)) {
        day.visitors.push(hash);
        const country = countryCode(req);
        day.countries[country] = (day.countries[country] || 0) + 1;
      }
      day.uniqueVisitors = day.visitors.length;
      if (page?.slug) {
        const post = day.posts[page.slug] || { title: page.title, views: 0 };
        post.title = page.title;
        post.views += 1;
        day.posts[page.slug] = post;
      }
      data.days[date] = day;
      const visitorRetention = new Set(recentDates(31));
      for (const [storedDate, storedDay] of Object.entries(data.days)) {
        if (!visitorRetention.has(storedDate)) delete storedDay.visitors;
      }
      activeVisitors.set(hash, Date.now());
      await save(data);
    };
    const result = writeQueue.then(task, task);
    writeQueue = result.catch(() => {});
    return result;
  }

  async function summary() {
    await writeQueue;
    const data = await load();
    const dates30 = recentDates(30);
    const aggregate = (dates) => dates.reduce((total, date) => {
      const day = data.days[date] || {};
      total.visitors += day.uniqueVisitors || 0;
      total.views += day.views || 0;
      return total;
    }, { visitors: 0, views: 0 });
    const posts = new Map();
    const countries = new Map();
    for (const date of dates30) {
      for (const [slug, post] of Object.entries(data.days[date]?.posts || {})) {
        const current = posts.get(slug) || { slug, title: post.title, views: 0 };
        current.views += post.views;
        current.title = post.title;
        posts.set(slug, current);
      }
      for (const [country, visitors] of Object.entries(data.days[date]?.countries || {})) {
        countries.set(country, (countries.get(country) || 0) + visitors);
      }
    }
    const activeCutoff = Date.now() - 5 * 60 * 1000;
    for (const [hash, lastSeen] of activeVisitors) if (lastSeen < activeCutoff) activeVisitors.delete(hash);
    return {
      today: aggregate(dates30.slice(-1)),
      sevenDays: aggregate(dates30.slice(-7)),
      thirtyDays: aggregate(dates30),
      activeVisitors: activeVisitors.size,
      daily: dates30.map((date) => ({ date, visitors: data.days[date]?.uniqueVisitors || 0, views: data.days[date]?.views || 0 })),
      popularPosts: [...posts.values()].sort((a, b) => b.views - a.views).slice(0, 10),
      countries: [...countries].map(([code, visitors]) => ({ code, visitors })).sort((a, b) => b.visitors - a.visitors),
    };
  }

  return { summary, track };
}
