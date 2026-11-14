// Pont mínim entre Electron i la web: rep els arxius oberts amb doble clic / «Obre amb…».
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('xcEscriptori', {
  onObre: (cb) => ipcRenderer.on('obre', (e, fitxers) => cb(fitxers)),
  llest: () => ipcRenderer.send('llest'),
});
