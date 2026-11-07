# Spooky

[English](README.md) · **한국어**

데스크톱 위를 떠다니는 픽셀 유령. 커서를 따라다니며 장난 게이지를 채우고, 게이지가 차면 **로컬 오픈 웨이트 모델**이 `BOO`를 할지, 데모 창의 버튼·입력칸을 폭파할지 고른다.

> Hacktoberfest 2026 _Ghost in the Machine_ 테마로 시작한 개인 프로젝트.
> 상태: 초기 단계. 계획은 [`docs/PRD.md`](docs/PRD.md).

## 필요 환경

- macOS
- Node.js 20.19+
- [Ollama](https://ollama.com) 0.5+ (structured outputs)

## 모델 준비

판단은 Ollama로 로컬에서 돌리는 [Qwen3 1.7B](https://ollama.com/library/qwen3)(Apache-2.0)가 한다.

```bash
ollama pull qwen3:1.7b
ollama serve   # Ollama 앱이 이미 실행 중이면 생략
```

Ollama가 꺼져 있거나 모델이 없으면 커서 추적만 하고 장난은 멈춘다. 머리 위에 `AI offline` / `Model missing`이 뜬다.

## 실행

```bash
npm install
npm run dev
npm test   # 상태 머신, 모델 출력 검증, 글자 자르기 (Vitest)
```

| 환경 변수               | 기본값       | 설명                                      |
| ----------------------- | ------------ | ----------------------------------------- |
| `SPOOKY_CHARGE_SECONDS` | `20`         | 게이지가 차는 시간(초). 데모 녹화에는 `8` |
| `SPOOKY_MODEL`          | `qwen3:1.7b` | Ollama 모델 태그                          |

판단마다 터미널에 `[spooky] decision {...}` 로그가 남는다. 입력 컨텍스트, 모델 원본 출력, 지연 시간, `model`/`fallback` 구분이 들어 있다.

Dock 아이콘 없이 메뉴 막대에만 있다. 종료는 메뉴 막대 → **Quit Spooky**.

## 설정

메뉴 막대에서 **Mischief Every**(장난 주기), **Ears**(없음 · 토끼 · 고양이 · 곰), **BOO Sounds**, **Mute**를 바꾼다. 설정은 재실행 후에도 남는다.

## 화면 속 버튼 (선택)

메뉴 막대에서 **React to On-Screen Buttons**를 켠다. macOS 손쉬운 사용 권한을 주면 다른 앱에서 커서 반경 120px 안의 버튼, 입력칸, 글씨(label/span), 아이콘(svg) 중 가장 가까운 것을 찾아 모델의 대상 목록에 넣는다. 읽는 정보는 종류·라벨·위치 세 가지다. 입력칸에 쓴 내용은 읽지 않고, 비밀번호 칸은 건너뛴다.

모델이 그 요소를 고르면 유령이 날아가 요소 위에 폭발과 그을음을 그리고, 동시에 요소의 글씨를 높은 목소리로 읽는다(macOS `say`, Mute면 생략). 실제 요소는 클릭하거나 바꾸지 않는다.

- 기본값은 꺼짐. 권한이 없으면 데모 창만 대상으로 삼는다.
- 라벨은 로컬 모델에만 넘기고, 로그에는 `[on-screen element]`로 남긴다.
- ad-hoc 서명으로 다시 빌드하면 손쉬운 사용 권한이 풀린다. 키체인 접근에서 `Spooky Dev`라는 자체 서명 **코드 서명** 인증서를 한 번 만들어 두면 `npm run build:mac`이 그 인증서로 서명해 권한이 유지된다.
- 빌드에 Xcode Command Line Tools(`swiftc`)가 필요하다. `npm run dev`가 `native/ax-probe.swift`를 컴파일한다.

## 안전

상태를 바꾸는 폭파는 데모 창 안에서만 일어난다. 다른 앱은 화면 속 버튼을 켰을 때만 읽고, 클릭하거나 바꾸지 않는다. 파일을 읽거나 쓰지 않으며, 네트워크는 `127.0.0.1`의 Ollama만 쓴다.

## 라이선스

[MIT](LICENSE)
