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
  // 소노마식 물결: 아래에서 겹겹이 올라오는 부드러운 곡선 띠(색은 위→아래)
  function wavesWith(colors, shadow) {
    return function (ctx, w, h) {
      const n = colors.length;
      for (let i = 0; i < n; i++) {
        const base = h * (0.18 + 0.82 * (i / n)), amp = h * (0.07 + 0.03 * (i % 2)), ph = i * 1.7 + 0.6, k = (1.1 + 0.25 * (i % 3)) * Math.PI / w;
        ctx.beginPath(); ctx.moveTo(0, h);
        for (let x = 0; x <= w + 8; x += 8) ctx.lineTo(x, base + Math.sin(x * k + ph) * amp + Math.sin(x * k * 2.3 + ph * 1.3) * amp * 0.25);
        ctx.lineTo(w, h); ctx.closePath();
        const g = ctx.createLinearGradient(0, base - amp, w, base + amp * 2); g.addColorStop(0, colors[i][0]); g.addColorStop(1, colors[i][1]);
        ctx.save(); ctx.shadowColor = shadow; ctx.shadowBlur = 40; ctx.shadowOffsetY = -6; ctx.fillStyle = g; ctx.fill(); ctx.restore();
      }
    };
  }
  // 필름 같은 잔잔한 입자(그라데이션을 덜 밋밋하게)
  function grain(ctx, w, h) {
    const r = rng(77), c = document.createElement('canvas'); c.width = 160; c.height = 160;
    const x = c.getContext('2d'), im = x.createImageData(160, 160);
    for (let i = 0; i < im.data.length; i += 4) { const v = r() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 22; }
    x.putImageData(im, 0, 0); ctx.fillStyle = ctx.createPattern(c, 'repeat'); ctx.fillRect(0, 0, w, h);
  }
  // 유화 느낌의 밤: 소용돌이 흐름을 따라 짧은 붓결을 아주 옅게 겹친다(그림처럼 보이지 않게 낮은 대비)
  function oilWith(strength) {
    return function (ctx, w, h) {
      const r = rng(1890), n = noise2(23), sc = 2.6 / Math.min(w, h);
      const vort = [[0.62, 0.30, 1.0], [0.30, 0.42, -0.8], [0.82, 0.62, 0.7], [0.18, 0.18, 0.6]].map(([x, y, k]) => [x * w, y * h, k * Math.min(w, h) * 0.28]);
      const angle = (x, y) => {
        let a = n(x * sc, y * sc, 3) * Math.PI * 2.2 + 0.4;
        let vx = Math.cos(a), vy = Math.sin(a);
        for (const [cx, cy, R] of vort) { const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy, f = Math.exp(-d2 / (2 * R * R)) * 2.4 * Math.sign(R); vx += -dy / Math.sqrt(d2 + 1) * f; vy += dx / Math.sqrt(d2 + 1) * f; }
        return Math.atan2(vy, vx);
      };
      const cols = ['#2b4c9b', '#3a63b8', '#1f3a80', '#4f7fcf', '#6f9ee0', '#86b4e6', '#1a2f6a', '#2f6fa8', '#4aa0c8'];
      const count = Math.floor(w * h / 260 * strength);
      ctx.lineCap = 'round';
      for (let i = 0; i < count; i++) {
        let x = r() * w, y = r() * h;
        const len = 14 + r() * 22, lw = 3.5 + r() * 5.5;
        const nearV = vort.some(([cx, cy, R]) => Math.hypot(x - cx, y - cy) < Math.abs(R) * 0.7);
        ctx.strokeStyle = (nearV && r() < 0.35) ? (r() < 0.5 ? '#c9dcf2' : '#e8d98a') : cols[Math.floor(r() * cols.length)];
        ctx.globalAlpha = (0.035 + r() * 0.06) * (0.7 + strength * 0.3);
        ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x, y);
        for (let k = 0; k < 4; k++) { const a = angle(x, y); x += Math.cos(a) * len / 4; y += Math.sin(a) * len / 4; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      // 별 둘레의 둥근 붓결 빛무리
      const starsAt = [[0.15, 0.12], [0.44, 0.08], [0.72, 0.16], [0.9, 0.08], [0.58, 0.28], [0.3, 0.24]];
      for (const [fx, fy] of starsAt) {
        const cx = fx * w, cy = fy * h, R = Math.min(w, h) * (0.025 + r() * 0.02);
        glow(ctx, cx, cy, R * 3.2, 'rgba(246,214,110,1)', 0.16 * strength + 0.06);
        for (let ring = 1; ring <= 3; ring++) for (let q = 0; q < 6; q++) { ctx.globalAlpha = 0.05 * strength; ctx.strokeStyle = ring % 2 ? '#f3dd8a' : '#cfe1f5'; ctx.lineWidth = 4 + r() * 3;
          const st = r() * 6.28; ctx.beginPath(); ctx.arc(cx, cy, R * (0.7 + ring * 0.6) + r() * 3, st, st + 0.6 + r() * 0.8); ctx.stroke(); }
        glow(ctx, cx, cy, R * 0.9, 'rgba(255,246,210,1)', 0.7);
      }
      // 달
      glow(ctx, w * 0.9, h * 0.1, Math.min(w, h) * 0.12, 'rgba(250,220,120,1)', 0.22);
      ctx.globalAlpha = 1;
    };
  }
  // HUD: 홀로그램 격자·동심원 게이지·눈금·스캔라인(청록 계열)
  function hud(ctx, w, h) {
    const r = rng(3000), C = (a) => 'rgba(80,220,255,' + a + ')';
    // 원근 격자 바닥
    ctx.lineWidth = 1;
    for (let i = 0; i <= 24; i++) { const x = (i / 24) * w; ctx.strokeStyle = C(0.05); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let j = 0; j <= 16; j++) { const y = (j / 16) * h; ctx.strokeStyle = C(0.04); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    // 동심원 게이지(오른쪽 위, 왼쪽 아래)
    const gauge = (cx, cy, R, seed) => {
      const q = rng(seed);
      glow(ctx, cx, cy, R * 1.3, 'rgba(60,200,255,1)', 0.10);
      for (let k = 0; k < 7; k++) {
        const rr = R * (0.32 + k * 0.11), segs = 2 + Math.floor(q() * 5);
        ctx.lineWidth = k % 3 === 0 ? 3 : 1.2; ctx.strokeStyle = C(0.18 + q() * 0.25);
        for (let sg = 0; sg < segs; sg++) { const st = q() * Math.PI * 2, ln = 0.3 + q() * 1.4; ctx.beginPath(); ctx.arc(cx, cy, rr, st, st + ln); ctx.stroke(); }
      }
      ctx.strokeStyle = C(0.3); ctx.lineWidth = 1;
      for (let t = 0; t < 72; t++) { const a = t / 72 * Math.PI * 2, l = t % 6 === 0 ? 10 : 4; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.lineTo(cx + Math.cos(a) * (R - l), cy + Math.sin(a) * (R - l)); ctx.stroke(); }
      glow(ctx, cx, cy, R * 0.18, 'rgba(170,240,255,1)', 0.5);
    };
    const m = Math.min(w, h);
    gauge(w * 0.80, h * 0.30, m * 0.30, 11);
    gauge(w * 0.16, h * 0.82, m * 0.22, 29);
    // 데이터 막대·꺾은선
    ctx.strokeStyle = C(0.22); ctx.lineWidth = 1.3; ctx.beginPath();
    for (let i = 0; i <= 40; i++) { const x = w * 0.05 + i * w * 0.009, y = h * 0.14 + Math.sin(i * 0.6) * 10 + r() * 8; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    for (let i = 0; i < 18; i++) { ctx.fillStyle = C(0.14 + r() * 0.12); const bh = 6 + r() * 34; ctx.fillRect(w * 0.55 + i * 9, h * 0.94 - bh, 5, bh); }
    // 모서리 브래킷
    ctx.strokeStyle = C(0.35); ctx.lineWidth = 2; const L = m * 0.06, P = 14;
    [[P, P, 1, 1], [w - P, P, -1, 1], [P, h - P, 1, -1], [w - P, h - P, -1, -1]].forEach(([x, y, sx, sy]) => { ctx.beginPath(); ctx.moveTo(x + sx * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * L); ctx.stroke(); });
    // 스캔라인
    ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
    ctx.globalAlpha = 1;
  }
  // 달빛: 뒤편에 크고 흐릿한 달 + 은빛 구름 띠
  function moon(ctx, w, h) {
    const r = rng(1969), n = noise2(5), m = Math.min(w, h);
    const cx = w * 0.62, cy = h * 0.26, R = m * 0.26;
    glow(ctx, cx, cy, R * 4.2, 'rgba(150,170,230,1)', 0.20);
    glow(ctx, cx, cy, R * 2.0, 'rgba(210,220,250,1)', 0.20);
    // 달 표면
    const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
    g.addColorStop(0, 'rgba(250,250,255,.95)'); g.addColorStop(0.7, 'rgba(222,228,244,.92)'); g.addColorStop(1, 'rgba(190,200,228,.85)');
    ctx.filter = 'blur(' + Math.round(R * 0.05) + 'px)'; ctx.globalAlpha = 0.5; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    // 바다(어두운 얼룩)
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    for (let i = 0; i < 9; i++) { const x = cx + (r() - 0.5) * R * 1.3, y = cy + (r() - 0.5) * R * 1.3; glow(ctx, x, y, R * (0.18 + r() * 0.25), 'rgba(120,132,170,1)', 0.12); }
    ctx.restore(); ctx.filter = 'none';
    // 은빛 구름
    const S = 3, lw = Math.ceil(w / S), lh = Math.ceil(h / S), oc = document.createElement('canvas'); oc.width = lw; oc.height = lh;
    const ox = oc.getContext('2d'), img = ox.createImageData(lw, lh), d = img.data, sc = 3 / m;
    for (let py = 0; py < lh; py++) for (let px = 0; px < lw; px++) {
      const x = px * S, y = py * S, band = Math.exp(-Math.pow((y - h * (0.42 + 0.08 * Math.sin(x / w * 3))) / (h * 0.13), 2));
      let v = n(x * sc * 1.4, y * sc * 3, 5); v = Math.max(0, v - 0.45) * 2.2 * band;
      const near = Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * (R * 2.2) ** 2));
      const i4 = (py * lw + px) * 4; d[i4] = 200 + 50 * near; d[i4 + 1] = 208 + 40 * near; d[i4 + 2] = 240; d[i4 + 3] = Math.min(255, v * (80 + 90 * near));
    }
    ox.putImageData(img, 0, 0); ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = true; ctx.drawImage(oc, 0, 0, w, h);
    dots(ctx, w, h, r, Math.floor(260 * w * h / 960000), ['#ffffff', '#dfe8ff']);
  }
  // 중세: 검정 가죽 결 + 금박 이중 테두리·모서리 장식·옅은 다마스크 격자
  function medieval(ctx, w, h) {
    const r = rng(1215), n = noise2(31), m = Math.min(w, h), G = (a) => 'rgba(212,175,55,' + a + ')';
    // 가죽 결(저해상도 노이즈)
    const S = 3, lw = Math.ceil(w / S), lh = Math.ceil(h / S), oc = document.createElement('canvas'); oc.width = lw; oc.height = lh;
    const ox = oc.getContext('2d'), img = ox.createImageData(lw, lh), d = img.data, sc = 9 / m;
    for (let py = 0; py < lh; py++) for (let px = 0; px < lw; px++) { const v = n(px * S * sc, py * S * sc, 4); const i4 = (py * lw + px) * 4; d[i4] = 60; d[i4 + 1] = 44; d[i4 + 2] = 24; d[i4 + 3] = Math.max(0, (v - 0.4)) * 90; }
    ox.putImageData(img, 0, 0); ctx.drawImage(oc, 0, 0, w, h);
    // 다마스크 격자(마름모 + 작은 꽃잎)
    const step = m * 0.12;
    ctx.strokeStyle = G(0.10); ctx.lineWidth = 1;
    for (let y = -step; y < h + step; y += step) for (let x = -step; x < w + step; x += step) {
      const ox2 = ((y / step) % 2) * step / 2;
      ctx.beginPath(); ctx.moveTo(x + ox2, y - step * 0.32); ctx.lineTo(x + ox2 + step * 0.22, y); ctx.lineTo(x + ox2, y + step * 0.32); ctx.lineTo(x + ox2 - step * 0.22, y); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = G(0.12); ctx.beginPath(); ctx.arc(x + ox2, y, 2, 0, Math.PI * 2); ctx.fill();
    }
    // 금박 이중 테두리
    const P1 = 10, P2 = 18;
    ctx.strokeStyle = G(0.55); ctx.lineWidth = 2; ctx.strokeRect(P1, P1, w - 2 * P1, h - 2 * P1);
    ctx.strokeStyle = G(0.3); ctx.lineWidth = 1; ctx.strokeRect(P2, P2, w - 2 * P2, h - 2 * P2);
    // 모서리 장식(소용돌이 덩굴)
    const corner = (x, y, sx, sy) => {
      ctx.save(); ctx.translate(x, y); ctx.scale(sx, sy); ctx.strokeStyle = G(0.6); ctx.lineWidth = 1.6;
      const L = m * 0.09;
      ctx.beginPath(); ctx.moveTo(0, L); ctx.bezierCurveTo(0, L * 0.4, L * 0.1, L * 0.1, L * 0.4, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(L * 0.28, L * 0.28, L * 0.14, Math.PI * 0.2, Math.PI * 1.9); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(L * 0.4, 0); ctx.quadraticCurveTo(L * 0.7, L * 0.12, L, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, L * 0.4); ctx.quadraticCurveTo(L * 0.12, L * 0.7, 0, L); ctx.stroke();
      ctx.fillStyle = G(0.7); ctx.beginPath(); ctx.moveTo(L * 0.28, L * 0.1); ctx.lineTo(L * 0.34, L * 0.28); ctx.lineTo(L * 0.28, L * 0.46); ctx.lineTo(L * 0.22, L * 0.28); ctx.closePath(); ctx.fill();
      ctx.restore();
    };
    corner(P2 + 4, P2 + 4, 1, 1); corner(w - P2 - 4, P2 + 4, -1, 1); corner(P2 + 4, h - P2 - 4, 1, -1); corner(w - P2 - 4, h - P2 - 4, -1, -1);
    // 촛불 같은 따뜻한 빛 + 비네트
    glow(ctx, w * 0.5, h * 0.05, m * 0.7, 'rgba(200,140,50,1)', 0.10);
    const v = ctx.createRadialGradient(w / 2, h / 2, m * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.6); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.globalAlpha = 1; ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  }
  // HUD v2: 군더더기 없이 큰 조준 링 하나(오른쪽 아래로 잘림) + 옅은 육각 메시 + 가는 눈금
  function hud2(ctx, w, h) {
    const m = Math.min(w, h), C = (a) => 'rgba(90,215,255,' + a + ')';
    // 육각 메시(가장자리로 갈수록 옅게)
    const R = m * 0.035, hx = R * Math.sqrt(3);
    ctx.lineWidth = 1;
    for (let row = 0, y = 0; y < h + R; row++, y += R * 1.5) for (let x = (row % 2) * hx / 2; x < w + hx; x += hx) {
      const fade = Math.max(0, 1 - Math.hypot(x - w * 0.78, y - h * 0.72) / (m * 1.1));
      if (fade < 0.05) continue; ctx.strokeStyle = C(0.07 * fade); ctx.beginPath();
      for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; const px = x + Math.cos(a) * R, py = y + Math.sin(a) * R; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.closePath(); ctx.stroke();
    }
    const cx = w * 0.80, cy = h * 0.74, B = m * 0.62;
    glow(ctx, cx, cy, B * 1.2, 'rgba(40,170,255,1)', 0.16);
    const arc = (r, a0, a1, lw, al) => { ctx.lineWidth = lw; ctx.strokeStyle = C(al); ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke(); };
    arc(B, 0, Math.PI * 2, 1, 0.25);
    arc(B * 0.93, Math.PI * 0.95, Math.PI * 1.55, 5, 0.35);
    arc(B * 0.93, Math.PI * 1.62, Math.PI * 1.78, 5, 0.5);
    arc(B * 0.82, Math.PI * 1.05, Math.PI * 1.9, 1.2, 0.3);
    arc(B * 0.70, Math.PI * 0.9, Math.PI * 1.25, 9, 0.12);
    arc(B * 0.58, 0, Math.PI * 2, 1, 0.18);
    arc(B * 0.45, Math.PI * 1.1, Math.PI * 1.7, 2.5, 0.35);
    // 눈금
    for (let t = 0; t < 120; t++) { const a = t / 120 * Math.PI * 2, l = t % 10 === 0 ? 14 : 6; ctx.strokeStyle = C(t % 10 === 0 ? 0.45 : 0.22); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * B * 0.88, cy + Math.sin(a) * B * 0.88); ctx.lineTo(cx + Math.cos(a) * (B * 0.88 - l), cy + Math.sin(a) * (B * 0.88 - l)); ctx.stroke(); }
    // 십자 조준선
    ctx.strokeStyle = C(0.18); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx - B * 1.1, cy); ctx.lineTo(cx - B * 0.5, cy); ctx.moveTo(cx, cy - B * 1.1); ctx.lineTo(cx, cy - B * 0.5); ctx.stroke();
    glow(ctx, cx, cy, B * 0.12, 'rgba(190,245,255,1)', 0.35);
    // 화면 위쪽 가는 정보 줄
    ctx.strokeStyle = C(0.25); ctx.beginPath(); ctx.moveTo(w * 0.04, h * 0.06); ctx.lineTo(w * 0.32, h * 0.06); ctx.lineTo(w * 0.35, h * 0.09); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // 달빛 v2: 오른쪽 위 화면 밖에 큰 달이 있는 듯 — 테두리 빛과 퍼지는 빛줄기만
  function moon2(ctx, w, h) {
    const m = Math.min(w, h), cx = w * 1.02, cy = -h * 0.08, R = m * 0.55, r = rng(77);
    glow(ctx, cx, cy, R * 2.6, 'rgba(150,170,225,1)', 0.30);
    glow(ctx, cx, cy, R * 1.5, 'rgba(205,215,245,1)', 0.30);
    // 달 표면은 아주 흐릿하게만
    ctx.filter = 'blur(' + Math.round(m * 0.012) + 'px)';
    const g = ctx.createRadialGradient(cx - R * 0.35, cy + R * 0.35, R * 0.2, cx, cy, R);
    g.addColorStop(0, 'rgba(236,240,252,.55)'); g.addColorStop(0.85, 'rgba(206,214,240,.42)'); g.addColorStop(1, 'rgba(255,255,255,.65)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill(); ctx.filter = 'none';
    // 빛줄기
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.6 + i * 0.05 + r() * 0.02), len = Math.hypot(w, h) * 1.1, wd = 0.02 + r() * 0.03;
      const gr = ctx.createLinearGradient(cx, cy, cx + Math.cos(a) * len, cy + Math.sin(a) * len); gr.addColorStop(0, 'rgba(180,195,240,.045)'); gr.addColorStop(1, 'rgba(180,195,240,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a - wd) * len, cy + Math.sin(a - wd) * len); ctx.lineTo(cx + Math.cos(a + wd) * len, cy + Math.sin(a + wd) * len); ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    dots(ctx, w, h, r, Math.floor(160 * w * h / 960000), ['#ffffff', '#dfe8ff']);
  }
  // 중세 v2: 검은 바탕 + 위아래 금박 띠(반복 문양) + 금속 광택 선 + 촛불빛
  function medieval2(ctx, w, h) {
    const m = Math.min(w, h);
    const metal = (y0, y1) => { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#6e5214'); g.addColorStop(0.45, '#f6d77c'); g.addColorStop(0.55, '#c9a034'); g.addColorStop(1, '#5c430f'); return g; };
    glow(ctx, w * 0.5, h * 0.5, Math.hypot(w, h) * 0.55, 'rgba(120,80,25,1)', 0.16);
    const band = (y, dir) => {
      const H = m * 0.035;
      ctx.fillStyle = metal(y, y + 2); ctx.fillRect(0, y, w, 2);
      ctx.fillStyle = metal(y + dir * H, y + dir * H + 1.5); ctx.fillRect(0, y + dir * H, w, 1.5);
      // 반복 문양: 마름모 + 양쪽 덩굴
      const step = H * 2.2;
      ctx.strokeStyle = 'rgba(214,176,70,.55)'; ctx.lineWidth = 1.2;
      for (let x = step / 2; x < w; x += step) {
        const yc = y + dir * H / 2;
        ctx.beginPath(); ctx.moveTo(x, yc - H * 0.32); ctx.lineTo(x + H * 0.26, yc); ctx.lineTo(x, yc + H * 0.32); ctx.lineTo(x - H * 0.26, yc); ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + H * 0.32, yc); ctx.bezierCurveTo(x + H * 0.6, yc - H * 0.35, x + H * 0.85, yc + H * 0.35, x + step / 2, yc); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - H * 0.32, yc); ctx.bezierCurveTo(x - H * 0.6, yc + H * 0.35, x - H * 0.85, yc - H * 0.35, x - step / 2, yc); ctx.stroke();
      }
    };
    band(3, 1); band(h - 3, -1);
    // 옆 금속 기둥선
    ctx.fillStyle = metal(0, 2); ctx.globalAlpha = 0.7; ctx.fillRect(3, 0, 1.5, h); ctx.fillRect(w - 4.5, 0, 1.5, h); ctx.globalAlpha = 1;
    // 은은한 문장 없는 다마스크 무늬
    ctx.strokeStyle = 'rgba(212,175,55,.06)'; ctx.lineWidth = 1; const st = m * 0.16;
    for (let y = st; y < h; y += st) for (let x = ((y / st) % 2) * st / 2; x < w + st; x += st) { ctx.beginPath(); ctx.ellipse(x, y, st * 0.18, st * 0.32, 0, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.ellipse(x, y, st * 0.32, st * 0.12, 0, 0, Math.PI * 2); ctx.stroke(); }
    const v = ctx.createRadialGradient(w / 2, h / 2, m * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  }
  const both = (a, b) => (ctx, w, h) => { a(ctx, w, h); b(ctx, w, h); };
  const wavesSunset = wavesWith([['#ffd9c2', '#ffc0cf'], ['#ffb199', '#ff9fb8'], ['#ff9478', '#f58bb5'], ['#e9739a', '#b98cf0'], ['#a77fe6', '#7e8cf2']], 'rgba(120,60,90,.18)');
  const wavesNight = wavesWith([['#1c2350', '#2a2163'], ['#2b2f7a', '#4a2c86'], ['#3f3fa8', '#6a35a6'], ['#5b4fd0', '#9b46b8'], ['#7b6cf0', '#c35bc9']], 'rgba(0,0,0,.45)');
  const wavesMint = wavesWith([['#dff7ee', '#d7f0fb'], ['#bdeedd', '#b8e3f7'], ['#93e0c8', '#94d2f2'], ['#64cfb0', '#6db9ec'], ['#3fb79a', '#4f9be0']], 'rgba(20,90,90,.16)');
  const FX = { hud, moon, medieval, hud2, moon2, medieval2, stars, galaxy, wavesSunset, wavesNight, wavesMint, starsGrain: stars, grain: () => {}, oilSoft: oilWith(0.6), oilMid: oilWith(1), oilStrong: oilWith(1.6) };
  function draw(name, canvas, cssW, cssH, dpr) {
    const fn = FX[name]; if (!fn) return false;
    dpr = dpr || 1; canvas.width = Math.max(1, Math.round(cssW * dpr)); canvas.height = Math.max(1, Math.round(cssH * dpr));
    const ctx = canvas.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.scale(dpr, dpr); fn(ctx, cssW, cssH); return true;
  }
  window.YeramArt = { draw };
})();
