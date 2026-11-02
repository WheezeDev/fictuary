// Fictuary for phones - screens and reading
const $ = (id) => document.getElementById(id);
const state = { works: [], search: '', shelf: 'all', filters: [], open: null, markers: [], textSize: 1 };
const SHELVES = [['all', 'All'], ['new', 'New chapters'], ['reading', 'Reading'], ['to-read', 'To read'], ['caught-up', 'Caught up'], ['finished', 'Finished']];
const BACKUP_REMIND_DAYS = 14;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cleanTag = (t) => t.trim().replace(/^#+/, '').toLowerCase().replace(/\s+/g, '-');
const ao3Tags = (w) => [...w.fandoms, ...w.relationships, ...w.characters, ...w.freeforms, ...w.warnings, ...w.categories, w.rating].filter(Boolean);
const daysSince = (iso) => (iso ? Math.floor((Date.now() - new Date(iso)) / 86400000) : Infinity);
const plural = (n, word) => `${n} ${n === 1 ? word : word.replace(/y$/, 'ie') + 's'}`;
const find = (id) => state.works.find((w) => w.id === id);

async function saveWork(w) {
  w.changedAt = new Date().toISOString();
  await Store.putWork(w);
}

// ---------- small helpers for messages ----------

let toastTimer;
function toast(msg, ms = 3500) {
  $('toast').textContent = msg;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('toast').hidden = true), ms);
}

// Ask a question with clearly named buttons. Resolves to the chosen button's value.
function ask(text, buttons) {
  return new Promise((resolve) => {
    $('dialogText').textContent = text;
    $('dialogButtons').innerHTML = '';
    for (const [value, label, cls] of buttons) {
      const b = document.createElement('button');
      b.textContent = label;
      if (cls) b.className = cls;
      b.onclick = () => { $('dialog').hidden = true; resolve(value); };
      $('dialogButtons').appendChild(b);
    }
    $('dialog').hidden = false;
  });
}

function openSheet(id) {
  document.querySelectorAll('.sheet').forEach((s) => (s.hidden = s.id !== id));
  $('shade').hidden = false;
}
function closeSheets() {
  document.querySelectorAll('.sheet').forEach((s) => (s.hidden = true));
  $('shade').hidden = true;
}
$('shade').onclick = closeSheets;
document.querySelectorAll('.sheet .close').forEach((b) => (b.onclick = closeSheets));

// ---------- adding stories ----------

$('addBtn').onclick = () => $('fileInput').click();
$('fileInput').onchange = async (e) => {
  const files = [...e.target.files];
  e.target.value = '';
  const results = [];
  for (const file of files) {
    try {
      results.push(await addStory(await file.text()));
    } catch (err) {
      results.push(`${file.name}: ${err.message}`);
    }
  }
  await loadLibrary();
  if (results.length === 1) toast(results[0], 5000);
  else toast(results.join('\n'), 7000);
};

async function addStory(html) {
  const parsed = AO3.parse(html);
  const { chapters, storyNotes, endNotes, ...meta } = parsed;
  const old = await Store.getWork(meta.id);
  const now = new Date().toISOString();

  if (!old) {
    await Store.putText({ id: meta.id, chapters, storyNotes, endNotes });
    await saveWork({ ...meta, myTags: [], notes: '', status: 'to-read', position: { ch: 0, p: 0 }, newChapters: 0,
      readChapters: 0, addedAt: now, savedAt: now, lastReadAt: null });
    return `Added "${meta.title}".`;
  }

  // Same story again: this is how new chapters come in.
  const shorter = meta.chapterCount < old.chapterCount || meta.words < old.words * 0.9;
  if (shorter) {
    const choice = await ask(
      `This download of "${meta.title}" is shorter than the copy you have saved.\n\n` +
      `Your copy: ${plural(old.chapterCount, 'chapter')}, ${old.words.toLocaleString()} words.\n` +
      `This download: ${plural(meta.chapterCount, 'chapter')}, ${meta.words.toLocaleString()} words.\n\n` +
      'The author may have removed or rewritten parts of it.',
      [['keep', 'Keep my copy', 'primary'], ['replace', 'Use the new version']]);
    if (choice === 'keep') return `Kept your saved copy of "${meta.title}".`;
  }

  const added = Math.max(0, meta.chapterCount - old.chapterCount);
  const wasCaughtUp = old.readChapters >= old.chapterCount || ['caught-up', 'finished'].includes(old.status);
  const work = {
    ...old, ...meta,
    myTags: old.myTags, notes: old.notes, addedAt: old.addedAt, lastReadAt: old.lastReadAt,
    savedAt: now,
    newChapters: (old.newChapters || 0) + added,
  };
  if (added && wasCaughtUp) {
    work.position = { ch: old.chapterCount, p: 0 }; // straight to the first new chapter
    work.status = 'reading';
  }
  if (meta.chapterCount < old.chapterCount && work.position.ch >= meta.chapterCount) work.position = { ch: meta.chapterCount - 1, p: 0 };
  if (work.complete && work.status === 'caught-up') work.status = 'finished';
  await Store.putText({ id: meta.id, chapters, storyNotes, endNotes });
  await saveWork(work);
  if (added) return `"${meta.title}": ${plural(added, 'new chapter')}.`;
  if (shorter) return `Replaced "${meta.title}" with the new version.`;
  return `"${meta.title}" is already up to date.`;
}

// ---------- library ----------

async function loadLibrary() {
  state.works = await Store.allWorks();
  renderLibrary();
}

function matches(w) {
  if (state.shelf === 'new' ? !w.newChapters : state.shelf !== 'all' && w.status !== state.shelf) return false;
  for (const f of state.filters) if (f.mine ? !w.myTags.includes(f.tag) : !ao3Tags(w).includes(f.tag)) return false;
  if (state.search) {
    const hay = [w.title, ...w.authors, w.summary, w.series, ...ao3Tags(w), ...w.myTags.map((t) => '#' + t), w.notes].join(' ').toLowerCase();
    if (!state.search.split(/\s+/).every((word) => hay.includes(word))) return false;
  }
  return true;
}

function toggleFilter(tag, mine) {
  const i = state.filters.findIndex((f) => f.tag === tag && !!f.mine === mine);
  if (i >= 0) state.filters.splice(i, 1);
  else state.filters.push({ tag, mine });
  renderLibrary();
  if (!$('filterSheet').hidden) renderFilterSheet();
}

function renderContinue() {
  const last = state.works.filter((w) => w.lastReadAt && w.status !== 'finished').sort((a, b) => b.lastReadAt.localeCompare(a.lastReadAt))[0];
  const box = $('continue');
  box.hidden = !last;
  if (!last) return;
  const ch = Math.min(last.position.ch + 1, last.chapterCount);
  box.innerHTML = `<div class="label">Continue reading</div><div class="t">${esc(last.title)}</div>
    <div class="muted small">Chapter ${ch} of ${last.chapterCount}${last.newChapters ? ` &middot; <span class="danger">${plural(last.newChapters, 'new chapter')}</span>` : ''}</div>`;
  box.onclick = () => openReader(last.id);
  box.setAttribute('role', 'button');
}

async function renderBackupHint() {
  const last = await Store.getSetting('lastBackupAt');
  const box = $('backupHint');
  box.hidden = !state.works.length || daysSince(last) < BACKUP_REMIND_DAYS;
  box.innerHTML = `${last ? `Last backup ${daysSince(last)} days ago.` : 'Not backed up yet.'} Your stories are only on this phone.<button type="button">Back up</button>`;
  box.querySelector('button').onclick = backup;
}

function renderLibrary() {
  renderContinue();
  renderBackupHint();
  const shown = state.works.filter(matches).sort((a, b) => (b.lastReadAt || b.addedAt).localeCompare(a.lastReadAt || a.addedAt));

  $('shelves').innerHTML = '';
  for (const [key, label] of SHELVES) {
    const n = key === 'all' ? state.works.length : key === 'new' ? state.works.filter((w) => w.newChapters).length : state.works.filter((w) => w.status === key).length;
    if (key !== 'all' && !n && state.shelf !== key) continue;
    const b = document.createElement('button');
    b.className = state.shelf === key ? 'on' : '';
    b.innerHTML = `${label}<span class="n">${n}</span>`;
    b.onclick = () => { state.shelf = key; renderLibrary(); };
    $('shelves').appendChild(b);
  }

  $('filterBtn').textContent = state.filters.length ? `Filter (${state.filters.length})` : 'Filter';
  $('activeFilters').innerHTML = state.filters.map((f, i) => `<button class="chip x ${f.mine ? 'mine' : ''}" data-i="${i}">${f.mine ? '#' : ''}${esc(f.tag)}</button>`).join('');
  $('activeFilters').querySelectorAll('button').forEach((b) => (b.onclick = () => { state.filters.splice(+b.dataset.i, 1); renderLibrary(); }));

  const list = $('list');
  if (!state.works.length) {
    list.innerHTML = `<div class="empty"><p>Nothing saved yet. Stories you add here stay on your phone, so you can read them even when AO3 is down or the story is taken off AO3.</p>
      <ol><li>Open a story on AO3.</li><li>Tap Download, then HTML.</li><li>Come back and tap Add story, then pick the file.</li></ol></div>`;
    return;
  }
  if (!shown.length) { list.innerHTML = '<div class="empty">No stories match. Try removing a filter.</div>'; return; }

  list.innerHTML = shown.map((w) => {
    const ongoing = !w.complete ? ` &middot; still being written, saved ${daysSince(w.savedAt) === 0 ? 'today' : daysSince(w.savedAt) + ' days ago'}` : '';
    return `<div class="work" data-id="${w.id}">
      <div><span class="title">${esc(w.title)}</span>${w.newChapters ? `<span class="badge new">${plural(w.newChapters, 'new chapter')}</span>` : ''}${w.status === 'caught-up' ? '<span class="badge">Caught up</span>' : ''}${w.status === 'finished' ? '<span class="badge">Finished</span>' : ''}</div>
      <div class="meta">${esc(w.authors.join(', '))} &middot; ${esc(w.fandoms.slice(0, 2).join(', '))}</div>
      <div class="meta">${w.words.toLocaleString()} words &middot; ${esc(w.chaptersLabel)} chapters${w.complete ? ' &middot; Complete' : ongoing}</div>
      ${w.summary ? `<div class="summary">${esc(w.summary)}</div>` : ''}
      <div class="chips">
        ${w.myTags.map((t) => `<button class="chip mine" data-tag="${esc(t)}" data-mine="1">#${esc(t)}</button>`).join('')}
        ${w.relationships.slice(0, 2).map((t) => `<button class="chip ship" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}
        ${w.freeforms.slice(0, 4).map((t) => `<button class="chip" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}
      </div>
    </div>`;
  }).join('');
  list.querySelectorAll('.work').forEach((el) => (el.onclick = (e) => {
    const chip = e.target.closest('.chip');
    if (chip) return toggleFilter(chip.dataset.tag, !!chip.dataset.mine);
    openReader(el.dataset.id);
  }));
}

$('search').oninput = (e) => { state.search = e.target.value.trim().toLowerCase(); renderLibrary(); };

// ---------- filter sheet ----------

function countTags(list, pick) {
  const counts = new Map();
  for (const w of list) for (const t of pick(w)) counts.set(t, (counts.get(t) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function renderFilterSheet() {
  const shown = state.works.filter(matches);
  const fill = (el, counts, mine, limit = 50) => {
    el.innerHTML = counts.length ? '' : '<span class="muted small">None</span>';
    for (const [tag, n] of counts.slice(0, limit)) {
      const b = document.createElement('button');
      b.className = state.filters.some((f) => f.tag === tag && !!f.mine === mine) ? 'on' : '';
      b.innerHTML = `${mine ? '#' : ''}${esc(tag)}<span class="n">${n}</span>`;
      b.onclick = () => toggleFilter(tag, mine);
      el.appendChild(b);
    }
  };
  // Counts follow what is currently shown, so the lists narrow as you pick tags.
  fill($('fMine'), countTags(shown, (w) => w.myTags), true);
  fill($('fFandoms'), countTags(shown, (w) => w.fandoms), false);
  fill($('fShips'), countTags(shown, (w) => w.relationships), false);
  fill($('fChars'), countTags(shown, (w) => w.characters), false, 30);
  fill($('fFree'), countTags(shown, (w) => w.freeforms), false, 60);
}
$('filterBtn').onclick = () => { renderFilterSheet(); openSheet('filterSheet'); };
$('clearFilters').onclick = () => { state.filters = []; renderLibrary(); renderFilterSheet(); };

// ---------- reader ----------

let libraryScroll = 0;

async function openReader(id, fromHistory) {
  const w = find(id);
  const text = await Store.getText(id);
  if (!w || !text) return toast('That story could not be found.');
  state.open = id;
  libraryScroll = window.scrollY;
  $('libraryView').hidden = true;
  $('readerView').hidden = false;
  $('rTitle').textContent = w.title;

  const firstNew = w.chapterCount - (w.newChapters || 0);
  const head = `<div class="story-head"><h1>${esc(w.title)}</h1><div>by ${esc(w.authors.join(', '))}</div>
    ${w.summary ? `<p>${esc(w.summary).replace(/\n+/g, '<br>')}</p>` : ''}
    ${text.storyNotes ? `<p><strong>Notes</strong></p>${text.storyNotes}` : ''}</div>`;
  $('story').innerHTML = head + text.chapters.map((c, i) => `<section data-ch="${i}">
      ${w.chapterCount > 1 || c.title ? `<h2 class="ch-title">${esc(c.title || 'Chapter ' + (i + 1))}${w.newChapters && i >= firstNew ? ' <span class="badge new">new</span>' : ''}</h2>` : ''}
      ${c.html}</section>`).join('') +
    (text.endNotes ? `<section class="chapter-notes">${text.endNotes}</section>` : '') +
    `<div class="story-end"><p>${w.complete ? 'The end.' : `You are caught up. This story is still being written (${esc(w.chaptersLabel)} chapters).`}</p>
      <p>If you enjoyed it, let the author know.</p>
      <button type="button" class="primary" data-act="kudos">Leave kudos on AO3</button>
      ${w.complete ? '' : '<button type="button" data-act="latest">Get latest chapters</button>'}</div>`;
  $('story').querySelectorAll('[data-act]').forEach((b) => (b.onclick = () => (b.dataset.act === 'kudos' ? openOnAo3(w) : getLatest(w))));

  // Every paragraph gets a number so we can come back to the exact spot.
  state.markers = [...$('story').querySelectorAll('section[data-ch]')].map((s) =>
    [...s.querySelectorAll('p, h2, h3, h4, li, hr, img, blockquote')].filter((el) => !el.closest('blockquote') || el.tagName === 'BLOCKQUOTE'));
  state.markers.forEach((list, ch) => list.forEach((el, p) => { el.dataset.ch = ch; el.dataset.p = p; }));

  if (!fromHistory) history.pushState({ reader: id }, '', '#story-' + id);
  setTimeout(() => goTo(w.position || { ch: 0, p: 0 }), 0);

  w.lastReadAt = new Date().toISOString();
  if (w.status === 'to-read') w.status = 'reading';
  await saveWork(w);
}

function barHeight() { return document.querySelector('#readerView .bar').offsetHeight; }

function goTo(pos) {
  const list = state.markers[pos.ch] || [];
  const el = list[pos.p] || document.querySelector(`section[data-ch="${pos.ch}"]`);
  if (!el || (pos.ch === 0 && pos.p === 0)) return window.scrollTo(0, 0);
  // Jump again shortly after, in case pictures in the story loaded and moved the text.
  const jump = () => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - barHeight() - 8);
  jump();
  setTimeout(jump, 120);
}

function currentPosition() {
  const top = barHeight() + 4;
  for (const [ch, list] of state.markers.entries()) {
    const section = document.querySelector(`section[data-ch="${ch}"]`);
    const r = section.getBoundingClientRect();
    if (r.bottom <= top) continue;
    const p = list.findIndex((el) => el.getBoundingClientRect().bottom > top);
    return { ch, p: Math.max(0, p) };
  }
  return { ch: state.markers.length - 1, p: 0 };
}

let scrollTimer;
window.addEventListener('scroll', () => {
  if (!state.open) return;
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(async () => {
    const w = find(state.open);
    if (!w) return;
    w.position = currentPosition();
    w.readChapters = Math.max(w.readChapters || 0, w.position.ch);
    if (w.newChapters && w.position.ch >= w.chapterCount - w.newChapters) w.newChapters = Math.max(0, w.chapterCount - 1 - w.position.ch);
    const atEnd = $('story').querySelector('.story-end').getBoundingClientRect().top < window.innerHeight;
    if (atEnd) {
      w.readChapters = w.chapterCount;
      w.newChapters = 0;
      if (w.status === 'reading' || w.status === 'to-read') w.status = w.complete ? 'finished' : 'caught-up';
    }
    await saveWork(w);
  }, 400);
}, { passive: true });

function closeReader() {
  state.open = null;
  closeSheets();
  $('story').innerHTML = '';
  state.markers = [];
  $('readerView').hidden = true;
  $('libraryView').hidden = false;
  renderLibrary();
  window.scrollTo(0, libraryScroll);
}

$('backBtn').onclick = () => history.back();
window.addEventListener('popstate', () => {
  if (state.open) closeReader();
  else if (location.hash.startsWith('#story-')) openReader(location.hash.slice(7), true);
});

function openOnAo3(w) { window.open(w.url, '_blank', 'noopener'); }

async function getLatest(w) {
  const go = await ask(
    `AO3 will open and download the newest version of "${w.title}".\n\n` +
    'When it has downloaded, come back here, tap Add story, and pick the file. Your tags, notes and place are kept.',
    [['go', 'Open AO3 download', 'primary'], ['cancel', 'Cancel']]);
  if (go !== 'go') return;
  const name = w.title.replace(/[^\w ]+/g, '').trim().slice(0, 40).replace(/ +/g, '_') || 'story';
  window.open(`https://archiveofourown.org/downloads/${w.id}/${encodeURIComponent(name)}.html`, '_blank', 'noopener');
}

// ---------- details sheet ----------

function renderDetails() {
  const w = find(state.open);
  $('dTitle').textContent = w.title;
  $('dMeta').innerHTML = `${esc(w.authors.join(', '))} &middot; ${esc(w.rating)} &middot; ${w.words.toLocaleString()} words &middot; ${esc(w.chaptersLabel)} chapters<br>
    ${esc(w.fandoms.join(', '))}<br>Saved ${daysSince(w.savedAt) === 0 ? 'today' : daysSince(w.savedAt) + ' days ago'}${w.updated ? ` &middot; updated on AO3 ${esc(w.updated)}` : ''}`;
  $('dTags').innerHTML = w.myTags.map((t) => `<button class="chip mine x" data-tag="${esc(t)}">#${esc(t)}</button>`).join('') || '<span class="muted small">None yet</span>';
  $('dTags').querySelectorAll('button').forEach((b) => (b.onclick = async () => {
    w.myTags = w.myTags.filter((t) => t !== b.dataset.tag);
    await saveWork(w);
    renderDetails();
  }));
  $('tagSuggest').innerHTML = [...new Set(state.works.flatMap((x) => x.myTags))].map((t) => `<option value="${esc(t)}">`).join('');
  $('dStatus').value = w.status;
  $('dNotes').value = w.notes || '';
  $('dLatest').hidden = w.complete;

  const here = currentPosition().ch;
  Store.getText(w.id).then((t) => {
    const firstNew = w.chapterCount - (w.newChapters || 0);
    $('dChapters').innerHTML = t.chapters.map((c, i) =>
      `<button type="button" data-ch="${i}" class="${i === here ? 'here' : ''} ${w.newChapters && i >= firstNew ? 'new' : ''}">${esc(c.title || 'Chapter ' + (i + 1))}</button>`).join('');
    $('dChapters').querySelectorAll('button').forEach((b) => (b.onclick = () => { closeSheets(); goTo({ ch: +b.dataset.ch, p: 0 }); }));
    const cur = $('dChapters').querySelector('.here');
    if (cur) $('dChapters').scrollTop = cur.offsetTop - $('dChapters').clientHeight / 2;
  });
}

$('detailsBtn').onclick = () => { renderDetails(); openSheet('detailsSheet'); };
$('tagForm').onsubmit = async (e) => {
  e.preventDefault();
  const w = find(state.open);
  const add = $('tagInput').value.split(',').map(cleanTag).filter(Boolean);
  $('tagInput').value = '';
  w.myTags = [...new Set([...w.myTags, ...add])];
  await saveWork(w);
  renderDetails();
};
$('dStatus').onchange = async (e) => { const w = find(state.open); w.status = e.target.value; await saveWork(w); };
$('dNotes').onchange = async (e) => { const w = find(state.open); w.notes = e.target.value; await saveWork(w); };
$('dLatest').onclick = () => getLatest(find(state.open));
$('dKudos').onclick = () => openOnAo3(find(state.open));
$('dRemove').onclick = async () => {
  const w = find(state.open);
  const choice = await ask(`Remove "${w.title}" from your library?\n\nThe saved copy on this phone will be deleted. If the story is later taken off AO3, you will not be able to get it back unless it is in a backup.`,
    [['cancel', 'Keep it', 'primary'], ['remove', 'Remove', 'danger']]);
  if (choice !== 'remove') return;
  await Store.remove(w.id);
  state.works = state.works.filter((x) => x.id !== w.id);
  history.back();
  toast(`Removed "${w.title}".`);
};

// ---------- more: text size, backup, space ----------

function applyTextSize() {
  document.documentElement.style.setProperty('--read-size', state.textSize);
  $('sizeLabel').textContent = Math.round(state.textSize * 100) + '%';
}
async function changeSize(step) {
  state.textSize = Math.min(1.8, Math.max(0.8, Math.round((state.textSize + step) * 10) / 10));
  applyTextSize();
  await Store.setSetting('textSize', state.textSize);
}
$('smaller').onclick = () => changeSize(-0.1);
$('bigger').onclick = () => changeSize(0.1);

async function renderMenu() {
  const last = await Store.getSetting('lastBackupAt');
  $('backupInfo').textContent = last ? `Last backup: ${new Date(last).toLocaleDateString()}` : 'No backup yet.';
  let space = `${plural(state.works.length, 'story')} saved.`;
  if (navigator.storage && navigator.storage.estimate) {
    const { usage } = await navigator.storage.estimate();
    space += ` About ${(usage / 1048576).toFixed(1)} MB used.`;
  }
  $('spaceInfo').textContent = space;
}
$('menuBtn').onclick = () => { renderMenu(); openSheet('menuSheet'); };

async function backup() {
  const works = await Store.allWorks();
  const texts = await Store.allTexts();
  const data = JSON.stringify({ app: 'fictuary', version: 1, createdAt: new Date().toISOString(), works, texts });
  const name = `fictuary-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([data], name, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Fictuary backup' }); // iPhone: choose "Save to Files"
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    }
  } catch (err) {
    if (err.name === 'AbortError') return toast('Backup cancelled.');
    throw err;
  }
  await Store.setSetting('lastBackupAt', new Date().toISOString());
  toast(`Backup made with ${plural(works.length, 'story')}. Keep the file somewhere safe.`);
  renderBackupHint();
  if (!$('menuSheet').hidden) renderMenu();
}
$('backupBtn').onclick = backup;

$('restoreBtn').onclick = () => $('restoreInput').click();
$('restoreInput').onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { data = null; }
  if (!data || data.app !== 'fictuary') return toast('That file is not a Fictuary backup.');
  const texts = new Map(data.texts.map((t) => [t.id, t]));
  let added = 0, updated = 0;
  // Merge: stories missing here are added, and for stories on both, the more recently changed copy wins.
  for (const w of data.works) {
    const mine = await Store.getWork(w.id);
    if (mine && mine.changedAt >= w.changedAt) continue;
    if (!texts.has(w.id)) continue;
    await Store.putText(texts.get(w.id));
    await Store.putWork(w);
    mine ? updated++ : added++;
  }
  await loadLibrary();
  closeSheets();
  toast(`Restored: ${plural(added, 'story')} added, ${updated} updated.`);
};

// ---------- start ----------

(async () => {
  state.textSize = (await Store.getSetting('textSize')) || 1;
  applyTextSize();
  await loadLibrary();
  if (location.hash.startsWith('#story-')) history.replaceState(null, '', location.pathname);
  // Ask the phone to keep this app's stories even when space runs low.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
})();
