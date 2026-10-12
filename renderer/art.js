'use strict';
// 예람달력 별빛 효과 — 그림 없이 별과 은하수 빛만 코드로 뿌린다(매번 같은 모양이 나오도록 고정된 난수 사용)
(function () {
  function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  const gauss = (r) => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  function glow(ctx, x, y, rad, color, alpha) { const g = ctx.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = alpha; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  function dots(ctx, w, h, r, n, colors) {
    for (let i = 0; i < n; i++) { const x = r() * w, y = r() * h, s = r() * r() * 1.5 + 0.35; ctx.globalAlpha = 0.25 + r() * 0.65; ctx.fillStyle = pick(r, colors); ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  // 드문드문 반짝이는 별
  function stars(ctx, w, h) {
    const r = rng(1889), area = w * h / 960000;
    dots(ctx, w, h, r, Math.floor(520 * area), ['#ffffff', '#fff6d6', '#dfe8ff']);
    for (let i = 0; i < Math.floor(16 * area) + 6; i++) {
      const x = r() * w, y = r() * h * 0.85, R = 2 + r() * 3;
      glow(ctx, x, y, R * 6, 'rgba(255,240,190,1)', 0.35);
      ctx.strokeStyle = 'rgba(255,248,220,.75)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - R * 3, y); ctx.lineTo(x + R * 3, y); ctx.moveTo(x, y - R * 3); ctx.lineTo(x, y + R * 3); ctx.stroke();
      ctx.fillStyle = '#fffbea'; ctx.beginPath(); ctx.arc(x, y, R * 0.45, 0, Math.PI * 2); ctx.fill();
    }
  }
  // 값 노이즈(부드러운 구름 결)
  function noise2(seed) {
    const h = (x, y) => { let n = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
    const sm = (t) => t * t * (3 - 2 * t);
    const v = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
      const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1); return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf; };
    return (x, y, oct) => { let s = 0, amp = 0.5, f = 1; for (let i = 0; i < (oct || 5); i++) { s += amp * v(x * f, y * f); f *= 2.03; amp *= 0.5; } return s / (1 - Math.pow(0.5, oct || 5)); };
  }
  // 은하수: 대각선으로 흐르는 뿌연 빛의 띠 + 가운데 밝은 핵 + 띠를 가르는 어두운 먼지 줄기 + 띠에 몰린 잔별
  function galaxy(ctx, w, h) {
    const r = rng(2026), n1 = noise2(7), n2 = noise2(19), n3 = noise2(41);
    const ax = -0.1 * w, ay = 0.98 * h, bx = 1.1 * w, by = 0.0 * h, len = Math.hypot(bx - ax, by - ay);
    const ux = (bx - ax) / len, uy = (by - ay) / len, nx = -uy, ny = ux;
    const W0 = 0.17 * Math.min(w, h) + 40;
    // 띠 중심선이 살짝 굽이치도록
    const off = (t) => Math.sin(t * 5.2 + 1.3) * W0 * 0.18 + Math.sin(t * 11 + 0.4) * W0 * 0.06;
    // 1) 저해상도로 빛 띠를 픽셀 단위로 계산 → 부드럽게 확대
    const S = 3, lw = Math.ceil(w / S), lh = Math.ceil(h / S);
    const oc = document.createElement('canvas'); oc.width = lw; oc.height = lh;
    const oct = oc.getContext('2d'), img = oct.createImageData(lw, lh), d = img.data;
    const sc = 3.2 / Math.min(w, h);
    for (let py = 0; py < lh; py++) for (let px = 0; px < lw; px++) {
      const x = px * S, y = py * S, rx = x - ax, ry = y - ay;
      const t = (rx * ux + ry * uy) / len, o = rx * nx + ry * ny - off(t);
      const wid = W0 * (0.75 + 0.5 * n3(t * 4, 0.5, 3) + 0.35 * Math.exp(-Math.pow((t - 0.62) / 0.12, 2)));
      const q = o / wid;
      let band = Math.exp(-q * q * 1.6);
      const cloud = n1(x * sc, y * sc, 5);
      band *= 0.45 + 0.9 * cloud;
      const core = Math.exp(-Math.pow((t - 0.62) / 0.13, 2)) * Math.exp(-q * q * 3.5);
      // 먼지 줄기: 중심선 근처에서 길게 늘어진 어두운 결
      const dn = n2(t * 9, q * 1.6 + 3, 5);
      const lane = Math.exp(-Math.pow((q + 0.08 * Math.sin(t * 9)) / 0.32, 2)) * Math.max(0, (dn - 0.42) * 2.6);
      let I = (band * 0.55 + core * 0.75) * (1 - Math.min(0.92, lane));
      const halo = Math.exp(-q * q * 0.35) * 0.08;
      I = Math.max(0, I) + halo;
      // 색: 핵은 따뜻한 상아색, 바깥은 푸른빛, 군데군데 옅은 자주
      const warm = Math.min(1, core * 1.4), purp = Math.max(0, n3(x * sc * 1.3 + 9, y * sc * 1.3, 3) - 0.55) * 1.6;
      let R = 150 + 105 * warm + 60 * purp, G = 170 + 70 * warm - 10 * purp, B = 255 - 60 * warm + 10 * purp;
      const i4 = (py * lw + px) * 4; d[i4] = Math.min(255, R); d[i4 + 1] = Math.min(255, G); d[i4 + 2] = Math.min(255, B); d[i4 + 3] = Math.min(255, I * 255);
    }
    oct.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(oc, 0, 0, w, h);
    // 2) 배경 전체 잔별
    const area = w * h / 960000;
    dots(ctx, w, h, r, Math.floor(700 * area), ['#ffffff', '#dfe8ff', '#fff3d6']);
    // 3) 띠 안에 몰린 아주 작은 별 가루
    for (let i = 0; i < Math.floor(9000 * area); i++) {
      const t = r(), o = gauss(r) * W0 * 0.45 + off(t), x = ax + ux * t * len + nx * o, y = ay + uy * t * len + ny * o;
      ctx.globalAlpha = 0.2 + r() * 0.6; ctx.fillStyle = r() < 0.7 ? '#ffffff' : (r() < 0.5 ? '#ffe8c8' : '#cfdcff');
      const z = r() < 0.92 ? 0.7 : 1.3; ctx.fillRect(x, y, z, z);
    }
    // 4) 밝은 별 몇 개
    for (let i = 0; i < Math.floor(14 * area) + 5; i++) { const x = r() * w, y = r() * h, R = 1 + r() * 1.4; glow(ctx, x, y, R * 5, 'rgba(220,230,255,1)', 0.35); ctx.globalAlpha = 1; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, R * 0.6, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  const FX = { stars, galaxy };
  function draw(name, canvas, cssW, cssH, dpr) {
    const fn = FX[name]; if (!fn) return false;
    dpr = dpr || 1; canvas.width = Math.max(1, Math.round(cssW * dpr)); canvas.height = Math.max(1, Math.round(cssH * dpr));
    const ctx = canvas.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.scale(dpr, dpr); fn(ctx, cssW, cssH); return true;
  }
  window.YeramArt = { draw };
})();
