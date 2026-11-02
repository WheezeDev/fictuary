// Fictuary - screen logic
const $ = (id) => document.getElementById(id);
const state = { works: [], waiting: [], search: '', shelf: 'all', filters: [], sort: 'added', open: null };
const SHELVES = [['all', 'Everything'], ['to-read', 'To read'], ['reading', 'Reading'], ['finished', 'Finished'], ['new', 'New chapters']];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cleanTag = (t) => t.trim().replace(/^#+/, '').toLowerCase().replace(/\s+/g, '-');
const allAo3Tags = (w) => [...w.fandoms, ...w.relationships, ...w.characters, ...w.freeforms, ...w.warnings, ...w.categories, w.rating].filter(Boolean);

async function api(url, opts = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts, body: opts.body && JSON.stringify(opts.body) });
  return res.json();
}

async function load() {
  const data = await api('/api/library');
  state.works = data.works;
  state.waiting = data.waiting;
  render();
}

function notice(text, bad) {
  const n = $('notice');
  n.textContent = text;
  n.className = 'notice' + (bad ? ' bad' : '');
  n.hidden = !text;
}

// ---------- saving links ----------

$('addForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const links = $('addInput').value.split(/\s+/).filter((l) => /\/works\/\d+/.test(l));
  if (!links.length) return notice('Paste a link to an AO3 story. It looks like archiveofourown.org/works/12345', true);
  $('addInput').value = '';
  let saved = 0, waiting = 0, failed = [];
  for (const [i, link] of links.entries()) {
    notice(`Saving ${i + 1} of ${links.length}...`);
    const r = await api('/api/add', { method: 'POST', body: { url: link } });
    if (r.ok) saved++;
    else if (r.waiting) waiting++;
    else failed.push(r.message);
    if (i < links.length - 1) await new Promise((r) => setTimeout(r, 3000)); // be gentle with AO3
  }
  const parts = [];
  if (saved) parts.push(saved === 1 ? 'Saved.' : `Saved ${saved} stories.`);
  if (waiting) parts.push(`AO3 is not answering right now, so ${waiting === 1 ? 'this one is' : waiting + ' are'} on the waiting list and will save on their own once AO3 is back.`);
  if (failed.length) parts.push(failed.join(' '));
  notice(parts.join(' '), failed.length > 0 || (waiting > 0 && !saved));
  load();
});

function renderWaiting() {
  const box = $('waiting');
  box.hidden = !state.waiting.length;
  if (!state.waiting.length) return;
  box.innerHTML = `<strong>Waiting for AO3 (${state.waiting.length})</strong> <span class="muted">Tries again every 10 minutes while this app is open.</span>
    <button id="retryBtn" type="button">Try now</button>
    <ul>${state.waiting.map((q) => `<li>${esc(q.url)} <span class="muted">- ${esc(q.reason)}</span> <button class="x" data-url="${esc(q.url)}" title="Remove">remove</button></li>`).join('')}</ul>`;
  $('retryBtn').onclick = async () => { await api('/api/retry', { method: 'POST' }); notice('Trying again...'); setTimeout(load, 8000); };
  box.querySelectorAll('.x').forEach((b) => (b.onclick = async () => { await api('/api/waiting/remove', { method: 'POST', body: { url: b.dataset.url } }); load(); }));
}

// ---------- library list ----------

function matches(w) {
  if (state.shelf === 'new' ? !w.newChapters : state.shelf !== 'all' && w.status !== state.shelf) return false;
  for (const f of state.filters) {
    if (f.mine ? !w.myTags.includes(f.tag) : !allAo3Tags(w).includes(f.tag)) return false;
  }
  if (state.search) {
    const hay = [w.title, ...w.authors, w.summary, ...allAo3Tags(w), ...w.myTags.map((t) => '#' + t), w.notes].join(' ').toLowerCase();
    if (!state.search.split(/\s+/).every((word) => hay.includes(word))) return false;
  }
  return true;
}

function sorted(list) {
  const by = {
    added: (a, b) => b.addedAt.localeCompare(a.addedAt),
    updated: (a, b) => (b.updated || '').localeCompare(a.updated || ''),
    title: (a, b) => a.title.localeCompare(b.title),
    words: (a, b) => b.words - a.words,
  }[state.sort];
  return [...list].sort(by);
}

function countTags(list, pick) {
  const counts = new Map();
  for (const w of list) for (const t of pick(w)) counts.set(t, (counts.get(t) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function tagButtons(el, counts, mine, limit = 40) {
  el.innerHTML = counts.length ? '' : '<span class="muted">None yet</span>';
  for (const [tag, n] of counts.slice(0, limit)) {
    const on = state.filters.some((f) => f.tag === tag && !!f.mine === mine);
    const b = document.createElement('button');
    b.className = on ? 'on' : '';
    b.innerHTML = `<span class="name" title="${esc(tag)}">${mine ? '#' : ''}${esc(tag)}</span><span class="n">${n}</span>`;
    b.onclick = () => toggleFilter(tag, mine);
    el.appendChild(b);
  }
}

function toggleFilter(tag, mine) {
  const i = state.filters.findIndex((f) => f.tag === tag && !!f.mine === mine);
  if (i >= 0) state.filters.splice(i, 1);
  else state.filters.push({ tag, mine });
  render();
}

function render() {
  renderWaiting();
  const shown = sorted(state.works.filter(matches));

  $('shelves').innerHTML = '';
  for (const [key, label] of SHELVES) {
    const n = key === 'all' ? state.works.length : key === 'new' ? state.works.filter((w) => w.newChapters).length : state.works.filter((w) => w.status === key).length;
    if (key === 'new' && !n) continue;
    const b = document.createElement('button');
    b.className = state.shelf === key ? 'on' : '';
    b.innerHTML = `<span>${label}</span><span class="n">${n}</span>`;
    b.onclick = () => { state.shelf = key; render(); };
    $('shelves').appendChild(b);
  }

  // Sidebar counts follow what is currently shown, so tags narrow down as you filter.
  tagButtons($('myTagList'), countTags(shown, (w) => w.myTags), true);
  tagButtons($('fandomList'), countTags(shown, (w) => w.fandoms), false);
  tagButtons($('shipList'), countTags(shown, (w) => w.relationships), false);
  tagButtons($('freeList'), countTags(shown, (w) => w.freeforms), false, 60);

  $('filters').innerHTML = state.filters.map((f, i) => `<button class="chip filter ${f.mine ? 'mine' : ''}" data-i="${i}">${f.mine ? '#' : ''}${esc(f.tag)}</button>`).join('');
  $('filters').querySelectorAll('button').forEach((b) => (b.onclick = () => { state.filters.splice(+b.dataset.i, 1); render(); }));

  const list = $('list');
  if (!state.works.length) {
    list.innerHTML = '<div class="empty">Nothing saved yet. Copy a story link from AO3 and paste it in the box at the top.</div>';
    return;
  }
  if (!shown.length) { list.innerHTML = '<div class="empty">No stories match. Try removing a filter.</div>'; return; }
  list.innerHTML = shown.map((w) => `
    <div class="work" data-id="${w.id}">
      <div class="head">
        <span class="title">${esc(w.title)}</span>
        <span class="meta">by ${esc(w.authors.join(', '))}</span>
        ${w.newChapters ? '<span class="badge new">New chapters</span>' : ''}
        ${w.status !== 'to-read' ? `<span class="badge">${w.status === 'reading' ? 'Reading' : 'Finished'}</span>` : ''}
      </div>
      <div class="meta">${esc(w.fandoms.join(', '))} &middot; ${esc(w.rating)} &middot; ${w.words.toLocaleString()} words &middot; ${esc(w.chapters)} chapters ${w.complete ? '' : '(still being written)'}</div>
      ${w.summary ? `<div class="summary">${esc(w.summary)}</div>` : ''}
      <div class="chips">
        ${w.myTags.map((t) => `<button class="chip mine" data-tag="${esc(t)}" data-mine="1">#${esc(t)}</button>`).join('')}
        ${w.relationships.slice(0, 3).map((t) => `<button class="chip ship" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}
        ${w.freeforms.slice(0, 6).map((t) => `<button class="chip" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}
      </div>
    </div>`).join('');
  list.querySelectorAll('.work').forEach((el) => (el.onclick = (e) => {
    const chip = e.target.closest('.chip');
    if (chip) return toggleFilter(chip.dataset.tag, !!chip.dataset.mine);
    openReader(el.dataset.id);
  }));
}

$('search').addEventListener('input', (e) => { state.search = e.target.value.trim().toLowerCase(); render(); });
$('sort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });

// ---------- reader ----------

const current = () => state.works.find((w) => w.id === state.open);
// Change the copy on screen first so quick edits in a row build on each other.
function update(changes) {
  Object.assign(current(), changes);
  return api('/api/work/' + state.open, { method: 'POST', body: changes });
}

function openReader(id) {
  state.open = id;
  const w = current();
  $('libraryView').hidden = true;
  $('readerView').hidden = false;
  $('rTitle').textContent = w.title;
  $('rAuthor').textContent = 'by ' + w.authors.join(', ');
  $('rStatus').value = w.status;
  $('rNotes').value = w.notes || '';
  $('rEpub').hidden = !w.hasEpub;
  $('rEpub').href = `/story/${id}/story.epub`;
  $('rAo3').href = w.url;
  renderMyTags();
  const frame = $('rFrame');
  frame.onload = () => {
    const doc = frame.contentDocument.scrollingElement;
    const max = () => doc.scrollHeight - frame.clientHeight;
    doc.scrollTop = (w.progress || 0) * max();
    let t;
    frame.contentWindow.onscroll = () => {
      clearTimeout(t);
      t = setTimeout(() => update({ progress: max() > 0 ? doc.scrollTop / max() : 0 }), 800);
    };
  };
  frame.src = `/story/${id}/story.html`;
  if (w.newChapters) update({ newChapters: false });
  if (w.status === 'to-read') { update({ status: 'reading' }); $('rStatus').value = 'reading'; }
  history.pushState({ reader: id }, '', '#' + id);
}

function closeReader() {
  state.open = null;
  $('rFrame').src = 'about:blank';
  $('readerView').hidden = true;
  $('libraryView').hidden = false;
  render();
}

function renderMyTags() {
  const w = current();
  $('rMyTags').innerHTML = w.myTags.map((t) => `<button class="chip mine filter" data-tag="${esc(t)}" title="Remove">#${esc(t)}</button>`).join('') || '<span class="muted">None yet</span>';
  $('rMyTags').querySelectorAll('button').forEach((b) => (b.onclick = async () => { await update({ myTags: w.myTags.filter((t) => t !== b.dataset.tag) }); renderMyTags(); }));
  const every = new Set(state.works.flatMap((x) => x.myTags));
  $('tagSuggest').innerHTML = [...every].map((t) => `<option value="${esc(t)}">`).join('');
}

$('rTagInput').addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter' && e.key !== ',') return;
  e.preventDefault();
  const w = current();
  const add = e.target.value.split(/[,]+/).map(cleanTag).filter(Boolean);
  e.target.value = '';
  await update({ myTags: [...new Set([...w.myTags, ...add])] });
  renderMyTags();
});
$('rStatus').addEventListener('change', (e) => update({ status: e.target.value }));
$('rNotes').addEventListener('change', (e) => update({ notes: e.target.value }));
$('rMore').addEventListener('click', () => ($('rDetails').hidden = !$('rDetails').hidden));
$('backBtn').addEventListener('click', () => history.back());
window.addEventListener('popstate', () => { if (state.open) closeReader(); });

$('rUpdate').addEventListener('click', async () => {
  const w = current();
  $('rUpdate').disabled = true;
  $('rUpdate').textContent = 'Checking...';
  const r = await api('/api/add', { method: 'POST', body: { url: w.url } });
  $('rUpdate').disabled = false;
  $('rUpdate').textContent = 'Check for new chapters';
  if (!r.ok) return alert(r.message);
  const before = w.chapters;
  Object.assign(w, r.work);
  alert(before === r.work.chapters ? 'No new chapters. Your copy is up to date.' : `Updated: now ${r.work.chapters} chapters.`);
  if (r.work.newChapters) update({ newChapters: false });
  $('rFrame').contentWindow.location.reload();
});

$('rDelete').addEventListener('click', async () => {
  const w = current();
  if (!confirm(`Remove "${w.title}" from your library? Your saved copy will be deleted.`)) return;
  await api('/api/work/' + w.id, { method: 'DELETE' });
  state.works = state.works.filter((x) => x.id !== w.id);
  history.back();
});

load();
setInterval(() => { if (!state.open && state.waiting.length) load(); }, 60000);
