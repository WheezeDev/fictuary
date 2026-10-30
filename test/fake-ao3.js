// A pretend AO3 for testing while the real one is down or to avoid bothering it.
// Run: node test/fake-ao3.js   then start the app with AO3_TEST_SITE=http://localhost:4399
const http = require('http');

let chapters = '2/?';
const page = (id) => `<!DOCTYPE html><html><head><title>Test | Archive of Our Own</title></head><body>
<div class="wrapper"><dl class="work meta group">
<dt class="rating tags">Rating:</dt><dd class="rating tags"><ul class="commas"><li><a class="tag" href="/tags/Teen">Teen And Up Audiences</a></li></ul></dd>
<dt class="warning tags">Archive Warning:</dt><dd class="warning tags"><ul class="commas"><li><a class="tag" href="/tags/x">No Archive Warnings Apply</a></li></ul></dd>
<dt class="category tags">Category:</dt><dd class="category tags"><ul class="commas"><li><a class="tag" href="/tags/x">M/M</a></li></ul></dd>
<dt class="fandom tags">Fandom:</dt><dd class="fandom tags"><ul class="commas"><li><a class="tag" href="/tags/x">Haikyuu!!</a></li></ul></dd>
<dt class="relationship tags">Relationship:</dt><dd class="relationship tags"><ul class="commas"><li><a class="tag" href="/tags/x">Kageyama Tobio/Hinata Sh&#333;y&#333;</a></li></ul></dd>
<dt class="character tags">Characters:</dt><dd class="character tags"><ul class="commas"><li><a class="tag" href="/tags/x">Hinata Sh&#333;y&#333;</a></li><li><a class="tag" href="/tags/x">Kageyama Tobio</a></li></ul></dd>
<dt class="freeform tags">Additional Tags:</dt><dd class="freeform tags"><ul class="commas"><li><a class="tag" href="/tags/x">Fluff</a></li><li><a class="tag" href="/tags/x">Slow Burn</a></li><li><a class="tag" href="/tags/x">Rivals to Lovers &amp; More</a></li></ul></dd>
<dt class="language">Language:</dt><dd class="language" lang="en">English</dd>
<dt class="stats">Stats:</dt><dd class="stats"><dl class="stats"><dt class="published">Published:</dt><dd class="published">2024-03-01</dd><dt class="status">Updated:</dt><dd class="status">2026-10-20</dd><dt class="words">Words:</dt><dd class="words">12,345</dd><dt class="chapters">Chapters:</dt><dd class="chapters">${chapters}</dd><dt class="kudos">Kudos:</dt><dd class="kudos">4,321</dd></dl></dd>
</dl>
<ul class="expandable secondary"><li class="download"><a href="/downloads/${id}/Test%20Story.epub?updated_at=1">EPUB</a></li><li><a href="/downloads/${id}/Test%20Story.html?updated_at=1">HTML</a></li></ul>
<div id="workskin"><div class="preface group">
<h2 class="title heading">
  Serve &amp; Volley
</h2>
<h3 class="byline heading"><a rel="author" href="/users/sunnyday/pseuds/sunnyday">sunnyday</a></h3>
<div class="summary module" role="complementary"><h3 class="heading">Summary:</h3>
<blockquote class="userstuff"><p>Two boys, one ball, and a lot of yelling.</p><p>Somehow it's sweet.</p></blockquote></div>
</div><div id="chapters" role="article"><p>Chapter text</p></div></div></div></body></html>`;

const story = (id) => `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Serve &amp; Volley</title></head><body>
<div id="preface"><h1>Serve &amp; Volley</h1><div class="byline">by sunnyday</div></div>
<div id="chapters">${Array.from({ length: parseInt(chapters) }, (_, i) => `<h2>Chapter ${i + 1}</h2>` + '<p>The gym smelled like floor polish and ambition. '.repeat(80) + '</p>').join('<hr>')}</div>
</body></html>`;

http.createServer((req, res) => {
  console.log(req.method, req.url, req.headers['user-agent']);
  const w = req.url.match(/^\/works\/(\d+)/);
  const d = req.url.match(/^\/downloads\/(\d+)\/.*\.(html|epub)/);
  if (req.url === '/bump') { chapters = '3/?'; return res.end('now 3 chapters'); }
  if (w && w[1] === '500') { res.writeHead(503); return res.end('The archive is down for maintenance.'); }
  if (w && w[1] === '999') { res.writeHead(302, { Location: '/users/login?restricted=true' }); return res.end(); }
  if (req.url.startsWith('/users/login')) { res.writeHead(200); return res.end('<html><body>Log in. This work is only available to registered users of the Archive.</body></html>'); }
  if (w) { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(page(w[1])); }
  if (d && d[2] === 'html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(story(d[1])); }
  if (d) { res.writeHead(200, { 'Content-Type': 'application/epub+zip' }); return res.end(Buffer.from('PK fake epub')); }
  res.writeHead(404); res.end('not found');
}).listen(4399, () => console.log('Fake AO3 on http://localhost:4399'));
