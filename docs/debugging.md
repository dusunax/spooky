# Spooky 디버깅

모델이 실제로 골랐는지, 화면 요소를 찾았는지 확인하는 방법을 모은다. 제품 요구사항은 [`PRD.md`](PRD.md).

## 환경 변수

| 변수                         | 지정하지 않으면 | 하는 일                                                        |
| ---------------------------- | --------------- | -------------------------------------------------------------- |
| `SPOOKY_CHARGE_SECONDS`      | 트레이 설정 값  | 시작할 때만 게이지 충전 시간(초)을 덮어쓴다. 데모 촬영에는 `5` |
| `SPOOKY_MODEL`               | `qwen3:1.7b`    | 다른 Ollama 모델 태그로 바꾼다                                 |
| `SPOOKY_DEBUG_SCREEN_TARGET` | 꺼짐            | `1`이면 화면 요소 강제 모드 (아래)                             |

## 화면 요소 강제 모드

`SPOOKY_DEBUG_SCREEN_TARGET=1`로 실행한다.

- 데모 창 버튼을 대상에서 뺀다.
- 커서 근처 화면 요소를 찾으면 모델을 거치지 않고 항상 그 요소를 폭파한다. 기록은 `source: 'debug'`, 상태 텍스트는 `Action: EXPLODE → that one (debug)`.
- 못 찾으면 평소처럼 모델에 묻는다.

화면 요소 탐색·폭발 위치·목소리를 모델 결과와 상관없이 반복해서 확인할 때 쓴다. 메뉴 막대에서 **React to On-Screen Buttons**가 켜져 있고 손쉬운 사용 권한이 있어야 한다.

## 터미널 로그

`npm run dev`는 터미널에 바로 찍힌다. 설치한 앱은 로그 파일로 받는다.

```bash
open -n /Applications/Spooky.app --env SPOOKY_DEBUG_SCREEN_TARGET=1 --stdout /tmp/spooky.log --stderr /tmp/spooky.log
```

| 로그                                                | 언제                    | 내용                                                                                      |
| --------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------- |
| `[spooky] engine <label>: <health>`                 | 시작                    | 엔진 상태 `ok` / `offline` / `model_missing`                                              |
| `[spooky] accessibility trusted — app: … helper: …` | 시작                    | 앱 본체와 Swift 도우미의 권한 판정. 둘이 다르면 도우미 서명 문제다                        |
| `[spooky] screen probe <status> …`                  | 판단마다 (화면 요소 켬) | `found`면 요소 종류·역할·앱·크기·탐색 시간, `none`이면 못 찾은 이유. 글씨는 남기지 않는다 |
| `[spooky] decision {…}`                             | 판단마다                | 컨텍스트, 모델 원본 출력, 행동, 대사, 엔진, `source`, 폴백 이유, 지연(ms)                 |
| `[spooky] debug: forcing EXPLODE …`                 | 강제 모드               | 모델을 건너뛰었다                                                                         |
| `[spooky] voice synthesis failed …`                 | 목소리 실패             | `say` 오류. 폭발은 목소리 없이 진행된다                                                   |

`decision` 로그에서 화면 요소 라벨은 `[on-screen element]`로 가린다.

## 손쉬운 사용 권한 유지

ad-hoc 서명으로 다시 빌드하면 macOS가 다른 앱으로 보고 손쉬운 사용 권한을 풀어 버린다. 키체인 접근에서 `Spooky Dev`라는 자체 서명 **코드 서명** 인증서를 한 번 만들어 두면, `npm run build:mac`이 그 인증서로 서명해 다시 빌드해도 권한이 유지된다.

## 트레이 도구

- **Test Ghost Voice**: 손쉬운 사용 권한 없이 영어·한국어 샘플을 유령 목소리로 번갈아 재생한다.
- **Rebuild Demo Buttons**: 부서진 데모 버튼을 되살린다.

## 디버그 패널 (예정)

마지막 입력 컨텍스트, 원본 응답, 검증 결과, 지연, `source`를 보여 주는 창. 아직 없다 — [PRD §12](PRD.md#12-향후-로드맵).
