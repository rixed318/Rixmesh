import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('rixmeshDesktop', {
  isDesktop: true,
  onSelectedProjectPath: (callback) => {
    ipcRenderer.on('selected-project-path', (_event, path) => callback(path));
  },
});
