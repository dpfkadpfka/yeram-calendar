'use strict';
(function () {
  const api = window.api;
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const GCOLORS = { 1: '#7986cb', 2: '#33b679', 3: '#8e24aa', 4: '#e67c73', 5: '#f6bf26', 6: '#f4511e', 7: '#039be5', 8: '#616161', 9: '#3f51b5', 10: '#0b8043', 11: '#d50000' };
  const GCOLOR_NAMES = { 1: '라벤더', 2: '세이지', 3: '포도', 4: '플라밍고', 5: '바나나', 6: '귤', 7: '공작', 8: '흑연', 9: '블루베리', 10: '바질', 11: '토마토' };
  // 예람쌤 캘린더 입력 규칙
  const RULES = [
    { label: '🔴 제출', prefix: '🔴[제출] ', color: '2', allDay: true, remind: 'none' },
    { label: '✔️ 할 일', prefix: '✔️', color: '8', allDay: false, time: ['23:00', '24:00'], remind: 'none' },
    { label: '⭐️ 출장', prefix: '⭐️[출장] ', color: '3' },
    { label: '⭐️ 출강', prefix: '⭐️[출강] ', color: '7' },
    { label: '🖥 회의', prefix: '🖥[회의] ', color: '1' },
    { label: '🖥 연수', prefix: '🖥[연수] ', color: '' },
    { label: '📽 촬영', prefix: '📽[촬영] ', color: '' },
    { label: '🗓 일정', prefix: '🗓[일정] ', color: '1' },
    { label: '📍 약속', prefix: '📍[약속] ', color: '4' },
    { label: '🏥 예약', prefix: '🏥[예약] ', color: '5' },
    { label: '🏫 학교', prefix: '🏫', color: '10' },
    { label: '🐻 쿼카', prefix: '🐻[쿼카] ', color: '6' },
    { label: '🟡 발표', prefix: '🟡', color: '2', allDay: true, remind: 'none' },
    { label: '⚫️ 갱신', prefix: '⚫️', color: '8', remind: 'none' }
  ];
  const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul';

  // ---------- 날짜 도구 ----------
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const hm = (d) => pad(d.getHours()) + ':' + pad(d.getMinutes());
  const parse = (s) => { const p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const dnum = (s) => { const p = s.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5; };
  const md = (s) => (+s.slice(5, 7)) + '/' + (+s.slice(8, 10));
  const wd = (s) => WD[parse(s).getDay()];
  const todayStr = () => ymd(new Date());
  const localIso = (dateStr, time) => dateStr + 'T' + (time || '00:00') + ':00';

  // ---------- 상태 ----------
  const S = {
    cfg: {}, cals: [], calMap: {}, events: [], ym: todayStr().slice(0, 7), sel: todayStr(),
    loading: false, lastSync: null, searchResults: null, timer: null, lastFocusLoad: 0, dragKey: null
  };

  // 설정창에서 고르는 중인 값(미리보기)을 저장된 값 위에 얹어서 본다
  const V = () => (S.draft ? Object.assign({}, S.cfg, S.draft) : S.cfg);
  function visibleCalIds() { const hidden = new Set(V().hiddenCalendars || []); return S.cals.filter(c => !hidden.has(c.id)).map(c => c.id); }
  function gridStart(ym) {
    const first = parse(ym + '-01'); const ws = +V().weekStart || 0;
    const off = (first.getDay() - ws + 7) % 7; first.setDate(first.getDate() - off); return ymd(first);
  }

  function norm(e) {
    const cal = S.calMap[e._cal] || {};
    const allDay = !!(e.start && e.start.date);
    let sd, ed, st = '', et = '';
    if (allDay) { sd = e.start.date; ed = addDays(e.end && e.end.date ? e.end.date : sd, -1); if (ed < sd) ed = sd; }
    else {
      const s = new Date(e.start.dateTime), en = new Date(e.end ? e.end.dateTime : e.start.dateTime);
      sd = ymd(s); ed = ymd(new Date(Math.max(+s, +en - 1))); st = hm(s); et = hm(en);
    }
    return {
      raw: e, id: e.id, calId: e._cal, title: e.summary || '(제목 없음)', allDay, sd, ed, st, et,
      color: GCOLORS[e.colorId] || cal.color || '#7986cb', colorId: e.colorId || '',
      loc: e.location || '', desc: e.description || '', link: e.htmlLink || '',
      recurring: !!e.recurringEventId, holiday: /#holiday@/.test(e._cal || ''), writable: cal.writable !== false
    };
  }
  function sortEv(a, b) {
    if (a.holiday !== b.holiday) return a.holiday ? -1 : 1;
    const am = a.ed > a.sd, bm = b.ed > b.sd;
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    if (am !== bm) return am ? -1 : 1;
    if (a.st !== b.st) return a.st < b.st ? -1 : 1;
    return a.title < b.title ? -1 : 1;
  }
  function byDay(list) {
    const map = {};
    list.forEach(ev => {
      let n = dnum(ev.ed) - dnum(ev.sd); if (n > 62) n = 62;
      for (let i = 0; i <= n; i++) { const d = addDays(ev.sd, i); (map[d] = map[d] || []).push(ev); }
    });
    Object.values(map).forEach(a => a.sort(sortEv));
    return map;
  }

  // ---------- 그리기 ----------
  function render() {
    const today = todayStr();
    $('monthTitle').textContent = S.ym.slice(0, 4) + '년 ' + (+S.ym.slice(5)) + '월';
    const ws = +V().weekStart || 0;
    const dow = $('dow'); dow.textContent = '';
    for (let i = 0; i < 7; i++) { const k = (i + ws) % 7; dow.appendChild(el('div', k === 0 ? 'sun' : k === 6 ? 'sat' : '', WD[k])); }

    const start = gridStart(S.ym);
    const list = S.events.map(norm);
    const map = byDay(list);
    S.dayMap = map;
    const grid = $('grid'); grid.textContent = '';
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i), dow_ = parse(d).getDay(), evs = map[d] || [];
      const hol = evs.find(e => e.holiday);
      const c = el('div', 'cell' + (d.slice(0, 7) !== S.ym ? ' out' : '') + (d === today ? ' today' : '') + (d === S.sel ? ' sel' : '') +
        (dow_ === 0 ? ' sun' : dow_ === 6 ? ' sat' : '') + (hol ? ' hol' : ''));
      c.dataset.d = d;
      const tint = (S.cfg.dayColors || {})[d]; if (tint) { c.classList.add('tinted'); c.style.setProperty('--tint', tint); }
      const head = el('div', 'chead'); head.appendChild(el('span', 'num', String(+d.slice(8))));
      if (hol) head.appendChild(el('span', 'hname', hol.title));
      c.appendChild(head);
      const chips = el('div', 'chips');
      evs.filter(e => !e.holiday).forEach(ev => {
        const ch = el('div', 'chip' + (ev.sd < d && ev.allDay ? ' cont' : ''));
        ch.style.setProperty('--cc', ev.color);
        if (!ev.allDay && ev.sd === d) ch.appendChild(el('span', 'tm', ev.st));
        // 여러 날 일정은 시작일과 주 첫 칸에만 제목을 쓰고 나머지는 색 띠로 이어 보여준다
        if (!(ev.allDay && ev.sd < d && i % 7 !== 0)) ch.appendChild(el('span', 'tx', ev.title));
        else ch.appendChild(el('span', 'tx', '\u00a0'));
        ch.appendChild(el('span', 'ic', leadIcon(ev.title)));
        ch.title = ev.title + (ev.allDay ? '' : ' (' + ev.st + '–' + ev.et + ')') + (ev.loc ? '\n' + ev.loc : '');
        ch.draggable = ev.writable;
        ch.addEventListener('click', (e) => { e.stopPropagation(); select(d, false); openEditor(ev); });
        ch.addEventListener('dblclick', (e) => e.stopPropagation());
        ch.addEventListener('dragstart', (e) => { S.drag = { ev, from: d }; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ev.id); });
        chips.appendChild(ch);
      });
      c.appendChild(chips);
      c.addEventListener('click', () => select(d, true));
      c.addEventListener('contextmenu', (e) => { e.preventDefault(); openTint(c); });
      c.addEventListener('mouseenter', () => { clearTimeout(PK.timer); if (S.cfg.hoverZoom === false || S.drag || tintEl) return; showPeek(c); });
      c.addEventListener('mouseleave', () => { clearTimeout(PK.timer); setTimeout(() => { if (!PK.over) hidePeek(); }, 90); });
      c.addEventListener('dblclick', () => openEditor(null, d));
      c.addEventListener('dragover', (e) => { if (S.drag) { e.preventDefault(); c.classList.add('drop'); } });
      c.addEventListener('dragleave', () => c.classList.remove('drop'));
      c.addEventListener('drop', (e) => { e.preventDefault(); c.classList.remove('drop'); if (S.drag) moveEvent(S.drag.ev, dnum(d) - dnum(S.drag.from)); S.drag = null; });
      grid.appendChild(c);
    }
    requestAnimationFrame(fitChips);
    renderPanel();
    renderFoot();
  }

  // 제목 맨 앞 이모지(없으면 앞 두 글자)
  const seg = window.Intl && Intl.Segmenter ? new Intl.Segmenter('ko', { granularity: 'grapheme' }) : null;
  function leadIcon(t) {
    const g = seg ? Array.from(seg.segment(t), x => x.segment) : Array.from(t);
    if (g.length && /\p{Extended_Pictographic}/u.test(g[0])) return g[0];
    return g.slice(0, 2).join('');
  }
  // 칸이 좁으면 ① 작은 글씨 → ② 이모지만 → ③ 그래도 넘치면 +N 순서로 최대한 보이게
  function fitChips() {
    document.querySelectorAll('.cell').forEach(c => {
      const box = c.querySelector('.chips'); if (!box) return;
      const old = box.querySelector('.more'); if (old) old.remove();
      c.classList.remove('dense', 'tiny', 'icons');
      const chips = Array.from(box.querySelectorAll('.chip'));
      chips.forEach(ch => ch.hidden = false);
      if (!chips.length) return;
      const fits = () => box.scrollHeight <= box.clientHeight + 1;
      if (fits()) return;
      c.classList.add('dense'); if (fits()) return;
      c.classList.remove('dense'); c.classList.add('tiny'); if (fits()) return;
      const m = el('div', 'more');
      m.addEventListener('click', (e) => { e.stopPropagation(); select(c.dataset.d, false); setPanel('day', true); });
      box.appendChild(m);
      for (let k = chips.length - 1; k >= 0; k--) {
        chips[k].hidden = true; m.textContent = '+' + (chips.length - k);
        if (fits()) break;
      }
    });
  }

  // ---------- 마우스 올린 칸 크게 보기 ----------
  const PK = { timer: null, over: false, el: null };
  function hidePeek() { if (PK.el) { PK.el.remove(); PK.el = null; } }
  function showPeek(c) {
    hidePeek();
    const d = c.dataset.d, all = (S.dayMap || {})[d] || [];
    const evs = all.filter(e => !e.holiday); if (!evs.length) return;
    const month = $('month');
    const p = el('div', 'peek');
    const head = el('div', 'peek-h', md(d) + ' (' + wd(d) + ')');
    const hol = all.find(e => e.holiday); if (hol) head.appendChild(el('span', 'peek-hol', hol.title));
    if (d === todayStr()) head.appendChild(el('span', 'peek-hol today', '오늘'));
    p.appendChild(head);
    evs.forEach(ev => {
      const r = el('div', 'prow'); r.style.setProperty('--cc', ev.color);
      r.appendChild(el('span', 'pt', ev.allDay ? (ev.ed > ev.sd ? '~' + md(ev.ed) : '종일') : (ev.sd === d ? ev.st : '~' + ev.et)));
      r.appendChild(el('span', 'pn', ev.title));
      r.title = ev.loc || '';
      r.addEventListener('click', (e) => { e.stopPropagation(); hidePeek(); select(d, false); openEditor(ev); });
      p.appendChild(r);
    });
    const foot = el('div', 'peek-foot');
    const add = el('button', 'peek-add', '＋ 일정 추가'); add.type = 'button';
    add.addEventListener('click', (e) => { e.stopPropagation(); hidePeek(); openEditor(null, d); });
    const tb = el('button', 'peek-add', '칸 색'); tb.type = 'button';
    tb.addEventListener('click', (e) => { e.stopPropagation(); hidePeek(); openTint(c); });
    foot.append(add, tb); p.appendChild(foot);
    p.addEventListener('mouseenter', () => { PK.over = true; });
    p.addEventListener('mouseleave', () => { PK.over = false; hidePeek(); });
    const cw = c.offsetWidth, w = Math.max(cw * 1.6, 230);
    p.style.width = w + 'px'; p.style.maxHeight = (month.clientHeight - 8) + 'px';
    month.appendChild(p); PK.el = p;
    let left = c.offsetLeft + cw / 2 - w / 2; left = Math.max(4, Math.min(left, month.clientWidth - w - 4));
    let top = c.offsetTop - 6; const h = p.offsetHeight;
    if (top + h > month.clientHeight - 4) top = Math.max(4, month.clientHeight - h - 4);
    p.style.left = left + 'px'; p.style.top = top + 'px';
    p.style.transformOrigin = (c.offsetLeft + cw / 2 - left) + 'px ' + (c.offsetTop + c.offsetHeight / 2 - top) + 'px';
  }

  // ---------- 날짜 칸 배경색 (오른쪽 클릭) ----------
  const TINTS = ['#ffd6e0', '#ffe3c2', '#fff1a8', '#d7f5c8', '#c9ecf7', '#d5dcff', '#e8d5ff', '#e2e5ea', '#ff9aa8', '#7fd1ae'];
  let tintEl = null;
  function closeTint() { if (tintEl) { tintEl.remove(); tintEl = null; } }
  function openTint(c) {
    hidePeek(); closeTint();
    const d = c.dataset.d, month = $('month'), cur = (S.cfg.dayColors || {})[d] || '';
    const m = el('div', 'tintmenu');
    m.appendChild(el('div', 'tint-h', md(d) + ' 칸 색'));
    const row = el('div', 'swatches');
    const none = el('button', 'def', '없음'); none.type = 'button'; none.setAttribute('aria-pressed', String(!cur)); row.appendChild(none);
    none.onclick = () => setTint(d, '');
    TINTS.forEach(col => { const b = el('button'); b.type = 'button'; b.style.setProperty('--sw', col); b.setAttribute('aria-pressed', String(cur === col)); b.onclick = () => setTint(d, col); row.appendChild(b); });
    const pick = el('input', 'colorpick'); pick.type = 'color'; pick.value = cur || '#ffd6e0'; pick.title = '직접 고르기';
    pick.addEventListener('change', () => setTint(d, pick.value)); row.appendChild(pick);
    m.appendChild(row);
    m.addEventListener('mousedown', (e) => e.stopPropagation());
    month.appendChild(m); tintEl = m;
    let left = c.offsetLeft; left = Math.max(4, Math.min(left, month.clientWidth - m.offsetWidth - 4));
    let top = c.offsetTop + 24; if (top + m.offsetHeight > month.clientHeight - 4) top = Math.max(4, c.offsetTop - m.offsetHeight + 6);
    m.style.left = left + 'px'; m.style.top = top + 'px';
  }
  async function setTint(d, col) {
    const dc = Object.assign({}, S.cfg.dayColors || {}); if (col) dc[d] = col; else delete dc[d];
    await setCfg({ dayColors: dc }); closeTint(); render();
  }
  document.addEventListener('mousedown', () => closeTint());

  function select(d, keepMonth) {
    S.sel = d;
    if (!keepMonth && d.slice(0, 7) !== S.ym) { S.ym = d.slice(0, 7); load(); }
    document.querySelectorAll('.cell.sel').forEach(c => c.classList.remove('sel'));
    const c = document.querySelector('.cell[data-d="' + d + '"]'); if (c) c.classList.add('sel');
    renderPanel();
  }

  function setPanel(mode, open) {
    S.cfg.panelMode = mode; if (open) S.cfg.panelOpen = true;
    api.setCfg({ panelMode: mode, panelOpen: S.cfg.panelOpen });
    applyPanel(); renderPanel();
    if (mode === 'search') setTimeout(() => $('searchInput').focus(), 0);
  }
  function applyPanel() {
    $('panel').hidden = !S.cfg.panelOpen;
    $('panelBtn').classList.toggle('on', !!S.cfg.panelOpen);
    $('panelHandle').textContent = S.cfg.panelOpen ? '›' : '‹';
    $('panelHandle').title = S.cfg.panelOpen ? '오른쪽 목록 닫기' : '오른쪽 목록 열기';
    ['day', 'week', 'search'].forEach(m => $('tab' + m[0].toUpperCase() + m.slice(1)).setAttribute('aria-selected', String(S.cfg.panelMode === m)));
    $('searchbox').hidden = S.cfg.panelMode !== 'search';
    requestAnimationFrame(fitChips);
  }

  function pitem(ev, day) {
    const it = el('div', 'pitem'); it.style.setProperty('--cc', ev.color);
    let t = '종일';
    if (!ev.allDay) t = (ev.sd === day || !day) ? ev.st : '~' + ev.et;
    else if (ev.ed > ev.sd) t = '~' + md(ev.ed);
    it.appendChild(el('div', 't', t));
    it.appendChild(el('div', 'n', ev.title));
    const meta = [];
    if (!ev.allDay && ev.ed === ev.sd) meta.push(ev.st + '–' + ev.et);
    if (ev.loc) meta.push(ev.loc);
    if (meta.length) it.appendChild(el('div', 'm', meta.join(' · ')));
    it.addEventListener('click', () => openEditor(ev));
    return it;
  }
  function dayHeader(d) {
    const today = todayStr();
    const h = el('div', 'pday' + (d === today ? ' today' : ''), md(d) + ' (' + wd(d) + ')');
    if (d === today) h.appendChild(el('span', 'sub', '오늘'));
    else if (d === addDays(today, 1)) h.appendChild(el('span', 'sub', '내일'));
    return h;
  }
  async function setMini(on) {
    await api.win('mini', on); S.cfg.mini = on; applyMini();
    if (on) { const t = todayStr(); S.sel = t; if (t.slice(0, 7) !== S.ym) { S.ym = t.slice(0, 7); load(); } }
    render();
  }
  function applyMini() {
    const on = !!S.cfg.mini;
    $('app').classList.toggle('mini', on);
    $('miniBtn').title = on ? '달력 크게 보기' : '오늘 일정만 작게 보기';
    $('miniBtn').innerHTML = on
      ? '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M9 9.5v10M14.5 9.5v10"/></svg>'
      : '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/></svg>';
    const t = todayStr(); $('miniTitle').textContent = '오늘 ' + md(t) + ' (' + wd(t) + ')';
  }
  function renderPanel() {
    const box = $('plist'); box.textContent = '';
    const mode = S.cfg.mini ? 'today' : (S.cfg.panelMode || 'day');
    const map = S.dayMap || {};
    if (mode === 'today') {
      const t = todayStr(), tm = addDays(t, 1);
      const evs = map[t] || [];
      if (!evs.length) box.appendChild(el('div', 'pempty', '오늘은 등록된 일정이 없어요.'));
      evs.forEach(ev => box.appendChild(pitem(ev, t)));
      const h = dayHeader(tm); box.appendChild(h);
      const ev2 = map[tm] || [];
      if (!ev2.length) box.appendChild(el('div', 'pempty', '없음'));
      ev2.forEach(ev => box.appendChild(pitem(ev, tm)));
      const add = el('button', 'padd', '＋ 오늘 일정 추가'); add.type = 'button';
      add.addEventListener('click', () => openEditor(null, t)); box.appendChild(add);
      return;
    }
    if (mode === 'day') {
      box.appendChild(dayHeader(S.sel));
      const evs = map[S.sel] || [];
      if (!evs.length) box.appendChild(el('div', 'pempty', '등록된 일정이 없어요.'));
      evs.forEach(ev => box.appendChild(pitem(ev, S.sel)));
      const add = el('button', 'padd', '＋ 이 날 일정 추가'); add.type = 'button';
      add.addEventListener('click', () => openEditor(null, S.sel)); box.appendChild(add);
    } else if (mode === 'week') {
      const ws = +V().weekStart || 0; const sd = parse(S.sel);
      const off = (sd.getDay() - ws + 7) % 7; const w0 = addDays(S.sel, -off);
      for (let i = 0; i < 7; i++) {
        const d = addDays(w0, i); box.appendChild(dayHeader(d));
        const evs = map[d] || [];
        if (!evs.length) box.appendChild(el('div', 'pempty', '없음'));
        evs.forEach(ev => box.appendChild(pitem(ev, d)));
      }
    } else {
      const r = S.searchResults;
      if (r == null) { box.appendChild(el('div', 'pempty', '검색어를 입력하고 Enter를 누르세요.')); return; }
      if (r === 'loading') { box.appendChild(el('div', 'pempty', '찾는 중…')); return; }
      if (!r.length) { box.appendChild(el('div', 'pempty', '찾은 일정이 없어요.')); return; }
      let last = '';
      r.forEach(ev => {
        if (ev.sd !== last) { box.appendChild(dayHeader(ev.sd)); last = ev.sd; }
        const it = pitem(ev, ev.sd);
        it.addEventListener('click', () => { select(ev.sd, false); });
        box.appendChild(it);
      });
    }
  }

  function renderFoot() {
    let t = S.loading ? '동기화 중…' : (S.lastSync ? '동기화 ' + hm(S.lastSync) : '');
    $('syncText').textContent = t;
  }
  function banner(msg) { const b = $('banner'); if (msg) { b.hidden = false; b.textContent = msg; } else b.hidden = true; }

  // ---------- 불러오기 ----------
  async function load(opts) {
    opts = opts || {};
    if (!S.cfg.loggedIn) { $('onboard').hidden = false; render(); return; }
    $('onboard').hidden = true;
    if (!S.cals.length || opts.cals) {
      const r = await api.calendars();
      if (!r.ok) return fail(r);
      S.cals = r.data; S.calMap = {}; S.cals.forEach(c => S.calMap[c.id] = c);
    }
    const ym = S.ym, start = gridStart(ym), end = addDays(start, 42);
    S.loading = true; renderFoot();
    const r = await api.events(visibleCalIds(), parse(start).toISOString(), parse(end).toISOString());
    S.loading = false;
    if (ym !== S.ym) return;
    if (!r.ok) return fail(r);
    S.events = r.data.items; S.lastSync = new Date(); hidePeek();
    banner(r.data.errors.length ? '일부 캘린더를 불러오지 못했어요: ' + r.data.errors.map(e => (S.calMap[e.id] || {}).name || e.id).join(', ') : '');
    render();
  }
  function fail(r) {
    S.loading = false; renderFoot();
    if (r.code === 'NOT_LOGGED_IN') { S.cfg.loggedIn = false; S.events = []; $('onboard').hidden = false; render(); banner(r.message !== 'NOT_LOGGED_IN' ? r.message : ''); return; }
    if (/fetch failed|ENOTFOUND|network/i.test(r.message)) banner('인터넷 연결을 확인해 주세요. 연결되면 자동으로 다시 불러와요.');
    else banner('불러오기 실패: ' + r.message);
  }
  function startTimer() { clearInterval(S.timer); S.timer = setInterval(() => { if (!document.hidden) load(); }, 60 * 1000); }

  // ---------- 일정 옮기기 (끌어놓기) ----------
  async function moveEvent(ev, delta) {
    if (!delta || !ev.writable) return;
    const e = ev.raw; let body;
    if (ev.allDay) body = { start: { date: addDays(e.start.date, delta) }, end: { date: addDays(e.end.date, delta) } };
    else {
      const s = new Date(e.start.dateTime), en = new Date(e.end.dateTime);
      s.setDate(s.getDate() + delta); en.setDate(en.getDate() + delta);
      body = { start: { dateTime: localIso(ymd(s), hm(s)), timeZone: TZ }, end: { dateTime: localIso(ymd(en), hm(en)), timeZone: TZ } };
    }
    const r = await api.patch(ev.calId, ev.id, body);
    if (!r.ok) banner('옮기지 못했어요: ' + r.message); else banner('');
    load();
  }

  // ---------- 편집창 ----------
  const ED = { ev: null, color: '', delArmed: false };
  // 이모지 뒤의 변형 선택자(FE0F)가 있든 없든 같은 분류로 본다
  function stripPrefix(t, p) {
    const P = p.trim(); let i = 0, j = 0;
    while (j < P.length) {
      if (i >= t.length) return null;
      if (t[i] === '\uFE0F' && P[j] !== '\uFE0F') { i++; continue; }
      if (P[j] === '\uFE0F' && t[i] !== '\uFE0F') { j++; continue; }
      if (t[i] !== P[j]) return null; i++; j++;
    }
    while (t[i] === '\uFE0F') i++;
    return t.slice(i);
  }
  function ruleOf(title) { return RULES.find(r => stripPrefix(title, r.prefix) !== null); }
  function buildCats() {
    const box = $('edCats'); box.textContent = '';
    RULES.forEach(r => {
      const b = el('button', null, r.label); b.type = 'button';
      b.addEventListener('click', () => applyRule(r)); box.appendChild(b);
    });
  }
  function markCat() {
    const r = ruleOf($('edSummary').value);
    Array.from($('edCats').children).forEach((b, i) => b.setAttribute('aria-pressed', String(RULES[i] === r)));
  }
  function applyRule(r) {
    let t = $('edSummary').value;
    const old = ruleOf(t); if (old) t = stripPrefix(t, old.prefix).replace(/^\s+/, '');
    $('edSummary').value = r.prefix + t;
    if (r.color !== undefined) setColor(r.color);
    if (r.allDay !== undefined) { $('edAllDay').checked = r.allDay; syncAllDay(); }
    if (r.time) { $('edST').value = r.time[0]; if (r.time[1] === '24:00') { $('edET').value = '00:00'; $('edED').value = addDays($('edSD').value, 1); } else $('edET').value = r.time[1]; }
    if (r.remind) $('edRemind').value = r.remind;
    markCat(); $('edSummary').focus();
  }
  function buildColors() {
    const box = $('edColors'); box.textContent = '';
    const d = el('button', 'def', '캘린더 색'); d.type = 'button'; d.dataset.c = ''; box.appendChild(d);
    Object.keys(GCOLORS).forEach(k => {
      const b = el('button'); b.type = 'button'; b.dataset.c = k; b.title = GCOLOR_NAMES[k]; b.setAttribute('aria-label', GCOLOR_NAMES[k]);
      b.style.setProperty('--sw', GCOLORS[k]); box.appendChild(b);
    });
    box.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setColor(b.dataset.c); });
  }
  function setColor(c) { ED.color = c || ''; Array.from($('edColors').children).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.c === ED.color))); }
  function syncAllDay() { document.querySelector('.row.when').classList.toggle('allday', $('edAllDay').checked); }

  function openEditor(ev, date) {
    ED.ev = ev || null; ED.delArmed = false;
    $('edErr').hidden = true;
    $('edTitle').textContent = ev ? '일정 수정' : '일정 추가';
    const cs = $('edCal'); cs.textContent = '';
    S.cals.filter(c => c.writable || (ev && c.id === ev.calId)).forEach(c => {
      const o = el('option', null, c.name + (c.primary ? ' (기본)' : '')); o.value = c.id; cs.appendChild(o);
    });
    cs.disabled = !!ev;
    $('edDelete').hidden = !ev; $('edDelete').textContent = '삭제';
    $('edOpen').hidden = !(ev && ev.link);
    if (ev) {
      const e = ev.raw;
      cs.value = ev.calId;
      $('edSummary').value = ev.title === '(제목 없음)' ? '' : ev.title;
      $('edAllDay').checked = ev.allDay;
      $('edSD').value = ev.sd; $('edED').value = ev.ed;
      if (ev.allDay) { $('edST').value = '09:00'; $('edET').value = '10:00'; }
      else { const s = new Date(e.start.dateTime), en = new Date(e.end.dateTime); $('edST').value = hm(s); $('edET').value = hm(en); $('edED').value = ymd(en); }
      $('edLoc').value = ev.loc; $('edDesc').value = ev.desc;
      setColor(ev.colorId);
      const rm = e.reminders || {};
      if (rm.useDefault) $('edRemind').value = 'default';
      else if (rm.overrides && rm.overrides.length) { const m = String(rm.overrides[0].minutes); $('edRemind').value = ['10', '30', '60', '1440'].includes(m) ? m : 'default'; }
      else $('edRemind').value = 'none';
      $('edRepeat').value = '';
      $('edRepeatWrap').hidden = ev.recurring; $('edRecurNote').hidden = !ev.recurring;
      ['edSummary', 'edAllDay', 'edSD', 'edST', 'edED', 'edET', 'edLoc', 'edDesc', 'edRemind', 'edSave', 'edDelete'].forEach(id => $(id).disabled = !ev.writable);
    } else {
      const primary = S.cals.find(c => c.primary && c.writable) || S.cals.find(c => c.writable);
      if (primary) cs.value = primary.id;
      const d = date || S.sel || todayStr();
      $('edSummary').value = ''; $('edAllDay').checked = true;
      $('edSD').value = d; $('edED').value = d; $('edST').value = '09:00'; $('edET').value = '10:00';
      $('edLoc').value = ''; $('edDesc').value = ''; setColor(''); $('edRemind').value = 'none'; $('edRepeat').value = '';
      $('edRepeatWrap').hidden = false; $('edRecurNote').hidden = true;
      ['edSummary', 'edAllDay', 'edSD', 'edST', 'edED', 'edET', 'edLoc', 'edDesc', 'edRemind', 'edSave'].forEach(id => $(id).disabled = false);
    }
    syncAllDay(); markCat();
    $('editor').showModal();
    setTimeout(() => $('edSummary').focus(), 0);
  }

  async function saveEditor() {
    const err = (m) => { $('edErr').textContent = m; $('edErr').hidden = false; };
    const title = $('edSummary').value.trim();
    if (!title) return err('제목을 입력해 주세요.');
    const allDay = $('edAllDay').checked;
    let sd = $('edSD').value, ed = $('edED').value || sd;
    if (!sd) return err('시작 날짜를 골라 주세요.');
    const body = { summary: title, location: $('edLoc').value, description: $('edDesc').value };
    if (allDay) {
      if (ed < sd) ed = sd;
      body.start = { date: sd, dateTime: null, timeZone: null }; body.end = { date: addDays(ed, 1), dateTime: null, timeZone: null };
    } else {
      const st = $('edST').value || '09:00'; let et = $('edET').value || st;
      if (ed + 'T' + et <= sd + 'T' + st) { const d = new Date(localIso(sd, st)); d.setHours(d.getHours() + 1); ed = ymd(d); et = hm(d); }
      body.start = { dateTime: localIso(sd, st), timeZone: TZ, date: null }; body.end = { dateTime: localIso(ed, et), timeZone: TZ, date: null };
    }
    const rm = $('edRemind').value;
    if (rm === 'default') body.reminders = { useDefault: true };
    else if (rm === 'none') body.reminders = { useDefault: false, overrides: [] };
    else body.reminders = { useDefault: false, overrides: [{ method: 'popup', minutes: +rm }] };
    const rep = $('edRepeat').value;
    $('edSave').disabled = true;
    let r;
    if (ED.ev) {
      body.colorId = ED.color || null;
      if (rep && !ED.ev.recurring) body.recurrence = ['RRULE:FREQ=' + rep];
      r = await api.patch(ED.ev.calId, ED.ev.id, body);
    } else {
      ['start', 'end'].forEach(k => Object.keys(body[k]).forEach(x => body[k][x] == null && delete body[k][x]));
      if (ED.color) body.colorId = ED.color;
      if (rep) body.recurrence = ['RRULE:FREQ=' + rep];
      r = await api.create($('edCal').value, body);
    }
    $('edSave').disabled = false;
    if (!r.ok) return err('저장하지 못했어요: ' + r.message);
    $('editor').close();
    S.sel = sd; if (sd.slice(0, 7) !== S.ym) S.ym = sd.slice(0, 7);
    load();
  }

  async function deleteEditor() {
    if (!ED.ev) return;
    if (!ED.delArmed) { ED.delArmed = true; $('edDelete').textContent = '한 번 더 누르면 삭제'; return; }
    const r = await api.remove(ED.ev.calId, ED.ev.id);
    if (!r.ok) { $('edErr').textContent = '삭제하지 못했어요: ' + r.message; $('edErr').hidden = false; return; }
    $('editor').close(); load();
  }

  // ---------- 검색 ----------
  async function doSearch() {
    const q = $('searchInput').value.trim(); if (!q) return;
    S.searchResults = 'loading'; renderPanel();
    const now = new Date(); const a = new Date(now); a.setFullYear(a.getFullYear() - 1); const b = new Date(now); b.setFullYear(b.getFullYear() + 1);
    const r = await api.search(visibleCalIds(), q, a.toISOString(), b.toISOString());
    S.searchResults = r.ok ? r.data.map(norm).sort((x, y) => x.sd < y.sd ? -1 : x.sd > y.sd ? 1 : sortEv(x, y)) : [];
    if (!r.ok) banner('검색 실패: ' + r.message);
    renderPanel();
  }

  // ---------- 설정창 ----------
  // ---------- 테마(컨셉 색 조합) ----------
  // 그림 없이 배경 그라데이션 + 칸·글자·포인트 색을 한 벌로 맞춘다. stars/galaxy만 코드로 별빛을 뿌린다.
  const SCENES = {
    // 밝은 테마
    sky: { name: '맑은 하늘', bg: 'linear-gradient(180deg,#d6ecff 0%,#eaf4ff 55%,#f7fbff 100%)',
      pal: { bg: '#e6f2ff', surface: '#ffffff', surface2: '#edf5ff', fg: '#1d2b45', muted: '#66789a', line: '#d6e4f5', accent: '#2563eb' } },
    paper: { name: '아이보리 노트', bg: 'linear-gradient(160deg,#fbf7ee 0%,#f3ecdc 100%)',
      pal: { bg: '#f5efe2', surface: '#fffdf7', surface2: '#f2ead9', fg: '#2b2a33', muted: '#7a7468', line: '#e5dbc7', accent: '#2f4a8a' } },
    monet: { name: '모네 수련', bg: 'radial-gradient(45% 40% at 80% 20%,rgba(232,199,216,.55),transparent 70%),radial-gradient(50% 45% at 15% 85%,rgba(180,220,200,.6),transparent 70%),linear-gradient(160deg,#dde8f4 0%,#e6e0f3 50%,#e0efe8 100%)',
      pal: { bg: '#e4e8f3', surface: '#fbfcff', surface2: '#eef0f8', fg: '#26304a', muted: '#6f7894', line: '#dde2ef', accent: '#6b7fd7' } },
    sakura: { name: '벚꽃', bg: 'radial-gradient(50% 40% at 85% 15%,rgba(255,190,210,.55),transparent 70%),linear-gradient(160deg,#fff1f5 0%,#ffe4ec 50%,#fff6f0 100%)',
      pal: { bg: '#ffeaf0', surface: '#fffafb', surface2: '#fcedf2', fg: '#3a2530', muted: '#8f6f7d', line: '#f3d8e2', accent: '#e05a8a' } },
    lemon: { name: '레몬 소다', bg: 'radial-gradient(45% 40% at 20% 15%,rgba(255,236,140,.6),transparent 70%),linear-gradient(160deg,#fffbe2 0%,#eafbf2 60%,#dff6f6 100%)',
      pal: { bg: '#f0f9ee', surface: '#fffffa', surface2: '#f1f8ec', fg: '#22332e', muted: '#6a7e77', line: '#e1ecda', accent: '#0f9f96' } },
    lavender: { name: '라벤더 밭', bg: 'radial-gradient(50% 40% at 80% 85%,rgba(200,220,190,.55),transparent 70%),linear-gradient(160deg,#f1ecfb 0%,#e8e2f7 55%,#eef2ea 100%)',
      pal: { bg: '#ece7f8', surface: '#fdfbff', surface2: '#f1ecfa', fg: '#2e2640', muted: '#7a7092', line: '#e1daf1', accent: '#7c5cd6' } },
    apricot: { name: '살구 크림', bg: 'radial-gradient(45% 40% at 85% 20%,rgba(255,196,160,.5),transparent 70%),linear-gradient(160deg,#fff3ea 0%,#ffe8da 55%,#fff8ef 100%)',
      pal: { bg: '#ffeee3', surface: '#fffcf9', surface2: '#fbefe5', fg: '#3a2a22', muted: '#8e7466', line: '#f0dccd', accent: '#ee6a45' } },
    // 어두운 테마
    starry: { name: '별이 빛나는 밤', dark: true, fx: 'stars', bg: 'radial-gradient(35% 30% at 78% 14%,rgba(246,209,74,.22),transparent 70%),radial-gradient(55% 45% at 25% 35%,rgba(70,130,210,.35),transparent 70%),linear-gradient(170deg,#0c1f55 0%,#14306f 55%,#0b1a45 100%)',
      pal: { bg: '#0e2154', surface: '#162b62', surface2: '#1e3674', fg: '#eef2ff', muted: '#a9b7dd', line: '#2b437c', accent: '#f6d14a' } },
    galaxy: { name: '은하수', dark: true, fx: 'galaxy', bg: 'linear-gradient(170deg,#05061a 0%,#0c0f32 55%,#1a1238 100%)',
      pal: { bg: '#0a0b22', surface: '#12152f', surface2: '#1a1e3e', fg: '#f1eeff', muted: '#a9a6ca', line: '#272b4e', accent: '#e9a6ff' } },
    aurora: { name: '오로라', dark: true, fx: 'stars', bg: 'radial-gradient(60% 40% at 30% 8%,rgba(47,243,160,.24),transparent 70%),radial-gradient(50% 40% at 82% 18%,rgba(176,108,255,.22),transparent 70%),linear-gradient(170deg,#04161c 0%,#082730 60%,#06141b 100%)',
      pal: { bg: '#071c22', surface: '#0d252c', surface2: '#133038', fg: '#e6fbf4', muted: '#95bdb4', line: '#1e3e45', accent: '#45f0b0' } },
    deepsea: { name: '깊은 바다', dark: true, bg: 'radial-gradient(45% 35% at 72% 88%,rgba(255,127,102,.16),transparent 70%),radial-gradient(55% 45% at 20% 20%,rgba(40,140,190,.28),transparent 70%),linear-gradient(170deg,#031b2a 0%,#06304a 55%,#021623 100%)',
      pal: { bg: '#04243a', surface: '#0a2a3d', surface2: '#0f354c', fg: '#e6f6ff', muted: '#93b4c6', line: '#18425a', accent: '#ff8a6b' } },
    wine: { name: '와인 & 골드', dark: true, bg: 'radial-gradient(40% 35% at 80% 15%,rgba(232,194,106,.18),transparent 70%),linear-gradient(170deg,#2a0f1a 0%,#3a1424 55%,#220b15 100%)',
      pal: { bg: '#2c101c', surface: '#3a1726', surface2: '#461d2f', fg: '#fbeef2', muted: '#c9a3b0', line: '#55253a', accent: '#e8c26a' } },
    mocha: { name: '모카 라떼', dark: true, bg: 'radial-gradient(45% 40% at 80% 85%,rgba(242,162,124,.14),transparent 70%),linear-gradient(170deg,#1f1612 0%,#2b1f19 60%,#1a120e 100%)',
      pal: { bg: '#211813', surface: '#2c211b', surface2: '#382a22', fg: '#f4ebe3', muted: '#c0aa9a', line: '#44342b', accent: '#f2a27c' } },
    charcoal: { name: '차콜 민트', dark: true, bg: 'linear-gradient(170deg,#141517 0%,#1c1d20 100%)',
      pal: { bg: '#17181a', surface: '#222327', surface2: '#2b2c31', fg: '#ececee', muted: '#a2a3a8', line: '#34353a', accent: '#5fd4b0' } }
  };
  const DEFAULT_SCENE = 'sky';
  const sceneOf = (c) => SCENES[c.scene] || (c.scene === 'desktop' ? null : SCENES[DEFAULT_SCENE]);
  const glassOn = (c) => (c.style || 'glass') === 'glass';
  function sceneIsDark(c) { const sc = sceneOf(c); return glassOn(c) && !!(sc && sc.dark); }
  function themeApply() {
    const c = V(), sc = sceneOf(c);
    let t = c.theme;
    if (glassOn(c) && sc) t = sc.dark ? 'dark' : 'light';
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
    lookApply();
  }
  // ---------- 글꼴·색 ----------
  const FONT_PRESETS = ['맑은 고딕', 'Pretendard', '나눔고딕', '나눔바른고딕', '나눔스퀘어', '나눔스퀘어라운드', 'Noto Sans KR', '에스코어 드림', 'G마켓 산스', '카페24 써라운드', '함초롬돋움', '굴림', '돋움', '바탕', '궁서'];
  const ACCENTS = ['#2f5bd3', '#039be5', '#0b8043', '#33b679', '#8e24aa', '#d81b60', '#e67c73', '#f4511e', '#f6bf26', '#616161'];
  const BGS = ['#ffffff', '#fbf7ef', '#f3f7f2', '#f2f5fb', '#fbf2f5', '#f6f2fb', '#1c2029', '#20262a', '#2a2027'];
  const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const lum = (h) => { const [r, g, b] = rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v || '');
  function lookApply() {
    const root = document.documentElement, s = root.style, c = V();
    if (c.fontFamily) s.setProperty('--font', '"' + c.fontFamily.replace(/"/g, '') + '","Malgun Gothic","Segoe UI",sans-serif'); else s.removeProperty('--font');
    document.body.style.zoom = String((c.fontSize || 13) / 13);
    root.dataset.style = c.style || 'glass';
    ['--glass', '--glass2', '--gline', '--accent', '--accent-soft', '--sat', '--surface', '--bg', '--surface2', '--fg', '--muted', '--line'].forEach(k => s.removeProperty(k));
    document.body.style.background = '';
    const see = c.acrylic && glassOn(c) && c.scene === 'desktop';
    if (see) root.dataset.acrylic = '1'; else delete root.dataset.acrylic;
    const sc = glassOn(c) ? sceneOf(c) : null;
    // 1) 테마 팔레트
    if (sc) {
      const P = sc.pal, set = (k, v) => s.setProperty(k, v);
      set('--bg', P.bg); set('--surface', P.surface); set('--surface2', P.surface2); set('--fg', P.fg); set('--muted', P.muted); set('--line', P.line);
      set('--accent', P.accent); set('--sat', P.accent); set('--accent-soft', 'color-mix(in srgb,' + P.accent + ' 18%, ' + P.surface + ')');
      set('--glass', P.surface + (sc.dark ? 'cc' : 'b8')); set('--glass2', P.surface2 + (sc.dark ? 'ee' : 'e8'));
      set('--gline', sc.dark ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.75)');
      document.body.style.background = sc.bg;
    }
    // 2) 직접 고른 포인트 색·카드 색이 있으면 우선
    if (isHex(c.accent)) { s.setProperty('--accent', c.accent); s.setProperty('--sat', c.accent); s.setProperty('--accent-soft', 'color-mix(in srgb,' + c.accent + ' 16%, var(--surface))'); }
    if (isHex(c.bgColor)) {
      const dark = lum(c.bgColor) < 0.25;
      s.setProperty('--surface', c.bgColor);
      s.setProperty('--surface2', mix(c.bgColor, dark ? '#ffffff' : '#5a6070', 0.08));
      s.setProperty('--line', mix(c.bgColor, dark ? '#ffffff' : '#5a6070', dark ? 0.14 : 0.18));
      s.setProperty('--fg', dark ? '#e9ecf2' : '#1d2330'); s.setProperty('--muted', dark ? '#a2aabb' : '#666e80');
      if (!sc) s.setProperty('--bg', mix(c.bgColor, dark ? '#000000' : '#5a6070', dark ? 0.25 : 0.06));
      s.setProperty('--glass', c.bgColor + 'b8'); s.setProperty('--glass2', c.bgColor + 'e8');
      root.style.colorScheme = dark ? 'dark' : 'light';
    } else root.style.colorScheme = '';
    // 3) 별빛 효과(은하수·별밤·오로라)
    if (sc && sc.fx) { root.dataset.art = '1'; paintArt(sc.fx); } else delete root.dataset.art;
    requestAnimationFrame(fitChips);
  }
  // ---------- 별빛 효과 그리기 ----------
  let artKey = '';
  function paintArt(name) {
    const cv = $('art'); if (!cv || !window.YeramArt) return;
    const z = parseFloat(document.body.style.zoom || '1') || 1;
    const w = cv.clientWidth || window.innerWidth, h = cv.clientHeight || window.innerHeight;
    const key = name + ':' + w + 'x' + h + ':' + z;
    if (key === artKey) return; artKey = key;
    window.YeramArt.draw(name, cv, w, h, (window.devicePixelRatio || 1) * z);
  }
  let artTimer = null;
  window.addEventListener('resize', () => { clearTimeout(artTimer); artTimer = setTimeout(() => { const sc = sceneOf(V()); if (document.documentElement.dataset.art && sc && sc.fx) { artKey = ''; paintArt(sc.fx); } }, 180); });
  let fontList = null;
  async function loadFonts() {
    if (fontList) return fontList;
    let names = [];
    try { if (window.queryLocalFonts) { const fs = await Promise.race([window.queryLocalFonts(), new Promise(r => setTimeout(() => r([]), 2500))]); names = Array.from(new Set(fs.map(f => f.family))); } } catch {}
    const korean = /[가-힣]|Nanum|Noto Sans KR|Noto Serif KR|Pretendard|Gmarket|Spoqa|S-Core|Cafe24|BM |Jalnan|Gowun|IBM Plex Sans KR|HY|Malgun/i;
    const ko = names.filter(n => korean.test(n)).sort((a, b) => a.localeCompare(b, 'ko'));
    const rest = names.filter(n => !korean.test(n)).sort((a, b) => a.localeCompare(b));
    fontList = names.length ? { ko, rest } : { ko: FONT_PRESETS, rest: [] };
    return fontList;
  }
  async function renderLook() {
    const c = V(), fsel = $('stFont');
    const fl = await loadFonts();
    fsel.textContent = '';
    const add = (parent, v, label) => { const o = el('option', null, label || v); o.value = v; if (v) o.style.fontFamily = '"' + v + '"'; parent.appendChild(o); };
    add(fsel, '', '기본 (맑은 고딕)');
    const g1 = el('optgroup'); g1.label = '한글 글꼴'; fl.ko.forEach(n => add(g1, n)); fsel.appendChild(g1);
    if (fl.rest.length) { const g2 = el('optgroup'); g2.label = '기타 글꼴'; fl.rest.forEach(n => add(g2, n)); fsel.appendChild(g2); }
    if (c.fontFamily && !fl.ko.includes(c.fontFamily) && !fl.rest.includes(c.fontFamily)) add(fsel, c.fontFamily);
    fsel.value = c.fontFamily || '';
    $('stStyle').value = c.style || 'glass';
    $('stFontSize').value = c.fontSize || 13; $('stFsVal').textContent = $('stFontSize').value;
    swatchRow($('stAccent'), ACCENTS, c.accent, '기본', (v) => setDraft({ accent: v }));
    swatchRow($('stBg'), BGS, c.bgColor, '테마 기본', (v) => setDraft({ bgColor: v }));
    const sb = $('stScene'); sb.textContent = '';
    const cur = c.scene === 'desktop' ? 'desktop' : (SCENES[c.scene] ? c.scene : DEFAULT_SCENE);
    const addBtn = (key, label, bgCss, dark, accent) => {
      const b = el('button', 'scene' + (dark ? ' dk' : ''), label); b.type = 'button'; b.setAttribute('aria-pressed', String(cur === key));
      if (bgCss) b.style.background = bgCss;
      if (accent) b.style.setProperty('--dot', accent);
      b.onclick = () => { setDraft({ scene: key }); renderLook(); }; sb.appendChild(b);
    };
    if (c.acrylic) addBtn('desktop', '바탕화면 비침', '', false, '');
    Object.entries(SCENES).filter(([, v]) => !v.dark).forEach(([k, v]) => addBtn(k, v.name, v.bg, false, v.pal.accent));
    sb.appendChild(el('div', 'scene-break'));
    Object.entries(SCENES).filter(([, v]) => v.dark).forEach(([k, v]) => addBtn(k, v.name, v.bg, true, v.pal.accent));
    $('stGlassRow').hidden = (c.style || 'glass') !== 'glass';
  }
  function swatchRow(box, colors, cur, defLabel, onPick) {
    box.textContent = '';
    const d = el('button', 'def', defLabel); d.type = 'button'; d.setAttribute('aria-pressed', String(!cur)); d.onclick = () => { onPick(''); mark(''); }; box.appendChild(d);
    colors.forEach(col => {
      const b = el('button'); b.type = 'button'; b.dataset.c = col; b.style.setProperty('--sw', col); b.title = col;
      b.setAttribute('aria-pressed', String((cur || '').toLowerCase() === col)); b.onclick = () => { onPick(col); mark(col); }; box.appendChild(b);
    });
    const pick = el('input', 'colorpick'); pick.type = 'color'; pick.title = '직접 고르기'; pick.value = /^#[0-9a-f]{6}$/i.test(cur || '') ? cur : colors[0];
    pick.addEventListener('input', () => { onPick(pick.value); mark(pick.value); }); box.appendChild(pick);
    function mark(v) { Array.from(box.querySelectorAll('button')).forEach(x => x.setAttribute('aria-pressed', String((x.dataset.c || '') === (v || '').toLowerCase() || (!v && x.classList.contains('def'))))); }
  }
  function lockApply() { $('lockBtn').classList.toggle('on', !!S.cfg.locked); $('titlebar').classList.toggle('drag', !S.cfg.locked); }
  function renderSettings() {
    const c = V();
    $('stClientId').value = c.clientId || '';
    $('stAdv').open = !c.builtIn && !c.loggedIn;
    $('stVer').textContent = c.version ? 'v' + c.version : '';
    $('stSecret').value = ''; $('stSecret').placeholder = c.hasSecret ? '저장됨 (바꾸려면 새로 입력)' : 'GOCSPX-...';
    $('stStatus').textContent = c.loggedIn ? '✅ 로그인됨' : '로그인 안 됨'; $('stStatus').className = 'status-text' + (c.loggedIn ? ' ok' : '');
    $('stLogin').hidden = !!c.loggedIn; $('stLogout').hidden = !c.loggedIn;
    $('stOpacity').value = Math.round((c.opacity || 1) * 100); $('stOpVal').textContent = $('stOpacity').value + '%';
    $('stTheme').value = c.theme || 'system'; $('stWeek').value = String(c.weekStart || 0);
    $('stPeek').checked = c.hoverZoom !== false;
    $('stTop').checked = !!c.alwaysOnTop; $('stLock').checked = !!c.locked; $('stAuto').checked = !!c.autoStart;
    renderLook();
    const box = $('stCals'); box.textContent = '';
    if (!S.cals.length) { box.appendChild(el('span', 'muted', c.loggedIn ? '불러오는 중…' : '로그인하면 목록이 나와요.')); return; }
    const hidden = new Set(c.hiddenCalendars || []);
    S.cals.forEach(cal => {
      const l = el('label'); const cb = el('input'); cb.type = 'checkbox'; cb.checked = !hidden.has(cal.id);
      cb.addEventListener('change', async () => {
        const h = new Set(V().hiddenCalendars || []); cb.checked ? h.delete(cal.id) : h.add(cal.id);
        setDraft({ hiddenCalendars: Array.from(h) }); load();
      });
      const sq = el('span', 'sq'); sq.style.setProperty('--sw', cal.color || '#999');
      l.append(cb, sq, document.createTextNode(cal.name)); box.appendChild(l);
    });
  }
  // ---------- 설정 미리보기 → 저장/취소 ----------
  // 설정은 따로 뜨는 창(SET_MODE)에서 고르고, 바뀐 값은 달력 창으로 보내 미리보기한다
  const SET_MODE = new URLSearchParams(location.search).has('settings');
  function setDraft(patch) {
    if (!S.draft) S.draft = {};
    Object.assign(S.draft, patch);
    if (SET_MODE) { themeApply(); api.win('draft', patch); return; }
    if ('opacity' in patch) api.win('opacity', patch.opacity);
    if ('scene' in patch || 'style' in patch) { const v = V(); api.win('material', (v.style || 'glass') === 'glass' && v.scene === 'desktop'); }
    themeApply();
    if ('weekStart' in patch) render();
  }
  async function saveSettings(remote) {
    if (SET_MODE) { await saveCreds(); api.win('settingsDone', 'save'); return; }
    const d = S.draft || {}; S.draft = null;
    if (!remote) await saveCreds();
    if (Object.keys(d).length) await setCfg(d);
    $('settings').close();
    if ('weekStart' in d || 'hiddenCalendars' in d) load(); else render();
  }
  function cancelSettings() {
    if (SET_MODE) { api.win('settingsDone', 'cancel'); return; }
    const had = S.draft && Object.keys(S.draft).length; const d = S.draft || {};
    S.draft = null;
    if ('opacity' in d) api.win('opacity', S.cfg.opacity || 1);
    if ('scene' in d || 'style' in d) api.win('material', (S.cfg.style || 'glass') === 'glass' && S.cfg.scene === 'desktop');
    themeApply();
    if ($('settings').open) $('settings').close();
    if (had && ('weekStart' in d || 'hiddenCalendars' in d)) load(); else if (had) render();
  }
  async function setCfg(patch) { const r = await api.setCfg(patch); if (r.ok) { S.cfg = r.data; themeApply(); lockApply(); } return r; }
  async function saveCreds() {
    const patch = { clientId: $('stClientId').value.trim() };
    if ($('stSecret').value.trim()) patch.clientSecret = $('stSecret').value.trim();
    await setCfg(patch);
  }

  // ---------- 이벤트 연결 ----------
  function bind() {
    $('prev').onclick = () => shiftMonth(-1); $('next').onclick = () => shiftMonth(1);
    $('todayBtn').onclick = () => { const t = todayStr(); S.sel = t; if (t.slice(0, 7) !== S.ym) { S.ym = t.slice(0, 7); load(); } else render(); };
    $('addBtn').onclick = () => openEditor(null, S.sel);
    $('searchBtn').onclick = () => setPanel('search', true);
    $('refreshBtn').onclick = () => load({ cals: true });
    $('panelBtn').onclick = () => { S.cfg.panelOpen = !S.cfg.panelOpen; api.setCfg({ panelOpen: S.cfg.panelOpen }); applyPanel(); };
    $('lockBtn').onclick = () => setCfg({ locked: !S.cfg.locked });
    $('settingsBtn').onclick = openSettings; $('onboardBtn').onclick = openSettings;
    $('miniBtn').onclick = () => setMini(!S.cfg.mini);
    $('minBtn').onclick = () => api.win('minimize'); $('closeBtn').onclick = () => api.win('hide');
    $('tabDay').onclick = () => setPanel('day'); $('tabWeek').onclick = () => setPanel('week'); $('tabSearch').onclick = () => setPanel('search');
    $('searchInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

    buildCats(); buildColors();
    $('edSummary').addEventListener('input', markCat);
    $('edAllDay').addEventListener('change', syncAllDay);
    $('edSD').addEventListener('change', () => { if (!$('edED').value || $('edED').value < $('edSD').value) $('edED').value = $('edSD').value; });
    $('edForm').addEventListener('submit', (e) => { e.preventDefault(); saveEditor(); });
    $('edCancel').onclick = () => $('editor').close(); $('edClose').onclick = () => $('editor').close();
    $('edDelete').onclick = deleteEditor;
    $('edOpen').onclick = () => { if (ED.ev && ED.ev.link) api.win('open', ED.ev.link); };

    $('stClose').onclick = cancelSettings;
    $('stCancel').onclick = cancelSettings;
    $('stForm').addEventListener('submit', (e) => { e.preventDefault(); saveSettings(); });
    $('settings').addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); cancelSettings(); } });
    // 설정창 제목을 잡고 끌어서 옮기기
    (function () {
      const dlg = $('settings'), head = dlg.querySelector('.dlg-head'); let sx, sy, ox, oy, dragging = false;
      head.addEventListener('mousedown', (e) => { if (e.target.closest('button')) return; dragging = true; const r = dlg.getBoundingClientRect(); sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top; e.preventDefault(); });
      window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const z = parseFloat(document.body.style.zoom || '1') || 1;
        let nx = ox + (e.clientX - sx), ny = oy + (e.clientY - sy);
        nx = Math.max(-dlg.offsetWidth * z + 80, Math.min(nx, window.innerWidth - 80)); ny = Math.max(0, Math.min(ny, window.innerHeight - 40));
        dlg.style.left = (nx / z) + 'px'; dlg.style.top = (ny / z) + 'px';
      });
      window.addEventListener('mouseup', () => { dragging = false; });
    })();
    $('stClientId').addEventListener('change', saveCreds); $('stSecret').addEventListener('change', saveCreds);
    $('stLogin').onclick = async () => {
      await saveCreds();
      if (!S.cfg.builtIn && (!S.cfg.clientId || !S.cfg.hasSecret)) { $('stStatus').textContent = '고급에서 클라이언트 ID와 보안 비밀번호를 먼저 넣어 주세요.'; $('stAdv').open = true; return; }
      $('stStatus').textContent = '브라우저에서 구글 로그인을 마쳐 주세요…';
      const r = await api.login();
      if (!r.ok) { $('stStatus').textContent = '로그인 실패: ' + r.message; return; }
      S.cfg = r.data; S.cals = [];
      if (SET_MODE) { const c = await api.calendars(); if (c.ok) S.cals = c.data; renderSettings(); return; }
      renderSettings(); await load({ cals: true }); renderSettings();
    };
    $('stLogout').onclick = async () => { const r = await api.logout(); if (r.ok) { S.cfg = r.data; S.cals = []; S.events = []; renderSettings(); if (!SET_MODE) load(); } };
    $('stOpacity').addEventListener('input', () => { $('stOpVal').textContent = $('stOpacity').value + '%'; $('tbOpacity').value = $('stOpacity').value; setDraft({ opacity: +$('stOpacity').value / 100 }); });
    $('stTheme').onchange = () => setDraft({ theme: $('stTheme').value });
    $('stWeek').onchange = () => setDraft({ weekStart: +$('stWeek').value });
    $('stFont').onchange = () => setDraft({ fontFamily: $('stFont').value });
    $('stStyle').onchange = () => { setDraft({ style: $('stStyle').value }); renderLook(); };
    $('tbOpacity').addEventListener('input', () => { const v = +$('tbOpacity').value; $('stOpacity').value = v; $('stOpVal').textContent = v + '%'; setCfg({ opacity: v / 100 }); });
    $('panelHandle').onclick = () => { S.cfg.panelOpen = !S.cfg.panelOpen; api.setCfg({ panelOpen: S.cfg.panelOpen }); applyPanel(); };
    $('stFontSize').addEventListener('input', () => { $('stFsVal').textContent = $('stFontSize').value; setDraft({ fontSize: +$('stFontSize').value }); });
    $('stTop').onchange = () => setDraft({ alwaysOnTop: $('stTop').checked });
    $('stPeek').onchange = () => setDraft({ hoverZoom: $('stPeek').checked });
    $('stLock').onchange = () => setDraft({ locked: $('stLock').checked });
    $('stAuto').onchange = () => setDraft({ autoStart: $('stAuto').checked });
    $('stQuit').onclick = () => api.win('quit');

    document.addEventListener('keydown', (e) => {
      if (document.querySelector('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      if (e.key === 'ArrowLeft') shiftMonth(-1);
      if (e.key === 'ArrowRight') shiftMonth(1);
      if (e.key === 'F5') load({ cals: true });
    });
    new ResizeObserver(() => fitChips()).observe($('grid'));
    api.on('app:focus', () => { if (Date.now() - S.lastFocusLoad > 15000) { S.lastFocusLoad = Date.now(); load(); } });
    api.on('app:refresh', () => load({ cals: true }));
    api.on('app:update', (msg) => banner(msg));
    api.on('app:settings', (m) => {
      if (!m) return;
      if (m.type === 'draft') { setDraft(m.patch || {}); if (m.patch && 'hiddenCalendars' in m.patch) load(); }
      else if (m.type === 'save') saveSettings(true);
      else if (m.type === 'cancel') cancelSettings();
    });
    api.on('app:cfg', async () => { const r = await api.getCfg(); if (r.ok) { S.cfg = r.data; themeApply(); lockApply(); } });
    // 자정이 지나면 오늘 표시 갱신
    let lastDay = todayStr();
    setInterval(() => { if (todayStr() !== lastDay) { lastDay = todayStr(); applyMini(); if (S.cfg.mini) { S.sel = lastDay; S.ym = lastDay.slice(0, 7); load(); } else render(); } }, 60 * 1000);
  }
  function openSettings() {
    if (!SET_MODE) { S.draft = {}; api.win('openSettings'); return; }
    const dlg = $('settings');
    if (dlg.open) return;
    S.draft = {}; renderSettings(); dlg.show();
    if (!dlg.style.left) { const z = parseFloat(document.body.style.zoom || '1') || 1; dlg.style.left = Math.max(8, (window.innerWidth / z - dlg.offsetWidth) / 2) + 'px'; dlg.style.top = '48px'; }
  }
  function shiftMonth(n) {
    const y = +S.ym.slice(0, 4), m = +S.ym.slice(5) - 1 + n;
    const d = new Date(y, m, 1); S.ym = ymd(d).slice(0, 7);
    S.sel = S.ym === todayStr().slice(0, 7) ? todayStr() : S.ym + '-01';
    S.events = []; render(); load();
  }

  async function initSettingsWindow() {
    document.body.classList.add('settings-mode'); document.title = '예람달력 설정';
    const r = await api.getCfg(); S.cfg = r.ok ? r.data : {};
    themeApply(); bind();
    if (S.cfg.loggedIn) { const c = await api.calendars(); if (c.ok) S.cals = c.data; }
    S.draft = {}; renderSettings(); $('settings').show();
  }
  async function init() {
    if (SET_MODE) return initSettingsWindow();
    const r = await api.getCfg(); S.cfg = r.ok ? r.data : {};
    themeApply(); lockApply(); applyPanel(); bind(); applyMini(); render();
    $('tbOpacity').value = Math.round((S.cfg.opacity || 1) * 100);
    await load({ cals: true }); startTimer();
  }
  init();
})();
