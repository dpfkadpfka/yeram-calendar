'use strict';
// 예람달력 그림 배경 — 이미지 파일 없이 캔버스에 직접 그린다(같은 그림이 매번 나오도록 고정된 난수 사용)
(function () {
  function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  const gauss = (r) => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  function vgrad(ctx, w, h, stops) { const g = ctx.createLinearGradient(0, 0, 0, h); stops.forEach(([o, c]) => g.addColorStop(o, c)); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
  function glow(ctx, x, y, r, color, alpha) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = alpha; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  function stars(ctx, w, h, r, n, maxY, colors) {
    for (let i = 0; i < n; i++) { const x = r() * w, y = r() * h * maxY, s = r() * r() * 1.6 + 0.3; ctx.globalAlpha = 0.3 + r() * 0.7; ctx.fillStyle = pick(r, colors || ['#ffffff', '#dfe8ff', '#fff4d6']); ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  function ridge(ctx, w, h, r, baseY, amp, color, rough) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, h);
    let y = baseY; for (let x = 0; x <= w + 10; x += 10) { y += (r() - 0.5) * rough; y = Math.max(baseY - amp, Math.min(baseY + amp * 0.4, y)); ctx.lineTo(x, y); }
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  }

  // ① 별이 빛나는 밤 — 소용돌이 붓질, 노란 별무리, 초승달, 사이프러스, 마을
  function starry(ctx, w, h) {
    const r = rng(1889), s = Math.min(w, h) / 700;
    vgrad(ctx, w, h, [[0, '#0a1d4f'], [0.55, '#1b3f86'], [1, '#0f2557']]);
    const swirls = [{ x: 0.46 * w, y: 0.34 * h, r: 0.17 * w, k: 1.4 }, { x: 0.68 * w, y: 0.26 * h, r: 0.09 * w, k: -1 }, { x: 0.25 * w, y: 0.2 * h, r: 0.08 * w, k: 1 }];
    const field = (x, y) => {
      let a = Math.sin(y * 0.012 / s + x * 0.004 / s) * 0.5;
      swirls.forEach(c => { const dx = x - c.x, dy = y - c.y, d = Math.hypot(dx, dy); const wgt = Math.exp(-d / c.r) * 2.2; a += wgt * ((Math.atan2(dy, dx) + Math.PI / 2 * Math.sign(c.k)) - a) * 0.5; });
      return a;
    };
    const blues = ['#2a5aa8', '#3d7fc9', '#6fa8dc', '#a7c7e7', '#1b3f86', '#4f86c6', '#88b4d8', '#c9dcef'];
    ctx.lineCap = 'round';
    const N = Math.floor(5200 * (w * h) / (1200 * 800));
    for (let i = 0; i < N; i++) {
      let x = r() * w, y = r() * h * 0.78; const steps = 5 + Math.floor(r() * 8);
      ctx.strokeStyle = r() < 0.04 ? '#e9dc8f' : pick(r, blues); ctx.lineWidth = (2.5 + r() * 3.5) * s; ctx.globalAlpha = 0.55 + r() * 0.35;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < steps; k++) { const a = field(x, y); x += Math.cos(a) * 5 * s; y += Math.sin(a) * 5 * s; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const starPos = [[0.08, 0.12], [0.17, 0.33], [0.33, 0.09], [0.55, 0.13], [0.62, 0.38], [0.79, 0.12], [0.93, 0.32], [0.4, 0.48], [0.73, 0.5], [0.12, 0.52]];
    starPos.forEach(([px, py], i) => {
      const x = px * w, y = py * h, R = (22 + (i % 3) * 9) * s;
      glow(ctx, x, y, R * 2.2, '#f6e27a', 0.55);
      for (let ring = 0; ring < 3; ring++) {
        const rr = R * (0.55 + ring * 0.35);
        for (let t = 0; t < 22; t++) { const a0 = r() * Math.PI * 2; ctx.strokeStyle = ring === 0 ? '#fff6c8' : (ring === 1 ? '#f3d75a' : '#e8e3b0'); ctx.globalAlpha = 0.85 - ring * 0.2; ctx.lineWidth = (2.5 + r() * 2) * s; ctx.beginPath(); ctx.arc(x, y, rr, a0, a0 + 0.35 + r() * 0.3); ctx.stroke(); }
      }
      ctx.globalAlpha = 1; ctx.fillStyle = '#fffbe0'; ctx.beginPath(); ctx.arc(x, y, R * 0.32, 0, Math.PI * 2); ctx.fill();
    });
    // 초승달
    const mx = 0.9 * w, my = 0.11 * h, mr = 40 * s;
    glow(ctx, mx, my, mr * 3, '#f7c948', 0.7);
    for (let ring = 0; ring < 4; ring++) for (let t = 0; t < 26; t++) { const a0 = r() * Math.PI * 2, rr = mr * (1.1 + ring * 0.3); ctx.strokeStyle = ring % 2 ? '#f2a93b' : '#f7d460'; ctx.lineWidth = 3 * s; ctx.globalAlpha = 0.8 - ring * 0.15; ctx.beginPath(); ctx.arc(mx, my, rr, a0, a0 + 0.4); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.fillStyle = '#ffd84d'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e9a23b'; ctx.beginPath(); ctx.arc(mx + mr * 0.45, my - mr * 0.15, mr * 0.85, 0, Math.PI * 2); ctx.fill();
    // 언덕과 마을
    const hillY = h * 0.8;
    ctx.fillStyle = '#16305e'; ctx.beginPath(); ctx.moveTo(0, h); for (let x = 0; x <= w; x += 8) ctx.lineTo(x, hillY - Math.sin(x / w * Math.PI * 2.2) * 28 * s - 30 * s * Math.sin(x / w * 5.1)); ctx.lineTo(w, h); ctx.fill();
    ctx.fillStyle = '#0d2147'; ctx.beginPath(); ctx.moveTo(0, h); for (let x = 0; x <= w; x += 8) ctx.lineTo(x, h * 0.88 - Math.sin(x / w * 7) * 10 * s); ctx.lineTo(w, h); ctx.fill();
    for (let i = 0; i < 26; i++) {
      const x = 0.25 * w + r() * 0.7 * w, y = h * 0.86 + r() * h * 0.08, bw = (14 + r() * 16) * s, bh = (10 + r() * 12) * s;
      ctx.fillStyle = pick(r, ['#24406f', '#2c4a7a', '#1d365f']); ctx.fillRect(x, y - bh, bw, bh);
      ctx.fillStyle = '#1a2b4d'; ctx.beginPath(); ctx.moveTo(x - 2 * s, y - bh); ctx.lineTo(x + bw / 2, y - bh - 8 * s); ctx.lineTo(x + bw + 2 * s, y - bh); ctx.fill();
      if (r() < 0.7) { ctx.fillStyle = '#ffd860'; ctx.fillRect(x + bw * 0.3, y - bh * 0.6, 3 * s, 3 * s); }
    }
    // 교회 첨탑
    const cx = 0.55 * w, cy = h * 0.87; ctx.fillStyle = '#1a2d52'; ctx.fillRect(cx, cy - 26 * s, 14 * s, 26 * s); ctx.beginPath(); ctx.moveTo(cx - 2 * s, cy - 26 * s); ctx.lineTo(cx + 7 * s, cy - 80 * s); ctx.lineTo(cx + 16 * s, cy - 26 * s); ctx.fill();
    // 사이프러스(불꽃 모양 나무)
    const bx = 0.12 * w, top = h * 0.18, base = h;
    for (let i = 0; i < 900; i++) {
      const t = r(); const y = base - t * (base - top); const half = (1 - t) * 0.075 * w * (0.8 + 0.2 * Math.sin(t * 20)) + 4 * s;
      const x = bx + (r() - 0.5) * 2 * half + Math.sin(t * 9) * 12 * s;
      ctx.strokeStyle = pick(r, ['#0c1f17', '#1b3a2a', '#2c4a2f', '#4a3b20', '#13291d']); ctx.lineWidth = (3 + r() * 3) * s; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + (r() - 0.5) * 10 * s, y - 12 * s, x + (r() - 0.5) * 8 * s, y - (18 + r() * 14) * s); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ② 은하수 — 대각선 별의 강, 성운, 산 능선
  function milkyway(ctx, w, h) {
    const r = rng(2026), s = Math.min(w, h) / 700;
    vgrad(ctx, w, h, [[0, '#04050d'], [0.6, '#0b0f2c'], [1, '#1b1338']]);
    stars(ctx, w, h, r, Math.floor(1600 * w * h / 960000), 1);
    const ax = -0.05 * w, ay = 0.95 * h, bx = 1.05 * w, by = 0.05 * h, len = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / len, uy = (by - ay) / len, nx = -uy, ny = ux, band = 0.11 * Math.min(w, h) + 40 * s;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 160; i++) { const t = r(), o = gauss(r) * band * 0.8; const x = ax + ux * t * len + nx * o, y = ay + uy * t * len + ny * o; glow(ctx, x, y, (40 + r() * 90) * s, pick(r, ['#ff6fae', '#8b5cf6', '#60a5fa', '#f59e0b', '#c084fc']), 0.08 + r() * 0.06); }
    for (let i = 0; i < Math.floor(9000 * w * h / 960000); i++) { const t = r(), o = gauss(r) * band * 0.55; const x = ax + ux * t * len + nx * o, y = ay + uy * t * len + ny * o; ctx.globalAlpha = 0.25 + r() * 0.75; ctx.fillStyle = pick(r, ['#ffffff', '#ffe9f3', '#e0e7ff', '#fff3d1']); ctx.fillRect(x, y, r() < 0.9 ? 1.1 : 2, r() < 0.9 ? 1.1 : 2); }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    for (let i = 0; i < 70; i++) { const t = r(), o = gauss(r) * band * 0.12; const x = ax + ux * t * len + nx * o, y = ay + uy * t * len + ny * o; glow(ctx, x, y, (18 + r() * 30) * s, '#05060f', 0.35); }
    for (let i = 0; i < 14; i++) { const x = r() * w, y = r() * h * 0.7; glow(ctx, x, y, 7 * s, '#ffffff', 0.9); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 1.6 * s, 0, 7); ctx.fill(); }
    ridge(ctx, w, h, r, h * 0.83, 60 * s, '#0b0c22', 26 * s);
    ridge(ctx, w, h, r, h * 0.9, 40 * s, '#06060f', 18 * s);
  }

  // ③ 오로라 — 초록·보라 빛 커튼, 눈 덮인 산
  function aurora(ctx, w, h) {
    const r = rng(77), s = Math.min(w, h) / 700;
    vgrad(ctx, w, h, [[0, '#030b14'], [0.5, '#06222b'], [1, '#0a1a24']]);
    stars(ctx, w, h, r, Math.floor(900 * w * h / 960000), 0.75);
    ctx.globalCompositeOperation = 'lighter';
    const ribbons = [{ y: 0.42, c: '#2ff3a0', a: 0.05, amp: 0.08, f: 1.6, hgt: 0.32 }, { y: 0.33, c: '#26d6c8', a: 0.035, amp: 0.06, f: 2.3, hgt: 0.25 }, { y: 0.5, c: '#b06cff', a: 0.03, amp: 0.05, f: 1.2, hgt: 0.2 }];
    ribbons.forEach((rb, k) => {
      const ph = r() * 6;
      for (let x = 0; x < w; x += 2) {
        const yy = h * rb.y + Math.sin(x / w * Math.PI * rb.f * 2 + ph) * h * rb.amp + Math.sin(x / w * 17 + k) * 6 * s;
        const hh = h * rb.hgt * (0.6 + 0.4 * Math.sin(x / w * 9 + ph * 2));
        const g = ctx.createLinearGradient(0, yy - hh, 0, yy); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.75, rb.c); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = rb.a * (0.6 + 0.6 * r()); ctx.fillStyle = g; ctx.fillRect(x, yy - hh, 2, hh + 6 * s);
      }
    });
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ridge(ctx, w, h, r, h * 0.78, 90 * s, '#1c3442', 40 * s);
    // 눈 덮인 봉우리 하이라이트
    ctx.globalAlpha = 0.25; ridge(ctx, w, h, rng(5), h * 0.8, 70 * s, '#cfe9f2', 30 * s); ctx.globalAlpha = 1;
    ridge(ctx, w, h, r, h * 0.86, 50 * s, '#0b1a22', 22 * s);
    // 물에 비친 빛
    const g = ctx.createLinearGradient(0, h * 0.9, 0, h); g.addColorStop(0, 'rgba(47,243,160,.10)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, h * 0.9, w, h * 0.1);
  }

  // ④ 반딧불 숲 — 겹겹의 전나무 실루엣, 안개, 반딧불
  function fireflies(ctx, w, h) {
    const r = rng(99), s = Math.min(w, h) / 700;
    vgrad(ctx, w, h, [[0, '#06120f'], [0.55, '#0d2a20'], [1, '#081610']]);
    stars(ctx, w, h, r, 300, 0.35, ['#e8fff1', '#ffffff']);
    glow(ctx, 0.78 * w, 0.16 * h, 120 * s, '#e9f5c8', 0.22); ctx.fillStyle = '#f2f7da'; ctx.beginPath(); ctx.arc(0.78 * w, 0.16 * h, 26 * s, 0, 7); ctx.fill();
    const layers = [['#123a2c', 0.62, 0.55], ['#0d2d22', 0.72, 0.75], ['#081e17', 0.82, 1]];
    layers.forEach(([col, yb, sc], li) => {
      ctx.fillStyle = col;
      for (let x = -40 * s; x < w + 40 * s; x += (24 + r() * 26) * s * sc) {
        const th = (90 + r() * 110) * s * sc, tw = th * 0.38, by = h * yb + r() * 20 * s;
        ctx.beginPath(); ctx.moveTo(x, by - th);
        for (let t = 1; t <= 5; t++) { const yy = by - th + th * t / 5; ctx.lineTo(x - tw * t / 5, yy); ctx.lineTo(x - tw * (t - 0.5) / 5 * 0.6, yy - 2); }
        for (let t = 5; t >= 1; t--) { const yy = by - th + th * t / 5; ctx.lineTo(x + tw * (t - 0.5) / 5 * 0.6, yy - 2); ctx.lineTo(x + tw * t / 5, yy); }
        ctx.closePath(); ctx.fill();
      }
      ctx.fillRect(0, h * yb, w, h);
      const mg = ctx.createLinearGradient(0, h * yb - 40 * s, 0, h * yb + 20 * s); mg.addColorStop(0, 'rgba(160,220,190,0)'); mg.addColorStop(0.6, 'rgba(160,220,190,.06)'); mg.addColorStop(1, 'rgba(160,220,190,0)');
      ctx.fillStyle = mg; ctx.fillRect(0, h * yb - 40 * s, w, 60 * s);
    });
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 90; i++) { const x = r() * w, y = h * 0.35 + r() * h * 0.6; glow(ctx, x, y, (10 + r() * 16) * s, '#d9ff6b', 0.5); ctx.fillStyle = '#fbffd0'; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(x, y, 1.6 * s, 0, 7); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }

  // ⑤ 벚꽃 — 꽃가지와 흩날리는 꽃잎
  function sakura(ctx, w, h) {
    const r = rng(404), s = Math.min(w, h) / 700;
    vgrad(ctx, w, h, [[0, '#fde7ef'], [0.5, '#fff1f4'], [1, '#fff8ef']]);
    glow(ctx, 0.85 * w, 0.85 * h, 0.4 * w, '#ffd9e6', 0.6);
    const petals = ['#f9b6cc', '#f7a1bd', '#ffd3e0', '#fbc4d5', '#ffffff'];
    function flower(x, y, R) {
      const rot = r() * Math.PI;
      ctx.fillStyle = pick(r, petals);
      for (let p = 0; p < 5; p++) { const a = rot + p * Math.PI * 2 / 5; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * R * 0.55, y + Math.sin(a) * R * 0.55, R * 0.55, R * 0.38, a, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#e46a8e'; ctx.beginPath(); ctx.arc(x, y, R * 0.18, 0, 7); ctx.fill();
    }
    function branch(x, y, a, len, wdt, depth) {
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      ctx.strokeStyle = '#5a3a35'; ctx.lineWidth = wdt; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo((x + x2) / 2 + (r() - 0.5) * len * 0.3, (y + y2) / 2 + (r() - 0.5) * len * 0.3, x2, y2); ctx.stroke();
      if (depth <= 0 || wdt < 1.5) { for (let i = 0; i < 6; i++) flower(x2 + (r() - 0.5) * 40 * s, y2 + (r() - 0.5) * 40 * s, (8 + r() * 7) * s); return; }
      const n = 2 + (r() < 0.4 ? 1 : 0);
      for (let i = 0; i < n; i++) branch(x2, y2, a + (r() - 0.5) * 1.1, len * (0.62 + r() * 0.2), wdt * 0.66, depth - 1);
      if (depth < 3) for (let i = 0; i < 3; i++) flower(x2 + (r() - 0.5) * 30 * s, y2 + (r() - 0.5) * 30 * s, (7 + r() * 6) * s);
    }
    branch(-10 * s, 0.08 * h, 0.35, 0.26 * w, 18 * s, 5);
    branch(w + 10 * s, 0.02 * h, Math.PI - 0.55, 0.22 * w, 15 * s, 5);
    for (let i = 0; i < 140; i++) { const x = r() * w, y = r() * h, R = (4 + r() * 6) * s; ctx.globalAlpha = 0.45 + r() * 0.5; ctx.fillStyle = pick(r, petals); ctx.beginPath(); ctx.ellipse(x, y, R, R * 0.6, r() * 3, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  // ⑥ 모네의 수련 — 인상파 붓 터치로 그린 연못, 연잎, 수련
  function monet(ctx, w, h) {
    const r = rng(1916), s = Math.min(w, h) / 700;
    vgrad(ctx, w, h, [[0, '#b9d3e3'], [0.5, '#a9c9d6'], [1, '#c2d6cc']]);
    const water = ['#a7c4d9', '#8fb3c9', '#b8d4c8', '#c9b8e0', '#e8c7d8', '#d7e6ef', '#9cc0cf', '#bfd8e6', '#f2e6c9'];
    ctx.lineCap = 'round';
    for (let i = 0; i < Math.floor(4200 * w * h / 960000); i++) { const x = r() * w, y = r() * h, l = (8 + r() * 16) * s; ctx.strokeStyle = pick(r, water); ctx.globalAlpha = 0.45 + r() * 0.4; ctx.lineWidth = (3 + r() * 4) * s; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + l, y + (r() - 0.5) * 3 * s); ctx.stroke(); }
    for (let i = 0; i < 22; i++) {
      const cx = r() * w, cy = h * 0.15 + r() * h * 0.85, R = (30 + r() * 50) * s * (0.6 + cy / h * 0.6);
      for (let k = 0; k < 90; k++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R; const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.45; ctx.strokeStyle = pick(r, ['#7fae7a', '#9cc58d', '#5f9466', '#b4d39c', '#6e9f74']); ctx.globalAlpha = 0.7; ctx.lineWidth = (3 + r() * 3) * s; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (6 + r() * 6) * s, y + (r() - 0.5) * 2 * s); ctx.stroke(); }
      if (r() < 0.6) { const fx = cx + (r() - 0.5) * R * 0.6, fy = cy + (r() - 0.5) * R * 0.2; const fc = r() < 0.6 ? ['#f4a7c3', '#f7c6d8', '#e985a8'] : ['#ffffff', '#fff3d6', '#f8e1a8']; for (let k = 0; k < 18; k++) { ctx.fillStyle = pick(r, fc); ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.ellipse(fx + (r() - 0.5) * 12 * s, fy + (r() - 0.5) * 6 * s, 4 * s, 2.4 * s, r() * 3, 0, 7); ctx.fill(); } }
    }
    for (let i = 0; i < 40; i++) { const x = r() * w; ctx.strokeStyle = pick(r, ['#c9b8e0', '#e8c7d8']); ctx.globalAlpha = 0.35; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + (r() - 0.5) * 20 * s, (40 + r() * 120) * s); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }

  // ⑦ 뭉게구름 하늘
  function clouds(ctx, w, h) {
    const r = rng(312), s = Math.min(w, h) / 700;
    vgrad(ctx, w, h, [[0, '#7fbdf5'], [0.55, '#bfe0fb'], [1, '#f3f9ff']]);
    glow(ctx, 0.15 * w, 0.12 * h, 220 * s, '#fffbe6', 0.9);
    function cloud(cx, cy, sc) {
      const puffs = []; for (let i = 0; i < 14; i++) puffs.push([cx + (r() - 0.5) * 200 * sc, cy - Math.abs(gauss(r)) * 40 * sc, (30 + r() * 45) * sc]);
      ctx.fillStyle = 'rgba(160,190,225,.35)'; puffs.forEach(([x, y, R]) => { ctx.beginPath(); ctx.arc(x + 6 * sc, y + 10 * sc, R, 0, 7); ctx.fill(); });
      puffs.forEach(([x, y, R]) => { const g = ctx.createRadialGradient(x - R * 0.3, y - R * 0.4, R * 0.2, x, y, R); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e6f0fb'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill(); });
    }
    [[0.25, 0.3, 1.1], [0.7, 0.2, 0.9], [0.55, 0.55, 1.3], [0.12, 0.72, 0.9], [0.9, 0.62, 1], [0.4, 0.88, 1.2], [0.85, 0.92, 0.8]].forEach(([x, y, c]) => cloud(x * w, y * h, c * s));
    ctx.strokeStyle = 'rgba(60,80,110,.55)'; ctx.lineWidth = 1.6 * s;
    for (let i = 0; i < 5; i++) { const x = (0.6 + r() * 0.25) * w, y = (0.08 + r() * 0.1) * h, b = (6 + r() * 4) * s; ctx.beginPath(); ctx.moveTo(x - b, y); ctx.quadraticCurveTo(x - b / 2, y - b * 0.6, x, y); ctx.quadraticCurveTo(x + b / 2, y - b * 0.6, x + b, y); ctx.stroke(); }
  }

  // ⑧ 여름 바다 — 하늘, 반짝이는 물결, 모래, 작은 돛단배
  function sea(ctx, w, h) {
    const r = rng(815), s = Math.min(w, h) / 700;
    vgrad(ctx, w, h * 0.45, [[0, '#8fd3ff'], [1, '#d9f2ff']]);
    glow(ctx, 0.8 * w, 0.12 * h, 160 * s, '#fff6c2', 0.95); ctx.fillStyle = '#fff3a8'; ctx.beginPath(); ctx.arc(0.8 * w, 0.12 * h, 34 * s, 0, 7); ctx.fill();
    const horizon = h * 0.45;
    const sg = ctx.createLinearGradient(0, horizon, 0, h * 0.86); sg.addColorStop(0, '#2f9fd8'); sg.addColorStop(0.5, '#4cc3dd'); sg.addColorStop(1, '#8fe3e0'); ctx.fillStyle = sg; ctx.fillRect(0, horizon, w, h * 0.41);
    ctx.lineCap = 'round';
    for (let i = 0; i < 700; i++) { const y = horizon + Math.pow(r(), 1.4) * h * 0.4, x = r() * w, l = (6 + (y - horizon) / h * 60) * s; ctx.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,.7)' : 'rgba(200,245,255,.6)'; ctx.lineWidth = (1 + (y - horizon) / h * 4) * s; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + l, y); ctx.stroke(); }
    for (let i = 0; i < 160; i++) { const x = 0.8 * w + gauss(r) * 40 * s, y = horizon + r() * h * 0.3; ctx.fillStyle = 'rgba(255,250,210,.85)'; ctx.fillRect(x, y, (4 + r() * 10) * s, 1.5 * s); }
    ctx.fillStyle = '#f6e7c8'; ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(0, h * 0.86); for (let x = 0; x <= w; x += 10) ctx.lineTo(x, h * 0.86 + Math.sin(x / w * 6) * 8 * s); ctx.lineTo(w, h); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3 * s; ctx.beginPath(); for (let x = 0; x <= w; x += 10) { const y = h * 0.86 + Math.sin(x / w * 6) * 8 * s - 2 * s; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    const bx = 0.28 * w, by = horizon + 26 * s; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(bx, by - 2 * s); ctx.lineTo(bx + 18 * s, by - 40 * s); ctx.lineTo(bx + 20 * s, by - 2 * s); ctx.fill(); ctx.fillStyle = '#ff8a7a'; ctx.beginPath(); ctx.moveTo(bx + 22 * s, by - 2 * s); ctx.lineTo(bx + 22 * s, by - 30 * s); ctx.lineTo(bx + 36 * s, by - 2 * s); ctx.fill(); ctx.fillStyle = '#3a4a6a'; ctx.fillRect(bx - 4 * s, by - 2 * s, 44 * s, 5 * s);
  }

  const ARTS = { starry, milkyway, aurora, fireflies, sakura, monet, clouds, sea };
  function draw(name, canvas, cssW, cssH, dpr) {
    const fn = ARTS[name]; if (!fn) return false;
    dpr = dpr || 1; canvas.width = Math.max(1, Math.round(cssW * dpr)); canvas.height = Math.max(1, Math.round(cssH * dpr));
    const ctx = canvas.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.scale(dpr, dpr); fn(ctx, cssW, cssH); return true;
  }
  window.YeramArt = { draw, names: Object.keys(ARTS) };
})();
