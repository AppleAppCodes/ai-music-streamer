import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('yoriaxDesktop', {
  platform: process.platform,
  app: 'YORIAX',
});
