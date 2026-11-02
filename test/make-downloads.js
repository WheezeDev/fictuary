// Writes pretend AO3 "Download > HTML" files into test/downloads for trying the phone app.
const fs = require('fs');
const path = require('path');

function download({ id, title, author, chapters, total, extraTags = '' }) {
  const words = chapters.length * 900;
  const body = chapters.length === 1 && total === '1'
    ? `<div class="userstuff">${chapters[0]}</div>`
    : chapters.map((text, i) => `<div class="meta group"><h2 class="heading">Chapter ${i + 1}: Part ${i + 1}</h2>
<p>Chapter Notes</p><blockquote class="userstuff"><p>Notes for chapter ${i + 1}.</p></blockquote></div>
<div class="userstuff">${text}</div>`).join('\n');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title} - ${author} - Haikyuu!! [Archive of Our Own]</title></head><body>
<div id="preface">
<p class="message"><b>${title}</b><br/>Posted originally on the <a href="https://archiveofourown.org/">Archive of Our Own</a> at <a href="https://archiveofourown.org/works/${id}">https://archiveofourown.org/works/${id}</a>.</p>
<div class="meta"><dl class="tags">
<dt>Rating:</dt><dd><a class="tag" href="https://archiveofourown.org/tags/Teen">Teen And Up Audiences</a></dd>
<dt>Archive Warning:</dt><dd><a class="tag" href="#">No Archive Warnings Apply</a></dd>
<dt>Category:</dt><dd><a class="tag" href="#">M/M</a></dd>
<dt>Fandom:</dt><dd><a class="tag" href="#">Haikyuu!!</a></dd>
<dt>Relationship:</dt><dd><a class="tag" href="#">Kageyama Tobio/Hinata Shōyō</a></dd>
<dt>Characters:</dt><dd><a class="tag" href="#">Hinata Shōyō</a>, <a class="tag" href="#">Kageyama Tobio</a></dd>
<dt>Additional Tags:</dt><dd><a class="tag" href="#">Fluff</a>, <a class="tag" href="#">Slow Burn</a>${extraTags}</dd>
<dt>Language:</dt><dd>English</dd>
<dt>Stats:</dt><dd>Published: 2024-03-01 Updated: 2026-10-20 Words: ${words.toLocaleString()} Chapters: ${chapters.length}/${total}</dd>
</dl>
<h1>${title}</h1>
<div class="byline">by <a rel="author" href="https://archiveofourown.org/users/${author}">${author}</a></div>
<p>Summary</p><blockquote class="userstuff"><p>Two boys, one ball, and a lot of yelling.</p><p>Somehow it's sweet.</p></blockquote>
</div></div>
<div id="chapters" class="userstuff">
${body}
</div>
<div id="afterword"><p>End Notes</p><blockquote class="userstuff"><p>Thanks for reading!</p></blockquote>
<p>Please <a href="https://archiveofourown.org/works/${id}#comments">drop by the archive and comment</a> to let the creator know if you enjoyed their work!</p></div>
<script>window.hacked = true</script>
</body></html>`;
}

const para = (ch, n) => Array.from({ length: n }, (_, i) => `<p>Chapter ${ch}, paragraph ${i + 1}. The gym smelled like floor polish and ambition, and the net looked higher than it had yesterday.</p>`).join('\n');
const out = path.join(__dirname, 'downloads');
fs.mkdirSync(out, { recursive: true });
const ch = (n) => Array.from({ length: n }, (_, i) => para(i + 1, 40));
const files = {
  'Serve_and_Volley_2ch.html': download({ id: 123, title: 'Serve &amp; Volley', author: 'sunnyday', chapters: ch(2), total: '?' }),
  'Serve_and_Volley_3ch.html': download({ id: 123, title: 'Serve &amp; Volley', author: 'sunnyday', chapters: ch(3), total: '?' }),
  'Serve_and_Volley_rewritten_1ch.html': download({ id: 123, title: 'Serve &amp; Volley', author: 'sunnyday', chapters: ch(1), total: '?' }),
  'Quiet_Hours_oneshot.html': download({ id: 456, title: 'Quiet Hours', author: 'nightowl', chapters: [para(1, 30) + '<p onclick="alert(1)"><a href="javascript:alert(1)">bad link</a></p>'], total: '1', extraTags: ', <a class="tag" href="#">Hurt/Comfort</a>' }),
  'not_a_story.html': '<html><body><p>hello</p></body></html>',
};
for (const [name, html] of Object.entries(files)) fs.writeFileSync(path.join(out, name), html);
console.log('Wrote', Object.keys(files).length, 'files to', out);
