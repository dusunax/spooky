# Spooky — Product Requirements Document

| 항목     | 값                                                                                         |
| -------- | ------------------------------------------------------------------------------------------ |
| Version  | 0.2.0 (v0.1.0 초안 정리본)                                                                 |
| Status   | MIN 구현 완료 + OQ-8(화면 요소) 확장. **DEV 챌린지에는 제출하지 않음 (2026-11-03 결정)**   |
| Target   | 개인 프로젝트 (처음 목표는 Hacktoberfest 2026 Week 4 · _Ghost in the Machine_, 제출 안 함) |
| Platform | macOS 우선 (Electron)                                                                      |
| Repo     | `spooky` (ux-lab과 분리된 단독 레포, 2026-10-31 Ghost.exe → Ghosty → Spooky 개명)          |
| License  | MIT                                                                                        |
| 작성일   | 2026-10-31                                                                                 |

### v0.1 → v0.2 변경 요약

1. **스코프를 3단계로 분리** — MIN(반드시 제출) / TARGET(목표) / MAX(여유 시·제출 후). 시간이 모자랄 때 버릴 순서(§3.4)를 명시.
2. **오버레이 구조 확정 제안** — "클릭 통과 투명 오버레이 창"과 "클릭 가능한 데모 창"을 별도 창 2개로 분리. v0.1에서는 클릭 통과와 버튼 폭파가 같은 창에서 충돌할 여지가 있었음.
3. **상태 머신을 2개 레이어로 분리** — 이동(Movement)과 장난(Mischief)을 독립 관리. PAUSED·AI_OFFLINE 상태 추가.
4. **AI 실패 정책 일관화** — "자동 장난 중지"와 "BOO로 폴백"이 섞여 있던 부분을 상황별로 정리하고, 모든 행동에 `source: 'model' | 'fallback'`을 기록.
5. **좌표 계약 정의** — 데모 창 버튼 위치를 화면 좌표로 오버레이에 전달하는 IPC 스펙 추가.
6. **스프라이트 의존성 제거** — MIN은 코드로 그린 픽셀 매트릭스로 시작하고, 형태는 레퍼런스 시트(`docs/reference/sprite-sheet.webp`)를 따른다.
7. **Open Questions 섹션 신설** — 마감 일시, 모델 버전 등 구현 전에 확정해야 할 항목.

---

## 1. 제품 개요

Spooky는 데스크톱 위를 떠다니는 픽셀 아트 유령 펫이다. 마우스 커서를 일정 거리를 두고 따라다니고, 머리 위 **장난 게이지**가 가득 차면 **로컬 오픈 웨이트 모델(Ollama)** 이 다음 장난을 한 번에 고른다(System 1). 장난은 귀신 소리(BOO)와 데모 버튼 폭파(EXPLODE) 두 가지다.

**핵심 콘셉트:** 귀엽지만 조금 성가신, 자기 마음대로 행동하는 데스크톱 유령.
**데모의 핵심 메시지:** "이 장난은 스크립트가 아니라 모델이 골랐다" — 그래서 AI 판단 과정을 볼 수 있어야 한다(Observable).

### 1.1 목표

1. 마우스를 따라다니는 투명 오버레이 유령
2. 게이지 기반 자율 행동 루프
3. 오픈 웨이트 모델이 실제로 행동을 결정 (스키마 검증된 JSON)
4. 안전한 샌드박스 장난 — 자체 데모 창의 버튼만 건드림
5. Week 4 기한 안에 public 레포 + README + 데모 GIF + DEV 제출 글

### 1.2 비목표 (전 단계 공통)

- 외부 앱 버튼의 실제 상태 변경, 임의 웹페이지 스크립트 주입
- 사용자 파일·데이터 접근
- 장기 기억·학습, 복수 유령, 멀티플레이어, 모바일, 3D
- 클라우드 LLM 호출 (오픈 웨이트 + 로컬 추론이 제출 포인트)

### 1.3 UX 원칙

| 원칙          | 구체 기준                                                   |
| ------------- | ----------------------------------------------------------- |
| Cute          | 위협적인 표정·소리 금지. BOO 기본 볼륨 30%                  |
| Unpredictable | 동일 입력에서도 행동이 달라질 수 있음 (temperature 0.8)     |
| Non-intrusive | 클릭 통과, 커서를 가리지 않음, 포커스를 빼앗지 않음         |
| Observable    | 머리 위 상태 텍스트 + (TARGET) 디버그 패널에 입력/출력 JSON |
| Controllable  | 트레이 메뉴 Pause·Mute·Quit, 언제든 종료                    |

---

## 2. 사용자 흐름 (데모 시나리오 기준)

| 시간   | 화면                                      | 상태 텍스트                                  |
| ------ | ----------------------------------------- | -------------------------------------------- |
| 0~10s  | 유령 등장, 커서를 따라다님                | `Following cursor`                           |
| 10~20s | 게이지 충전, 80% 이상에서 장난스러운 표정 | `Mischief 80%`                               |
| 20~25s | 게이지 100%, 점멸 후 멈춤                 | `Thinking...`                                |
| 25~35s | 모델 결정 → BOO 또는 EXPLODE              | `Action: BOO` / `Action: EXPLODE → btn-save` |
| 35~45s | 부서진 버튼은 그대로, 쿨다운 5초          | `Cooldown`                                   |
| 45s~   | 다시 추적                                 | `Following cursor`                           |

> 데모 촬영 시에는 `SPOOKY_CHARGE_SECONDS=8` 같은 환경변수로 충전 시간을 줄여 한 영상에 BOO·EXPLODE를 모두 담는다.

---

## 3. 스코프 — MIN / TARGET / MAX

### 3.1 MIN — 반드시 제출 (예상 3~4시간)

**이것만으로 §10 DoD를 모두 통과해야 한다.**

| ID     | 기능       | MIN 범위                                                                                                                        |
| ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------- |
| FR-01  | 오버레이   | 커서가 있는 디스플레이 전체 크기 투명·프레임 없음·always-on-top·클릭 통과 창 1개                                                |
| FR-02  | 추적       | `screen.getCursorScreenPoint()` 30Hz 폴링, lerp 0.08, 목표 거리 60px, 화면 밖 이동 방지, 커서가 있는 디스플레이로 오버레이 이동 |
| FR-03  | 게이지     | 0→100, 20초 충전, 머리 위 48×6px, 쿨다운 중 정지                                                                                |
| FR-04  | AI 결정    | Ollama `/api/chat` + `format`(JSON 스키마) + Zod 검증, 파싱 실패 1회 재시도                                                     |
| FR-05  | EXPLODE    | 데모 창 버튼 3개 중 1개: 유령 접근 → 흔들림·색 변경·파티클(데모 창 내부 CSS) → 영구 disabled(Rebuild로만 복구)                  |
| FR-06  | BOO        | Web Audio로 합성한 "우우우~" (오디오 파일·라이선스 문제 없음) + 입 벌린 얼굴 + 몸통 팽창                                        |
| FR-07  | 상태 표시  | 머리 위 한 줄 텍스트 (`Following cursor` / `Mischief n%` / `Thinking...` / `Action: …` / `AI offline`)                          |
| FR-08  | 제어       | 트레이 메뉴: Pause/Resume, Mute/Unmute, BOO Sounds, Quit. Dock 아이콘 숨김. Mute·BOO Sounds는 `userData/settings.json`에 저장   |
| 비주얼 | 스프라이트 | 코드 픽셀 매트릭스(16×16 → 4배 확대 64px) 2종: 기본 웃는 얼굴, BOO 얼굴. 레퍼런스 시트 형태 기준. `image-rendering: pixelated`  |
| 제출   | 문서       | README(설치·Ollama 모델 pull·실행), MIT LICENSE, 데모 GIF                                                                       |

### 3.2 TARGET — 목표 (+2~3시간)

| 기능                   | 내용                                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| 스프라이트 시트        | 레퍼런스 시트 기준 PNG, IDLE·HAUNT·EXPLODE·BOO 4상태 + 이동 방향 좌우 반전, 상태당 2~4프레임 8FPS     |
| 디버그 패널            | 단축키(`⌘⇧D`)로 토글되는 별도 창: 마지막 입력 컨텍스트, 원본 응답, 검증 결과, 지연 시간(ms), `source` |
| THINKING·COOLDOWN 표현 | 무표정 정지 / 지친 얼굴로 천천히 원래 크기 복귀                                                       |
| AI offline UX          | 트레이에 `Retry AI connection`, 30초 간격 자동 재연결                                                 |
| 오버레이 폭발 이펙트   | 데모 창 내부 CSS 대신 오버레이에 버튼 화면 좌표 기준 파티클 (창 경계를 넘는 폭발)                     |
| 전역 단축키            | `⌘⇧G` Pause/Resume                                                                                    |
| 게이지 연출            | 레퍼런스 시트 GAUGE 11단계: 빈 칸→파랑→초록→노랑→주황→빨강, 100% 점멸                                 |
| 설정 유지              | Mute·Pause 상태를 재실행 후에도 유지                                                                  |
| 대사 필드              | 모델 출력에 `line`(최대 40자) 추가 → 행동 직전 말풍선 1.5초 (모델 "성격"이 보이는 가장 싼 방법)       |

> **레퍼런스 시트** (`docs/reference/sprite-sheet.webp`, 2026-10-31 사용자 제공): IDLE 8f·8fps, MOVE/HAUNT 8f·12fps, TURN 4f, HAPPY 4f, SURPRISE 4f, ANGRY 4f, HURT 4f, THINKING 4f, BOO 6f·12fps, CHARGING 8f·8fps, EXPLODE ACTION 8f·12fps, COOLDOWN 6f·8fps, GAUGE 11f, BUTTON EXPLOSION 12f·12fps, EXTRA(spark·star·heart·!·?·idea·sleep). 시트는 크기·격자가 균일하지 않은 시안이라 그대로 잘라 쓰지 않고, 상태·프레임 구성과 형태의 기준으로 삼는다. TARGET은 IDLE·HAUNT·BOO·EXPLODE ACTION·GAUGE·BUTTON EXPLOSION을 우선 옮긴다.

### 3.3 MAX — 여유 시 / 제출 후 (v0.1.x)

| 기능                     | 비고                                                             |
| ------------------------ | ---------------------------------------------------------------- |
| 7개 상태 전체 애니메이션 | CHARGING 흔들림 등                                               |
| 멀티 모니터 확장         | 디스플레이 경계에 걸친 연출, 디스플레이 연결·해제 대응           |
| 패키징                   | electron-builder unsigned `.dmg`                                 |
| 설정 창                  | 추적 속도, 장난 빈도, 크기(S/M/L), 모델 선택                     |
| 행동 추가                | 예: `HIDE`(커서 반대편으로 숨기), `SPIN` — 허용 목록 확장 방식만 |
| 외부 화면 시각 효과      | 외부 앱 위 특정 좌표에 폭발 그림만 (상태 변경 없음)              |

v0.2 이후(Personality, Haunted Desktop, Autonomous Pet, Platform)는 §12 로드맵 참조.

### 3.4 시간이 부족할 때 버리는 순서

TARGET 안에서 아래 순서로 먼저 버린다. **MIN은 버리지 않는다.**

1. 설정 유지 → 2. 전역 단축키 → 3. 오버레이 폭발 이펙트 → 4. THINKING·COOLDOWN 표현 → 5. 스프라이트 시트 (코드 픽셀 유지) → 6. `line` 말풍선 → 7. 디버그 패널

디버그 패널은 "AI가 실제로 골랐다"를 증명하는 장치라 가장 마지막에 버린다. 버려야 할 경우 터미널 로그(`[ghost] decision {…}`)로 대체하고 GIF에 터미널을 함께 찍는다.

---

## 4. 기능 요구사항 상세

### FR-01. 데스크톱 오버레이 (P0)

**창 구성 (확정 제안)**

| 창               | 역할                                         | 속성                                                                                                                                                                                                                                                                            |
| ---------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `overlay`        | 유령·게이지·상태 텍스트·(TARGET) 폭발 이펙트 | 커서가 있는 디스플레이 `bounds` 크기(커서가 넘어가면 `setBounds`로 이동), `transparent`, `frame:false`, `hasShadow:false`, `focusable:false`, `setAlwaysOnTop(true,'screen-saver')`, `setIgnoreMouseEvents(true)`, `setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true})` |
| `demo`           | 폭파 대상 버튼이 있는 일반 창                | 일반 창, 클릭 가능, 로컬 HTML만 로드                                                                                                                                                                                                                                            |
| `debug` (TARGET) | AI 입출력 확인                               | 일반 창, 기본 숨김                                                                                                                                                                                                                                                              |

- 작은 창을 30Hz로 `setPosition` 하는 방식은 macOS에서 끊김·그림자 문제가 있어 채택하지 않는다. 전체 화면 오버레이 안에서 CSS `transform`으로 움직인다.
- `getCursorScreenPoint()`는 macOS 손쉬운 사용(Accessibility) 권한이 필요 없다. → 첫 실행 권한 팝업 없음.

수용 기준

- [ ] 유령이 다른 앱(풀스크린 포함) 위에 보인다.
- [ ] 유령·게이지 아래의 버튼·링크가 정상 클릭된다.
- [ ] 트레이 Quit으로 모든 창·타이머·진행 중 요청이 정리되고 종료된다.

### FR-02. 마우스 추적 (P0)

| 항목        | 기본값                                                                       |
| ----------- | ---------------------------------------------------------------------------- |
| 커서 폴링   | 30Hz (main) → overlay로 IPC                                                  |
| 렌더        | rAF, lerp 계수 0.08                                                          |
| 목표 거리   | 커서에서 60px 떨어진 지점 (커서의 좌상단 방향 기본, 이동 방향에 따라 반대편) |
| 정지 임계값 | 목표점과 8px 이내면 정지                                                     |
| 화면 경계   | 유령 박스가 디스플레이 밖으로 나가지 않게 clamp                              |

- 유령 중심이 커서 반경 48px 안에 들어오지 않게 한다(시야 가림 방지).
- 커서 속도(px/s)는 최근 0.5초 이동량으로 계산해 AI 입력에 쓴다.

### FR-03. 장난 게이지 (P0)

| 항목                | 기본값                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 범위                | 0~100                                                                                                                                         |
| 충전                | 기본 20초에 100. 트레이 **Mischief Every**에서 10초·20초·40초·1.5분·3분 선택(저장됨, 바로 적용). `SPOOKY_CHARGE_SECONDS`는 시작할 때만 덮어씀 |
| 100 도달            | 충전 정지 → THINKING, AI 요청 1회                                                                                                             |
| 행동 완료           | 0으로 초기화 → COOLDOWN 5초 (충전 정지)                                                                                                       |
| PAUSED / AI_OFFLINE | 충전 정지 (AI_OFFLINE은 100에서 대기)                                                                                                         |

### FR-04. AI 행동 결정 — System 1 (P0)

**정의:** 짧은 컨텍스트 1회 호출로, 숙고 없이 즉시 하나의 행동을 고른다. 체인·도구 호출·재귀 없음. 모델의 thinking 모드는 끈다.

**입력 컨텍스트**

```ts
type DecisionContext = {
  cursorSpeed: 'still' | 'slow' | 'fast' // 수치 대신 버킷 — 소형 모델이 덜 헷갈림
  distanceToCursor: number // px, 정수
  lastAction: 'BOO' | 'EXPLODE' | null
  secondsSinceLastAction: number | null
  targets: { id: string; label: string }[] // 현재 폭파 가능한 버튼 (데모 창이 닫혀 있거나 이미 부서졌으면 제외)
}
```

**출력 스키마** (Ollama `format`에 JSON 스키마로 전달 + Zod로 재검증, `electron/ai/schema.ts`)

모델 출력은 `{ choice, intensity }` 한 가지 형태다. `choice`는 `"BOO"` 또는 `"EXPLODE:<targetId>"` 중 하나이고, 선택지 목록은 호출마다 현재 targets로 만들어 JSON 스키마 `enum`에 넣는다. 검증을 통과하면 내부 `GhostAction`으로 바꾼다.

```ts
// 모델 출력
{ choice: 'BOO' | `EXPLODE:${targetId}`, intensity: number }
// 내부 행동 (src/shared/ipc.ts)
type GhostAction = { type: 'BOO'; intensity: number } | { type: 'EXPLODE'; targetId: string }
// 검증: BOO는 0 ≤ intensity ≤ 1, EXPLODE는 targetId ∈ context.targets
// line: EXPLODE일 때만 모델이 만드는 유령의 한마디 (호기심 많은 어린이 말투, 5단어·40자, 첫 문장만, 이모지 제거, lineLanguage로 한/영)
```

> 왜 한 필드인가 (2026-10-31 실측): `{type, intensity, targetId}` 세 필드로 두면 qwen2.5:1.5b는 EXPLODE를 고르고 targetId를 비워 4/12가 무효였고, qwen3:1.7b는 12/12 모두 BOO 0.5만 골랐다. 선택지를 한 필드로 합치자 qwen3:1.7b가 16/16 유효, BOO 9·EXPLODE 7로 고르게 섞였다.

**결정 기록** (상태 텍스트·디버그 패널·로그 공통)

```ts
type DecisionRecord = {
  context: DecisionContext
  raw: string | null
  action: GhostAction
  engine: string // 'ollama' (§7.5)
  source: 'model' | 'fallback'
  fallbackReason?: 'parse_failed' | 'invalid_target' | 'no_target'
  latencyMs: number
}
```

**호출 파라미터 (초기값)**

| 항목        | 값                                                                                      |
| ----------- | --------------------------------------------------------------------------------------- |
| Endpoint    | `http://127.0.0.1:11434/api/chat`, `stream:false`                                       |
| Model       | `qwen3:1.7b` (Apache-2.0, Q4_K_M 1.4GB). p50 586ms. 환경변수 `SPOOKY_MODEL`로 교체 가능 |
| temperature | 0.8                                                                                     |
| think       | false                                                                                   |
| Timeout     | 10초 (넘으면 THINKING 유지하다 실패 처리)                                               |
| 호출 위치   | Electron main (renderer는 결과만 받음)                                                  |

**프롬프트 초안**

```text
You are the instinctive brain of a mischievous but cute desktop ghost.
Pick exactly one playful action right now. Do not explain.

Actions:
- BOO: make a cute ghost sound. intensity 0.0 (whisper) to 1.0 (loud).
- EXPLODE: playfully explode one demo button. targetId must be one of the given targets.

Rules:
- Only choose EXPLODE if targets is not empty.
- Prefer a different action than lastAction, but surprise is allowed.
- If the cursor is fast, the user is busy: prefer a small BOO.

Context:
{context JSON}
```

> 출력 형식 지시("Return valid JSON only")는 `format` 스키마가 강제하므로 프롬프트에서 뺀다. 안전 규칙("Never damage user data")은 모델이 지킬 수 있는 영역이 아니라 **허용 목록·검증 코드가 보장**하므로 프롬프트가 아니라 §7 보안에 둔다.

### FR-05. 버튼 폭파 — EXPLODE (P0)

**데모 창 구성:** 버튼 3개 — `Save`, `Submit`, `Delete Everything`(장난용 문구, 실제 동작 없음) + 입력칸 1개(`input-note`). 각 요소에 `data-ghost-target="btn-save"` 등 id.

**좌표 계약**

1. demo renderer → main: `demo:targets` — `{ id, label, rect, disabled }[]` (창 로드·리사이즈·버튼 상태 변경 시. 창 이동은 main이 창 좌표로 매번 보정)
2. main: `demoWin.getContentBounds()`로 화면 좌표 변환 → overlay 디스플레이 원점 기준 로컬 좌표로 변환
3. main → overlay: `ghost:approach { x, y }`
4. overlay 도착(목표 20px 이내 또는 1.5초 경과) → main → demo: `demo:explode { id }`
5. demo: 흔들림 300ms → 그을린 스타일 + 섬광·파편·연기 → `disabled` → 연출(0.7초) 끝에 `demo:exploded { id }`
6. main: COOLDOWN 진입, 유령은 다시 커서 추적. **부서진 버튼은 돌아오지 않는다** (2026-10-31 사용자 결정). 데모 창의 Rebuild 버튼이나 트레이 `Rebuild Demo Buttons`(`demo:reset`)로만 되살린다. 세 개가 모두 부서지면 대상이 비어 모델은 BOO만 고를 수 있다

대상 목록은 호출마다 순서를 섞어 모델에 넘긴다 — 실측에서 qwen3:1.7b가 목록 맨 앞(`btn-save`)만 3/3 골랐다.

예외

- 데모 창이 닫혀 있음 / 최소화 / 다른 디스플레이 → `targets`에서 제외 → 모델이 EXPLODE를 고를 수 없음
- 모델이 없는 id를 반환 → BOO(intensity 0.5) 폴백, `source:'fallback'`, `fallbackReason:'invalid_target'`
- 데모 창을 닫았다 다시 열면 버튼도 새로 만들어진다

### FR-06. 귀신 소리 — BOO (P0)

- Web Audio 합성: 사인파 + 비브라토(5~6Hz) + 피치 하강 + 페이드 아웃, 길이 1.2~1.8초 (`intensity`에 비례)
- 최종 볼륨 = 마스터 볼륨(기본 0.3) × `0.4 + 0.6 × intensity`
- Mute면 소리 없이 애니메이션만 재생
- 사운드 종료(`onended`) → COOLDOWN

### FR-07. 상태 표시 (P0 텍스트 / TARGET 디버그 패널)

머리 위 상태 텍스트는 FR-03 게이지 바로 위, 9~10px 픽셀 폰트, 흰 글자 + 검은 외곽선.

### FR-08. 제어 (P0)

| 메뉴             | 동작                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Pause / Resume   | 추적·충전·AI 호출 모두 정지, 유령은 제자리에서 반투명(50%)                                                               |
| Mute / Unmute    | BOO 소리만 끔                                                                                                            |
| BOO Sounds       | BOO 패턴 5종(wail·question·stutter·moan·warble) 체크박스. 켠 패턴 중 랜덤(직전 패턴 제외), 켤 때 미리듣기, 최소 1개 유지 |
| Show Demo Window | 데모 창 열기/앞으로                                                                                                      |
| Quit             | 진행 중 fetch abort, 타이머·IPC 정리 후 종료                                                                             |

---

## 5. 상태 머신

v0.1의 단일 상태 머신을 **두 레이어**로 나눈다. 렌더링 표정은 두 레이어 조합으로 결정한다.

### 5.1 Movement 레이어

| 상태       | 설명                                          | 전이                                      |
| ---------- | --------------------------------------------- | ----------------------------------------- |
| `FOLLOW`   | 커서 추적 (HAUNT)                             | Mischief가 `ACTING(EXPLODE)` → `APPROACH` |
| `APPROACH` | 대상 버튼으로 이동                            | 도착 또는 1.5초 → `HOLD`                  |
| `HOLD`     | 제자리 (BOO 중, EXPLODE 중, THINKING, PAUSED) | 행동 종료 → `FOLLOW`                      |

### 5.2 Mischief 레이어

```ts
type MischiefState =
  | 'CHARGING' // 게이지 충전 중 (IDLE/HAUNT와 동시)
  | 'THINKING' // AI 요청 중
  | 'ACTING' // BOO 또는 EXPLODE 실행 중
  | 'COOLDOWN' // 5초, 충전 정지
  | 'AI_OFFLINE' // Ollama 연결 불가, 게이지 100에서 대기
  | 'PAUSED' // 사용자 일시정지
```

| 현재       | 조건                                | 다음                                                          |
| ---------- | ----------------------------------- | ------------------------------------------------------------- |
| CHARGING   | gauge = 100                         | THINKING                                                      |
| THINKING   | 유효한 결정(모델 또는 폴백)         | ACTING                                                        |
| THINKING   | 연결 실패 / 모델 없음 / 타임아웃    | AI_OFFLINE                                                    |
| ACTING     | BOO 사운드 종료 / EXPLODE 연출 종료 | COOLDOWN                                                      |
| COOLDOWN   | 5초                                 | CHARGING (gauge 0)                                            |
| AI_OFFLINE | 재연결 성공                         | THINKING                                                      |
| (any)      | Pause                               | PAUSED (이전 상태 기억)                                       |
| PAUSED     | Resume                              | 이전 상태 (THINKING이었다면 CHARGING으로 되돌리고 gauge 유지) |

### 5.3 표정 매핑 (구현: `src/sprites/expression.ts`, 2026-11-03)

| 조건                 | 표정                 | 머리 옆 아이콘 | 움직임        |
| -------------------- | -------------------- | -------------- | ------------- |
| CHARGING, gauge < 80 | 웃는 얼굴            | –              | 둥실둥실      |
| CHARGING, gauge ≥ 80 | 장난기(눈썹·씩 웃음) | –              | 부들부들 떨림 |
| THINKING             | 골똘히(위를 보는 눈) | `?`            | 멈춤          |
| ACTING(BOO)          | 입 크게              | –              | 몸통 팽창     |
| ACTING(EXPLODE)      | 신남(^ ^ 눈)         | 반짝           | 통통 튀기     |
| COOLDOWN             | 졸림(감은 눈)        | `z`            | 느리게 둥실   |
| AI_OFFLINE           | 졸림                 | `zzz`          | 느리게 둥실   |
| PAUSED               | 웃는 얼굴            | –              | 반투명        |

-------------------- | ----------------------------- | --------------------------------------- |
| CHARGING, gauge < 80 | 웃는 얼굴 + 둥실둥실 | MIN |
| ACTING(BOO) | 입 크게 + 팽창 | MIN |
| ACTING(EXPLODE) | 신난 얼굴 + 튀어 오름 | MIN은 웃는 얼굴 재사용, TARGET에서 추가 |
| CHARGING, gauge ≥ 80 | 장난스러운 얼굴 + 미세 흔들림 | MAX |
| THINKING | 무표정 정지 | TARGET |
| COOLDOWN | 지친 얼굴 + 천천히 축소 | TARGET |
| AI_OFFLINE | 졸린 얼굴 (`zzz`) | TARGET (MIN은 상태 텍스트만) |
| PAUSED | 현재 얼굴 반투명 | MIN |

---

## 6. AI 실패 처리

원칙: **모델에 닿지 못하면 장난을 멈춘다. 모델이 응답했는데 쓸 수 없으면 BOO로 폴백한다.** 폴백은 `source:'fallback'`으로 기록해 "AI가 골랐다"고 표시하지 않는다.

| 상황                      | 처리                                                                                | 상태 텍스트              |
| ------------------------- | ----------------------------------------------------------------------------------- | ------------------------ |
| Ollama 미실행 (연결 거부) | AI_OFFLINE, 자동 장난 중지, 30초 간격 재연결(TARGET)                                | `AI offline`             |
| 모델 미설치 (404)         | AI_OFFLINE, README의 `ollama pull …` 안내를 트레이 툴팁에                           | `Model missing`          |
| 타임아웃 10초             | AI_OFFLINE과 동일 처리                                                              | `AI offline`             |
| 응답 파싱·스키마 실패     | 1회 재시도 → 또 실패 시 BOO(0.5) 폴백                                               | `Action: BOO (fallback)` |
| 존재하지 않는 targetId    | 재시도 없이 BOO(0.5) 폴백                                                           | `Action: BOO (fallback)` |
| 대상 버튼 없음            | 컨텍스트에서 targets가 빈 배열 → 모델이 BOO만 고르게 됨. 그래도 EXPLODE면 위와 동일 | —                        |
| 추론 지연                 | THINKING 유지 (렌더·추적은 계속)                                                    | `Thinking...`            |
| 앱 종료                   | AbortController로 요청 취소, 타이머 정리                                            | —                        |

시작 시 헬스체크: `GET /api/tags`로 서버·모델 존재 확인 → 없으면 처음부터 AI_OFFLINE으로 시작해 게이지가 의미 없이 차지 않게 한다.

---

## 7. 기술 아키텍처

### 7.1 스택

| 영역        | 선택                                                  | 비고                               |
| ----------- | ----------------------------------------------------- | ---------------------------------- |
| Desktop     | Electron                                              |                                    |
| Build       | Vite + `electron-vite` (또는 vite-plugin-electron)    | 착수 시 하나로 확정                |
| UI          | React + TypeScript                                    |                                    |
| State       | Zustand                                               | Mischief/Movement 스토어           |
| Styling     | CSS (CSS Modules 또는 plain)                          |                                    |
| Sprite      | MIN: 코드 픽셀 매트릭스 → TARGET: PNG 스프라이트 시트 |                                    |
| Audio       | Web Audio API                                         | 외부 오디오 파일 없음              |
| AI          | Ollama REST (fetch)                                   | SDK 없이 직접 호출 — 의존성 최소화 |
| Validation  | Zod                                                   |                                    |
| Lint/Format | 레포 생성 시 결정 (Biome 권장 — 설정 1개)             |                                    |

> 사내 레퍼런스: ux-lab `apps/tuffy`가 Electron 투명 데스크톱 캐릭터 + main 프로세스 "뇌" 구조라 창 설정·IPC·트레이 코드를 참고할 수 있다. 코드를 복사하지 않고 패턴만 참고한다(레포·라이선스 분리).

### 7.2 프로세스 책임

| 프로세스         | 책임                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| main             | 창 생성, 커서 폴링, 게이지·Mischief 상태의 **단일 진실 공급원**, Ollama 호출, 트레이, IPC 라우팅 |
| overlay renderer | 유령 렌더, lerp 이동, 게이지·상태 텍스트, BOO 사운드 재생                                        |
| demo renderer    | 버튼 렌더, 버튼 rect 보고, 폭파 연출, Rebuild                                                    |
| preload          | `contextBridge`로 채널 화이트리스트만 노출                                                       |

게이지·상태를 main이 소유하는 이유: overlay가 숨겨지거나 리로드돼도 상태가 유지되고, AI 호출 중복을 main 한 곳에서 막을 수 있다.

### 7.3 IPC 채널 (화이트리스트)

| 채널                | 방향                  | 페이로드                                              |
| ------------------- | --------------------- | ----------------------------------------------------- |
| `cursor:update`     | main → overlay        | `{ x, y, speed, origin }` (오버레이 로컬 좌표)        |
| `ghost:state`       | main → overlay        | `{ mischief, gauge, statusText, decision, actionId }` |
| `ghost:settings`    | main → overlay        | `{ muted, booPatterns }`                              |
| `ghost:preview-boo` | main → overlay        | `{ pattern }`                                         |
| `ghost:position`    | overlay → main        | `{ x, y }` (4Hz, AI 컨텍스트의 커서 거리용)           |
| `ghost:approach`    | main → overlay        | `{ x, y }`                                            |
| `ghost:arrived`     | overlay → main        | `{}`                                                  |
| `ghost:boo-ended`   | overlay → main        | `{}`                                                  |
| `demo:targets`      | demo → main           | `{ id, label, rect, disabled }[]`                     |
| `demo:explode`      | main → demo           | `{ id }`                                              |
| `demo:exploded`     | demo → main           | `{ id }`                                              |
| `debug:decision`    | main → debug (TARGET) | `DecisionRecord`                                      |

### 7.4 디렉터리

```text
spooky/
├── electron/
│   ├── main.ts            # 앱 수명주기, 창 생성
│   ├── windows.ts         # overlay / demo / debug 창 설정
│   ├── cursor.ts          # 커서 폴링 + 속도
│   ├── mischief.ts        # 게이지 + Mischief 상태 머신
│   ├── ai/
│   │   ├── decide.ts      # 엔진 선택 + 검증 + 폴백 + DecisionRecord 작성 (엔진 무관)
│   │   ├── schema.ts      # DecisionContext·GhostAction Zod + JSON 스키마 (계약)
│   │   ├── prompt.ts      # 컨텍스트 → 프롬프트 (LLM 엔진 공용)
│   │   └── engines/
│   │       ├── types.ts   # DecisionEngine 인터페이스
│   │       └── ollama.ts  # 헬스체크, chat 호출, abort
│   ├── tray.ts
│   └── preload.ts
├── src/
│   ├── overlay/           # 페이지(index.html) + Ghost, MischiefGauge, StatusText, useFollow
│   ├── demo/              # DemoButtons, explode 연출
│   ├── debug/             # (TARGET)
│   ├── audio/boo.ts
│   ├── sprites/           # pixel matrix (MIN) / sheet (TARGET)
│   └── shared/ipc.ts      # IPC 채널 계약 (main·preload·renderer 공용)
├── docs/PRD.md
├── README.md
├── LICENSE
└── package.json
```

### 7.5 결정 엔진 계층 (확장 대비)

MVP는 Ollama 엔진 하나만 구현하지만, 나중에 jev(TypeSafe)·다른 로컬 런타임·룰 엔진을 붙일 때 **`engines/`에 파일 하나만 추가**하면 되도록 경계를 나눈다.

```ts
// electron/ai/engines/types.ts
interface DecisionEngine {
  id: string // 'ollama' | 'jev' | ...
  kind: 'open-local' | 'hosted' // 제출 빌드는 open-local만 허용
  health(): Promise<'ok' | 'offline' | 'model_missing'>
  decide(ctx: DecisionContext, signal: AbortSignal): Promise<{ raw: string; latencyMs: number }>
}
```

| 계층                      | 아는 것                                                         | 모르는 것                |
| ------------------------- | --------------------------------------------------------------- | ------------------------ |
| `mischief.ts` (상태 머신) | `decide(ctx)` → `DecisionRecord`                                | 어떤 엔진·모델인지       |
| `decide.ts`               | 엔진 선택, Zod 검증, targetId 검증, 재시도, 폴백, `source` 기록 | HTTP·프롬프트 세부       |
| `engines/*`               | 각 런타임의 호출 방식                                           | 상태 머신, 폴백 정책, UI |

규칙

- 검증·폴백·`source` 기록은 `decide.ts` 한 곳에만 둔다. 엔진이 바뀌어도 안전 보장은 그대로다.
- `DecisionRecord`에 `engine: string` 필드를 추가해 디버그 패널·로그에서 어떤 엔진이 골랐는지 보인다.
- 엔진은 `SPOOKY_ENGINE` 환경변수(기본 `ollama`)로 선택한다. 유료(`kind:'hosted'`) 엔진은 MVP에서 구현하지 않으며, 추가할 때도 기본값이 될 수 없고 명시적 opt-in + 비용 상한을 둔다.

---

## 8. UI 규격

| 요소        | 규격                                                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| 유령        | 표시 64×64px(16×16 ×4), nearest-neighbor, 흰 몸통 + 진회색 외곽선 + 오른쪽에 몰린 점눈 + 분홍 입 + 물결 하단 + 바닥 그림자 |
| 게이지      | 유령 상단 중앙, 48×6px, 1px 검은 외곽선, 모서리 라운드 0~1px                                                               |
| 상태 텍스트 | 게이지 위 4px, 픽셀 폰트 10px, 흰 글자 + 검은 외곽선(text-shadow)                                                          |
| 애니메이션  | 6~12FPS 스프라이트, 이동은 rAF                                                                                             |
| 데모 창     | 420×280px, 버튼 3개 가로 배치, 다크 배경 (유령의 흰색이 잘 보이도록)                                                       |

---

## 9. 비기능 요구사항

| 영역   | 기준                                                                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 성능   | 오버레이 렌더 30FPS 이상, AI 추론 중에도 추적이 멈추지 않음, AI 호출은 게이지 사이클당 최대 2회(재시도 포함)                                |
| 리소스 | 유휴 시 CPU 5% 이하 목표 (M 시리즈 기준), 모델은 첫 호출 후 Ollama keep-alive에 맡김                                                        |
| 보안   | `contextIsolation:true`, `nodeIntegration:false`, `sandbox:true`, IPC 화이트리스트, 원격 URL 로드 금지(로컬 파일만), Ollama는 `127.0.0.1`만 |
| 안전   | 행동은 허용 목록(BOO·EXPLODE)만, targetId는 데모 창이 보고한 id만, 외부 앱·파일 접근 코드 없음                                              |
| 사용성 | 클릭 통과, 커서 가림 방지, 화면 밖 이동 방지, 종료 수단 항상 노출, 기본 볼륨 30%                                                            |

---

## 10. 완료 기준 (Definition of Done — MIN 기준)

- [ ] `npm install && npm run dev`로 실행된다 (README 그대로 따라 했을 때)
- [ ] 데스크톱 위에 픽셀 유령이 보이고 커서를 따라다닌다
- [ ] 유령 아래를 클릭해도 아래 앱이 정상 반응한다
- [ ] 게이지가 자동 충전되고, 100에서 **실제 Ollama 호출**이 일어난다 (로그로 확인)
- [ ] 모델 결정으로 BOO와 EXPLODE가 **각각 1회 이상** 실행된 것을 확인했다 (`source:'model'`)
- [ ] EXPLODE된 버튼은 부서진 채 남고, Rebuild로 세 버튼이 모두 되살아난다
- [ ] Ollama를 끈 상태로 실행해도 크래시 없이 `AI offline`으로 동작한다
- [ ] 트레이에서 Pause·Mute·Quit이 동작한다
- [ ] 5분 연속 실행 중 크래시 없음
- [ ] GitHub public 레포에 소스·MIT LICENSE·README(모델 pull 방법 포함)·데모 GIF
- [ ] DEV 챌린지 제출 글 게시

---

## 11. Open Questions — 구현 착수 전 확정

| ID   | 질문                                                                  | 제안 기본값                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 상태                 |
| ---- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| OQ-1 | DEV 챌린지 Week 4 제출 마감 일시                                      | **2026-10-31 23:59 PDT = 2026-11-01 15:59 KST** (공식 페이지는 날짜만 표기, 시각·시간대는 검색 결과 기준이라 마진 확보). 2026-10-31 17:05 KST 기준 약 23시간 남음 → MIN 확정, TARGET은 여유분만. 글쓰기 품질 가중치가 가장 높으므로 제출 글에 최소 1.5시간 배정                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | ✅ 확인 (2026-10-31) |
| OQ-2 | 레포 위치·이름·GitHub 공개 시점                                       | `~/repository/spooky`, GitHub `spooky`, MIN 동작 확인 후 public                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | ✅ 확정 (2026-10-31) |
| OQ-3 | 레퍼런스 이미지를 레포에 넣을지, 그 이미지로 스프라이트를 직접 그릴지 | MIN은 코드 픽셀로 레퍼런스 형태를 따라 그림, TARGET에서 PNG                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | ✅ 확정 (2026-10-31) |
| OQ-4 | 모델 확정                                                             | **무료·오픈 웨이트만**: Ollama 로컬 Qwen 계열 1~2B. jev(TypeSafe 유료 호스팅)는 챌린지 규정상 제외하되, 나중에 붙일 수 있게 **결정 엔진 계층을 분리**(§7.5). 실측 후 `qwen3:1.7b` 확정 (2026-10-31: p50 586ms·16/16 유효, 비교 후보 qwen2.5:1.5b는 EXPLODE 비율이 낮음)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | ✅ 확정 (2026-10-31) |
| OQ-5 | Ollama 미연결 시 정책                                                 | 자동 장난 중지(§6). 데모 영상에서 "폴백이 아니라 진짜 모델 결정"을 보장하기 위함                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | ✅ 확정 (2026-10-31) |
| OQ-6 | 오버레이 방식                                                         | 전체 화면 클릭 통과 창 1개 + 데모 창 분리(§4 FR-01)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | ✅ 확정 (2026-10-31) |
| OQ-7 | EXPLODE 대상 범위                                                     | 자체 데모 창 버튼만. 외부 화면 시각 효과는 MAX                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | ✅ 확정 (2026-10-31) |
| OQ-8 | 외부 앱 버튼 위 화면 연출 (읽기 전용)                                 | **허용 (2026-10-31 사용자 결정)**: macOS 손쉬운 사용 API로 **반경 120px 안에서 커서에 가장 가까운** 요소(button·input·label/span 글씨·svg 아이콘)의 종류·라벨·위치만 읽어(입력칸에 입력된 값은 읽지 않고 비밀번호 칸은 제외, 글씨·아이콘이 버튼 안이면 버튼 우선. 대상 확장·최근접 선택은 2026-10-31~11-01 사용자 요청). 폭발과 **동시에** 그 요소의 글씨를 유령 목소리로 읽는다 — macOS `say`(영어 Junior·한글 Yuna)로 WAV를 만들어 Web Audio로 아주 높은 음(1.45배 재생, say는 분당 131단어로 늦춰 들리는 속도 190단어)·떨림을 입힘(울림은 거의 없음, 메아리는 두 번 말하는 것처럼 들려 제거, 볼륨 0.35) — 귀엽고 빠르게(2026-11-01 사용자 요청). 글씨는 임시 파일로 넘기고 바로 삭제, Mute면 생략, 말끝에 ?를 붙여 억양을 올림(2026-11-01 사용자 요청). 읽는 글씨와 모델 라벨은 **최대 4단어·30자를 단어 경계에서** 잘라 중간에 끊기지 않게 한다 (2026-11-01 사용자 요청) 모델 컨텍스트에 넣고, EXPLODE를 고르면 오버레이에 폭발만 그린다. 외부 요소를 누르거나 비활성화하지 않는다. 트레이 토글로 opt-in(기본 꺼짐), 권한이 없으면 데모 창만 대상. 읽은 글씨는 로컬 모델에만 전달하고 로그에서는 가린다 | ✅ 확정 (2026-10-31) |

---

## 12. 향후 로드맵

| 버전   | 테마                | 주요 항목                                                                  |
| ------ | ------------------- | -------------------------------------------------------------------------- |
| v0.1.x | Polish              | MAX 항목, 패키징, 멀티 모니터 확장                                         |
| v0.2   | Personality         | 감정 상태, 성격별 행동 확률, 사용자 행동 반응, 표정 확장                   |
| v0.3   | Haunted Desktop     | 외부 화면 시각 효과, 주변 창 인지, 대상 선택 알고리즘                      |
| v0.4   | Autonomous Pet      | 장기 기억, 시간대별 행동, 자율 탐색, 커스터마이징                          |
| v1.0   | Open Ghost Platform | 사용자 캐릭터, 행동 플러그인(허용 목록 확장 API), 모델 교체, 커뮤니티 공유 |

---

## 13. 성공 지표 (Hacktoberfest MVP)

| 지표           | 목표                                                 |
| -------------- | ---------------------------------------------------- |
| 실제 모델 결정 | 데모 중 `source:'model'` 비율 100% (폴백 0회)        |
| 행동 종류      | BOO·EXPLODE 2종 모두 영상에 등장                     |
| 버튼 상태      | 부서진 버튼 유지 100%, Rebuild 후 정상 100%          |
| 안정성         | 영상 촬영 중 크래시 0회, 5분 연속 실행               |
| 결정 지연      | p50 2초 이하 (THINKING이 데모 흐름을 끊지 않을 정도) |
| 공개           | GitHub public + DEV 제출 기한 내                     |

---

## 14. 제출 계획

**제출물:** public 레포 · README · MIT LICENSE · 30~60초 GIF/영상 · DEV 제출 글

**챌린지 규정 (공식 페이지, 2026-10-31 확인)**

- 기간: 2026-10-26 ~ 2026-10-31 (23:59 PDT 추정), 수상 발표 11월 2일 주
- 오픈소스 AI(오픈 웨이트 모델·오픈소스 하네스·로컬 추론)가 **프로젝트를 동작하게 하는 핵심**이어야 함 → Ollama + Qwen 로컬 추론이 충족
- 심사: **Writing Quality(가중치 최대)** · 주제 적합성 · 창의성 · 기술 완성도 · 파트너 기술 사용(선택)
- 글 템플릿: What I Built / Demo / Code / How I Built It / **Why open innovation matters**(필수) / My Agent Session·The Spirit of It(선택), 참가 카테고리 명시

**DEV 글에서 강조할 점**

1. System 1 — 1회 호출로 즉흥 결정, 스키마로 행동을 묶어 "자유롭지만 안전한" 에이전트
2. 오픈 웨이트 모델을 로컬에서 실제 행동 제어에 사용 (클라우드 없음)
3. 투명 클릭 통과 오버레이 + React UI
4. `source: 'model' | 'fallback'` 기록 — AI가 실제로 골랐는지 숨기지 않는 설계
5. 샌드박스 장난 — 허용 목록·대상 id 검증으로 외부 앱은 절대 건드리지 않음

**구현 순서 (MIN)**

| #   | 작업                                                                | 예상              |
| --- | ------------------------------------------------------------------- | ----------------- |
| 1   | 레포 스캐폴드 (electron-vite + React + TS), 오버레이 창 + 클릭 통과 | 40분              |
| 2   | 코드 픽셀 유령 + 커서 추적                                          | 40분              |
| 3   | 게이지 + Mischief 상태 머신 (main) + 상태 텍스트                    | 30분              |
| 4   | Ollama 헬스체크 + chat + Zod + 폴백                                 | 40분              |
| 5   | BOO (Web Audio + 얼굴)                                              | 20분              |
| 6   | 데모 창 + 좌표 계약 + EXPLODE + Rebuild                             | 45분              |
| 7   | 트레이 (Pause·Mute·Quit)                                            | 15분              |
| 8   | README · LICENSE · GIF 촬영 · DEV 글                                | 45분              |
|     | **합계**                                                            | **약 4시간 15분** |
