# Spooky 모델

판단에 쓰는 모델을 고르고 바꾸는 방법. 모델을 고른 이유는 [PRD §1.4](PRD.md#14-제약과-모델-선택).

## 어떤 모델을 쓰나

`SPOOKY_MODEL`을 지정하지 않으면 `qwen3:1.7b`를 쓴다(`electron/ai/engines/ollama.ts`의 `DEFAULT_OLLAMA_MODEL`). 지정하면 그 태그를 쓴다.

```bash
ollama pull qwen3:4b
SPOOKY_MODEL=qwen3:4b npm run dev
```

## 조건

- **로컬 Ollama 모델만.** `127.0.0.1`의 Ollama에만 연결한다. 클라우드 모델은 쓸 수 없다.
- **태그는 `ollama list`의 이름 그대로.** 시작할 때 목록의 이름과 정확히 비교한다. `llama3.2`라고 쓰면 목록의 `llama3.2:latest`와 달라 `Model missing`이 뜬다.
- **JSON 스키마 출력 지원.** 답의 형식을 Ollama `format`(structured outputs)으로 강제한다. 형식이 깨지면 BOO로 대신한다.

## 확인

- 실측한 모델은 `qwen3:1.7b`뿐이다. 다른 모델은 BOO만 고르거나, 대사가 길거나, 목록 맨 앞만 고르는 경향이 더 심할 수 있다.
- 판단 결과는 터미널의 `[spooky] decision` 로그로 본다([디버깅](debugging.md#터미널-로그)).
- 메모리·속도 예상은 [PRD §1.4 크기·양자화](PRD.md#14-제약과-모델-선택).

## 모델에 닿지 못할 때

Ollama가 꺼져 있거나 모델이 없으면 커서 추적만 하고 액션은 멈춘다. 머리 위에 `AI offline` / `Model missing`이 뜨고, 30초마다 다시 시도한다.
