# Ghosty

A pixel ghost that haunts your desktop. It follows your cursor, charges a mischief gauge,
and when the gauge is full a **local open-weight model** decides what prank to pull —
a cute `BOO`, or exploding a button in its own demo window.

> Hacktoberfest 2026 · DEV Open-Source AI Challenge Week 4 — _Ghost in the Machine_
> Status: early scaffold. See [`docs/PRD.md`](docs/PRD.md) for the plan.

## Requirements

- macOS
- Node.js 20.19+
- [Ollama](https://ollama.com) (model setup will be documented once the model is pinned)

## Run

```bash
npm install
npm run dev
```

Ghosty lives in the menu bar (no Dock icon). Use the tray menu → **Quit Ghosty** to exit.

## Safety

Ghosty only touches buttons in its own demo window. It never interacts with other apps,
never reads or writes your files, and only talks to Ollama on `127.0.0.1`.

## License

[MIT](LICENSE)
