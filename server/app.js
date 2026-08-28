import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import matter from 'gray-matter';
import { marked } from 'marked';
import multer from 'multer';
import sanitizeHtml from 'sanitize-html';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const postsDir = process.env.STUDY_DIR ? path.resolve(process.env.STUDY_DIR) : path.join(rootDir, '_study');
const studyFilesDir = process.env.STUDY_FILES_DIR
  ? path.resolve(process.env.STUDY_FILES_DIR)
  : process.env.STUDY_DIR
    ? path.join(path.dirname(postsDir), 'study-files')
    : path.join(rootDir, '_study_files');
const privateFilesDir = process.env.PRIVATE_FILES_DIR
  ? path.resolve(process.env.PRIVATE_FILES_DIR)
  : process.env.STUDY_DIR
    ? path.join(path.dirname(postsDir), 'private-files')
    : path.join(rootDir, '_private_files');
const siteSettingsFile = process.env.SITE_SETTINGS_FILE
  ? path.resolve(process.env.SITE_SETTINGS_FILE)
  : process.env.STUDY_DIR
    ? path.join(path.dirname(postsDir), 'site-settings.json')
    : path.join(rootDir, '_site_settings.json');
const commentsDir = process.env.COMMENTS_DIR
  ? path.resolve(process.env.COMMENTS_DIR)
  : process.env.STUDY_DIR
    ? path.join(path.dirname(postsDir), 'comments')
    : path.join(rootDir, '_comments');
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
const allowLocalAdmin = process.env.ALLOW_LOCAL_ADMIN === 'true';
const resumeShareToken = process.env.RESUME_SHARE_TOKEN || '';
const studyShareToken = process.env.STUDY_SHARE_TOKEN || '';
const defaultSiteSettings = Object.freeze({ studyAccess: studyShareToken ? 'shared' : 'public' });
let siteSettingsCache;
let commentWriteQueue = Promise.resolve();
const commentRateLimits = new Map();
const app = express();
const attachmentNamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:py|pdf|png|jpe?g|gif|webp)$/i;
const privateFileNamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:py|sql|pdf|png|jpe?g|gif|webp)$/i;
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, callback) => attachmentNamePattern.test(file.originalname)
    ? callback(null, true)
    : callback(new Error('지원하는 Python, PDF 또는 이미지 파일만 업로드할 수 있습니다.')),
});
const privateFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, callback) => privateFileNamePattern.test(file.originalname)
    ? callback(null, true)
    : callback(new Error('지원하는 Python, SQL, PDF 또는 이미지 파일만 업로드할 수 있습니다.')),
});

marked.setOptions({ gfm: true, breaks: false });

app.disable('x-powered-by');
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

function cookieValue(req, name) {
  const cookie = req.get('Cookie') || '';
  const item = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!item) return '';
  try { return decodeURIComponent(item.slice(name.length + 1)); } catch { return ''; }
}

function tokensMatch(candidate, expected) {
  if (!candidate || !expected) return false;
  const left = Buffer.from(String(candidate));
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function setShareCookie(res, name, value, cookiePath) {
  res.cookie(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: cookiePath,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

async function loadSiteSettings() {
  if (siteSettingsCache) return siteSettingsCache;
  try {
    const parsed = JSON.parse(await fs.readFile(siteSettingsFile, 'utf8'));
    siteSettingsCache = {
      studyAccess: ['shared', 'public'].includes(parsed.studyAccess)
        ? parsed.studyAccess
        : defaultSiteSettings.studyAccess,
    };
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
    siteSettingsCache = { ...defaultSiteSettings };
  }
  return siteSettingsCache;
}

async function saveSiteSettings(settings) {
  await fs.mkdir(path.dirname(siteSettingsFile), { recursive: true });
  const temporaryFile = path.join(path.dirname(siteSettingsFile), `.${crypto.randomUUID()}.tmp`);
  await fs.writeFile(temporaryFile, `${JSON.stringify(settings, null, 2)}\n`, { encoding: 'utf8', mode: 0o640 });
  await fs.rename(temporaryFile, siteSettingsFile);
  siteSettingsCache = settings;
}

function commentFilePath(slug) {
  if (!validateSlug(slug)) throw new Error('댓글의 글 주소를 확인하세요.');
  return path.join(commentsDir, `${slug}.json`);
}

async function loadComments(slug) {
  try {
    const parsed = JSON.parse(await fs.readFile(commentFilePath(slug), 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function saveComments(slug, comments) {
  await fs.mkdir(commentsDir, { recursive: true });
  const target = commentFilePath(slug);
  const temporaryFile = path.join(commentsDir, `.${crypto.randomUUID()}.tmp`);
  await fs.writeFile(temporaryFile, `${JSON.stringify(comments, null, 2)}\n`, { encoding: 'utf8', mode: 0o640 });
  await fs.rename(temporaryFile, target);
}

async function loadAllComments(posts) {
  const groups = await Promise.all(posts.map(async (post) => ({ post, comments: await loadComments(post.slug) })));
  return groups.flatMap(({ post, comments }) => comments.map((comment) => ({ ...comment, postSlug: post.slug, postTitle: post.title })))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function updateComments(task) {
  const result = commentWriteQueue.then(task, task);
  commentWriteQueue = result.catch(() => {});
  return result;
}

function normalizeCommentText(value, label, maximumLength) {
  const text = String(value || '').trim();
  if (!text || text.length > maximumLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) {
    throw new Error(`${label}을(를) 확인하세요.`);
  }
  return text;
}

function enforceCommentRateLimit(req) {
  const address = process.env.NODE_ENV === 'production'
    ? req.get('Cf-Connecting-Ip') || req.ip
    : req.ip;
  const now = Date.now();
  if (commentRateLimits.size > 500) {
    for (const [key, times] of commentRateLimits) {
      if (!times.some((time) => now - time < 10 * 60 * 1000)) commentRateLimits.delete(key);
    }
  }
  const recent = (commentRateLimits.get(address) || []).filter((time) => now - time < 10 * 60 * 1000);
  if (recent.length >= 20) throw new Error('댓글은 10분에 20개까지 작성할 수 있습니다. 잠시 후 다시 시도하세요.');
  recent.push(now);
  commentRateLimits.set(address, recent);
}

function requireSameOrigin(req, res, next) {
  const origin = req.get('Origin');
  if (!origin) return res.status(403).send('Origin header required.');
  try {
    if (new URL(origin).host !== req.get('host')) return res.status(403).send('Invalid request origin.');
  } catch {
    return res.status(403).send('Invalid request origin.');
  }
  next();
}

function shareAccess({ token, cookieName, cookiePath, acceptedCookies = [], publicAccess = async () => false }) {
  return async (req, res, next) => {
    try {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
      if (!token) return next();

      const queryToken = typeof req.query.share === 'string' ? req.query.share : '';
      if (tokensMatch(queryToken, token)) {
        setShareCookie(res, cookieName, token, cookiePath);
        const cleanUrl = new URL(req.originalUrl, 'http://localhost');
        cleanUrl.searchParams.delete('share');
        return res.redirect(302, `${cleanUrl.pathname}${cleanUrl.search}`);
      }

      if (await publicAccess()) return next();

      if (tokensMatch(cookieValue(req, cookieName), token)) return next();
      if (acceptedCookies.some(({ name, value }) => tokensMatch(cookieValue(req, name), value))) return next();
      res.setHeader('Cache-Control', 'private, no-store');
      return res.status(404).send('Not found');
    } catch (error) { return next(error); }
  };
}

const requireResumeShare = shareAccess({ token: resumeShareToken, cookieName: 'resume_share', cookiePath: '/resume' });
const requireStudyShare = shareAccess({
  token: studyShareToken,
  cookieName: 'study_share',
  cookiePath: '/study',
  acceptedCookies: [{ name: 'study_from_resume', value: resumeShareToken }],
  publicAccess: async () => (await loadSiteSettings()).studyAccess === 'public',
});

app.use('/resume', requireResumeShare);
app.use('/study', requireStudyShare);
app.use('/study/assets', express.static(path.join(rootDir, 'study', 'assets'), { maxAge: '1h' }));
app.use('/admin/assets', express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

const staticFiles = ['favicon-16x16.png', 'favicon-32x32.png'];
for (const file of staticFiles) app.get(`/${file}`, (_req, res) => res.sendFile(path.join(rootDir, file)));
app.get('/resume/profile.png', (_req, res) => res.sendFile(path.join(rootDir, 'profile.png')));
for (const file of ['style.css', 'script.js', 'config.js']) {
  app.get(`/resume/${file}`, (_req, res) => res.sendFile(path.join(rootDir, file)));
}
app.get(/^\/resume$/, (req, res) => res.redirect(302, `/resume/${req.originalUrl.slice('/resume'.length)}`));
app.get('/resume/', (req, res) => {
  if (resumeShareToken && studyShareToken && tokensMatch(cookieValue(req, 'resume_share'), resumeShareToken)) {
    setShareCookie(res, 'study_from_resume', resumeShareToken, '/study');
  }
  res.sendFile(path.join(rootDir, 'index.html'));
});
app.get('/', (_req, res) => res.status(404).send('Not found'));
app.get('/robots.txt', (_req, res) => res.type('text/plain').send('User-agent: *\nDisallow: /\n'));
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function slugFromFilename(filename) {
  return filename.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');
}

function titleSequence(title) {
  const circledNumbers = Array.from('①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚㉛㉜㉝㉞㉟㊱㊲㊳㊴㊵㊶㊷㊸㊹㊺㊻㊼㊽㊾㊿');
  const match = String(title).match(/Python 기초 문법 (.)/u);
  const index = match ? circledNumbers.indexOf(match[1]) : -1;
  return index + 1;
}

function validateSlug(slug) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function normalizeDate(value) {
  const date = value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new Error('날짜 형식이 올바르지 않습니다.');
  }
  return date;
}

function normalizeCategory(value) {
  const category = String(value || '').trim();
  if (!category || category.length > 40 || /[\u0000-\u001f]/.test(category)) throw new Error('카테고리를 확인하세요.');
  return category;
}

function normalizeStudyOrder(value) {
  if (value === undefined || value === null || value === '') return 0;
  const order = Number(value);
  if (!Number.isInteger(order) || order < 1 || order > 9999) throw new Error('학습 순서는 1 이상의 정수여야 합니다.');
  return order;
}

function validImageBuffer(extension, buffer) {
  if (extension === '.png') return buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  if (extension === '.jpg' || extension === '.jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8;
  if (extension === '.gif') return ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
  if (extension === '.webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return false;
}

function imageMimeType(extension) {
  return { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' }[extension];
}

function prepareUploadedFile(file, { allowSql = false } = {}) {
  const extension = path.extname(file.originalname).toLowerCase();
  if (extension === '.py' || (allowSql && extension === '.sql')) {
    const sizeLimit = extension === '.sql' ? 2 * 1024 * 1024 : 512 * 1024;
    const fileType = extension === '.sql' ? 'SQL' : 'Python';
    if (file.size > sizeLimit) throw new Error(`${fileType} 파일은 ${extension === '.sql' ? '2MB' : '512KB'} 이하만 업로드할 수 있습니다.`);
    let source;
    try {
      source = new TextDecoder('utf-8', { fatal: true }).decode(file.buffer);
    } catch {
      throw new Error(`UTF-8 텍스트 형식의 ${fileType} 파일만 업로드할 수 있습니다.`);
    }
    if (source.includes('\0')) throw new Error(`텍스트 형식의 ${fileType} 파일만 업로드할 수 있습니다.`);
    return { filename: file.originalname, content: source };
  }
  if (imageExtensions.has(extension)) {
    if (file.size > 5 * 1024 * 1024) throw new Error('이미지 파일은 5MB 이하만 업로드할 수 있습니다.');
    if (!validImageBuffer(extension, file.buffer)) throw new Error('올바른 이미지 파일만 업로드할 수 있습니다.');
    return { filename: file.originalname, content: file.buffer };
  }
  if (file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('올바른 PDF 파일만 업로드할 수 있습니다.');
  return { filename: file.originalname, content: file.buffer };
}

async function storeUploadedFiles(files, destination) {
  if (!files.length) return;
  await fs.mkdir(destination, { recursive: true });
  for (const file of files) {
    const temporaryFile = path.join(destination, `.${crypto.randomUUID()}.tmp`);
    await fs.writeFile(temporaryFile, file.content, { mode: 0o640 });
    await fs.rename(temporaryFile, path.join(destination, file.filename));
  }
}

async function loadPrivateFiles() {
  await fs.mkdir(privateFilesDir, { recursive: true });
  const entries = (await fs.readdir(privateFilesDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && privateFileNamePattern.test(entry.name));
  return Promise.all(entries.map(async (entry) => {
    const stats = await fs.stat(path.join(privateFilesDir, entry.name));
    return { filename: entry.name, size: stats.size, modified: stats.mtime.toISOString() };
  })).then((files) => files.sort((a, b) => a.filename.localeCompare(b.filename, 'ko', { numeric: true, sensitivity: 'base' })));
}

function formatFileSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUptime(totalSeconds) {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return [days ? `${days}일` : '', hours ? `${hours}시간` : '', `${minutes}분`].filter(Boolean).join(' ');
}

async function loadAttachmentFiles(slug) {
  try {
    return (await fs.readdir(path.join(studyFilesDir, slug), { withFileTypes: true }))
      .filter((entry) => entry.isFile() && attachmentNamePattern.test(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function loadPosts() {
  await fs.mkdir(postsDir, { recursive: true });
  const files = (await fs.readdir(postsDir)).filter((name) => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(name));
  const posts = await Promise.all(files.map(async (filename) => {
    const raw = await fs.readFile(path.join(postsDir, filename), 'utf8');
    const parsed = matter(raw);
    const date = normalizeDate(parsed.data.date || filename.slice(0, 10));
    const category = normalizeCategory(parsed.data.category || '기타');
    const tags = Array.isArray(parsed.data.tags) ? parsed.data.tags.map(String) : [];
    const order = normalizeStudyOrder(parsed.data.order) || titleSequence(parsed.data.title);
    return {
      filename,
      slug: slugFromFilename(filename),
      title: String(parsed.data.title || slugFromFilename(filename)),
      date,
      category,
      tags,
      order,
      body: parsed.content.trim(),
      attachmentFiles: await loadAttachmentFiles(slugFromFilename(filename)),
    };
  }));
  return posts.sort((a, b) => {
    const dateOrder = b.date.localeCompare(a.date);
    if (dateOrder) return dateOrder;
    const sequenceOrder = b.order - a.order;
    return sequenceOrder || b.title.localeCompare(a.title, 'ko');
  });
}

function renderMarkdown(source) {
  const html = sanitizeHtml(marked.parse(source), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2']),
    allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, img: ['src', 'alt', 'title'] },
    allowedSchemes: ['http', 'https', 'mailto'],
  });
  return html
    .replaceAll('<table>', '<div class="study-table-scroll" role="region" aria-label="표 스크롤 영역" tabindex="0"><table>')
    .replaceAll('</table>', '</table></div>');
}

function studyPostNavigation(posts, currentPost) {
  const currentIndex = posts.findIndex((post) => post.slug === currentPost.slug);
  if (currentIndex < 0) return '';
  const previousPost = posts[currentIndex + 1];
  const nextPost = posts[currentIndex - 1];
  if (!previousPost && !nextPost) return '';
  const previousLink = previousPost ? `<a class="series-previous" href="/study/${encodeURIComponent(previousPost.slug)}/"><span>이전 글</span><strong>← ${escapeHtml(previousPost.title)}</strong></a>` : '';
  const nextLink = nextPost ? `<a class="series-next" href="/study/${encodeURIComponent(nextPost.slug)}/"><span>다음 글</span><strong>${escapeHtml(nextPost.title)} →</strong></a>` : '';
  return `<nav class="study-series-nav" aria-label="학습 기록 이전 및 다음 글">${previousLink}${nextLink}</nav>`;
}

function formatCommentDate(value) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function renderComments(post, comments, status) {
  const notice = status === 'registered' ? '<p class="study-comment-notice" role="status">댓글이 등록되었습니다.</p>' : '';
  const list = comments.length
    ? `<ol class="study-comment-list">${comments.map((comment) => `<li><header><strong>${escapeHtml(comment.author)}</strong><time datetime="${escapeHtml(comment.createdAt)}">${escapeHtml(formatCommentDate(comment.createdAt))}</time></header><p>${escapeHtml(comment.content)}</p></li>`).join('')}</ol>`
    : '<p class="study-comments-empty">첫 댓글을 남겨 보세요.</p>';
  return `<section class="study-comments" id="comments"><header><h2>댓글 <span>${comments.length}</span></h2><p>글에 대한 의견이나 질문을 남길 수 있습니다.</p></header>${notice}${list}<form class="study-comment-form" method="post" action="/study/${encodeURIComponent(post.slug)}/comments/"><label>이름<input name="author" required maxlength="30" autocomplete="name"></label><label>댓글<textarea name="content" required maxlength="1000" rows="5"></textarea></label><label class="study-comment-trap" aria-hidden="true">웹사이트<input name="website" tabindex="-1" autocomplete="off"></label><button type="submit">댓글 등록</button></form></section>`;
}

function studySidebar(posts) {
  const categories = posts.reduce((result, post) => {
    result.set(post.category, (result.get(post.category) || 0) + 1);
    return result;
  }, new Map());
  const sortedCategories = [...categories].sort(([left], [right]) => left.localeCompare(right, 'ko'));
  const months = posts.reduce((result, post) => {
    const month = post.date.slice(0, 7);
    result.set(month, (result.get(month) || 0) + 1);
    return result;
  }, new Map());
  const tags = [...new Set(posts.flatMap((post) => post.tags))].sort((a, b) => a.localeCompare(b, 'ko'));
  return `<aside class="study-sidebar" id="study-sidebar" data-study-sidebar>
    <div class="sidebar-header"><div class="study-brand-group"><span class="study-brand">Tech Notes</span><span class="study-owner-brand">by <span>Seungje</span> <strong>Lee</strong></span></div><button class="sidebar-close" type="button" aria-label="탐색 메뉴 닫기" data-sidebar-close>×</button></div>
    <nav class="sidebar-nav" aria-label="학습 기록 탐색"><a class="sidebar-primary-link" href="/study/">전체 기록</a>
      <form class="sidebar-search" action="/study/" role="search" data-study-search-form><label for="study-search">글 검색</label><div><input id="study-search" type="search" name="q" placeholder="제목, 카테고리, 태그" autocomplete="off" data-study-search><button type="submit" aria-label="검색">⌕</button></div></form>
      <section class="sidebar-group"><h2>카테고리</h2><div class="sidebar-categories">${sortedCategories.map(([category, count]) => `<a href="/study/?category=${encodeURIComponent(category)}" data-sidebar-category="${escapeHtml(category)}"><span>${escapeHtml(category)}</span><span class="sidebar-count">${count}</span></a>`).join('')}</div></section>
      <section class="sidebar-group"><h2>월별 기록</h2><div class="sidebar-months">${[...months].map(([month, count]) => `<a href="/study/#month-${month}"><span>${escapeHtml(month)}</span><span class="sidebar-count">${count}</span></a>`).join('')}</div></section>
      <section class="sidebar-group"><h2>주제별 태그</h2><div class="sidebar-tags">${tags.map((tag) => `<a href="/study/?tag=${encodeURIComponent(tag)}" data-sidebar-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}</a>`).join("")}</div></section>
    </nav><div class="study-sidebar-footer"><button class="study-settings-button" type="button" aria-label="설정" title="설정" data-study-settings-open><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.09A1.7 1.7 0 0 0 9 19.36a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15a1.7 1.7 0 0 0-1.56-1.03H3v-4h.09A1.7 1.7 0 0 0 4.64 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63a1.7 1.7 0 0 0 1.03-1.56V3h4v.09A1.7 1.7 0 0 0 15 4.64a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9a1.7 1.7 0 0 0 1.56 1.03H21v4h-.09A1.7 1.7 0 0 0 19.4 15z"/></svg></button></div>
  </aside>`;
}

function studyLayout({ title = '', description = '', content, posts, isHome = false }) {
  const pageTitle = isHome ? 'Tech Notes · Seungje Lee' : escapeHtml(title) + ' · Tech Notes';
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'">
    <title>${pageTitle}</title><meta name="description" content="${escapeHtml(description)}"><meta name="theme-color" content="#ffffff">
    <link rel="icon" href="/favicon-32x32.png"><link rel="stylesheet" href="/study/assets/study.css?v=20260828-1"><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&family=Noto+Sans+Mono:wght@400;500;600&display=swap" rel="stylesheet"><script src="/study/assets/study.js?v=20260825-1" defer></script></head>
    <body class="study-page"><a class="skip-link" href="#study-content">본문으로 바로가기</a><header class="mobile-study-header"><button class="sidebar-open" type="button" aria-expanded="false" aria-controls="study-sidebar" aria-label="탐색 메뉴 열기" data-sidebar-open>☰</button><a href="/study/">Tech Notes</a></header>
    ${studySidebar(posts)}<button class="sidebar-overlay" type="button" aria-label="탐색 메뉴 닫기" data-sidebar-overlay hidden></button><main class="study-main" id="study-content" tabindex="-1">${content}</main><dialog class="study-settings" data-study-settings><form method="dialog"><div class="study-settings-title"><h2>설정</h2><button type="submit" aria-label="설정 닫기">×</button></div><label>테마<select data-study-theme><option value="system">시스템 설정</option><option value="light">라이트</option><option value="dark">다크</option></select></label><button class="study-settings-done" type="submit">완료</button></form></dialog></body></html>`;
}

app.get('/study/', async (req, res, next) => {
  try {
    const posts = await loadPosts();
    const groups = posts.reduce((result, post) => {
      const month = post.date.slice(0, 7);
      if (!result.has(month)) result.set(month, []);
      result.get(month).push(post);
      return result;
    }, new Map());
    const archive = posts.length ? [...groups].map(([month, items]) => `<section class="study-month" id="month-${month}" data-study-month><h2>${month}</h2><div class="study-note-list">${items.map((post) => `<article class="study-note-card" data-study-note data-category="${escapeHtml(post.category)}" data-tags="${escapeHtml(post.tags.join('||'))}" data-search="${escapeHtml([post.title, post.category, ...post.tags].join(' '))}"><time datetime="${post.date}">${post.date.slice(5, 7)}월 ${post.date.slice(8)}일</time><a class="study-card-category" href="/study/?category=${encodeURIComponent(post.category)}">${escapeHtml(post.category)}</a><h3><a href="/study/${encodeURIComponent(post.slug)}/">${escapeHtml(post.title)}</a></h3><div class="study-card-tags">${post.tags.map((tag) => `<a href="/study/?tag=${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a>`).join('')}</div></article>`).join('')}</div></section>`).join('') : '<section class="study-empty-state"><h2>첫 기록을 작성해 보세요.</h2></section>';
    const content = `<header class="study-home-header"><p class="study-eyebrow">TECH LEARNING NOTES</p><h1>개발 학습 기록</h1><p>데이터베이스, 백엔드, Linux와 클라우드 등 개발 과정에서 배운 내용을 정리합니다.</p></header><div class="study-filter-status" data-filter-status hidden><span data-filter-summary></span><a href="/study/">필터 해제</a></div><div class="study-archive" data-study-archive>${archive}</div><p class="study-empty-filter" data-empty-filter hidden>검색 조건에 해당하는 기록이 없습니다.</p>`;
    res.send(studyLayout({ title: '개발 학습 기록', description: '개발과 기술 학습 기록', content, posts, isHome: true }));
  } catch (error) { next(error); }
});

app.get('/study/:slug/', async (req, res, next) => {
  try {
    const posts = await loadPosts();
    const post = posts.find((item) => item.slug === req.params.slug);
    if (!post) return res.status(404).send('Not found');
    const comments = await loadComments(post.slug);
    const downloadableFiles = post.attachmentFiles.filter((filename) => !imageExtensions.has(path.extname(filename).toLowerCase()));
    const attachments = downloadableFiles.length ? `<section class="study-attachments"><h2>첨부 파일</h2><ul>${downloadableFiles.map((filename) => { const action = filename.toLowerCase().endsWith('.pdf') ? '다운로드' : '보기'; return `<li><a href="/study/${encodeURIComponent(post.slug)}/files/${encodeURIComponent(filename)}/"><code>${escapeHtml(filename)}</code> ${action}</a></li>`; }).join('')}</ul></section>` : '';
    const content = `<article class="study-note"><header class="study-note-header"><p class="study-note-date"><time datetime="${post.date}">${post.date.replaceAll('-', '. ')}</time></p><a class="study-note-category" href="/study/?category=${encodeURIComponent(post.category)}">${escapeHtml(post.category)}</a><h1>${escapeHtml(post.title)}</h1><div class="study-note-tags">${post.tags.map((tag) => `<a href="/study/?tag=${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a>`).join('')}</div></header><div class="study-note-content">${renderMarkdown(post.body)}</div>${attachments}${studyPostNavigation(posts, post)}${renderComments(post, comments, req.query.comment)}<footer class="study-note-footer"><a href="/study/">← 전체 학습 기록</a></footer></article>`;
    res.send(studyLayout({ title: post.title, description: post.body.slice(0, 150), content, posts }));
  } catch (error) { next(error); }
});

app.post('/study/:slug/comments/', requireSameOrigin, async (req, res, next) => {
  try {
    if (!validateSlug(req.params.slug)) return res.status(404).send('Not found');
    const post = (await loadPosts()).find((item) => item.slug === req.params.slug);
    if (!post) return res.status(404).send('Not found');
    if (String(req.body.website || '')) return res.redirect(303, `/study/${encodeURIComponent(post.slug)}/#comments`);
    const author = normalizeCommentText(req.body.author, '이름', 30);
    const content = normalizeCommentText(req.body.content, '댓글', 1000);
    enforceCommentRateLimit(req);
    await updateComments(async () => {
      const comments = await loadComments(post.slug);
      comments.push({ id: crypto.randomUUID(), author, content, createdAt: new Date().toISOString() });
      await saveComments(post.slug, comments);
    });
    res.redirect(303, `/study/${encodeURIComponent(post.slug)}/?comment=registered#comments`);
  } catch (error) { next(error); }
});

app.get('/study/:slug/files/:filename/', async (req, res, next) => {
  try {
    if (!validateSlug(req.params.slug) || !attachmentNamePattern.test(req.params.filename)) return res.status(404).send('Not found');
    const posts = await loadPosts();
    const post = posts.find((item) => item.slug === req.params.slug);
    if (!post || !post.attachmentFiles.includes(req.params.filename)) return res.status(404).send('Not found');
    const filePath = path.join(studyFilesDir, post.slug, req.params.filename);
    const extension = path.extname(req.params.filename).toLowerCase();
    if (extension === '.pdf') return res.download(filePath, req.params.filename);
    if (imageExtensions.has(extension)) {
      res.type(imageMimeType(extension));
      return res.sendFile(filePath);
    }
    const source = await fs.readFile(filePath, 'utf8');
    const content = `<article class="study-note study-file"><header class="study-note-header"><p class="study-note-date">${escapeHtml(post.title)}</p><h1>${escapeHtml(req.params.filename)}</h1></header><pre><code>${escapeHtml(source)}</code></pre><footer class="study-note-footer"><a href="/study/${encodeURIComponent(post.slug)}/">← 글로 돌아가기</a></footer></article>`;
    res.send(studyLayout({ title: req.params.filename, description: `${post.title}의 Python 첨부 파일`, content, posts }));
  } catch (error) { next(error); }
});

async function requireAdmin(req, res, next) {
  const accessEmail = req.get('Cf-Access-Authenticated-User-Email');
  const isLocal = ['127.0.0.1', '::1'].includes(req.ip);
  if (!accessEmail && !(allowLocalAdmin && isLocal)) return res.status(403).send('Cloudflare Access 인증이 필요합니다.');
  try {
    res.locals.adminEmail = accessEmail || 'local-development';
    res.locals.siteSettings = await loadSiteSettings();
    next();
  } catch (error) { next(error); }
}

app.get(/^\/admin$/, (_req, res) => res.redirect(302, '/admin/'));
app.use('/admin', requireAdmin);
app.use('/admin', (req, res, next) => req.method === 'GET' || req.method === 'HEAD' ? next() : requireSameOrigin(req, res, next));
app.get('/admin/profile.png', (_req, res) => res.sendFile(path.join(rootDir, 'profile.png')));

function adminLayout(title, content, email, activeSection = '') {
  const icons = {
    dashboard: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    notes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h10l4 4v14H5z"/><path d="M15 3v5h4M8 12h8M8 16h8"/></svg>',
    comments: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v12H9l-5 4z"/><path d="M8 8h8M8 12h5"/></svg>',
    files: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h7l2 2h9v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  };
  const navItem = (section, href, label) => `<a${section === activeSection ? ' class="is-active" aria-current="page"' : ''} href="${href}">${icons[section]}<span>${label}</span></a>`;
  const resumeUrl = resumeShareToken ? `/resume/?share=${encodeURIComponent(resumeShareToken)}` : '/resume/';
  const studyAccess = siteSettingsCache?.studyAccess || defaultSiteSettings.studyAccess;
  const studyUrl = studyAccess === 'shared' && studyShareToken ? `/study/?share=${encodeURIComponent(studyShareToken)}` : '/study/';
  const sharedDisabled = studyShareToken ? '' : ' disabled';
  const sharedSelected = studyAccess === 'shared' ? ' selected' : '';
  const publicSelected = studyAccess === 'public' ? ' selected' : '';
  const pageTitle = title === '대시보드' ? 'Administration Console · Seungje Lee' : `${escapeHtml(title)} · Administration Console`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${pageTitle}</title><link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png"><link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png"><link rel="stylesheet" href="/admin/assets/admin.css?v=20260818-2"><link rel="stylesheet" href="/admin/assets/admin-attachments.css?v=20260828-1"><link rel="stylesheet" href="/admin/assets/admin-shell.css?v=20260828-1"><script src="/admin/assets/admin-settings.js?v=20260828-1" defer></script></head><body><header class="admin-mobile-header"><button type="button" aria-expanded="false" aria-controls="admin-sidebar" aria-label="관리자 메뉴 열기" data-admin-sidebar-open>☰</button><a href="/admin/">Seungje Lee</a></header><div class="admin-shell"><aside class="admin-sidebar" id="admin-sidebar" data-admin-sidebar><div class="admin-sidebar-header"><div class="admin-brand"><small>ADMINISTRATION CONSOLE</small><a href="/admin/" aria-label="Seungje Lee 관리자 대시보드"><span>Seungje</span> <strong>Lee</strong></a></div><button class="admin-sidebar-close" type="button" aria-label="관리자 메뉴 닫기" data-admin-sidebar-close>×</button></div><nav aria-label="관리자 메뉴">${navItem('dashboard', '/admin/', '대시보드')}${navItem('notes', '/admin/notes/', 'Tech Notes')}${navItem('comments', '/admin/comments/', '댓글 관리')}${navItem('files', '/admin/files/', '비공개 파일 저장소')}<div class="admin-external-links"><a class="admin-external-link" href="${studyUrl}" target="_blank" rel="noopener"><span>Tech Notes 보기</span><b aria-hidden="true">↗</b></a><a class="admin-external-link" href="${resumeUrl}" target="_blank" rel="noopener"><span>이력서 보기</span><b aria-hidden="true">↗</b></a></div></nav><div class="admin-sidebar-footer"><img src="/admin/profile.png" alt="" width="30" height="30"><p class="admin-account" title="${escapeHtml(email)}">${escapeHtml(email)}</p><button class="admin-settings-button" type="button" aria-label="설정" title="설정" data-admin-settings-open><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.09A1.7 1.7 0 0 0 9 19.36a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15a1.7 1.7 0 0 0-1.56-1.03H3v-4h.09A1.7 1.7 0 0 0 4.64 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63a1.7 1.7 0 0 0 1.03-1.56V3h4v.09A1.7 1.7 0 0 0 15 4.64a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9a1.7 1.7 0 0 0 1.56 1.03H21v4h-.09A1.7 1.7 0 0 0 19.4 15z"/></svg></button></div></aside><button class="admin-sidebar-overlay" type="button" aria-label="관리자 메뉴 닫기" data-admin-sidebar-overlay hidden></button><main class="admin-main">${content}</main></div><dialog class="admin-settings" data-admin-settings><form method="post" action="/admin/settings/study-access"><div class="admin-settings-title"><h2>설정</h2><button type="submit" formmethod="dialog" aria-label="설정 닫기">×</button></div><label>테마<select data-admin-theme><option value="system">시스템 설정</option><option value="light">라이트</option><option value="dark">다크</option></select></label><label>언어<select data-admin-language><option value="ko">한국어</option><option value="en">English</option></select></label><section class="admin-settings-access"><h3>Tech Notes 접근</h3><label><select name="studyAccess"><option value="shared"${sharedSelected}${sharedDisabled}>공유 링크 필요</option><option value="public"${publicSelected}>공개</option></select></label>${studyShareToken ? '<small>변경 즉시 새 요청부터 적용됩니다.</small>' : '<small>공유 링크 모드를 사용하려면 서버에 STUDY_SHARE_TOKEN을 먼저 설정하세요.</small>'}</section><section class="admin-settings-account"><h3>계정</h3><a class="admin-logout" href="/cdn-cgi/access/logout" data-admin-logout>로그아웃</a></section><button class="button primary" type="submit">저장</button></form></dialog></body></html>`;
}

app.post('/admin/settings/study-access', async (req, res, next) => {
  try {
    const studyAccess = String(req.body.studyAccess || '');
    if (!['shared', 'public'].includes(studyAccess)) throw new Error('Tech Notes 접근 설정을 확인하세요.');
    if (studyAccess === 'shared' && !studyShareToken) throw new Error('공유 링크 모드에는 STUDY_SHARE_TOKEN이 필요합니다.');
    await saveSiteSettings({ studyAccess });
    res.redirect('/admin/');
  } catch (error) { next(error); }
});

app.get('/admin/', async (_req, res, next) => {
  try {
    const [posts, files] = await Promise.all([loadPosts(), loadPrivateFiles()]);
    const memory = process.memoryUsage();
    const content = `<div class="admin-title"><div><p>SERVER OVERVIEW</p><h1>대시보드</h1></div><span class="server-health"><i aria-hidden="true"></i>서비스 정상</span></div><div class="dashboard-grid"><section class="dashboard-card"><span>서버 상태</span><strong>정상 작동 중</strong><small>가동 시간 ${formatUptime(process.uptime())}</small></section><section class="dashboard-card"><span>메모리 사용량</span><strong>${formatFileSize(memory.rss)}</strong><small>Node.js RSS 기준</small></section><section class="dashboard-card"><span>Tech Notes</span><strong>${posts.length}개</strong><a href="/admin/notes/">글 관리 →</a></section><section class="dashboard-card"><span>비공개 파일</span><strong>${files.length}개</strong><a href="/admin/files/">파일 관리 →</a></section></div><section class="server-details"><h2>실행 환경</h2><dl><div><dt>Node.js</dt><dd>${escapeHtml(process.version)}</dd></div><div><dt>환경</dt><dd>${escapeHtml(process.env.NODE_ENV || 'development')}</dd></div><div><dt>프로세스 ID</dt><dd>${process.pid}</dd></div></dl></section>`;
    res.send(adminLayout('대시보드', content, res.locals.adminEmail, 'dashboard'));
  } catch (error) { next(error); }
});

app.get('/admin/notes/', async (_req, res, next) => {
  try {
    const posts = await loadPosts();
    const rows = posts.map((post) => `<tr><td>${post.date}</td><td><a href="/admin/edit/${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></td><td>${escapeHtml(post.category)}</td><td>${post.tags.map(escapeHtml).join(', ')}</td><td><a href="/study/${encodeURIComponent(post.slug)}/">보기</a></td></tr>`).join('');
    res.send(adminLayout('글 목록', `<div class="admin-title"><div><p>TECH LEARNING NOTES</p><h1>글 목록</h1></div><a class="button primary" href="/admin/new">새 글 작성</a></div><div class="table-wrap"><table><thead><tr><th>날짜</th><th>제목</th><th>카테고리</th><th>태그</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`, res.locals.adminEmail, 'notes'));
  } catch (error) { next(error); }
});

app.get('/admin/comments/', async (_req, res, next) => {
  try {
    const posts = await loadPosts();
    const comments = await loadAllComments(posts);
    const rows = comments.map((comment) => `<tr><td>${escapeHtml(formatCommentDate(comment.createdAt))}</td><td><a href="/study/${encodeURIComponent(comment.postSlug)}/" target="_blank" rel="noopener">${escapeHtml(comment.postTitle)}</a></td><td><div class="admin-comment-meta"><strong>${escapeHtml(comment.author)}</strong></div><p class="admin-comment-content">${escapeHtml(comment.content)}</p></td><td><form method="post" action="/admin/comments/${encodeURIComponent(comment.postSlug)}/${encodeURIComponent(comment.id)}/delete" onsubmit="return confirm('이 댓글을 삭제할까요?')"><button class="button danger" type="submit">삭제</button></form></td></tr>`).join('');
    const body = comments.length
      ? `<div class="table-wrap admin-comments-table"><table><thead><tr><th>작성일</th><th>글</th><th>댓글</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : '<p class="private-empty">등록된 댓글이 없습니다.</p>';
    const content = `<div class="admin-title"><div><p>TECH NOTES COMMENTS</p><h1>댓글 관리</h1></div><span>${comments.length}개</span></div>${body}`;
    res.send(adminLayout('댓글 관리', content, res.locals.adminEmail, 'comments'));
  } catch (error) { next(error); }
});

app.post('/admin/comments/:slug/:id/delete', async (req, res, next) => {
  try {
    if (!validateSlug(req.params.slug) || !/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(404).send('Not found');
    await updateComments(async () => {
      const comments = await loadComments(req.params.slug);
      const filtered = comments.filter((comment) => comment.id !== req.params.id);
      if (filtered.length === comments.length) return;
      if (filtered.length) await saveComments(req.params.slug, filtered);
      else await fs.rm(commentFilePath(req.params.slug), { force: true });
    });
    res.redirect('/admin/comments/');
  } catch (error) { next(error); }
});

app.get('/admin/files/', async (_req, res, next) => {
  try {
    const files = await loadPrivateFiles();
    const rows = files.map((file) => {
      const extension = path.extname(file.filename).toLowerCase();
      const action = extension === '.pdf' ? '다운로드' : '보기';
      return `<tr><td><code>${escapeHtml(file.filename)}</code></td><td>${formatFileSize(file.size)}</td><td>${file.modified.slice(0, 10)}</td><td><a href="/admin/files/${encodeURIComponent(file.filename)}">${action}</a></td><td><form method="post" action="/admin/files/${encodeURIComponent(file.filename)}/delete" onsubmit="return confirm('이 파일을 삭제할까요?')"><button class="button danger" type="submit">삭제</button></form></td></tr>`;
    }).join('');
    const empty = files.length ? '' : '<p class="private-empty">저장된 파일이 없습니다.</p>';
    const content = `<div class="admin-title"><div><p>PRIVATE FILE STORAGE</p><h1>비공개 파일 저장소</h1></div></div><form class="private-upload" method="post" enctype="multipart/form-data" action="/admin/files/upload"><label>파일 선택 <small>.py 512KB · .sql 2MB · 이미지 5MB · .pdf 15MB 이하 · 최대 5개</small><input type="file" name="privateFiles" accept=".py,.sql,.pdf,.png,.jpg,.jpeg,.gif,.webp,text/x-python,application/sql,text/plain,application/pdf,image/png,image/jpeg,image/gif,image/webp" multiple required></label><button class="button primary" type="submit">업로드</button></form>${empty}<div class="table-wrap private-files-table"><table><thead><tr><th>파일명</th><th>크기</th><th>수정일</th><th></th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
    res.send(adminLayout('비공개 파일 저장소', content, res.locals.adminEmail, 'files'));
  } catch (error) { next(error); }
});

app.get('/admin/files/:filename', async (req, res, next) => {
  try {
    if (!privateFileNamePattern.test(req.params.filename)) return res.status(404).send('Not found');
    const files = await loadPrivateFiles();
    if (!files.some((file) => file.filename === req.params.filename)) return res.status(404).send('Not found');
    const filePath = path.join(privateFilesDir, req.params.filename);
    const extension = path.extname(req.params.filename).toLowerCase();
    res.setHeader('Cache-Control', 'private, no-store');
    if (extension === '.pdf') return res.download(filePath, req.params.filename);
    if (imageExtensions.has(extension)) {
      res.type(imageMimeType(extension));
      return res.sendFile(filePath);
    }
    const source = await fs.readFile(filePath, 'utf8');
    const content = `<div class="admin-title"><div><p>PRIVATE CODE FILE</p><h1>${escapeHtml(req.params.filename)}</h1></div><a class="button" href="/admin/files/">파일 목록</a></div><pre class="private-code"><code>${escapeHtml(source)}</code></pre>`;
    res.send(adminLayout(req.params.filename, content, res.locals.adminEmail, 'files'));
  } catch (error) { next(error); }
});

app.post('/admin/files/upload', privateFileUpload.array('privateFiles', 5), async (req, res, next) => {
  try {
    const files = (req.files || []).map((file) => prepareUploadedFile(file, { allowSql: true }));
    if (!files.length) throw new Error('업로드할 파일을 선택하세요.');
    await storeUploadedFiles(files, privateFilesDir);
    res.redirect('/admin/files/');
  } catch (error) { next(error); }
});

app.post('/admin/files/:filename/delete', async (req, res, next) => {
  try {
    if (!privateFileNamePattern.test(req.params.filename)) return res.status(404).send('Not found');
    const files = await loadPrivateFiles();
    if (!files.some((file) => file.filename === req.params.filename)) return res.status(404).send('Not found');
    await fs.unlink(path.join(privateFilesDir, req.params.filename));
    res.redirect('/admin/files/');
  } catch (error) { next(error); }
});

function editor(post = {}) {
  const isEdit = Boolean(post.filename);
  const existingFiles = (post.attachmentFiles || []).map((filename) => {
    const isImage = imageExtensions.has(path.extname(filename).toLowerCase());
    const imageMarkdown = isImage ? `<small>본문 삽입: <code>![설명](/study/${encodeURIComponent(post.slug)}/files/${encodeURIComponent(filename)}/)</code></small>` : '';
    return `<li><div><code>${escapeHtml(filename)}</code>${imageMarkdown}</div><form method="post" action="/admin/edit/${encodeURIComponent(post.slug)}/files/${encodeURIComponent(filename)}/delete" onsubmit="return confirm('이 첨부 파일을 삭제할까요?')"><button class="button danger" type="submit">삭제</button></form></li>`;
  }).join('');
  const attachmentList = existingFiles ? `<div class="attached-files"><strong>현재 첨부</strong><ul>${existingFiles}</ul></div>` : '';
  return `<div class="admin-title"><div><p>TECH NOTES EDITOR</p><h1>${isEdit ? '글 수정' : '새 글 작성'}</h1></div></div><form class="editor" method="post" enctype="multipart/form-data" action="${isEdit ? `/admin/edit/${encodeURIComponent(post.slug)}` : '/admin/new'}"><label>제목<input name="title" required maxlength="120" value="${escapeHtml(post.title || '')}"></label><div class="field-row"><label>날짜<input type="date" name="date" required value="${escapeHtml(post.date || new Date().toISOString().slice(0, 10))}"></label><label>학습 순서 <small>비워 두면 다음 번호 자동 지정</small><input type="number" name="order" min="1" max="9999" value="${post.order || ''}"></label></div><label>주소용 슬러그<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value="${escapeHtml(post.slug || '')}" placeholder="oracle-backup-basics"></label><label>카테고리<input name="category" required maxlength="40" value="${escapeHtml(post.category || '')}" placeholder="Python"></label><label>태그 <small>쉼표로 구분</small><input name="tags" value="${escapeHtml((post.tags || []).join(', '))}" placeholder="Syntax, Automation"></label><label>본문 <small>Markdown · 이미지는 업로드 후 수정 화면에 표시되는 삽입 문법을 원하는 위치에 붙여넣기</small><textarea name="body" required>${escapeHtml(post.body || '')}</textarea></label><label>첨부 파일 <small>.py 512KB · 이미지 5MB · .pdf 15MB 이하 · 최대 5개 · 같은 이름은 교체</small><input type="file" name="attachmentFiles" accept=".py,.pdf,.png,.jpg,.jpeg,.gif,.webp,text/x-python,application/pdf,image/png,image/jpeg,image/gif,image/webp" multiple></label><div class="actions"><button class="button primary" type="submit">저장</button><a class="button" href="/admin/notes/">취소</a></div></form>${attachmentList}${isEdit ? `<form class="delete-form" method="post" action="/admin/delete/${encodeURIComponent(post.slug)}" onsubmit="return confirm('이 글을 삭제할까요?')"><button class="button danger" type="submit">글 삭제</button></form>` : ''}`;
}

app.get('/admin/new', (_req, res) => res.send(adminLayout('새 글', editor(), res.locals.adminEmail, 'notes')));
app.get('/admin/edit/:slug', async (req, res, next) => {
  try {
    const post = (await loadPosts()).find((item) => item.slug === req.params.slug);
    if (!post) return res.status(404).send('Not found');
    res.send(adminLayout('글 수정', editor(post), res.locals.adminEmail, 'notes'));
  } catch (error) { next(error); }
});

async function savePost(req, previousSlug = null) {
  const title = String(req.body.title || '').trim();
  const slug = String(req.body.slug || '').trim().toLowerCase();
  const date = normalizeDate(req.body.date);
  const body = String(req.body.body || '').trim();
  const category = normalizeCategory(req.body.category);
  const tags = String(req.body.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean);
  if (!title || !body || !validateSlug(slug)) throw new Error('제목, 본문, 영문 소문자 슬러그를 확인하세요.');
  const uploadedFiles = (req.files || []).map(prepareUploadedFile);
  const posts = await loadPosts();
  const order = normalizeStudyOrder(req.body.order) || Math.max(0, ...posts.map((post) => post.order)) + 1;
  if (posts.some((post) => post.slug === slug && post.slug !== previousSlug)) throw new Error('이미 사용 중인 슬러그입니다.');
  const filename = `${date}-${slug}.md`;
  const output = matter.stringify(`${body}\n`, { title, date, category, tags, order });
  const target = path.join(postsDir, filename);
  const temporary = path.join(postsDir, `.${crypto.randomUUID()}.tmp`);
  await fs.writeFile(temporary, output, { encoding: 'utf8', mode: 0o640 });
  await fs.rename(temporary, target);
  if (previousSlug) {
    const previous = posts.find((post) => post.slug === previousSlug);
    if (previous && previous.filename !== filename) await fs.unlink(path.join(postsDir, previous.filename));
    if (previousSlug !== slug) {
      await fs.mkdir(studyFilesDir, { recursive: true });
      try {
        await fs.rename(path.join(studyFilesDir, previousSlug), path.join(studyFilesDir, slug));
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      await fs.mkdir(commentsDir, { recursive: true });
      try {
        await fs.rename(commentFilePath(previousSlug), commentFilePath(slug));
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
  }
  await storeUploadedFiles(uploadedFiles, path.join(studyFilesDir, slug));
}

app.post('/admin/new', attachmentUpload.array('attachmentFiles', 5), async (req, res, next) => { try { await savePost(req); res.redirect('/admin/notes/'); } catch (error) { next(error); } });
app.post('/admin/edit/:slug', attachmentUpload.array('attachmentFiles', 5), async (req, res, next) => { try { await savePost(req, req.params.slug); res.redirect('/admin/notes/'); } catch (error) { next(error); } });
app.post('/admin/edit/:slug/files/:filename/delete', async (req, res, next) => {
  try {
    if (!validateSlug(req.params.slug) || !attachmentNamePattern.test(req.params.filename)) return res.status(404).send('Not found');
    const post = (await loadPosts()).find((item) => item.slug === req.params.slug);
    if (!post || !post.attachmentFiles.includes(req.params.filename)) return res.status(404).send('Not found');
    await fs.unlink(path.join(studyFilesDir, post.slug, req.params.filename));
    res.redirect(`/admin/edit/${encodeURIComponent(post.slug)}`);
  } catch (error) { next(error); }
});
app.post('/admin/delete/:slug', async (req, res, next) => {
  try {
    const post = (await loadPosts()).find((item) => item.slug === req.params.slug);
    if (post) {
      await fs.unlink(path.join(postsDir, post.filename));
      await fs.rm(path.join(studyFilesDir, post.slug), { recursive: true, force: true });
      await fs.rm(commentFilePath(post.slug), { force: true });
    }
    res.redirect('/admin/notes/');
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(400).send(`요청을 처리하지 못했습니다: ${escapeHtml(error.message)}`);
});

app.listen(port, host, () => console.log(`Resume server listening on http://${host}:${port}`));
