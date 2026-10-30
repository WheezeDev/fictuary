// Fanfic Library - a small local app that saves AO3 stories to this folder
// so they can be read even when AO3 is down. No installs needed beyond Node.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4321;
const ROOT = __dirname;
const LIB = path.join(ROOT, 'library');
const PUBLIC = path.join(ROOT, 'public');
const QUEUE_FILE = path.join(LIB, '_waiting.json');
const AO3 = process.env.AO3_TEST_SITE || 'https://archiveofourown.org'; // test site only used by test/fake-ao3.js
const UA = 'FanficLibrary/1.0 (personal offline reading copy)';
const RETRY_MINUTES = 10;

fs.mkdirSync(LIB, { recursive: true });

// ---------- helpers ----------

function decode(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}
const stripTags = (s) => decode(String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '')).replace(/\n{3,}/g, '\n\n').trim();

function workIdFrom(url) {
  const m = String(url).match(/(?:archiveofourown\.org|ao3\.org)\/(?:collections\/[^/]+\/)?works\/(\d+)/i);
  return m ? m[1] : null;
}

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

class FriendlyError extends Error {
  constructor(message, retry) { super(message); this.retry = retry; }
}

async function get(url) {
  let res;
  try {
    res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  } catch {
    throw new FriendlyError('Could not reach AO3. Check your internet, or AO3 may be down.', true);
  }
  if (res.status === 404) throw new FriendlyError('AO3 says this story does not exist (it may have been deleted).', false);
  if (res.status === 429) throw new FriendlyError('AO3 asked us to slow down. It will try again shortly.', true);
  if (res.status >= 500 || res.status === 418 || res.status === 403) throw new FriendlyError('AO3 is down or busy right now.', true);
  if (!res.ok) throw new FriendlyError('AO3 gave an unexpected answer (' + res.status + ').', true);
  return res;
}

// ---------- reading AO3's story page ----------

function parseWorkPage(html, id) {
  if (/maintenance|Request temporarily denied/i.test(html.slice(0, 3000)) && !/class="work meta group"/.test(html)) {
    throw new FriendlyError('AO3 is down for maintenance right now.', true);
  }
  if (/users\/login|only available to registered users/i.test(html) && !/class="work meta group"/.test(html)) {
    throw new FriendlyError('This story is only visible to people logged in to AO3, so it cannot be saved yet.', false);
  }
  if (!/class="work meta group"/.test(html)) throw new FriendlyError('That page does not look like an AO3 story.', false);

  const tags = {};
  for (const m of html.matchAll(/<dd class="([a-z ]+?) tags">([\s\S]*?)<\/dd>/g)) {
    const kind = m[1].trim();
    tags[kind] = [...m[2].matchAll(/<a class="tag"[^>]*>([\s\S]*?)<\/a>/g)].map((t) => decode(t[1]).trim());
  }
  const stat = (name) => {
    const m = html.match(new RegExp('<dd class="' + name + '"[^>]*>([\\s\\S]*?)</dd>'));
    return m ? stripTags(m[1]) : '';
  };
  const title = stripTags((html.match(/<h2 class="title heading">([\s\S]*?)<\/h2>/) || [])[1]) || 'Untitled';
  const byline = (html.match(/<h3 class="byline heading">([\s\S]*?)<\/h3>/) || [])[1] || '';
  const authors = [...byline.matchAll(/<a rel="author"[^>]*>([\s\S]*?)<\/a>/g)].map((a) => decode(a[1]).trim());
  const summaryBlock = (html.match(/<div class="summary module"[^>]*>([\s\S]*?)<\/blockquote>/) || [])[1] || '';
  const summary = stripTags(summaryBlock.replace(/[\s\S]*<blockquote class="userstuff">/, ''));

  const links = [...html.matchAll(/href="([^"]*\/downloads\/\d+\/[^"]+)"/g)].map((m) => decode(m[1]));
  const abs = (u) => (u && u.startsWith('/') ? AO3 + u : u);
  const chapters = stat('chapters'); // e.g. "3/?" or "5/5"
  const [done, total] = chapters.split('/');

  return {
    id,
    url: AO3 + '/works/' + id,
    title,
    authors: authors.length ? authors : ['Anonymous'],
    summary,
    rating: (tags.rating || [])[0] || '',
    warnings: tags.warning || [],
    categories: tags.category || [],
    fandoms: tags.fandom || [],
    relationships: tags.relationship || [],
    characters: tags.character || [],
    freeforms: tags.freeform || [],
    language: stat('language'),
    words: parseInt(stat('words').replace(/[^\d]/g, ''), 10) || 0,
    chapters,
    complete: total !== '?' && done === total,
    published: stat('published'),
    updated: stat('status') || stat('published'),
    kudos: parseInt(stat('kudos').replace(/[^\d]/g, ''), 10) || 0,
    htmlLink: abs(links.find((l) => /\.html(\?|$)/.test(l))) || AO3 + '/downloads/' + id + '/work.html',
    epubLink: abs(links.find((l) => /\.epub(\?|$)/.test(l))) || AO3 + '/downloads/' + id + '/work.epub',
  };
}

// ---------- saving ----------

async function saveWork(url) {
  const id = workIdFrom(url);
  if (!id) throw new FriendlyError('That does not look like an AO3 story link. It should contain /works/ and a number.', false);

  const page = await (await get(AO3 + '/works/' + id + '?view_adult=true')).text();
  const meta = parseWorkPage(page, id);

  const storyHtml = await (await get(meta.htmlLink)).text();
  if (!/<html/i.test(storyHtml)) throw new FriendlyError('AO3 did not send the story text. It will try again.', true);
  let epub = null;
  try { epub = Buffer.from(await (await get(meta.epubLink)).arrayBuffer()); } catch { /* the e-book copy is a bonus */ }

  const dir = path.join(LIB, id);
  fs.mkdirSync(dir, { recursive: true });
  const old = readJSON(path.join(dir, 'meta.json'), null);
  fs.writeFileSync(path.join(dir, 'story.html'), storyHtml);
  if (epub) fs.writeFileSync(path.join(dir, 'story.epub'), epub);

  const now = new Date().toISOString();
  const saved = {
    ...meta,
    hasEpub: !!epub || !!(old && old.hasEpub),
    myTags: old ? old.myTags : [],
    status: old ? old.status : 'to-read',
    progress: old ? old.progress : 0,
    notes: old ? old.notes : '',
    addedAt: old ? old.addedAt : now,
    checkedAt: now,
    newChapters: !!(old && old.chapters && old.chapters !== meta.chapters),
  };
  delete saved.htmlLink; delete saved.epubLink;
  writeJSON(path.join(dir, 'meta.json'), saved);
  return saved;
}

// ---------- waiting list (for when AO3 is down) ----------

const queue = readJSON(QUEUE_FILE, []);
const saveQueue = () => writeJSON(QUEUE_FILE, queue);
let working = false;

function enqueue(url, reason) {
  const id = workIdFrom(url);
  if (!queue.some((q) => workIdFrom(q.url) === id)) queue.push({ url, reason, since: new Date().toISOString() });
  else queue.find((q) => workIdFrom(q.url) === id).reason = reason;
  saveQueue();
}

async function retryQueue() {
  if (working || !queue.length) return;
  working = true;
  for (const item of [...queue]) {
    try {
      await saveWork(item.url);
      queue.splice(queue.indexOf(item), 1);
    } catch (e) {
      item.reason = e.message;
      if (e.retry === false) queue.splice(queue.indexOf(item), 1);
      if (e.retry) break; // AO3 still down, stop for now
    }
    saveQueue();
    await new Promise((r) => setTimeout(r, 3000)); // be gentle with AO3
  }
  working = false;
}

// ---------- web server ----------

function listLibrary() {
  return fs.readdirSync(LIB, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => readJSON(path.join(LIB, d.name, 'meta.json'), null))
    .filter(Boolean);
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.epub': 'application/epub+zip', '.svg': 'image/svg+xml' };

// Extra styling put into saved stories so they read nicely inside the app.
const READER_STYLE = `<style>
html{background:var(--bg,#faf8f4);color:var(--fg,#222)}
body{max-width:42em;margin:0 auto;padding:1.5em 1.2em 4em;font:1.1em/1.65 Georgia,'Times New Roman',serif}
a{color:#8a2a2a} h1,h2,h3{line-height:1.25} hr{border:0;border-top:1px solid #ccc;margin:2em 0}
dl.tags{font-size:.85em;line-height:1.4} dl.tags dt{font-weight:bold;margin-top:.4em}
@media (prefers-color-scheme: dark){html{--bg:#1b1b1d;--fg:#ddd} a{color:#e39b9b} hr{border-color:#444}}
</style>`;

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function body(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = decodeURIComponent(url.pathname);

  try {
    if (p === '/api/library' && req.method === 'GET') {
      return send(res, 200, { works: listLibrary(), waiting: queue });
    }

    if (p === '/api/add' && req.method === 'POST') {
      const { url: link } = await body(req);
      try {
        const work = await saveWork(link);
        const i = queue.findIndex((q) => workIdFrom(q.url) === work.id);
        if (i >= 0) { queue.splice(i, 1); saveQueue(); }
        return send(res, 200, { ok: true, work });
      } catch (e) {
        if (!(e instanceof FriendlyError)) throw e;
        if (e.retry) enqueue(link, e.message);
        return send(res, 200, { ok: false, message: e.message, waiting: !!e.retry });
      }
    }

    if (p === '/api/retry' && req.method === 'POST') {
      retryQueue();
      return send(res, 200, { ok: true });
    }

    if (p === '/api/waiting/remove' && req.method === 'POST') {
      const { url: link } = await body(req);
      const i = queue.findIndex((q) => q.url === link);
      if (i >= 0) { queue.splice(i, 1); saveQueue(); }
      return send(res, 200, { ok: true });
    }

    const upd = p.match(/^\/api\/work\/(\d+)$/);
    if (upd && req.method === 'POST') {
      const file = path.join(LIB, upd[1], 'meta.json');
      const meta = readJSON(file, null);
      if (!meta) return send(res, 404, { ok: false });
      const changes = await body(req);
      for (const k of ['myTags', 'status', 'progress', 'notes', 'newChapters']) if (k in changes) meta[k] = changes[k];
      writeJSON(file, meta);
      return send(res, 200, { ok: true, work: meta });
    }
    if (upd && req.method === 'DELETE') {
      fs.rmSync(path.join(LIB, upd[1]), { recursive: true, force: true });
      return send(res, 200, { ok: true });
    }

    const story = p.match(/^\/story\/(\d+)\/(story\.html|story\.epub)$/);
    if (story) {
      const file = path.join(LIB, story[1], story[2]);
      if (!fs.existsSync(file)) return send(res, 404, 'Not saved', 'text/plain');
      if (story[2] === 'story.html') {
        const html = fs.readFileSync(file, 'utf8').replace(/<\/head>/i, READER_STYLE + '</head>');
        return send(res, 200, html, TYPES['.html']);
      }
      res.writeHead(200, { 'Content-Type': TYPES['.epub'], 'Content-Disposition': `attachment; filename="ao3-${story[1]}.epub"` });
      return fs.createReadStream(file).pipe(res);
    }

    const file = path.join(PUBLIC, p === '/' ? 'index.html' : p);
    if (file.startsWith(PUBLIC) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      return send(res, 200, fs.readFileSync(file), TYPES[path.extname(file)] || 'application/octet-stream');
    }
    send(res, 404, 'Not found', 'text/plain');
  } catch (e) {
    console.error(e);
    send(res, 500, { ok: false, message: 'Something went wrong: ' + e.message });
  }
});

if (require.main === module) {
  setInterval(retryQueue, RETRY_MINUTES * 60 * 1000);
  server.listen(PORT, '127.0.0.1', () => {
    console.log('Fanfic Library is running at http://localhost:' + PORT);
    console.log('Keep this window open while you use it. Close it to stop.');
    setTimeout(retryQueue, 5000);
  });
}

module.exports = { parseWorkPage, workIdFrom };
