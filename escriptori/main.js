// Xoriguer Compactador per a Windows (Electron). Tot és local: la web de www/ va dins de l'instal·lador
// i es serveix amb el protocol app:// (el worker de mòdul i el WASM de 7-Zip no funcionen amb file://).
// «Obre amb…» / doble clic: el camí arriba a process.argv (o a second-instance si l'app ja és oberta).
const { app, BrowserWindow, Menu, shell, protocol, net, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const WWW = path.join(__dirname, 'www');
const MIME = { '.wasm': 'application/wasm', '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8' };

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

if (!app.requestSingleInstanceLock()) { app.quit(); }

let finestra = null;
let llest = false;
let pendents = [];

/** Camins d'arxiu que vénen a la línia d'ordres (els que existeixen i no són opcions). */
function arxiusDe(argv) {
  return argv.slice(app.isPackaged ? 1 : 2).filter((a) => !a.startsWith('-') && fs.existsSync(a) && fs.statSync(a).isFile());
}
function envia(camins) {
  if (!camins.length) return;
  if (!llest || !finestra) { pendents.push(...camins); return; }
  const fitxers = camins.map((c) => ({ nom: path.basename(c), dades: fs.readFileSync(c) }));
  finestra.webContents.send('obre', fitxers);
}

function crea() {
  finestra = new BrowserWindow({
    width: 1000, height: 820, minWidth: 360, minHeight: 520,
    backgroundColor: '#1E2A3B', title: 'Xoriguer Compactador',
    icon: path.join(__dirname, 'icona.png'),
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  Menu.setApplicationMenu(null);
  finestra.loadURL('app://local/index.html');
  finestra.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('app://')) return { action: 'allow' };   // llicències
    shell.openExternal(url); return { action: 'deny' };
  });
  finestra.on('closed', () => { finestra = null; llest = false; });
}

app.on('second-instance', (e, argv) => {
  if (finestra) { if (finestra.isMinimized()) finestra.restore(); finestra.focus(); }
  envia(arxiusDe(argv));
});

ipcMain.on('llest', () => { llest = true; const p = pendents; pendents = []; envia(p); });

app.whenReady().then(() => {
  protocol.handle('app', async (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '') || 'index.html';
    const fitxer = path.normalize(path.join(WWW, rel));
    if (!fitxer.startsWith(WWW)) return new Response('', { status: 403 });
    try {
      const r = await net.fetch(pathToFileURL(fitxer).toString());
      const tipus = MIME[path.extname(fitxer).toLowerCase()];
      return new Response(r.body, { status: r.status, headers: tipus ? { 'Content-Type': tipus } : r.headers });
    } catch { return new Response('', { status: 404 }); }
  });
  // Permís per a la carpeta de destí (File System Access) i el porta-retalls
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(['fileSystem', 'clipboard-sanitized-write'].includes(perm)));
  crea();
  envia(arxiusDe(process.argv));
});
app.on('window-all-closed', () => app.quit());
