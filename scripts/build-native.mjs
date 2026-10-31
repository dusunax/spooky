// native/ax-probe.swift → resources/bin/ax-probe (macOS, Xcode Command Line Tools 필요).
// swiftc가 없으면 경고만 하고 넘어간다 — 화면 버튼 기능만 꺼지고 나머지는 그대로 동작한다.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'native/ax-probe.swift')
const output = join(root, 'resources/bin/ax-probe')

if (process.platform !== 'darwin') process.exit(0)
if (existsSync(output) && statSync(output).mtimeMs >= statSync(source).mtimeMs) process.exit(0)

try {
  mkdirSync(dirname(output), { recursive: true })
  execFileSync('swiftc', ['-O', source, '-o', output], { stdio: 'inherit' })
  console.log('[spooky] built resources/bin/ax-probe')
} catch {
  console.warn(
    '[spooky] swiftc not available — on-screen buttons disabled (xcode-select --install)'
  )
}
