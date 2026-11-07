/**
 * Session-scoped file persistence for the video project document.
 *
 * Layout: `<dataRoot>/projects/<sessionId>.json`. Session ids are validated
 * before they reach a path, so a crafted id cannot escape the directory.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export function createStore(root) {
  const dir = join(root, 'projects')

  async function ensure() {
    await mkdir(dir, { recursive: true })
  }

  function pathOf(sessionId) {
    return join(dir, `${sessionId}.json`)
  }

  return {
    read: async (sessionId) => {
      try {
        const text = await readFile(pathOf(sessionId), 'utf8')
        const parsed = JSON.parse(text)
        return parsed !== null && typeof parsed === 'object' ? parsed : null
      } catch {
        return null
      }
    },
    write: async (sessionId, document) => {
      await ensure()
      const target = pathOf(sessionId)
      const tmp = `${target}.tmp`
      await writeFile(tmp, JSON.stringify(document), 'utf8')
      await rename(tmp, target)
    },
    pathOf,
  }
}
