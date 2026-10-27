// Generates images/og-default.png — the fallback social/OG image used by pages
// that have no photo of their own (homepage, About, Contact, the grocery tool,
// Submit a Recipe). Run with: node tools/make-og-default.js
//
// 1200x630 is the size Facebook/X/LinkedIn crop to; the palette matches
// style.css (--bg, --ink, --accent, --rule) so the card looks like the site.
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "images", "og-default.png");
const LOGO = path.join(ROOT, "images", "logo-mark.png");

const W = 1200;
const H = 630;

const background = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#fffdfa"/>
  <rect x="28" y="28" width="${W - 56}" height="${H - 56}" fill="none" stroke="#e4ddd0" stroke-width="2"/>
  <text x="600" y="392" font-family="Georgia, 'Times New Roman', serif" font-size="86" fill="#1c1a17" text-anchor="middle">The Delicious Daily</text>
  <rect x="560" y="428" width="80" height="3" fill="#8a3324"/>
  <text x="600" y="500" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="32" fill="#756e66" text-anchor="middle">A daily dose of deliciousness</text>
</svg>`;

async function main() {
  const logo = await sharp(LOGO).resize({ height: 120 }).png().toBuffer();
  await sharp(Buffer.from(background))
    .composite([{ input: logo, top: 150, left: Math.round((W - 120) / 2) }])
    .png({ quality: 90 })
    .toFile(OUT);
  console.log("wrote", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
