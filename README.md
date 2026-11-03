# Spooky

A pixel ghost that haunts your desktop. It follows your cursor, charges a mischief gauge,
and when the gauge is full a **local open-weight model** decides what prank to pull —
a cute `BOO`, or exploding a button or input in its own demo window.

> Started for the Hacktoberfest 2026 _Ghost in the Machine_ theme — now a personal project.
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
npm test   # state machine, model-output validation, text trimming (Vitest)
```

| Env                     | Default      | What it does                                                     |
| ----------------------- | ------------ | ---------------------------------------------------------------- |
| `SPOOKY_CHARGE_SECONDS` | `20`         | Seconds to fill the mischief gauge (use `8` for demo recordings) |
| `SPOOKY_MODEL`          | `qwen3:1.7b` | Any Ollama model tag                                             |

Each decision is logged to the terminal as `[spooky] decision {...}` with the context, the raw model output, latency, and whether it came from the model or a fallback.

Spooky lives in the menu bar (no Dock icon). Use the tray menu → **Quit Spooky** to exit.

## On-screen buttons (optional)

Turn on **React to On-Screen Buttons** in the menu bar. With macOS Accessibility permission, Spooky looks within 120px of your cursor in other apps and picks the nearest button, input, text (label/span) or icon (svg) — its role, label and position, nothing else — and gives that to the model as one more target. It never reads what you typed into an input, and skips password fields entirely. If the model picks it, Spooky flies over and draws an explosion while reading its text aloud in a ghostly voice (macOS `say` + echo/reverb, skipped when muted) — and a scorch mark **on top of** it. The real element is never clicked, disabled or changed.

- Off by default. Without the permission Spooky only haunts its demo window.
- Labels go to the local model only; logs show `[on-screen element]` instead.
- Rebuilding an ad-hoc signed app resets the Accessibility permission. Create a self-signed **Code Signing** certificate named `Spooky Dev` in Keychain Access once, and `npm run build:mac` signs with it so the permission survives rebuilds.
- Building it needs Xcode Command Line Tools (`swiftc`). `npm run dev` compiles `native/ax-probe.swift` automatically.

## Safety

Spooky only breaks buttons in its own demo window. Other apps are read-only (and only when you turn on on-screen buttons): it never clicks or changes them,
never reads or writes your files, and only talks to Ollama on `127.0.0.1`.

## License

[MIT](LICENSE)
