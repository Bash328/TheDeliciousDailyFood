// Easter egg: a full-screen, colour ASCII-art bouquet of roses and stargazer
// lilies, seen from the front. Loaded on demand; call Bloom.open().
//
// The flowers are real 3D surfaces (cupped rose petals, curved lily tepals
// with painted textures) splatted into a z-buffered character grid. Each cell
// takes its colour from the surface, its glyph from the lighting, and is
// darkened where it sits just behind a neighbour, which draws the outlines
// between petals. Glyphs are pre-rendered to small coverage bitmaps and
// blitted into one ImageData, so tens of thousands of characters stay cheap.
// No images, no video, no dependencies.
(function () {
  "use strict";
  if (window.Bloom) return;

  var TAU = Math.PI * 2;
  var FPS = 30;
  var SETTLE = 16; // seconds into the animation used for the static reduced-motion frame
  var RAMP = ".:'-~+ilrxzYUJCLQ0OZmwqpdbkhao*#MW&8%B@$"; // light to dense
  var LINES = "|/\\_";
  var ALL = RAMP + LINES + "o";
  var I_LINE = RAMP.length, I_PEARL = I_LINE + 4;
  var FONT = 'ui-monospace,"SF Mono",Menlo,Consolas,"DejaVu Sans Mono",monospace';
  var BG = [7, 6, 10];
  var BG32 = 0xff000000 | (BG[2] << 16) | (BG[1] << 8) | BG[0];
  var CAM = 6;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function frac(v) { return v - Math.floor(v); }
  function hash(a, b, c) { return frac(Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453); }
  function norm(v) { var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function hex(s) { return [1, 3, 5].map(function (i) { return parseInt(s.slice(i, i + 2), 16); }); }
  function mix(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
  function pal(list) { return list.map(hex); }

  // Rose palettes: shadow at the heart of a petal, body, light at the rim.
  var ROSES = [
    pal(["#a01535", "#e8305a", "#ff8aa0"]), // crimson
    pal(["#a82460", "#ee4a92", "#ffa8cc"]), // hot pink
    pal(["#b8402c", "#f4634a", "#ffb09c"]), // coral
    pal(["#a23c62", "#f58fb0", "#ffd0e0"]), // blush
    pal(["#a8742e", "#f6d089", "#fff1cf"])  // cream
  ];

  var PETALS = [6, 5, 5, 4, 4, 3, 3];

  // Stargazer lily: yellow-green throat, magenta flare, white-pink margins.
  var LILY = { throat: hex("#d9e27a"), flare: hex("#cc1456"), edge: hex("#fde3ec"), rib: hex("#8f0f3c"), speck: hex("#6e0a30") };
  var STEM_A = hex("#4fa33d"), STEM_B = hex("#9bd36a");
  var LIGHT = norm([-0.45, 0.6, 0.8]);

  // ------------------------------------------------------------ the renderer

  function createRenderer(canvas, coarse) {
    var ctx = canvas.getContext("2d", { alpha: false });
    var W, H, dpr, cellW, cellH, cols, rows, N, bump = 0;
    var depth, who, colR, colG, colB, lum, over, glyphs, image, pixels;
    var scale, cx, cy, model, curId, portrait = false;
    var cosY = 1, sinY = 0, cosP = 1, sinP = 0, swayA = 0;
    var LX = LIGHT[0], LY = LIGHT[1], LZ = LIGHT[2];

    function buildGlyphs() {
      var g = document.createElement("canvas");
      g.width = cellW; g.height = cellH;
      var c = g.getContext("2d", { willReadFrequently: true });
      c.font = "600 " + Math.round(cellH * 1.02) + "px " + FONT;
      c.textBaseline = "middle"; c.textAlign = "center";
      glyphs = [];
      for (var k = 0; k < ALL.length; k++) {
        c.fillStyle = "#000"; c.fillRect(0, 0, cellW, cellH);
        c.fillStyle = "#fff"; c.fillText(ALL.charAt(k), cellW / 2, cellH / 2 + 0.5);
        var d = c.getImageData(0, 0, cellW, cellH).data, m = new Uint16Array(cellW * cellH);
        for (var i = 0; i < m.length; i++) m[i] = Math.min(256, Math.round(d[i * 4] * 1.3));
        glyphs.push(m);
      }
    }

    function resize() {
      var box = canvas.getBoundingClientRect();
      if (!box.width || !box.height) return;
      dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
      W = Math.round(box.width * dpr); H = Math.round(box.height * dpr);
      canvas.width = W; canvas.height = H;
      var cap = coarse ? 30000 : 90000; // cells; keeps a low-end phone to a few tens of thousands
      var ch = Math.round(clamp(box.height / 170, 4.5, 7) * dpr) + bump;
      for (;; ch++) {
        cellH = Math.max(6, ch); cellW = Math.max(4, Math.round(cellH * 0.62));
        cols = Math.ceil(W / cellW); rows = Math.ceil(H / cellH);
        if (cols * rows <= cap) break;
      }
      N = cols * rows;
      depth = new Float32Array(N); who = new Uint16Array(N);
      colR = new Float32Array(N); colG = new Float32Array(N); colB = new Float32Array(N);
      lum = new Float32Array(N); over = new Uint8Array(N);
      image = ctx.createImageData(W, H);
      pixels = new Uint32Array(image.data.buffer);
      buildGlyphs();
      // bouquet spans about 2.9 wide by 3.5 tall in world units; leave room for the hint
      var usableH = H - 56 * dpr; // keeps the bow clear of the hint
      // on a tall phone screen the bouquet is drawn narrower and taller, and sized to fill the width
      portrait = W / H < 0.8;
      var Ly = layout(), span = Ly.top - Ly.base;
      scale = Math.min(usableH / span, W * (portrait ? 0.38 : 0.3)) * (portrait ? 0.93 : 1); // a touch of air round the edge on a phone
      cx = W / 2; cy = (usableH - scale * span) / 2 + scale * Ly.top;
      buildModel(Ly);
    }

    // -------------------------------------------------------------- geometry

    // Write one surface sample to the grid; the nearest sample wins.
    function splat(x, y, z, r, g, b, s, glyph, id) {
      var lift = y + 1.95;
      x += swayA * lift * lift * 0.08;
      var x1 = x * cosY + z * sinY, z1 = -x * sinY + z * cosY;
      var y2 = y * cosP - z1 * sinP, z2 = y * sinP + z1 * cosP;
      var f = CAM / (CAM - z2);
      var px = cx + x1 * f * scale, py = cy - y2 * f * scale;
      if (px < 0 || py < 0) return;
      var c = (px / cellW) | 0, w = (py / cellH) | 0;
      if (c >= cols || w >= rows) return;
      var i = w * cols + c;
      if (z2 <= depth[i]) return;
      depth[i] = z2; who[i] = id; colR[i] = r; colG[i] = g; colB[i] = b; lum[i] = s; over[i] = glyph;
    }

    function disc(x, y, z, rad, col, s, id, gl) {
      var n = clamp(Math.ceil(rad * scale / cellH * 2.2), 1, 12);
      for (var a = -n; a <= n; a++) for (var b = -n; b <= n; b++) {
        if (a * a + b * b > n * n) continue;
        splat(x + a / n * rad, y + b / n * rad, z, col[0], col[1], col[2], s * (1 - 0.25 * Math.sqrt(a * a + b * b) / n), gl || 0, id);
      }
    }

    // Big lilies lead, smaller roses fill between them. [x, y, z, size, delay, palette]
    var ROSE_SPECS = [
      [0.0, 0.34, 0.7, 0.36, 0.5, 0], [-0.55, -0.22, 0.68, 0.32, 0.9, 1], [0.57, -0.17, 0.68, 0.32, 1.3, 2],
      [0.0, -0.7, 0.7, 0.32, 1.7, 3], [-0.05, 1.0, 0.66, 0.27, 2.1, 4], [-0.95, 0.52, 0.62, 0.26, 2.5, 3],
      [1.0, 0.47, 0.62, 0.26, 2.9, 1], [-0.95, -0.66, 0.62, 0.26, 3.3, 2], [0.97, -0.66, 0.62, 0.26, 3.7, 0],
      [0.0, -0.3, 0.72, 0.32, 4.0, 0], [-1.05, -1.35, 0.6, 0.28, 4.3, 3], [1.1, -1.4, 0.6, 0.28, 4.6, 1],
      [-1.4, -0.24, 0.62, 0.26, 4.9, 2], [-1.4, -0.7, 0.62, 0.26, 5.2, 4], [1.5, -0.3, 0.62, 0.26, 5.5, 3], [1.5, -0.8, 0.62, 0.26, 5.8, 0]
    ];
    var LILY_SPECS = [
      [-0.5, 0.5, 0.6, 0.62, 2.0], [0.56, 0.44, 0.56, 0.58, 2.5], [-1.0, -0.05, 0.54, 0.58, 3.0],
      [1.05, -0.1, 0.58, 0.56, 3.5], [-0.45, -0.95, 0.52, 0.56, 4.0], [0.5, -1.0, 0.5, 0.54, 4.5],
      [-1.3, -0.85, 0.5, 0.5, 5.0], [1.3, -1.0, 0.5, 0.5, 5.5]
    ];

    // On a phone the layout is squeezed sideways and stretched upward so it fills a tall screen.
    function layout() {
      var KX = portrait ? 0.72 : 1, KY = portrait ? 1.45 : 1, KS = portrait ? 0.88 : 1;
      var fit = function (f) { var g = f.slice(); g[0] *= KX; g[1] *= KY; g[3] *= KS; return g; };
      var roses = ROSE_SPECS.map(fit), lilies = LILY_SPECS.map(fit), top = -9, low = 9;
      roses.concat(lilies).forEach(function (f) { top = Math.max(top, f[1] + f[3] * 1.2); low = Math.min(low, f[1] - f[3] * 1.2); });
      return { roses: roses, lilies: lilies, top: top, base: low - 1.1, KX: KX, KY: KY };
    }

    function frame3(x, y, k) {
      var A = norm([x * k, y * k, 1]), E1 = norm(cross(A, [0, 1, 0])), E2 = cross(A, E1);
      return [A, E1, E2];
    }

    function buildModel(Ly) {
      model = { roses: [], lilies: [], stems: [], breath: [], stock: [], euc: [], Ly: Ly };
      var base = Ly.base, roseSpecs = Ly.roses, lilySpecs = Ly.lilies;
      roseSpecs.forEach(function (f, i) {
        var fr = frame3(f[0], f[1], 0.15);
        model.roses.push({ C: [f[0], f[1], f[2]], A: fr[0], E1: fr[1], E2: fr[2], R: f[3], pal: ROSES[f[5]], rot: hash(i, 1, 1) * TAU, delay: f[4] });
      });
      lilySpecs.forEach(function (f, n2) {
        var fr = frame3(f[0], f[1], 0.5), A = fr[0], E1 = fr[1], E2 = fr[2];
        var L = f[3], nu = clamp(Math.ceil(L * 1.2 * scale / cellH * 2.2), 12, 140);
        var nv = clamp(Math.ceil(L * 0.5 * scale / cellW * 1.8), 6, 70);
        var prof = new Float32Array(nu), k, u, v, j, i;
        for (i = 0; i < nu; i++) prof[i] = Math.pow(Math.sin(Math.PI * Math.pow((i + 0.5) / nu, 0.78)), 0.85);
        var tepals = [];
        for (k = 0; k < 6; k++) {
          var inner = k % 2 === 1, phi = k / 6 * TAU + 0.28 + n2 * 0.9 + (hash(n2, k, 3) - 0.5) * 0.14;
          var tl = L * 1.18 * (inner ? 1 : 1.03), tw = L * (inner ? 0.26 : 0.2);
          var tex = new Float32Array(nu * nv * 4);
          for (i = 0; i < nu; i++) for (j = 0; j < nv; j++) {
            u = (i + 0.5) / nu; v = (j + 0.5) / nv * 2 - 1;
            var av = Math.abs(v), o = (i * nv + j) * 4;
            var flare = (1 - smooth(0.2, 0.95, av)) * (1 - smooth(0.45, 0.95, u));
            var c = mix(LILY.throat, LILY.flare, smooth(0.03, 0.16, u));
            c = mix(LILY.edge, c, Math.max(flare, 1 - smooth(0.02, 0.2, u)));
            c = mix(c, LILY.rib, (1 - smooth(0.02, 0.11, av)) * 0.55 * (1 - smooth(0.7, 1, u)));
            if (u > 0.14 && u < 0.58 && av < 0.7 && hash(Math.floor(u * 30), Math.floor(v * 8), n2 * 7 + k) > 0.8) c = mix(c, LILY.speck, 0.85);
            var pearl = 0;
            for (var pp = -1; pp <= 1; pp += 2) {
              var du = (u - 0.34) * tl, dv = (v - pp * 0.2) * tw;
              if (du * du + dv * dv < 0.0012) pearl = 1;
            }
            if (pearl) c = [255, 250, 250];
            tex[o] = c[0]; tex[o + 1] = c[1]; tex[o + 2] = c[2]; tex[o + 3] = pearl;
          }
          tepals.push({ phi: phi, cp: Math.cos(phi), sp: Math.sin(phi), L: tl, w: tw, tex: tex, bow: (hash(n2, k, 2) - 0.5) * 0.28 });
        }
        model.lilies.push({ n: n2, C: [f[0], f[1], f[2]], A: A, E1: E1, E2: E2, L: L, nu: nu, nv: nv, prof: prof, tepals: tepals,
          r: new Float32Array(nu), h: new Float32Array(nu), th: new Float32Array(nu), wait: f[4] });
      });
      // a stem from the tied base up to every flower, with leaves along the lower part
      var flowers = roseSpecs.map(function (f) { return { x: f[0], y: f[1], z: f[2], leaf: 0.3, n: 2 }; })
        .concat(lilySpecs.map(function (f) { return { x: f[0], y: f[1], z: f[2], leaf: 0.55, n: 4 }; }));
      flowers.forEach(function (f, n3) {
        var B0 = [f.x * 0.1, base, -0.1], B1 = [f.x * 0.2, base + 0.75, f.z * 0.2], B2 = [f.x * 0.9, f.y - 0.5, f.z * 0.6], B3 = [f.x, f.y, f.z - 0.05];
        var cnt = clamp(Math.ceil((f.y - base) * scale / cellH * 3), 40, 500), pts = new Float32Array(cnt * 3);
        for (var i = 0; i < cnt; i++) {
          var t = i / (cnt - 1), m = 1 - t;
          for (var a = 0; a < 3; a++) pts[i * 3 + a] = m * m * m * B0[a] + 3 * m * m * t * B1[a] + 3 * m * t * t * B2[a] + t * t * t * B3[a];
        }
        var leaves = [];
        for (i = 0; i < f.n; i++) {
          var sp = 0.15 + 0.55 * (i + hash(n3, i, 5) * 0.5) / f.n, pi3 = Math.floor(sp * (cnt - 1)) * 3;
          var side = (i % 2 ? 1 : -1) * (f.x >= 0 ? 1 : -1);
          var dir = norm([side * (0.6 + hash(n3, i, 6) * 0.5), 0.6 + hash(n3, i, 7) * 0.5, (hash(n3, i, 8) - 0.3) * 0.5]);
          leaves.push({ s: sp, x: pts[pi3], y: pts[pi3 + 1], z: pts[pi3 + 2], dir: dir, side: norm(cross(dir, [0.1, 0.2, 1])),
            L: f.leaf * (0.8 + 0.4 * hash(n3, i, 9)), w: 0.07 + 0.03 * hash(n3, i, 10), droop: 0.1 + 0.2 * hash(n3, i, 11) });
        }
        model.stems.push({ n: n3, pts: pts, cnt: cnt, leaves: leaves, delay: 0.1 + n3 * 0.15 });
      });
      // baby's breath and pink stock scattered through every gap, a few eucalyptus sprigs at the edge
      var rx = 1.7 * Ly.KX, ry = 1.55 * Ly.KY, mid = (Ly.top + Ly.base) / 2 + 0.25, i;
      for (i = 0; i < 30; i++) {
        var a = hash(i, 21, 1) * TAU, rr = Math.sqrt(hash(i, 22, 2));
        model.breath.push({ x: Math.cos(a) * rr * rx, y: mid + Math.sin(a) * rr * ry, z: 0.15 + 0.3 * hash(i, 23, 3), k: i });
      }
      for (i = 0; i < 14; i++) {
        var a2 = hash(i, 31, 1) * TAU, r2 = 0.45 + 0.55 * Math.sqrt(hash(i, 32, 2));
        model.stock.push({ x: Math.cos(a2) * r2 * rx, y: mid + Math.sin(a2) * r2 * ry, z: 0.2 + 0.2 * hash(i, 33, 3), k: i });
      }
      for (i = 0; i < 8; i++) {
        var a3 = i * TAU / 8 + 0.3;
        model.euc.push({ x: Math.cos(a3) * 0.9 * rx, y: mid + Math.sin(a3) * 0.9 * ry, ang: a3, k: i });
      }
    }

    function drawRose(m, b) {
      var R = m.R * (0.28 + 0.72 * ease(b * 1.6)), C = m.C, A = m.A, E1 = m.E1, E2 = m.E2, P = m.pal;
      for (var k = 0; k < PETALS.length; k++) {
        var o = ease((b * 1.45 - k * 0.11) / 0.5);
        var Rk = R * (1 - k * 0.12) * (0.38 + 0.62 * o);
        var hk = R * 0.12 * k * (0.5 + 0.5 * o) + (1 - o) * R * 0.6;
        var mk = PETALS[k], hw = Math.PI / mk * 1.25;
        var nu = clamp(Math.ceil(Rk * scale / cellH * 2.1), 3, 48), nv = clamp(Math.ceil(Rk * hw * scale / cellW * 2.1), 4, 64);
        for (var j = 0; j < mk; j++) {
          var phi = k * 2.4 + j * TAU / mk + (1 - o) * 0.5 + m.rot, id = ++curId;
          for (var ii = 0; ii < nu; ii++) {
            var u = (ii + 0.5) / nu, rho = Rk * (0.2 + 0.8 * u);
            var h = hk + Rk * 0.3 * u * (1 - 0.85 * u) + j * 0.002;
            var slope = 0.3 * (1 - 1.7 * u) / 0.8;
            var span = Math.sqrt(Math.max(0, 1 - Math.pow(u, 3.5))); // rounded lobe outline
            // colour along the petal: shadowed heart to bright curled rim
            var t = u < 0.5 ? u / 0.5 : (u - 0.5) / 0.5, c0 = u < 0.5 ? P[0] : P[1], c1 = u < 0.5 ? P[1] : P[2];
            var cr = lerp(c0[0], c1[0], t), cg = lerp(c0[1], c1[1], t), cb = lerp(c0[2], c1[2], t);
            for (var jj = 0; jj < nv; jj++) {
              var v = (jj + 0.5) / nv * 2 - 1;
              if (Math.abs(v) > span) continue;
              var th = phi + v * hw, ct = Math.cos(th), st = Math.sin(th);
              var rx = E1[0] * ct + E2[0] * st, ry = E1[1] * ct + E2[1] * st, rz = E1[2] * ct + E2[2] * st;
              var nx = A[0] - slope * rx, ny = A[1] - slope * ry, nz = A[2] - slope * rz;
              var dot = Math.abs(nx * LX + ny * LY + nz * LZ) / Math.sqrt(nx * nx + ny * ny + nz * nz);
              splat(C[0] + A[0] * h + rx * rho, C[1] + A[1] * h + ry * rho, C[2] + A[2] * h + rz * rho,
                cr, cg, cb, (0.68 + 0.32 * dot) * (0.8 + 0.2 * smooth(0, 0.8, u)), 0, id);
            }
          }
        }
      }
    }

    function drawLily(m, size, b) {
      if (size <= 0.01) return;
      var A = m.A, E1 = m.E1, E2 = m.E2, C = m.C, nu = m.nu, nv = m.nv, prof = m.prof;
      var dim = lerp(0.72, 1, b), widen = lerp(0.42, 1, b) * size, cupK = lerp(0.65, 0.2, b);
      var tt, i, j;
      for (tt = 0; tt < 6; tt++) {
        var t = m.tepals[tt], L = t.L * size * lerp(0.82, 1, b), ds = L / nu, r = 0, h = 0;
        // centreline: closed it bulges and meets at the tip, open it spreads flat and the tip curls back
        for (i = 0; i < nu; i++) {
          var u = (i + 0.5) / nu;
          var th = lerp(0.35 - 0.8 * u, 1.15 + t.bow * 0.5 + 0.5 * Math.pow(u, 1.8), b);
          r += Math.sin(th) * ds; h += Math.cos(th) * ds;
          m.r[i] = r; m.h[i] = h; m.th[i] = th;
        }
        var Rx = t.cp * E1[0] + t.sp * E2[0], Ry = t.cp * E1[1] + t.sp * E2[1], Rz = t.cp * E1[2] + t.sp * E2[2];
        var Wx = -t.sp * E1[0] + t.cp * E2[0], Wy = -t.sp * E1[1] + t.cp * E2[1], Wz = -t.sp * E1[2] + t.cp * E2[2];
        var tw = t.w * widen, id = ++curId;
        for (i = 0; i < nu; i++) {
          var sn = Math.sin(m.th[i]), cs = Math.cos(m.th[i]), wu = prof[i] * tw;
          var bx = C[0] + A[0] * m.h[i] + Rx * m.r[i], by = C[1] + A[1] * m.h[i] + Ry * m.r[i], bz = C[2] + A[2] * m.h[i] + Rz * m.r[i];
          var Nx = A[0] * sn - Rx * cs, Ny = A[1] * sn - Ry * cs, Nz = A[2] * sn - Rz * cs;
          for (j = 0; j < nv; j++) {
            var v = (j + 0.5) / nv * 2 - 1, ww = v * wu, cup = v * v * wu * cupK, groove = (1 - Math.min(1, Math.abs(v) * 7)) * wu * -0.1;
            var k2 = -2 * v * cupK, ax = Nx + Wx * k2, ay = Ny + Wy * k2, az = Nz + Wz * k2;
            var il = 1 / Math.sqrt(ax * ax + ay * ay + az * az);
            var dot = Math.abs(ax * LX + ay * LY + az * LZ) * il;
            var o = (i * nv + j) * 4, pearl = t.tex[o + 3];
            splat(bx + Wx * ww + Nx * (cup + groove), by + Wy * ww + Ny * (cup + groove), bz + Wz * ww + Nz * (cup + groove),
              t.tex[o] * dim, t.tex[o + 1] * dim, t.tex[o + 2] * dim, pearl ? 1 : 0.34 + 0.66 * dot, pearl ? I_PEARL : 0, id);
          }
        }
      }
      // stamens: pale filaments, rust-orange anthers, one longer pistil
      var grow = smooth(0.45, 0.95, b);
      if (grow <= 0) return;
      var L0 = m.L * size;
      for (var k = 0; k < 7; k++) {
        var pistil = k === 6, a = k * 1.047 + m.n, splay = pistil ? 0 : 0.26, len = L0 * (pistil ? 0.5 : 0.42) * grow;
        var dx = A[0] + (Math.cos(a) * E1[0] + Math.sin(a) * E2[0]) * splay * 2;
        var dy = A[1] + (Math.cos(a) * E1[1] + Math.sin(a) * E2[1]) * splay * 2;
        var dz = A[2] + (Math.cos(a) * E1[2] + Math.sin(a) * E2[2]) * splay * 2;
        var seg = clamp(Math.ceil(len * scale / cellH * 2), 6, 40), sid = ++curId;
        for (i = 0; i <= seg; i++) {
          var q = i / seg;
          splat(C[0] + dx * len * q, C[1] + dy * len * q, C[2] + dz * len * q + 0.02, 190, 208, 120, 0.7, 0, sid);
        }
        var tx = C[0] + dx * len, ty = C[1] + dy * len, tz = C[2] + dz * len + 0.02;
        var col = pistil ? [226, 232, 150] : [214, 96, 26];
        var ox = Math.cos(a + 1.2) * E1[0] + Math.sin(a + 1.2) * E2[0], oy = Math.cos(a + 1.2) * E1[1] + Math.sin(a + 1.2) * E2[1];
        var oz = Math.cos(a + 1.2) * E1[2] + Math.sin(a + 1.2) * E2[2], sp = L0 * 0.07 * grow;
        for (i = -6; i <= 6; i++) {
          var w2 = i / 6 * sp;
          splat(tx + ox * w2, ty + oy * w2, tz + oz * w2 + 0.01, col[0], col[1], col[2], 0.95, 0, sid);
        }
      }
    }

    // ---- the wrap: fanned pink sheets behind, a gathered cone round the stems, a satin bow

    function drawSheets(g) {
      if (g <= 0) return;
      var Ly = model.Ly, oy = Ly.base + 0.6, len = (Ly.top - Ly.base) * 0.8 * g;
      var spread = portrait ? 0.55 : 0.8, deep = [226, 112, 156], pale = [255, 212, 228];
      for (var k = 0; k < 7; k++) {
        var ang = (k - 3) / 3 * spread, sn = Math.sin(ang), cs = Math.cos(ang);
        var wk = (portrait ? 0.5 : 0.56) * (1 - 0.14 * Math.abs(k - 3) / 3);
        var nu = clamp(Math.ceil(len * scale / cellH * 1.15), 8, 170), nv = clamp(Math.ceil(wk * 2 * scale / cellW * 1.15), 6, 110);
        var id = ++curId;
        for (var i = 0; i < nu; i++) {
          var u = (i + 0.5) / nu, w = wk * (0.15 + 0.85 * Math.pow(u, 0.8)), uS = smooth(0.2, 1, u);
          for (var j = 0; j < nv; j++) {
            var v = (j + 0.5) / nv * 2 - 1;
            if (u > 1 - 0.06 * (1 + Math.cos(v * 6 + k))) continue; // scalloped far edge
            var fold = 0.5 + 0.5 * Math.sin(v * 11 + k * 2 + u * 2), tt = uS * (0.6 + 0.4 * fold);
            splat(sn * len * u + cs * w * v, oy + cs * len * u - sn * w * v, -0.12 - 0.03 * k + 0.06 * Math.sin(v * 5 + k * 1.7 + u * 3),
              deep[0] + (pale[0] - deep[0]) * tt, deep[1] + (pale[1] - deep[1]) * tt, deep[2] + (pale[2] - deep[2]) * tt,
              0.2 + 0.24 * fold * (0.6 + 0.4 * u), 0, id);
          }
        }
      }
    }

    function drawCone(g) {
      if (g <= 0) return;
      var Ly = model.Ly, H = 1.25 * g, id = ++curId;
      var nu = clamp(Math.ceil(H * scale / cellH * 1.5), 6, 120), nv = clamp(Math.ceil(2 * scale / cellW * 1.4), 8, 140);
      var deep = [214, 96, 142], pale = [250, 190, 214];
      for (var i = 0; i < nu; i++) {
        var u = (i + 0.5) / nu, h = u * H, hw = 0.1 + 0.95 * Math.pow(u, 1.1), uS = smooth(0.2, 1, u);
        for (var j = 0; j < nv; j++) {
          var v = (j + 0.5) / nv * 2 - 1;
          if (u > 1 - 0.07 * (1 + Math.cos(v * 8)) * (g > 0.99 ? 1 : 0.5)) continue; // frilled top edge
          var fold = 0.5 + 0.5 * Math.cos(v * 9 + u * 1.5), tt = uS * (0.6 + 0.4 * fold);
          splat(hw * v, Ly.base + h, 0.2 + 0.3 * Math.sqrt(Math.max(0, 1 - v * v)) * hw + 0.03 * Math.sin(v * 7),
            deep[0] + (pale[0] - deep[0]) * tt, deep[1] + (pale[1] - deep[1]) * tt, deep[2] + (pale[2] - deep[2]) * tt,
            0.35 + 0.35 * fold, 0, id);
        }
      }
    }

    function ribbon(cx0, cy0, z, rx, ry, rot, thick, grow, id) {
      var cr = Math.cos(rot), sr = Math.sin(rot), n = clamp(Math.ceil(TAU * Math.max(rx, ry) * scale / cellH * 2.5), 24, 260);
      var m = clamp(Math.ceil(thick * scale / cellW * 2.4), 2, 14);
      for (var t = 0; t < n; t++) {
        var a = t / n * TAU, ex = Math.cos(a) * rx * grow, ey = Math.sin(a) * ry * grow;
        var nx = Math.cos(a) * ry, ny = Math.sin(a) * rx, nl = Math.sqrt(nx * nx + ny * ny) || 1;
        for (var q = 0; q < m; q++) {
          var o = ((q + 0.5) / m - 0.5) * thick * grow;
          var lx = ex + nx / nl * o, ly = ey + ny / nl * o, shine = 0.5 + 0.5 * Math.sin(a * 2 + 1);
          splat(cx0 + lx * cr - ly * sr, cy0 + lx * sr + ly * cr, z + 0.05 * Math.sin(a * 2),
            lerp(240, 255, shine), lerp(140, 214, shine), lerp(184, 230, shine), 0.55 + 0.4 * shine, 0, id);
        }
      }
    }

    function drawBow(g) {
      if (g <= 0) return;
      var Ly = model.Ly, by = Ly.base + 0.5, id = ++curId;
      ribbon(-0.42 * g, by + 0.1, 0.95, 0.4, 0.21, 0.35, 0.09, g, id);
      ribbon(0.42 * g, by + 0.1, 0.95, 0.4, 0.21, -0.35, 0.09, g, ++curId);
      // two tails hanging down from the knot
      for (var sd = -1; sd <= 1; sd += 2) {
        var tid = ++curId, n = clamp(Math.ceil(0.5 * scale / cellH * 3), 12, 120);
        for (var i = 0; i < n; i++) {
          var u = i / n, x = sd * (0.04 + 0.28 * u * u + 0.05 * Math.sin(u * 5)) * g, y = by - 0.05 - 0.45 * u * g;
          var wd = 0.05 + 0.05 * u, m = clamp(Math.ceil(wd * 2 * scale / cellW * 2.4), 2, 14);
          for (var q = 0; q < m; q++) {
            var o = ((q + 0.5) / m - 0.5) * 2 * wd, shine = 0.5 + 0.5 * Math.sin(u * 9 + q);
            splat(x + o, y, 0.98, lerp(240, 255, shine), lerp(140, 214, shine), lerp(184, 230, shine), 0.55 + 0.4 * shine, 0, tid);
          }
        }
      }
      disc(0, by + 0.08, 1.0, 0.11 * g, [214, 96, 146], 0.7, ++curId); // the knot
    }

    function drawFiller(g) {
      if (g <= 0) return;
      var d, i;
      model.breath.forEach(function (c) {
        for (d = 0; d < 7; d++) {
          var ang = d * 2.4 + c.k, rr = 0.2 * frac(d * 0.37 + c.k * 0.13) * g;
          disc(c.x + Math.cos(ang) * rr, c.y + Math.sin(ang) * rr, c.z, 0.024 * g, [255, 250, 238], 0.95, 700 + c.k * 8 + d, I_PEARL);
        }
      });
      model.stock.forEach(function (c) {
        for (d = 0; d < 6; d++) {
          var ang = d * 2.1 + c.k, rr = 0.1 * frac(d * 0.41 + c.k * 0.17) * g;
          disc(c.x + Math.cos(ang) * rr, c.y + Math.sin(ang) * rr, c.z, 0.04 * g, d % 2 ? [226, 98, 178] : [246, 150, 206], 0.85, 1000 + c.k * 8 + d);
        }
      });
      model.euc.forEach(function (e) {
        for (i = 1; i <= 3; i++) for (var sd = -1; sd <= 1; sd += 2) {
          var along = 0.07 * i * g, off = sd * 0.05 * g, cs = Math.cos(e.ang), sn = Math.sin(e.ang);
          disc(e.x + cs * along - sn * off, e.y + sn * along + cs * off, 0.3, 0.06 * g, [150, 184, 150], 0.75, 1200 + e.k * 8 + i * 2 + (sd > 0 ? 1 : 0));
        }
      });
    }

    function drawStem(st, g) {
      var end = Math.floor(st.cnt * g), p = st.pts;
      for (var i = 1; i < end; i++) {
        var q = i * 3, dx = (p[q] - p[q - 3]) * scale / cellW, dy = (p[q + 1] - p[q - 2]) * scale / cellH;
        var ratio = Math.abs(dx) / (Math.abs(dy) + 1e-6);
        var gl = ratio < 0.3 ? I_LINE : ratio > 2.6 ? I_LINE + 3 : dx * dy > 0 ? I_LINE + 1 : I_LINE + 2;
        var c = mix(STEM_A, STEM_B, 0.5 + 0.5 * Math.sin(i * 0.09 + st.n));
        splat(p[q], p[q + 1], p[q + 2], c[0], c[1], c[2], 0.8, gl, 2);
        splat(p[q] + 0.025, p[q + 1], p[q + 2], c[0] * 0.8, c[1] * 0.8, c[2] * 0.8, 0.65, gl, 2);
      }
    }

    function drawLeaf(lf, g) {
      if (g <= 0) return;
      var L = lf.L * g, wd = lf.w * Math.sqrt(g);
      var nu = clamp(Math.ceil(L * scale / cellH * 2.6), 8, 90), nv = clamp(Math.ceil(wd * 2 * scale / cellW * 2.4), 3, 20);
      var dx = lf.dir[0], dy = lf.dir[1], dz = lf.dir[2], sx = lf.side[0], sy = lf.side[1], sz = lf.side[2];
      var nx = dy * sz - dz * sy, ny = dz * sx - dx * sz, nz = dx * sy - dy * sx;
      var s = 0.3 + 0.7 * Math.abs(nx * LX + ny * LY + nz * LZ), id = ++curId;
      for (var i = 0; i < nu; i++) {
        var u = (i + 0.5) / nu, w = wd * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.7)), 0.8);
        var px = lf.x + dx * L * u, py = lf.y + dy * L * u - lf.droop * u * u * g, pz = lf.z + dz * L * u;
        for (var j = 0; j < nv; j++) {
          var v = (j + 0.5) / nv * 2 - 1, rib = 1 - Math.abs(v), t = lerp(0.1, 0.85, rib * rib * (1 - u * 0.5));
          splat(px + sx * w * v, py + sy * w * v, pz + sz * w * v, lerp(47, 163, t), lerp(138, 220, t), lerp(58, 120, t), s * (0.7 + 0.3 * rib), 0, id);
        }
      }
    }

    // ----------------------------------------------------------- one frame

    function blit(col, row, glyph, r, g, b) {
      var m = glyphs[glyph], x0 = col * cellW, y0 = row * cellH;
      var xEnd = Math.min(cellW, W - x0), yEnd = Math.min(cellH, H - y0);
      for (var yy = 0; yy < yEnd; yy++) {
        var o = (y0 + yy) * W + x0, k = yy * cellW;
        for (var xx = 0; xx < xEnd; xx++, o++, k++) {
          var a = m[k];
          if (!a) continue;
          var q = 256 - a;
          pixels[o] = 0xff000000 | (((b * a + BG[2] * q) >> 8) << 16) | (((g * a + BG[1] * q) >> 8) << 8) | ((r * a + BG[0] * q) >> 8);
        }
      }
    }

    function render(T, motion) {
      if (!N) return;
      depth.fill(-1e9); over.fill(0); curId = 100;
      var clock = performance.now() / 1000;
      var yaw = motion * Math.sin(clock * 0.31) * 0.1, pitch = -0.02 + motion * Math.sin(clock * 0.23) * 0.025;
      swayA = motion * Math.sin(clock * 0.8) * 0.03;
      cosY = Math.cos(yaw); sinY = Math.sin(yaw); cosP = Math.cos(pitch); sinP = Math.sin(pitch);

      drawSheets(ease((T - 0.2) / 2.2));
      drawFiller(ease((T - 0.6) / 2.4));
      model.stems.forEach(function (st) {
        var g = ease((T - st.delay) / 2.2);
        drawStem(st, g);
        st.leaves.forEach(function (lf) { drawLeaf(lf, ease((g - lf.s * 0.9) / 0.34)); });
      });
      drawCone(ease((T - 0.8) / 2));
      drawBow(ease((T - 2.2) / 1.2));
      model.roses.forEach(function (m) { drawRose(m, ease((T - 0.8 - m.delay) / 3)); });
      model.lilies.forEach(function (m) {
        var size = ease((T - 1.8 - m.wait) / 1.4), b = ease((T - 3 - m.wait) / 3);
        drawLily(m, lerp(0, lerp(0.8, 1, b), size), b);
      });

      pixels.fill(BG32);
      var top = RAMP.length - 1;
      for (var y = 0, i = 0; y < rows; y++) {
        for (var x = 0; x < cols; x++, i++) {
          var d = depth[i];
          if (d < -1e8) continue;
          // a cell just behind a neighbour darkens: that is the outline between petals
          var edge = 1, me = who[i];
          for (var q = 0; q < 4; q++) {
            var j = q === 0 ? (x + 1 < cols ? i + 1 : -1) : q === 1 ? (x > 0 ? i - 1 : -1) : q === 2 ? (y + 1 < rows ? i + cols : -1) : (y > 0 ? i - cols : -1);
            if (j < 0) continue;
            var gap = depth[j] - d;
            if (gap > 0.02 && who[j] && who[j] !== me) { edge = 0.5; break; }
            if (gap > 0.08) edge = 0.65;
          }
          var s = lum[i], fog = 0.82 + 0.18 * clamp((d + 0.3) / 1.0, 0, 1);
          var light = (0.5 + 0.75 * s) * fog * edge, shine = s > 0.9 ? (s - 0.9) * 1.6 : 0;
          var glyph = over[i] || clamp(Math.round(s * top), 0, top);
          // lift every colour toward full brightness, as the video-to-ASCII players do
          var cr = colR[i], cg = colG[i], cb = colB[i], lift = 255 / Math.max(cr, cg, cb, 1);
          blit(x, y, glyph,
            Math.min(255, (cr * 0.4 + cr * lift * 0.6) * light + 255 * shine) | 0,
            Math.min(255, (cg * 0.4 + cg * lift * 0.6) * light + 255 * shine) | 0,
            Math.min(255, (cb * 0.4 + cb * lift * 0.6) * light + 255 * shine) | 0);
        }
      }
      ctx.putImageData(image, 0, 0);
    }

    var slow = 0, seen = 0;
    return {
      resize: resize,
      render: render,
      // if frames run long, use bigger cells (up to 3 steps) and rebuild
      adapt: function (ms) {
        slow = slow * 0.95 + ms * 0.05; seen++;
        if (seen > 45 && slow > 26 && bump < 3) { bump++; seen = 0; slow = 0; resize(); }
      },
      destroy: function () { depth = who = colR = colG = colB = lum = over = glyphs = image = pixels = model = null; N = 0; }
    };
  }

  // ------------------------------------------------------------------ overlay

  var st = null; // live state while open; null when closed

  function open() {
    if (st) return;
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var coarse = innerWidth < 700 || (window.matchMedia && matchMedia("(pointer:coarse)").matches);

    // Put the on-screen keyboard away first. On a phone it is still up when the
    // search box triggers this, and its closing would resize the page mid-open.
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();

    var root = document.createElement("div");
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "A bouquet of roses and lilies. Tap or press Escape to close.");
    // 100dvh follows the visible screen as a phone's address bar comes and goes.
    root.style.cssText = "position:fixed;left:0;top:0;width:100%;height:100%;height:100dvh;z-index:2147483000;" +
      "background:#07060a;cursor:pointer;overscroll-behavior:contain;touch-action:none;" +
      "-webkit-tap-highlight-color:transparent;opacity:0;transition:opacity .35s";
    var cv = document.createElement("canvas");
    cv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;display:block";
    var hint = document.createElement("div");
    hint.textContent = "Tap to close";
    hint.style.cssText = "position:absolute;left:0;right:0;bottom:calc(14px + env(safe-area-inset-bottom));" +
      "text-align:center;pointer-events:none;font:400 12px/1 'IBM Plex Mono',ui-monospace,monospace;" +
      "letter-spacing:.14em;text-transform:uppercase;color:#b8aa88;" +
      "text-shadow:0 0 8px #000,0 0 2px #000;transition:opacity 1.5s 4s;opacity:1";
    root.appendChild(cv); root.appendChild(hint);
    document.body.appendChild(root);
    var htmlOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden"; // nothing scrolls behind the bouquet

    var r = createRenderer(cv, coarse);
    var s = st = { raf: 0, last: 0, start: 0, T: 0, timer: 0, born: performance.now(), closed: false };

    function frame(T) { s.T = T; r.render(T, reduce ? 0 : 1); }
    function tick(now) {
      s.raf = requestAnimationFrame(tick);
      if (now - s.last < 1000 / FPS - 1) return;
      s.last = now;
      var t0 = performance.now();
      frame((now - s.start) / 1000);
      r.adapt(performance.now() - t0);
    }
    function close() {
      if (s.closed) return;
      s.closed = true;
      cancelAnimationFrame(s.raf);
      clearTimeout(s.timer);
      removeEventListener("keydown", onKey);
      removeEventListener("resize", onResize);
      root.remove();
      document.documentElement.style.overflow = htmlOverflow;
      cv.width = cv.height = 0; // release the bitmap
      r.destroy();
      st = null;
    }
    function onKey(e) { if (e.key === "Escape") close(); }
    // A tap that is still part of whatever opened this (the keyboard going away,
    // a double tap) must not close it again straight away.
    function onTap() { if (performance.now() - s.born > 700) close(); }
    // Refit and redraw in the same step so the canvas is never seen blank, and
    // keep the animation's clock so a resize never restarts the bloom.
    function onResize() {
      clearTimeout(s.timer);
      s.timer = setTimeout(function () {
        if (s.closed) return;
        r.resize();
        frame(reduce ? SETTLE : s.T);
      }, 150);
    }
    s.close = close;

    root.addEventListener("click", onTap);
    addEventListener("keydown", onKey);
    addEventListener("resize", onResize);

    // Paint the black overlay first, build the flowers on the next frame, and
    // start the clock only once they are ready: the build never eats into the
    // animation, and nothing stutters on the way in.
    requestAnimationFrame(function () {
      if (s.closed) return;
      root.style.opacity = "1";
      requestAnimationFrame(function () {
        if (s.closed) return;
        r.resize();
        if (reduce) { frame(SETTLE); return; }
        s.start = performance.now();
        s.raf = requestAnimationFrame(tick);
        hint.style.opacity = ".55";
      });
    });
  }

  window.Bloom = { open: open, close: function () { if (st) st.close(); } };
})();
