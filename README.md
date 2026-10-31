# Spooky

A pixel ghost that haunts your desktop. It follows your cursor, charges a mischief gauge,
and when the gauge is full a **local open-weight model** decides what prank to pull —
a cute `BOO`, or exploding a button in its own demo window.

> Hacktoberfest 2026 · DEV Open-Source AI Challenge Week 4 — _Ghost in the Machine_
> Status: early scaffold. See [`docs/PRD.md`](docs/PRD.md) for the plan.

## Requirements

- macOS
- Node.js 20.19+
- [Ollama](https://ollama.com) 0.5+ (structured outputs)

## Model setup

Spooky's decisions come from [Qwen3 1.7B](https://ollama.com/library/qwen3) (Apache-2.0), running locally through Ollama.

```bash
ollama pull qwen3:1.7b
ollama serve   # skip if the Ollama app is already running
```

If Ollama is not running or the model is missing, Spooky keeps following your cursor but stops pranking and shows `AI offline` / `Model missing`.

## Run

```bash
npm install
npm run dev
```

| Env                     | Default      | What it does                                                     |
| ----------------------- | ------------ | ---------------------------------------------------------------- |
| `SPOOKY_CHARGE_SECONDS` | `20`         | Seconds to fill the mischief gauge (use `8` for demo recordings) |
| `SPOOKY_MODEL`          | `qwen3:1.7b` | Any Ollama model tag                                             |

Each decision is logged to the terminal as `[spooky] decision {...}` with the context, the raw model output, latency, and whether it came from the model or a fallback.

Spooky lives in the menu bar (no Dock icon). Use the tray menu → **Quit Spooky** to exit.

## Safety

Spooky only touches buttons in its own demo window. It never interacts with other apps,
never reads or writes your files, and only talks to Ollama on `127.0.0.1`.

## License

[MIT](LICENSE)
