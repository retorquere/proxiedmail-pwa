import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const edgePath = process.env.EDGE_BIN ?? (process.platform === 'darwin'
  ? '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
  : '')

if (!edgePath || !existsSync(edgePath)) {
  console.error('Microsoft Edge was not found. Set EDGE_BIN to the Edge executable path.')
  process.exit(1)
}

const ng = process.platform === 'win32' ? 'node_modules/.bin/ng.cmd' : join('node_modules', '.bin', 'ng')
const result = spawnSync(ng, ['test', ...process.argv.slice(2)], {
  env: { ...process.env, CHROME_BIN: edgePath },
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
