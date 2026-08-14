import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PhotoRecord, PhotoRequest, WorkflowProfile } from "../types/domain.js";

type QueueEntry = [number, string, ...unknown[]];
export interface ComfyQueueSnapshot { queue_running?: QueueEntry[]; queue_pending?: QueueEntry[] }

export function locateQueueJob(snapshot: ComfyQueueSnapshot, promptId: string) {
  const running = snapshot.queue_running ?? [];
  const pending = snapshot.queue_pending ?? [];
  if (running.some((entry) => entry[1] === promptId)) {
    return { queueState: "running" as const, queuePosition: 0, queueLength: pending.length };
  }
  const index = pending.findIndex((entry) => entry[1] === promptId);
  if (index >= 0) return { queueState: "waiting" as const, queuePosition: index + 1, queueLength: pending.length };
  return null;
}

function buildPrompt(request: PhotoRequest) {
  return [
    "Emily, fictional 43-year-old adult woman",
    request.scene, request.activity, request.outfit, request.pose,
    request.expression, request.camera, request.environment
  ].filter(Boolean).join(", ");
}

export function replaceDeep(value: unknown, replacements: Record<string, string | number>): unknown {
  if (typeof value === "string") {
    if (Object.hasOwn(replacements, value)) return replacements[value];
    let output = value;
    for (const [key, replacement] of Object.entries(replacements)) output = output.replaceAll(key, String(replacement));
    return output;
  }
  if (Array.isArray(value)) return value.map((x) => replaceDeep(x, replacements));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replaceDeep(v, replacements)]));
  return value;
}

export class ImageService {
  constructor(
    private readonly comfyUrl: string,
    private readonly root: string,
    private readonly referencesDir: string,
    private readonly photosDir: string
  ) {}

  async generate(request: PhotoRequest, profile: WorkflowProfile): Promise<PhotoRecord> {
    const id = crypto.randomUUID();
    const prompt = buildPrompt(request);
    const base: PhotoRecord = {
      id, filename: `${id}.json`, createdAt: new Date().toISOString(), status: "queued",
      workflowProfile: profile.id, prompt, request
    };
    await mkdir(this.photosDir, { recursive: true });
    if (profile.mode === "mock") {
      const filename = `${id}.json`;
      await writeFile(path.join(this.photosDir, filename), JSON.stringify({ mock: true, prompt, request }, null, 2));
      return { ...base, filename, status: "mock" };
    }
    if (!profile.workflowFile) throw new Error(`Workflow profile ${profile.id} has no workflowFile`);
    const workflowPath = path.resolve(this.root, profile.workflowFile);
    const workflow = JSON.parse(await readFile(workflowPath, "utf8")) as unknown;
    const reference = request.referenceSlot ? await this.resolveReference(request.referenceSlot) : "";
    if (reference) await this.uploadReference(reference);
    const replacements: Record<string, string | number> = {
      "__COMPANION_PROMPT__": prompt,
      "__COMPANION_NEGATIVE__": "minor, child, teenager, low quality, distorted anatomy, extra fingers, watermark, text",
      "__COMPANION_SEED__": request.seed ?? 430208,
      "__COMPANION_WIDTH__": request.width ?? 832,
      "__COMPANION_HEIGHT__": request.height ?? 1216,
      "__COMPANION_REFERENCE_IMAGE__": reference,
      "__COMPANION_POSE_IMAGE__": request.poseImage ?? "",
      "__COMPANION_CONTROL_STRENGTH__": request.controlStrength ?? 0.75
    };
    const response = await fetch(`${this.comfyUrl}/prompt`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: replaceDeep(workflow, replacements), client_id: "ai-companion-v4" }),
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) throw new Error(`ComfyUI returned ${response.status}: ${await response.text()}`);
    const body = await response.json() as { prompt_id?: string };
    return { ...base, comfyPromptId: body.prompt_id };
  }

  async profileDiagnostics(profile: WorkflowProfile) {
    if (profile.mode === "mock") {
      return { ok: true, profile: profile.id, mode: profile.mode, workflowFile: null, foundPlaceholders: [], missingPlaceholders: [] };
    }
    if (!profile.workflowFile) {
      return { ok: false, profile: profile.id, mode: profile.mode, workflowFile: null, foundPlaceholders: [], missingPlaceholders: [], error: "No workflowFile is configured." };
    }
    const workflowPath = path.resolve(this.root, profile.workflowFile);
    try {
      const raw = await readFile(workflowPath, "utf8");
      JSON.parse(raw);
      const expected = Object.values(profile.placeholders);
      const found = expected.filter((token) => raw.includes(token));
      const missing = expected.filter((token) => !raw.includes(token));
      return {
        ok: missing.length === 0,
        profile: profile.id,
        mode: profile.mode,
        workflowFile: profile.workflowFile,
        foundPlaceholders: found,
        missingPlaceholders: missing,
        error: missing.length ? "The API-format workflow is valid JSON but is missing configured placeholders." : undefined
      };
    } catch (error) {
      return { ok: false, profile: profile.id, mode: profile.mode, workflowFile: profile.workflowFile, foundPlaceholders: [], missingPlaceholders: Object.values(profile.placeholders), error: String(error) };
    }
  }

  async queueSnapshot(): Promise<ComfyQueueSnapshot | null> {
    try {
      const response = await fetch(`${this.comfyUrl}/queue`, { signal: AbortSignal.timeout(5_000) });
      if (!response.ok) return null;
      return await response.json() as ComfyQueueSnapshot;
    } catch { return null; }
  }

  async refresh(record: PhotoRecord, queue: ComfyQueueSnapshot | null = null): Promise<PhotoRecord> {
    if (record.status !== "queued" || !record.comfyPromptId) return record;
    const response = await fetch(`${this.comfyUrl}/history/${encodeURIComponent(record.comfyPromptId)}`, {
      signal: AbortSignal.timeout(5_000)
    });
    if (!response.ok) return record;
    const history = await response.json() as Record<string, { status?: { status_str?: string }; outputs?: Record<string, { images?: Array<{ filename: string; subfolder?: string; type?: string }> }> }>;
    const job = history[record.comfyPromptId];
    const image = job?.outputs && Object.values(job.outputs).flatMap((output) => output.images ?? [])[0];
    if (!image) {
      if (job?.status?.status_str === "error") return { ...record, status: "failed", completedAt: new Date().toISOString(), queueState: undefined, queuePosition: undefined, queueLength: undefined, error: "ComfyUI reported a workflow error." };
      const queueJob = queue ? locateQueueJob(queue, record.comfyPromptId) : null;
      return queueJob ? { ...record, ...queueJob } : record;
    }
    const params = new URLSearchParams({ filename: image.filename, subfolder: image.subfolder ?? "", type: image.type ?? "output" });
    const fileResponse = await fetch(`${this.comfyUrl}/view?${params}`, { signal: AbortSignal.timeout(30_000) });
    if (!fileResponse.ok) return { ...record, status: "failed", completedAt: new Date().toISOString(), queueState: undefined, queuePosition: undefined, queueLength: undefined, error: `Could not retrieve ComfyUI output (${fileResponse.status}).` };
    const sourceExt = path.extname(image.filename).toLowerCase();
    const ext = [".png", ".jpg", ".jpeg", ".webp"].includes(sourceExt) ? sourceExt : ".png";
    const filename = `${record.id}${ext}`;
    await writeFile(path.join(this.photosDir, filename), Buffer.from(await fileResponse.arrayBuffer()));
    return { ...record, filename, status: "complete", completedAt: new Date().toISOString(), queueState: undefined, queuePosition: undefined, queueLength: undefined };
  }

  private async resolveReference(slot: string) {
    const entries = await import("node:fs/promises").then((fs) => fs.readdir(this.referencesDir));
    const file = entries.find((name) => name.startsWith(slot));
    if (!file) return "";
    return file;
  }

  private async uploadReference(filename: string) {
    const ext = path.extname(filename).toLowerCase();
    const mimeType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    const contents = await readFile(path.join(this.referencesDir, filename));
    const form = new FormData();
    form.append("image", new Blob([contents], { type: mimeType }), filename);
    form.append("type", "input");
    form.append("overwrite", "true");
    const response = await fetch(`${this.comfyUrl}/upload/image`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30_000)
    });
    if (!response.ok) throw new Error(`ComfyUI reference upload returned ${response.status}: ${await response.text()}`);
  }

  async health() {
    try {
      const response = await fetch(`${this.comfyUrl}/system_stats`, { signal: AbortSignal.timeout(3_000) });
      return { ok: response.ok, url: this.comfyUrl };
    } catch (error) { return { ok: false, url: this.comfyUrl, error: String(error) }; }
  }
}
