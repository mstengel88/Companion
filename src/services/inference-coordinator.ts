import type { WorkflowProfile } from "../types/domain.js";

interface OllamaRuntime {
  unload(): Promise<{ ok: boolean; error?: string }>;
}

export interface CoordinatorStatus {
  mode: "auto" | "off";
  busy: boolean;
  lastHandoffAt: string | null;
  lastHandoffError: string | null;
}

export class InferenceCoordinator {
  private queue = Promise.resolve();
  private busy = false;
  private lastHandoffAt: string | null = null;
  private lastHandoffError: string | null = null;

  constructor(private readonly ollama: OllamaRuntime, private readonly mode: "auto" | "off") {}

  runChat<T>(task: () => Promise<T>) {
    return this.serial(task);
  }

  runImage<T>(profile: WorkflowProfile, task: () => Promise<T>) {
    return this.serial(async () => {
      if (this.mode === "auto" && profile.mode === "comfyui") {
        const result = await this.ollama.unload();
        this.lastHandoffAt = new Date().toISOString();
        this.lastHandoffError = result.ok ? null : result.error ?? "Ollama did not confirm model unload.";
      }
      return task();
    });
  }

  status(): CoordinatorStatus {
    return { mode: this.mode, busy: this.busy, lastHandoffAt: this.lastHandoffAt, lastHandoffError: this.lastHandoffError };
  }

  private async serial<T>(task: () => Promise<T>): Promise<T> {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const result = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
    this.queue = this.queue.then(async () => {
      this.busy = true;
      try { resolve(await task()); }
      catch (error) { reject(error); }
      finally { this.busy = false; }
    });
    await this.queue;
    return result;
  }
}
