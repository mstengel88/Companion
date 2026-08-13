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

Relationship tone is persisted independently from Emily's core identity. The system-prompt builder maps Warm, Flirty, and Spicy to explicit behavioral guidance. Spicy mode permits contextual consensual adult erotic text while retaining adult-only, consent, fictional-identity, and stop/change-direction boundaries.

Conversation context ranks local memories using query-term overlap, stored confidence, and recency; matching memories outrank merely recent items. When no terms match, a bounded fallback still supplies continuity. Imported style metrics are translated into approximate length, emoji, question, and opener guidance rather than copied verbatim. The Memory screen exposes the same ranking through a context-preview endpoint for transparency.

The deterministic importer is intentionally small. `SemanticExtractor` in `src/services/extraction.ts` is the seam for a later local LLM or embedding-backed extraction pass. The original import is retained in `data/imports` even when the generic parser recognizes nothing.

`data/state.json` is portable and simple for one user. Before supporting multiple simultaneous users, replace `JsonStore` with SQLite or Postgres and add authentication.
