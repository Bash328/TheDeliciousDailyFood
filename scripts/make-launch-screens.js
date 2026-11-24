// Makes the iPhone/iPad launch pictures ("splash screens") for both apps, from each
// app's own icon, and keeps the <link rel="apple-touch-startup-image"> tags in step.
//
//   node scripts/make-launch-screens.js
//
// Re-run it whenever an app icon changes or a new device size needs adding below.
//   - Main site: writes images/launch/*.png and _data/launchScreens.json (the site's
//     <head> reads that file).
//   - Admin app: writes admin/launch/*.png and refreshes the block between the
//     "launch-screens" comments in admin/index.html and admin/quick/index.html.
// Android needs nothing here: it builds its launch screen from each manifest's
// background_color and icon, which are already set.
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");

// Portrait CSS size and pixel ratio. iPads also get a landscape picture.
const PHONES = [
  [320, 568, 2], [375, 667, 2], [414, 736, 3], [375, 812, 3], [414, 896, 2], [414, 896, 3],
  [390, 844, 3], [428, 926, 3], [393, 852, 3], [430, 932, 3], [402, 874, 3], [440, 956, 3],
];
const IPADS = [
  [768, 1024, 2], [810, 1080, 2], [820, 1180, 2], [834, 1112, 2], [834, 1194, 2], [744, 1133, 2], [1024, 1366, 2],
];

const APPS = [
  { name: "site", icon: "images/app-icon-512.png", out: "images/launch", url: "/images/launch" },
  { name: "admin", icon: "admin/icon-512.png", out: "admin/launch", url: "/launch" },
];

function devices() {
  const list = [];
  for (const [w, h, r] of PHONES) list.push({ w, h, r, orientation: "portrait", pad: false });
  for (const [w, h, r] of IPADS) {
    list.push({ w, h, r, orientation: "portrait", pad: true });
    list.push({ w, h, r, orientation: "landscape", pad: true });
  }
  return list;
}

const media = (d) =>
  `(device-width: ${d.w}px) and (device-height: ${d.h}px) and (-webkit-device-pixel-ratio: ${d.r}) and (orientation: ${d.orientation})`;

(async () => {
  for (const app of APPS) {
    const iconPath = path.join(ROOT, app.icon);
    // The icon is the logo on the app's own background, so the launch picture is
    // that same colour with the icon centred on it: it blends in with no seam.
    const { data } = await sharp(iconPath).raw().toBuffer({ resolveWithObject: true });
    const bg = { r: data[0], g: data[1], b: data[2] };
    fs.mkdirSync(path.join(ROOT, app.out), { recursive: true });
    const entries = [];
    for (const d of devices()) {
      const pxW = (d.orientation === "portrait" ? d.w : d.h) * d.r;
      const pxH = (d.orientation === "portrait" ? d.h : d.w) * d.r;
      const side = Math.round(Math.min(pxW, pxH) * (d.pad ? 0.34 : 0.5));
      const icon = await sharp(iconPath).resize(side, side).toBuffer();
      const file = `${d.w}x${d.h}@${d.r}x-${d.orientation}.png`;
      await sharp({ create: { width: pxW, height: pxH, channels: 3, background: bg } })
        .composite([{ input: icon, gravity: "center" }])
        .png({ palette: true, colours: 64, compressionLevel: 9 })
        .toFile(path.join(ROOT, app.out, file));
      entries.push({ media: media(d), href: `${app.url}/${file}` });
    }
    if (app.name === "site") {
      fs.writeFileSync(path.join(ROOT, "_data/launchScreens.json"), JSON.stringify(entries, null, 2) + "\n");
    } else {
      const block =
        "<!-- launch-screens:start (written by scripts/make-launch-screens.js) -->\n" +
        entries.map((e) => `  <link rel="apple-touch-startup-image" media="${e.media}" href="${e.href}">`).join("\n") +
        "\n  <!-- launch-screens:end -->";
      for (const page of ["admin/index.html", "admin/quick/index.html"]) {
        const file = path.join(ROOT, page);
        let html = fs.readFileSync(file, "utf8");
        const crlf = html.includes("\r\n"); if (crlf) html = html.replace(/\r\n/g, "\n");
        const re = /<!-- launch-screens:start[\s\S]*?<!-- launch-screens:end -->/;
        if (re.test(html)) html = html.replace(re, block);
        else html = html.replace(/(<link rel="apple-touch-icon"[^>]*>\n)/, `$1  ${block}\n`);
        fs.writeFileSync(file, crlf ? html.replace(/\n/g, "\r\n") : html);
      }
    }
    const kb = fs.readdirSync(path.join(ROOT, app.out)).reduce((n, f) => n + fs.statSync(path.join(ROOT, app.out, f)).size, 0) / 1024;
    console.log(`${app.name}: ${entries.length} launch pictures, ${Math.round(kb)} KB total, background rgb(${bg.r},${bg.g},${bg.b})`);
  }
})();
