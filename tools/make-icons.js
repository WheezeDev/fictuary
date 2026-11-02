// Draws the app icon (an open book on dark red) as PNG files, with no extra installs.
// Run: node tools/make-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function png(size) {
  const px = Buffer.alloc(size * size * 4);
  const s = size / 100; // draw on a 100x100 grid
  const bg = [153, 0, 0], page = [250, 246, 238], line = [205, 185, 175];
  const inRound = (x, y, x0, y0, x1, y1, r) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const cx = Math.min(Math.max(x, x0 + r), x1 - r), cy = Math.min(Math.max(y, y0 + r), y1 - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = (i + 0.5) / s, y = (j + 0.5) / s;
    let c = bg;
    // two pages, slightly tilted at the outer top corners
    const left = inRound(x, y, 20, 30, 48.5, 72, 2.5) && y > 30 + (48.5 - x) * 0.12;
    const right = inRound(x, y, 51.5, 30, 80, 72, 2.5) && y > 30 + (x - 51.5) * 0.12;
    if (left || right) {
      c = page;
      const ly = [42, 48, 54, 60];
      const lx = left ? [26, 44] : [56, 74];
      for (const l of ly) {
        const yy = l + (left ? (48.5 - x) : (x - 51.5)) * 0.12;
        if (Math.abs(y - yy) < 0.9 && x > lx[0] && x < lx[1]) c = line;
      }
    }
    px.set([...c, 255], (j * size + i) * 4);
  }
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let j = 0; j < size; j++) px.copy(raw, j * (size * 4 + 1) + 1, j * size * 4, (j + 1) * size * 4);
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const out = path.join(__dirname, '..', 'mobile', 'icons');
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  fs.writeFileSync(path.join(out, name), png(size));
}
console.log('Icons written to', out);
