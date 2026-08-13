import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppState } from "../types/domain.js";

const emptyState: AppState = {
  messages: [], memories: [], photos: [], references: [], style: null, lastAutoPhotoAt: null,
  proactive: { enabled: false, minimumIntervalMinutes: 240, quietHoursStart: 22, quietHoursEnd: 8 },
  lastProactiveAt: null
};

export class JsonStore {
  private queue = Promise.resolve();
  constructor(private readonly dataDir: string) {}

  private get file() { return path.join(this.dataDir, "state.json"); }

  async init() {
    await mkdir(this.dataDir, { recursive: true });
    try { await readFile(this.file, "utf8"); }
    catch { await this.write(emptyState); }
  }

  async read(): Promise<AppState> {
    const raw = await readFile(this.file, "utf8");
    return { ...emptyState, ...JSON.parse(raw) } as AppState;
  }

  async update(mutator: (state: AppState) => void | Promise<void>) {
    let result!: AppState;
    this.queue = this.queue.then(async () => {
      const state = await this.read();
      await mutator(state);
      await this.write(state);
      result = state;
    });
    await this.queue;
    return result;
  }

  private async write(state: AppState) {
    const temp = `${this.file}.tmp`;
    await writeFile(temp, JSON.stringify(state, null, 2), "utf8");
    await rename(temp, this.file);
  }
}
