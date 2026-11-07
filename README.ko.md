# Spooky

[English](README.md) · **한국어**

데스크톱에 사는 픽셀 유령이에요. 커서를 따라다니며 장난 게이지를 채우고, 게이지가 가득 차면 **로컬 오픈 웨이트 모델**이 어떤 장난을 칠지 정해요.
귀여운 `BOO`를 하거나, 자기 데모 창의 버튼이나 입력칸을 폭파해요.

> Hacktoberfest 2026 _Ghost in the Machine_ 테마로 시작했고, 지금은 개인 프로젝트예요.
> 상태: 초기 단계. 계획은 [`docs/PRD.md`](docs/PRD.md)에 있어요.

## 필요한 것

- macOS
- Node.js 20.19+
- [Ollama](https://ollama.com) 0.5+ (structured outputs)

## 모델 준비

Spooky의 판단은 Ollama로 로컬에서 돌리는 [Qwen3 1.7B](https://ollama.com/library/qwen3)(Apache-2.0)가 내려요.

```bash
ollama pull qwen3:1.7b
ollama serve   # Ollama 앱이 이미 떠 있으면 생략
```

Ollama가 꺼져 있거나 모델이 없으면, Spooky는 커서는 계속 따라다니지만 장난은 멈추고 `AI offline` / `Model missing`을 보여 줘요.

## 실행

```bash
npm install
npm run dev
npm test   # 상태 머신, 모델 출력 검증, 글자 자르기 (Vitest)
```

| 환경 변수               | 기본값       | 하는 일                                                  |
| ----------------------- | ------------ | -------------------------------------------------------- |
| `SPOOKY_CHARGE_SECONDS` | `20`         | 장난 게이지가 차는 데 걸리는 초 (데모 녹화에는 `8` 권장) |
| `SPOOKY_MODEL`          | `qwen3:1.7b` | 아무 Ollama 모델 태그                                    |

판단할 때마다 터미널에 `[spooky] decision {...}`이 찍혀요. 컨텍스트, 모델 원본 출력, 걸린 시간, 모델이 정했는지 대체 동작인지가 들어 있어요.

Spooky는 메뉴 막대에 살아요(Dock 아이콘 없음). 끄려면 트레이 메뉴 → **Quit Spooky**를 누르세요.

## 꾸미기

메뉴 막대에서 **Mischief Every**(장난 주기), **Ears**(없음 · 토끼 · 고양이 · 곰), **BOO Sounds**, **Mute**를 바꿀 수 있어요. 설정은 저장돼요.

## 화면 속 버튼 (선택)

메뉴 막대에서 **React to On-Screen Buttons**를 켜세요. macOS 손쉬운 사용 권한이 있으면, Spooky는 다른 앱에서 커서 주변 120px 안을 살펴 가장 가까운 버튼, 입력칸, 글씨(label/span), 아이콘(svg)을 골라요. 읽는 건 종류·라벨·위치뿐이고, 이걸 모델에게 대상 하나로 더 넘겨요. 입력칸에 입력한 내용은 절대 읽지 않고, 비밀번호 칸은 아예 건너뛰어요. 모델이 그걸 고르면 Spooky가 날아가서 그 **위에** 폭발과 그을음 자국을 그리고, 동시에 그 글씨를 유령 목소리로 읽어 줘요(macOS `say`를 높은 음으로, Mute면 생략). 실제 요소는 절대 누르거나 끄거나 바꾸지 않아요.

- 기본은 꺼져 있어요. 권한이 없으면 Spooky는 데모 창에서만 장난쳐요.
- 라벨은 로컬 모델에만 넘어가고, 로그에는 `[on-screen element]`로만 남아요.
- ad-hoc 서명으로 다시 빌드하면 손쉬운 사용 권한이 초기화돼요. 키체인 접근에서 `Spooky Dev`라는 이름의 자체 서명 **코드 서명** 인증서를 한 번 만들어 두면, `npm run build:mac`이 그걸로 서명해서 다시 빌드해도 권한이 유지돼요.
- 빌드에는 Xcode Command Line Tools(`swiftc`)가 필요해요. `npm run dev`가 `native/ax-probe.swift`를 자동으로 컴파일해요.

## 안전

Spooky가 부수는 건 자기 데모 창의 버튼뿐이에요. 다른 앱은 읽기만 하고(화면 속 버튼을 켰을 때만), 누르거나 바꾸지 않아요.
파일을 읽거나 쓰지 않고, `127.0.0.1`의 Ollama하고만 통신해요.

## 라이선스

[MIT](LICENSE)
