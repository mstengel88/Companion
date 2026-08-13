# Emily AI Companion v5.5

A private, local-first companion app built around **Emily**, a fictional 43-year-old adult character. Emily is polite and adventurous, initially shy, and has a playful wild streak. She likes snowboarding and wake surfing.

v5.5 connects browser chat to a local Ollama model and routes structured photo requests to either a mock provider or a user-supplied generic ComfyUI workflow. The code contains no explicit-content model, prompt pack, or workflow selection.

## Included in v5.5

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
- Installable phone-app metadata, home-screen icon, and an HTTPS-capable offline shell
- Mac LAN start and status helpers
- Optional PIN protection with signed 30-day sessions, login throttling, and a mobile unlock screen
- Warm, Flirty, and Spicy relationship-tone controls for consensual adult conversation
- Query-relevant memory retrieval, imported writing-style guidance, and a transparent context preview
- Safer conversation migration with nested/ChatGPT-style JSON, HTML, TXT, stable IDs, and repeat-import deduplication
- Authenticated JSON backup, non-destructive message/memory restore, and manual memory entry
- macOS login-service installation with automatic restart, health reporting, local logs, and recoverable uninstall
- Private Tailscale HTTPS access for the phone away from home Wi-Fi, without router port forwarding
- Confirmed phone-friendly controls to clear a conversation, forget memories, remove imported style, and delete individual local photos or references
- Bounded recent-chat context with compact older-message continuity excerpts and a transparent context-size preview
- Phone photo controls for choosing an Emily reference, seeing live local-renderer status and progress, and retrying failed or legacy mock requests
- Gallery actions to open or save completed images, reload prior settings for adjustment, and render non-destructive new-seed variations
- Renderer-aware chat replies with queued, completed, or failed photo status shown directly beneath Emily's message
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

To serve the app to a phone on the same trusted Wi-Fi network:

```bash
./scripts/start-mac-lan.sh
```

The script prints the current phone URL. Check a running host with `./scripts/status-mac-lan.sh`. On iPhone, open the phone URL in Safari, tap **Share**, then **Add to Home Screen**. Service-worker offline caching requires HTTPS on non-localhost addresses; the home-screen web app itself remains usable over trusted-LAN HTTP while the Mac host is online.

To keep Emily running after this terminal closes and restart her automatically when you log into the Mac:

```bash
./scripts/install-mac-service.sh
./scripts/status-mac-lan.sh
```

Logs are written under `data/logs/`. To stop automatic startup, run `./scripts/uninstall-mac-service.sh`; it moves the service definition to Trash and leaves all project data untouched.

## Private phone access away from Wi-Fi

Install and sign in to [Tailscale for macOS](https://tailscale.com/download/mac) and install Tailscale on the phone under the same account. Then run:

```bash
./scripts/setup-private-access.sh
./scripts/status-private-access.sh
```

The setup script uses Tailscale Serve to provision a private HTTPS address that proxies only to `127.0.0.1:3000`. It does not enable Funnel and does not make Emily public. Keep PIN protection enabled. Disable only the HTTPS proxy with `./scripts/disable-private-access.sh`.

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

Nested JSON and ChatGPT-style `mapping → message → author/content.parts` exports are also recognized. HTML accepts role-tagged blocks such as `data-role="user"` / `data-role="emily"`, with labeled transcript fallback. TXT accepts `Me: ...` and `Emily: ...` lines. Unknown formats are safely retained in `data/imports` and produce a warning instead of discarding the source. Stable imported IDs prevent duplicate messages when the same export is loaded again.

## Configuration

Copy `.env.example` to `.env`. Notable values:

- `HOST=127.0.0.1`: local-only binding; keep this default initially.
- `OLLAMA_MODEL=qwen2.5:7b`: conversational model.
- `COMFYUI_PROFILE=mock`: workflow profile ID.
- `OLLAMA_KEEP_ALIVE=5m`: normal chat-model residency before an image handoff.
- `GPU_HANDOFF=auto`: unload the Ollama model before a real ComfyUI job; use `off` only when the models fit together.
- `PHOTO_ROUTING=auto`: route direct/contextual photo requests from chat.
- `AUTO_PHOTO_COOLDOWN_MINUTES=30`: avoid repeated automatic queues.
- `AUTH_MODE=off`: set to `pin` when serving beyond localhost.
- `APP_PIN`: local unlock PIN; use at least four characters.
- `AUTH_SECRET`: random secret of at least 32 characters used to sign session cookies. Never commit the real value.
- `TRUST_PROXY=loopback`: use this only when a local proxy such as Tailscale Serve terminates HTTPS; it lets HTTPS sessions receive Secure cookies without trusting spoofed proxy headers from LAN devices.

## Validate

```bash
npm run check
```

## Privacy and scope

- Emily is always represented as a fictional adult, age 43.
- Spicy mode permits consensual adult erotic text when the user initiates it or the conversation mutually develops that way; it excludes minors, coercion, incapacity, exploitation, and sexualized real-person likenesses.
- The app makes no claim that Emily is a real person or that imported conversations literally continue another person's identity.
- Reference images, conversations, and photos stay local by default and are Git-ignored.
- JSON backups contain conversation and memory content plus settings and media metadata. They do not contain image binaries, the PIN, or the signing secret; store backups privately.
- PIN authentication is available for trusted-LAN access. It is not a replacement for HTTPS when traffic crosses an untrusted network.
- No image checkpoint is redistributed. Verify the license, consent implications, and legality of any model, workflow, or reference material you choose locally.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for extension points.
