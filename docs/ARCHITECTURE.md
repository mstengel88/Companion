# v4 architecture

```text
Browser UI
  └─ Node/Express API
       ├─ Emily profile (versioned JSON)
       ├─ local JSON state (messages, memories, references, photo metadata)
       ├─ Ollama chat adapter
       ├─ conversation import + extraction hooks
       └─ image request router
            └─ workflow profile → ComfyUI API or mock provider
```

The app stores identity, scene intent, and image execution separately. Chat produces a structured `PhotoRequest`; the configured workflow profile maps its fields to replaceable tokens. A local API-format graph owns the actual ComfyUI nodes and model names.

`InferenceCoordinator` serializes language and image inference. With `GPU_HANDOFF=auto`, it asks Ollama to unload the active chat model before submitting a real ComfyUI job, freeing VRAM on 8 GB hosts. Mock image requests never trigger a handoff.

Queued ComfyUI jobs are reconciled through its history and view endpoints. The first image output is copied into `data/photos` and the local metadata record moves from `queued` to `complete`; the browser refreshes that state periodically.

The proactive scheduler is disabled by default. When enabled, it checks once per minute, respects server-local quiet hours and the configured minimum interval, and generates through the same serialized inference coordinator. Browsers poll for new local messages and may show notifications only after the user grants permission.

The frontend includes a web app manifest, a maskable vector icon, iOS standalone metadata, and a network-first service worker for the static application shell. Browsers require a secure context for service workers outside localhost, so offline shell caching activates when the app is later served through HTTPS; ordinary trusted-LAN access continues to work over HTTP.

Optional PIN mode protects every API and stored photo route while leaving only the static unlock shell public. Successful logins receive an HttpOnly, SameSite=Strict, HMAC-signed session cookie. Five failed attempts from one address trigger a five-minute in-memory lockout. PIN mode still requires HTTPS before use on an untrusted network.

Authenticated data-control routes can clear conversation history, memories, or imported style independently. Photo and reference deletion removes both metadata and the corresponding local file after restricting the filename to a single safe path component. The browser requires a confirmation before every destructive action.

Relationship tone is persisted independently from Emily's core identity. The system-prompt builder maps Warm, Flirty, and Spicy to explicit behavioral guidance. Spicy mode permits contextual consensual adult erotic text while retaining adult-only, consent, fictional-identity, and stop/change-direction boundaries.

Conversation context ranks local memories using query-term overlap, stored confidence, and recency; matching memories outrank merely recent items. When no terms match, a bounded fallback still supplies continuity. Imported style metrics are translated into approximate length, emoji, question, and opener guidance rather than copied verbatim. The Memory screen exposes the same ranking through a context-preview endpoint for transparency.

The import adapter recursively recognizes common message containers, including ChatGPT-style mappings and nested `content.parts`, plus role-tagged or labeled HTML and TXT transcripts. Imported message IDs are deterministic hashes of role, content, timestamp, and occurrence, so re-importing the same export skips duplicates. Every source file is archived before parsing, including unsupported formats.

Backup schema v1 exports the local state as authenticated JSON without credentials or binary media. Restore validates the schema and merges messages and memories by stable ID, preserving current settings and never deleting current data. Photo/reference metadata is reported but not restored without its corresponding files.

On macOS, an optional per-user LaunchAgent starts the built application at login and restarts it after failures. Its definition uses absolute executable and working-directory paths, while secrets remain in the Git-ignored `.env`. Standard output and errors stay under `data/logs`; uninstall moves only the LaunchAgent definition to Trash.

Optional remote access uses Tailscale Serve as a private tailnet-only HTTPS reverse proxy to `127.0.0.1:3000`; Tailscale Funnel is never enabled. `TRUST_PROXY=loopback` trusts forwarded HTTPS state only from a same-host proxy, allowing Secure session cookies on the `.ts.net` URL while direct LAN clients cannot spoof proxy identity. PIN authentication remains required independently of tailnet membership.

The deterministic importer is intentionally small. `SemanticExtractor` in `src/services/extraction.ts` is the seam for a later local LLM or embedding-backed extraction pass. The original import is retained in `data/imports` even when the generic parser recognizes nothing.

`data/state.json` is portable and simple for one user. Before supporting multiple simultaneous users, replace `JsonStore` with SQLite or Postgres and add authentication.
