// Generates icon-192.png and icon-512.png as solid gold (#c9a96e) squares
// Uses only Node.js built-ins (zlib for PNG compression)
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

function createPNG(size) {
  const r = 0xc9, g = 0xa9, b = 0x6e; // #c9a96e gold

  // Build raw image data: each row = filter byte (0) + size*3 RGB bytes
  const rowSize = 1 + size * 3;
  const raw = Buffer.alloc(size * rowSize);
  for (let y = 0; y < size; y++) {
    const off = y * rowSize;
    raw[off] = 0; // filter type None
    for (let x = 0; x < size; x++) {
      raw[off + 1 + x * 3 + 0] = r;
      raw[off + 1 + x * 3 + 1] = g;
      raw[off + 1 + x * 3 + 2] = b;
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  function chunk(type, data) {
    const buf = Buffer.alloc(12 + data.length);
    buf.writeUInt32BE(data.length, 0);
    buf.write(type, 4, "ascii");
    data.copy(buf, 8);
    // CRC32
    let crc = 0xffffffff;
    const crcBuf = Buffer.concat([Buffer.from(type, "ascii"), data]);
    for (const byte of crcBuf) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    buf.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 8 + data.length);
    return buf;
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // color type RGB
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdrData),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const publicDir = path.join(__dirname, "../public");
fs.writeFileSync(path.join(publicDir, "icon-192.png"), createPNG(192));
fs.writeFileSync(path.join(publicDir, "icon-512.png"), createPNG(512));
fs.writeFileSync(path.join(publicDir, "apple-touch-icon.png"), createPNG(180));
console.log("✅ Generated icon-192.png, icon-512.png, apple-touch-icon.png");
