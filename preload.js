const { contextBridge, ipcRenderer } = require('electron');

const call = (ch) => (...a) => ipcRenderer.invoke(ch, ...a);
contextBridge.exposeInMainWorld('api', {
  getCfg: call('cfg:get'),
  setCfg: call('cfg:set'),
  login: call('auth:login'),
  logout: call('auth:logout'),
  calendars: call('cal:list'),
  events: call('ev:list'),
  search: call('ev:search'),
  getEvent: call('ev:get'),
  create: call('ev:create'),
  patch: call('ev:patch'),
  remove: call('ev:delete'),
  win: call('win:action'),
  on: (ch, fn) => {
    if (!['app:focus', 'app:refresh', 'app:cfg', 'app:update'].includes(ch)) return;
    ipcRenderer.on(ch, (_e, arg) => fn(arg));
  }
});
