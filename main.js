// 예람달력 — 구글 캘린더 연동 바탕화면 달력 (Electron main process)
const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, safeStorage, screen, session } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const os = require('os');
// 윈도우 11(22H2 이상)이면 바탕화면이 비치는 진짜 유리(아크릴) 효과 사용
const ACRYLIC = process.platform === 'win32' && Number((os.release().split('.')[2]) || 0) >= 22621;

const API = 'https://www.googleapis.com/calendar/v3';
const SCOPE = 'https://www.googleapis.com/auth/calendar';

let win = null;
let tray = null;
let quitting = false;

// ---------- 설정 저장 ----------
const cfgPath = () => path.join(app.getPath('userData'), 'config.json');
const DEFAULTS = {
  clientId: '', clientSecret: '', refreshToken: '',
  hiddenCalendars: [], opacity: 1, theme: 'system',
  alwaysOnTop: false, locked: false, autoStart: false,
  weekStart: 0, panelOpen: true, panelMode: 'day', bounds: null
};
let cfg = { ...DEFAULTS };
// 배포판에 함께 넣는 기본 구글 키(빌드할 때 creds.json으로 들어감). 설정에서 직접 넣은 키가 있으면 그걸 우선 사용
let BUILTIN = { clientId: '', clientSecret: '' };
try { BUILTIN = { ...BUILTIN, ...JSON.parse(fs.readFileSync(path.join(__dirname, 'creds.json'), 'utf8')) }; } catch {}
const clientId = () => cfg.clientId || BUILTIN.clientId;
const clientSecret = () => (cfg.clientId ? cfg.clientSecret : BUILTIN.clientSecret);
function loadCfg() {
  try { cfg = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(cfgPath(), 'utf8')) }; } catch { cfg = { ...DEFAULTS }; }
}
function saveCfg() {
  try { fs.mkdirSync(path.dirname(cfgPath()), { recursive: true }); fs.writeFileSync(cfgPath(), JSON.stringify(cfg, null, 2)); } catch (e) { console.error(e); }
}
function enc(s) {
  if (!s) return '';
  try { if (safeStorage.isEncryptionAvailable()) return 'enc:' + safeStorage.encryptString(s).toString('base64'); } catch {}
  return 'raw:' + Buffer.from(s).toString('base64');
}
function dec(s) {
  if (!s) return '';
  try {
    if (s.startsWith('enc:')) return safeStorage.decryptString(Buffer.from(s.slice(4), 'base64'));
    if (s.startsWith('raw:')) return Buffer.from(s.slice(4), 'base64').toString();
  } catch {}
  return '';
}
function publicCfg() {
  const { refreshToken, clientSecret, ...rest } = cfg;
  return { ...rest, hasSecret: !!clientSecret, loggedIn: !!refreshToken, acrylic: ACRYLIC, builtIn: !!(BUILTIN.clientId && BUILTIN.clientSecret), version: app.getVersion() };
}

// ---------- 구글 로그인 (PKCE + 루프백) ----------
let accessToken = null, accessExp = 0;
function b64url(buf) { return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }

function login() {
  return new Promise((resolve, reject) => {
    if (!clientId() || !clientSecret()) return reject(new Error('NO_CLIENT'));
    const verifier = b64url(crypto.randomBytes(32));
    const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
    const state = b64url(crypto.randomBytes(12));
    let done = false;
    const server = http.createServer(async (req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      if (u.pathname !== '/') { res.writeHead(404); res.end(); return; }
      const code = u.searchParams.get('code');
      const err = u.searchParams.get('error');
      const page = (msg) => `<!doctype html><meta charset="utf-8"><title>예람달력</title><body style="font-family:'Malgun Gothic',sans-serif;padding:40px;font-size:18px">${msg}</body>`;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      if (err || !code || u.searchParams.get('state') !== state) {
        res.end(page('로그인이 취소됐어요. 예람달력에서 다시 시도해 주세요.'));
        finish(new Error(err || 'LOGIN_FAILED'));
        return;
      }
      try {
        const port = server.address().port;
        const r = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code, client_id: clientId(), client_secret: clientSecret(),
            redirect_uri: `http://127.0.0.1:${port}`, grant_type: 'authorization_code', code_verifier: verifier
          })
        });
        const j = await r.json();
        if (!r.ok || !j.refresh_token) throw new Error(j.error_description || j.error || 'NO_REFRESH_TOKEN');
        cfg.refreshToken = enc(j.refresh_token); saveCfg();
        accessToken = j.access_token; accessExp = Date.now() + (j.expires_in - 60) * 1000;
        res.end(page('✅ 로그인 완료! 이 창을 닫고 예람달력으로 돌아가세요.'));
        finish(null);
      } catch (e) {
        res.end(page('로그인 중 문제가 생겼어요: ' + String(e.message).replace(/</g, '&lt;')));
        finish(e);
      }
    });
    const timer = setTimeout(() => finish(new Error('TIMEOUT')), 5 * 60 * 1000);
    function finish(e) {
      if (done) return; done = true; clearTimeout(timer);
      setTimeout(() => server.close(), 500);
      if (win) { win.show(); win.focus(); }
      e ? reject(e) : resolve(true);
    }
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
        client_id: clientId(), redirect_uri: `http://127.0.0.1:${port}`, response_type: 'code',
        scope: SCOPE, access_type: 'offline', prompt: 'consent', code_challenge: challenge,
        code_challenge_method: 'S256', state
      });
      shell.openExternal(url);
    });
  });
}

async function token() {
  if (accessToken && Date.now() < accessExp) return accessToken;
  const rt = dec(cfg.refreshToken);
  if (!rt) throw Object.assign(new Error('NOT_LOGGED_IN'), { code: 'NOT_LOGGED_IN' });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId(), client_secret: clientSecret(), refresh_token: rt, grant_type: 'refresh_token' })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (j.error === 'invalid_grant') { cfg.refreshToken = ''; saveCfg(); throw Object.assign(new Error('로그인이 만료됐어요. 설정에서 다시 로그인해 주세요.'), { code: 'NOT_LOGGED_IN' }); }
    throw Object.assign(new Error(j.error_description || j.error || '토큰 갱신 실패'), { code: 'TOKEN' });
  }
  accessToken = j.access_token; accessExp = Date.now() + (j.expires_in - 60) * 1000;
  return accessToken;
}

async function api(method, p, query, body) {
  const t = await token();
  const url = API + p + (query ? '?' + new URLSearchParams(query) : '');
  const r = await fetch(url, {
    method, headers: { Authorization: 'Bearer ' + t, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  if (r.status === 204) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401) { accessToken = null; }
    throw Object.assign(new Error((j.error && j.error.message) || ('HTTP ' + r.status)), { code: 'API_' + r.status });
  }
  return j;
}
const enc1 = encodeURIComponent;

// ---------- IPC ----------
function wrap(fn) {
  return async (_e, ...args) => {
    try { return { ok: true, data: await fn(...args) }; }
    catch (e) { return { ok: false, code: e.code || 'ERR', message: e.message }; }
  };
}

ipcMain.handle('cfg:get', wrap(async () => publicCfg()));
ipcMain.handle('cfg:set', wrap(async (patch) => {
  const allowed = ['clientId', 'clientSecret', 'hiddenCalendars', 'opacity', 'theme', 'alwaysOnTop', 'locked', 'autoStart', 'weekStart', 'panelOpen', 'panelMode', 'fontFamily', 'fontSize', 'accent', 'bgColor', 'style', 'hoverZoom', 'scene', 'glassSeeThrough', 'dayColors'];
  for (const k of Object.keys(patch || {})) if (allowed.includes(k)) cfg[k] = patch[k];
  if ('clientId' in patch || 'clientSecret' in patch) { cfg.clientId = String(cfg.clientId || '').trim(); cfg.clientSecret = String(cfg.clientSecret || '').trim(); }
  saveCfg(); applyWindowCfg();
  return publicCfg();
}));
ipcMain.handle('auth:login', wrap(async () => { await login(); return publicCfg(); }));
ipcMain.handle('auth:logout', wrap(async () => {
  const rt = dec(cfg.refreshToken);
  if (rt) fetch('https://oauth2.googleapis.com/revoke?token=' + enc1(rt), { method: 'POST' }).catch(() => {});
  cfg.refreshToken = ''; accessToken = null; saveCfg(); return publicCfg();
}));

ipcMain.handle('cal:list', wrap(async () => {
  const j = await api('GET', '/users/me/calendarList', { maxResults: 250 });
  return (j.items || []).map(c => ({
    id: c.id, name: c.summaryOverride || c.summary, color: c.backgroundColor, primary: !!c.primary,
    writable: c.accessRole === 'owner' || c.accessRole === 'writer', timeZone: c.timeZone
  }));
}));

ipcMain.handle('ev:list', wrap(async (calIds, timeMin, timeMax) => {
  const out = []; const errors = [];
  await Promise.all(calIds.map(async (id) => {
    try {
      let pageToken;
      do {
        const q = { timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: 2500 };
        if (pageToken) q.pageToken = pageToken;
        const j = await api('GET', `/calendars/${enc1(id)}/events`, q);
        (j.items || []).forEach(e => { if (e.status !== 'cancelled') out.push({ ...e, _cal: id }); });
        pageToken = j.nextPageToken;
      } while (pageToken);
    } catch (e) { if (e.code === 'NOT_LOGGED_IN') throw e; errors.push({ id, message: e.message }); }
  }));
  return { items: out, errors };
}));

ipcMain.handle('ev:search', wrap(async (calIds, q, timeMin, timeMax) => {
  const out = [];
  await Promise.all(calIds.map(async (id) => {
    try {
      const j = await api('GET', `/calendars/${enc1(id)}/events`, { q, timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: 100 });
      (j.items || []).forEach(e => out.push({ ...e, _cal: id }));
    } catch (e) { if (e.code === 'NOT_LOGGED_IN') throw e; }
  }));
  return out;
}));
ipcMain.handle('ev:get', wrap(async (calId, id) => api('GET', `/calendars/${enc1(calId)}/events/${enc1(id)}`)));
ipcMain.handle('ev:create', wrap(async (calId, body) => api('POST', `/calendars/${enc1(calId)}/events`, null, body)));
ipcMain.handle('ev:patch', wrap(async (calId, id, body) => api('PATCH', `/calendars/${enc1(calId)}/events/${enc1(id)}`, null, body)));
ipcMain.handle('ev:delete', wrap(async (calId, id) => api('DELETE', `/calendars/${enc1(calId)}/events/${enc1(id)}`)));

ipcMain.handle('win:action', wrap(async (act, arg) => {
  if (!win) return;
  if (act === 'minimize') win.minimize();
  if (act === 'mini') {
    const on = !!arg; if (on === !!cfg.mini) return;
    const cur = win.getBounds();
    if (on) {
      cfg.bounds = cur;
      const mb = cfg.miniBounds || { width: 320, height: 460, x: cur.x + cur.width - 320, y: cur.y };
      cfg.mini = true; win.setMinimumSize(240, 200); win.setBounds(mb);
    } else {
      cfg.miniBounds = cur; cfg.mini = false;
      win.setMinimumSize(560, 420); win.setBounds(cfg.bounds || { width: 980, height: 660, x: cur.x + cur.width - 980, y: cur.y });
    }
    saveCfg();
  }
  if (act === 'hide') win.hide();
  if (act === 'open' && typeof arg === 'string' && /^https:\/\//.test(arg)) shell.openExternal(arg);
  if (act === 'quit') { quitting = true; app.quit(); }
}));

// ---------- 창 ----------
function applyWindowCfg() {
  if (!win) return;
  win.setOpacity(Math.min(1, Math.max(0.3, Number(cfg.opacity) || 1)));
  const glass = (cfg.style || 'glass') === 'glass' && ACRYLIC && cfg.glassSeeThrough !== false;
  try { if (process.platform === 'win32' && win.setBackgroundMaterial) win.setBackgroundMaterial(glass ? 'acrylic' : 'none'); } catch (e) { console.error(e); }
  try { win.setBackgroundColor(glass ? '#00000000' : '#f6f7f9'); } catch {}
  win.setAlwaysOnTop(!!cfg.alwaysOnTop);
  win.setMovable(!cfg.locked);
  win.setResizable(!cfg.locked);
  try { app.setLoginItemSettings({ openAtLogin: !!cfg.autoStart, path: process.execPath }); } catch {}
  if (tray) tray.setContextMenu(trayMenu());
}

function iconPath() { return path.join(__dirname, 'assets', 'icon.png'); }

function createWindow() {
  const wa = screen.getPrimaryDisplay().workArea;
  let b = cfg.mini ? (cfg.miniBounds || cfg.bounds) : cfg.bounds;
  const visible = b && screen.getAllDisplays().some(d => {
    const a = d.workArea; return b.x < a.x + a.width - 40 && b.x + b.width > a.x + 40 && b.y >= a.y - 10 && b.y < a.y + a.height - 40;
  });
  if (!visible) b = { width: 980, height: 660, x: wa.x + wa.width - 1000, y: wa.y + 20 };
  win = new BrowserWindow({
    ...b, minWidth: cfg.mini ? 240 : 560, minHeight: cfg.mini ? 200 : 420, titleBarStyle: 'hidden', show: false, skipTaskbar: false,
    backgroundColor: '#f6f7f9', title: '예람달력', icon: iconPath(), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => { applyWindowCfg(); win.show(); });
  const saveBounds = () => { if (win && !win.isMinimized()) { if (cfg.mini) cfg.miniBounds = win.getBounds(); else cfg.bounds = win.getBounds(); saveCfg(); } };
  win.on('moved', saveBounds); win.on('resized', saveBounds);
  win.on('close', (e) => { if (!quitting) { e.preventDefault(); win.hide(); } });
  win.on('focus', () => win.webContents.send('app:focus'));
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

function trayMenu() {
  return Menu.buildFromTemplate([
    { label: '예람달력 열기', click: () => { win.show(); win.focus(); } },
    { label: '새로고침', click: () => win.webContents.send('app:refresh') },
    { label: '업데이트 확인 (현재 v' + app.getVersion() + ')', click: () => checkUpdate(true) },
    { type: 'separator' },
    { label: '항상 위에 표시', type: 'checkbox', checked: !!cfg.alwaysOnTop, click: (m) => { cfg.alwaysOnTop = m.checked; saveCfg(); applyWindowCfg(); win.webContents.send('app:cfg'); } },
    { label: '위치·크기 고정', type: 'checkbox', checked: !!cfg.locked, click: (m) => { cfg.locked = m.checked; saveCfg(); applyWindowCfg(); win.webContents.send('app:cfg'); } },
    { label: '윈도우 시작 시 실행', type: 'checkbox', checked: !!cfg.autoStart, click: (m) => { cfg.autoStart = m.checked; saveCfg(); applyWindowCfg(); win.webContents.send('app:cfg'); } },
    { type: 'separator' },
    { label: '종료', click: () => { quitting = true; app.quit(); } }
  ]);
}

// ---------- 자동 업데이트 (깃허브 릴리스) ----------
let updater = null;
function checkUpdate(manual) {
  if (!app.isPackaged) return;
  try {
    if (!updater) {
      updater = require('electron-updater').autoUpdater;
      updater.autoDownload = true; updater.autoInstallOnAppQuit = true;
      updater.on('update-downloaded', (info) => {
        if (win) win.webContents.send('app:update', 'v' + info.version + ' 업데이트를 받았어요. 앱을 다시 켜면 적용돼요.');
      });
      updater.on('update-not-available', () => { if (updater._manual && win) win.webContents.send('app:update', '최신 버전이에요 (v' + app.getVersion() + ').'); });
      updater.on('error', (e) => { if (updater._manual && win) win.webContents.send('app:update', '업데이트 확인 실패: ' + (e && e.message || e)); });
    }
    updater._manual = !!manual;
    updater.checkForUpdates().catch(() => {});
  } catch (e) { console.error(e); }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });
  app.whenReady().then(() => {
    app.setAppUserModelId('kr.yeram.calendar');
    loadCfg();
    // 설정의 글꼴 목록에 내 PC에 설치된 글꼴을 보여주기 위해 허용
    session.defaultSession.setPermissionCheckHandler((_wc, perm) => perm === 'local-fonts');
    session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(perm === 'local-fonts'));
    createWindow();
    try {
      tray = new Tray(nativeImage.createFromPath(iconPath()).resize({ width: 16, height: 16 }));
      tray.setToolTip('예람달력');
      tray.setContextMenu(trayMenu());
      setTimeout(() => checkUpdate(false), 8000);
      setInterval(() => checkUpdate(false), 6 * 60 * 60 * 1000);
      tray.on('click', () => { if (win.isVisible() && win.isFocused()) win.hide(); else { win.show(); win.focus(); } });
    } catch (e) { console.error(e); }
  });
  app.on('before-quit', () => { quitting = true; });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
