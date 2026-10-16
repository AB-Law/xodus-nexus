// Dedicated sandboxed remote-page preload. No launcher API, Node API, file or
// token-storage access is exposed. The main process independently checks sender.
import { contextBridge, ipcRenderer, webFrame } from 'electron';
const hosts = ['login.live.com', 'account.live.com', 'login.microsoftonline.com', 'login.microsoft.com', 'account.microsoft.com', 'sisu.xboxlive.com'];
if (window === window.top && location.protocol === 'https:' && !location.port && hosts.includes(location.hostname)) {
  contextBridge.exposeInMainWorld('__nexusAuth', {
    notify: (payload: unknown) => {
      if (typeof payload === 'string' && payload.length <= 65_536) ipcRenderer.send('nexus-auth:notify', payload);
    },
  });
  // Chromium already owns window.external. Install only the Wry-compatible
  // method on that object, before the sign-in page's inline scripts execute.
  void webFrame.executeJavaScript(`Object.defineProperty(globalThis.external, 'notify', {
    value: payload => globalThis.__nexusAuth.notify(payload),
    configurable: false,
    writable: false
  })`);
}
