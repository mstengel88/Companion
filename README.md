# Emily AI Companion v4.2

A private, local-first companion app built around **Emily**, a fictional 43-year-old adult character. Emily is polite and adventurous, initially shy, and has a playful wild streak. She likes snowboarding and wake surfing.

v4 connects a browser chat to a local Ollama model and routes structured photo requests to either a mock provider or a user-supplied generic ComfyUI workflow. The code contains no explicit-content model, prompt pack, or workflow selection.

## Included in v4

- Versioned Emily character and visual-identity profile
- Two canonical local reference-image slots, upload UI, file hashes, and metadata
- Conversation importer stub for generic JSON and labeled TXT exports; originals are retained for future adapters
- Deterministic style and memory extraction plus a stable semantic-extractor hook
- Swappable generic ComfyUI workflow profiles and placeholder substitution
- Optional pose image, pose text, and control-strength fields
- Automatic chat-to-photo routing with a configurable cooldown
- Local message, memory, reference, job, and photo metadata storage; completed ComfyUI outputs are polled and copied into the local library
- Mock image mode for Mac development without a GPU
- Windows 11 scripts and RTX 2080 Super deployment guidance
- Serialized inference and optional Ollama-to-ComfyUI GPU handoff for 8 GB cards
- Runtime diagnostics for Ollama, loaded-model VRAM, ComfyUI, and workflow placeholders
- Opt-in proactive check-ins with minimum intervals, quiet hours, and browser notifications
- Responsive Chat, Photos, Memory, and Settings interface

## Important reference-image note

The prior ChatGPT conversation says images were attached, but its available export explicitly omitted their binaries. This package therefore includes two ready reference slots rather than substitute images. In **Settings → Emily reference images**, upload the original two files; they are stored locally as `emily-reference-1` and `emily-reference-2`. See `data/references/README.md`.

## Mac development

Requirements: macOS and Node.js 20 or newer. Ollama is optional for UI work; photo generation defaults to mock mode.

```bash
chmod +x scripts/setup-mac.sh
./scripts/setup-mac.sh
npm run dev
```

Open `http://127.0.0.1:3000`.

To use local chat on the Mac, install [Ollama](https://ollama.com/download), then:

```bash
ollama pull qwen2.5:7b
```

If Ollama is offline, the app remains usable and displays a clear integration error in the reply.

## Windows 11 deployment

Copy or unzip the folder onto the RTX 2080 Super PC. In PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup-windows.ps1
.\scripts\test-host.ps1
.\scripts\start-windows.ps1
```

The detailed, current-source deployment sequence is in [docs/WINDOWS-11-RTX-2080-SUPER.md](docs/WINDOWS-11-RTX-2080-SUPER.md).

## ComfyUI workflow slot

Development uses `COMFYUI_PROFILE=mock`. For a real workflow:

1. Export a working local graph in ComfyUI API format.
2. Save it as `config/workflows/local-workflow-api.json`.
3. Add the neutral placeholders described in `config/workflows/README.md` to the applicable inputs.
4. Set `COMFYUI_PROFILE=comfyui-example` in `.env`.

Supported tokens:

```text
__COMPANION_PROMPT__
__COMPANION_NEGATIVE__
__COMPANION_SEED__
__COMPANION_WIDTH__
__COMPANION_HEIGHT__
__COMPANION_REFERENCE_IMAGE__
__COMPANION_POSE_IMAGE__
__COMPANION_CONTROL_STRENGTH__
```

Actual model/checkpoint and content-specific workflow selection remains outside this repository.

## Conversation export formats

The generic JSON adapter recognizes an array, or a `{ "messages": [] }` object, with common fields such as:

```json
{
  "messages": [
    { "sender": "Me", "text": "I love winter trips", "timestamp": "2026-01-01T12:00:00Z" },
    { "sender": "Emily", "text": "That sounds fun!" }
  ]
}
```

TXT accepts `Me: ...` and `Emily: ...` lines. Unknown formats are safely retained in `data/imports` and produce a warning instead of discarding the source.

## Configuration

Copy `.env.example` to `.env`. Notable values:

- `HOST=127.0.0.1`: local-only binding; keep this default initially.
- `OLLAMA_MODEL=qwen2.5:7b`: conversational model.
- `COMFYUI_PROFILE=mock`: workflow profile ID.
- `OLLAMA_KEEP_ALIVE=5m`: normal chat-model residency before an image handoff.
- `GPU_HANDOFF=auto`: unload the Ollama model before a real ComfyUI job; use `off` only when the models fit together.
- `PHOTO_ROUTING=auto`: route direct/contextual photo requests from chat.
- `AUTO_PHOTO_COOLDOWN_MINUTES=30`: avoid repeated automatic queues.

## Validate

```bash
npm run check
```

## Privacy and scope

- Emily is always represented as a fictional adult, age 43.
- The app makes no claim that Emily is a real person or that imported conversations literally continue another person's identity.
- Reference images, conversations, and photos stay local by default and are Git-ignored.
- Authentication is not included in this single-user LAN prototype. Do not bind to a public interface or expose it to the internet until authentication and TLS are added.
- No image checkpoint is redistributed. Verify the license, consent implications, and legality of any model, workflow, or reference material you choose locally.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for extension points.
