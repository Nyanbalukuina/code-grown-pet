// 描画側には保存通知の購読だけを公開し、Electron API自体は渡さない。
import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("pet", {
  onSaved(callback: () => void): () => void {
    const listener = (): void => callback();
    ipcRenderer.on("pet:saved", listener);
    return () => ipcRenderer.removeListener("pet:saved", listener);
  },
});
