import type { IpcMain } from 'electron'
import Store from 'electron-store'

const store = new Store()

export function registerStorageHandlers(ipcMain: IpcMain): void {
    ipcMain.handle('store:get', (_e, key: string) => store.get(key))
    ipcMain.handle('store:set', (_e, key: string, value: any) => {
        store.set(key, value)
        return true
    })
    ipcMain.handle('store:delete', (_e, key: string) => {
        store.delete(key)
        return true
    })
}