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

The deterministic importer is intentionally small. `SemanticExtractor` in `src/services/extraction.ts` is the seam for a later local LLM or embedding-backed extraction pass. The original import is retained in `data/imports` even when the generic parser recognizes nothing.

`data/state.json` is portable and simple for one user. Before supporting multiple simultaneous users, replace `JsonStore` with SQLite or Postgres and add authentication.
