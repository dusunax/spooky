// dist/mac-arm64/Spooky.app 서명.
// 키체인에 "Spooky Dev" 코드 서명 인증서가 있으면 그걸로 — 다시 빌드해도 손쉬운 사용 허용이 유지된다.
// 없으면 ad-hoc 서명 — 빌드할 때마다 손쉬운 사용에서 Spooky를 지우고 다시 추가해야 한다.
import { execFileSync } from 'node:child_process'

const IDENTITY = process.env.SPOOKY_SIGN_IDENTITY ?? 'Spooky Dev'
const APP = 'dist/mac-arm64/Spooky.app'

const identities = execFileSync('security', ['find-identity', '-p', 'codesigning'], {
  encoding: 'utf8'
})
const signer = identities.includes(`"${IDENTITY}"`) ? IDENTITY : '-'

execFileSync(
  'codesign',
  ['--force', '--deep', '--sign', signer, '--identifier', 'dev.dusuna.spooky', APP],
  { stdio: 'inherit' }
)
console.log(
  signer === '-'
    ? `[spooky] ad-hoc signed — create a "${IDENTITY}" code signing certificate to keep Accessibility permission across builds`
    : `[spooky] signed with "${IDENTITY}"`
)
