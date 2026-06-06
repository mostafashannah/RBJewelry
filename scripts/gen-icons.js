// Generate RB Jewelry PWA icons with "RB" text using sharp + SVG
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const publicDir = path.join(__dirname, "../public");

const svg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="#c9a96e"/>
  <text x="${size/2}" y="${Math.round(size * 0.67)}"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="${Math.round(size * 0.47)}"
    font-weight="bold"
    fill="white"
    text-anchor="middle"
    letter-spacing="${Math.round(size * -0.02)}">RB</text>
</svg>`;

async function makeIcon(size, filename) {
  await sharp(Buffer.from(svg(size)))
    .png()
    .toFile(path.join(publicDir, filename));
  console.log(`✅ ${filename} (${size}×${size})`);
}

(async () => {
  await makeIcon(512, "icon-512.png");
  await makeIcon(192, "icon-192.png");
  await makeIcon(180, "apple-touch-icon.png");
  console.log("Done!");
})().catch(console.error);
