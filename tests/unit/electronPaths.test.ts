import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { serverEntry } from '../../electron/paths'

describe('serverEntry', () => {
  it('uses the build output next to the app when running from the project', () => {
    expect(serverEntry({ isPackaged: false, appPath: '/proj', resourcesPath: '/electron/resources' })).toBe(join('/proj', '.output', 'server', 'index.mjs'))
  })

  it('uses the server shipped as an extra resource (outside the asar) when installed', () => {
    expect(serverEntry({ isPackaged: true, appPath: '/opt/Dardar/resources/app.asar', resourcesPath: '/opt/Dardar/resources' })).toBe(
      join('/opt/Dardar/resources', 'app-server', 'server', 'index.mjs'),
    )
  })
})
