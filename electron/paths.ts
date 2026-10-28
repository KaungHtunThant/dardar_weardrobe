import { join } from 'node:path'

/** Folder under the app's resources where electron-builder puts `.output` (see electron-builder.yml). */
export const SERVER_RESOURCE_DIR = 'app-server'

/**
 * The built Nitro server. Installed, it ships as an extra resource outside the asar archive,
 * because its native modules (ONNX runtime, sharp) and model files can't be loaded from inside one.
 */
export function serverEntry(app: { isPackaged: boolean; appPath: string; resourcesPath: string }): string {
  return app.isPackaged
    ? join(app.resourcesPath, SERVER_RESOURCE_DIR, 'server', 'index.mjs')
    : join(app.appPath, '.output', 'server', 'index.mjs')
}
