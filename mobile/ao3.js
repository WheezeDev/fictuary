// Reads a story file from AO3's "Download > HTML" button into title, tags and chapters.
const AO3 = (() => {
  const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

  // AO3 stories are written by users, so only keep harmless formatting.
  const DROP = 'script,iframe,object,embed,link,meta,form,input,button,textarea,select,base,frame,frameset,svg,math';
  function clean(root) {
    root.querySelectorAll(DROP).forEach((el) => el.remove());
    root.querySelectorAll('*').forEach((el) => {
      for (const a of [...el.attributes]) {
        const name = a.name.toLowerCase();
        const val = a.value.trim().toLowerCase();
        if (name.startsWith('on') || name === 'id' || name === 'srcset' ||
            ((name === 'href' || name === 'src' || name === 'xlink:href') && !/^(https?:|#|mailto:)/.test(val))) {
          el.removeAttribute(a.name);
        }
      }
      if (el.tagName === 'A') { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener'); }
    });
    return root;
  }

  function parse(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const preface = doc.getElementById('preface');
    const chaptersEl = doc.getElementById('chapters');
    const workLink = [...doc.querySelectorAll('a[href*="/works/"]')].map((a) => a.getAttribute('href').match(/\/works\/(\d+)/)).find(Boolean);
    if (!preface || !chaptersEl || !workLink) {
      throw new Error('This file does not look like an AO3 story download. On AO3, use Download, then HTML.');
    }

    // Tags are listed as "Fandom:" followed by links.
    const tags = {};
    let stats = '';
    for (const dt of preface.querySelectorAll('dl.tags dt')) {
      const label = text(dt).toLowerCase();
      const dd = dt.nextElementSibling;
      if (!dd) continue;
      const links = [...dd.querySelectorAll('a')].map(text).filter(Boolean);
      const key = /^rating/.test(label) ? 'rating' : /warning/.test(label) ? 'warnings' : /categor/.test(label) ? 'categories'
        : /fandom/.test(label) ? 'fandoms' : /relationship/.test(label) ? 'relationships' : /character/.test(label) ? 'characters'
        : /additional/.test(label) ? 'freeforms' : /language/.test(label) ? 'language' : /series/.test(label) ? 'series'
        : /stats/.test(label) ? 'stats' : null;
      if (key === 'stats') stats = text(dd);
      else if (key === 'language') tags.language = text(dd);
      else if (key === 'series') tags.series = text(dd);
      else if (key) tags[key] = links;
    }
    const stat = (name) => (stats.match(new RegExp(name + ':\\s*([^\\s]+)', 'i')) || [])[1] || '';

    const title = text(preface.querySelector('h1')) || text(preface.querySelector('.message b')) || text(doc.querySelector('title')).replace(/ - .*$/, '') || 'Untitled';
    const authors = [...preface.querySelectorAll('.byline a[rel="author"], .byline a')].map(text).filter(Boolean);
    const byline = text(preface.querySelector('.byline')).replace(/^by\s+/i, '');

    // Summary is a <p>Summary</p> followed by a blockquote.
    let summary = '';
    for (const p of preface.querySelectorAll('p')) {
      if (/^summary/i.test(text(p))) {
        const bq = p.nextElementSibling;
        if (bq && bq.tagName === 'BLOCKQUOTE') summary = [...bq.querySelectorAll('p')].map(text).join('\n\n') || text(bq);
        break;
      }
    }

    // Chapters: each starts with a block holding an h2 heading. One-chapter stories have none.
    clean(chaptersEl);
    const chapters = [];
    let current = null;
    for (const node of [...chaptersEl.childNodes]) {
      const heading = node.nodeType === 1 && (node.matches('h2') ? node : node.querySelector(':scope > h2'));
      if (heading) {
        current = { title: text(heading), html: '' };
        chapters.push(current);
        heading.remove();
        if (node !== heading && text(node)) current.html += '<div class="chapter-notes">' + node.innerHTML + '</div>';
        continue;
      }
      if (!current) { current = { title: '', html: '' }; chapters.push(current); }
      current.html += node.nodeType === 1 ? node.outerHTML : (node.textContent.trim() ? node.textContent : '');
    }
    const kept = chapters.filter((c) => c.html.trim() || c.title);
    if (kept.length === 1 && !kept[0].title) kept[0].title = title;

    const afterword = doc.getElementById('afterword');
    const words = parseInt(stat('Words').replace(/[^\d]/g, ''), 10) || 0;
    const [done, total] = (stat('Chapters') || kept.length + '/' + kept.length).split('/');

    return {
      id: workLink[1],
      url: 'https://archiveofourown.org/works/' + workLink[1],
      title,
      authors: authors.length ? [...new Set(authors)] : [byline || 'Anonymous'],
      summary: summary.trim(),
      rating: (tags.rating || [])[0] || '',
      warnings: tags.warnings || [],
      categories: tags.categories || [],
      fandoms: tags.fandoms || [],
      relationships: tags.relationships || [],
      characters: tags.characters || [],
      freeforms: tags.freeforms || [],
      language: tags.language || '',
      series: tags.series || '',
      published: stat('Published'),
      updated: stat('Updated') || stat('Completed') || stat('Published'),
      words,
      chapterCount: kept.length,
      chaptersLabel: done + '/' + total,
      complete: total !== '?' && done === total,
      chapters: kept,
      endNotes: afterword ? clean(afterword).innerHTML : '',
    };
  }

  return { parse };
})();
