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
  // 대각선으로 흐르는 은하수 띠 + 성운 빛
  function galaxy(ctx, w, h) {
    const r = rng(2026), area = w * h / 960000;
    dots(ctx, w, h, r, Math.floor(1300 * area), ['#ffffff', '#e0e7ff', '#fff3d1']);
    const ax = -0.05 * w, ay = 0.95 * h, bx = 1.05 * w, by = 0.05 * h, len = Math.hypot(bx - ax, by - ay);
    const ux = (bx - ax) / len, uy = (by - ay) / len, nx = -uy, ny = ux, band = 0.12 * Math.min(w, h) + 30;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 140; i++) { const t = r(), o = gauss(r) * band * 0.8; glow(ctx, ax + ux * t * len + nx * o, ay + uy * t * len + ny * o, 40 + r() * 100, pick(r, ['#ff6fae', '#8b5cf6', '#60a5fa', '#c084fc']), 0.07 + r() * 0.05); }
    for (let i = 0; i < Math.floor(7000 * area); i++) { const t = r(), o = gauss(r) * band * 0.5; ctx.globalAlpha = 0.25 + r() * 0.7; ctx.fillStyle = pick(r, ['#ffffff', '#ffe9f3', '#e0e7ff']); ctx.fillRect(ax + ux * t * len + nx * o, ay + uy * t * len + ny * o, 1.1, 1.1); }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    for (let i = 0; i < 60; i++) { const t = r(), o = gauss(r) * band * 0.1; glow(ctx, ax + ux * t * len + nx * o, ay + uy * t * len + ny * o, 16 + r() * 26, '#05061a', 0.3); }
  }
  const FX = { stars, galaxy };
  function draw(name, canvas, cssW, cssH, dpr) {
    const fn = FX[name]; if (!fn) return false;
    dpr = dpr || 1; canvas.width = Math.max(1, Math.round(cssW * dpr)); canvas.height = Math.max(1, Math.round(cssH * dpr));
    const ctx = canvas.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.scale(dpr, dpr); fn(ctx, cssW, cssH); return true;
  }
  window.YeramArt = { draw };
})();
