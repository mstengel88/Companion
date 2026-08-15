import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ImageService, locateQueueJob, replaceDeep } from "../src/services/comfyui.js";
import type { WorkflowProfile } from "../src/types/domain.js";

test("workflow placeholders preserve standalone numeric values", () => {
  const workflow = {
    seed: "__SEED__",
    text: "seed __SEED__ at __STRENGTH__",
    nested: ["__STRENGTH__"]
  };
  assert.deepEqual(replaceDeep(workflow, { __SEED__: 430208, __STRENGTH__: 0.9 }), {
    seed: 430208,
    text: "seed 430208 at 0.9",
    nested: [0.9]
  });
});

test("reports running and waiting ComfyUI queue positions", () => {
  const queue = {
    queue_running: [[1, "running-id"]] as [number, string][],
    queue_pending: [[2, "first-id"], [3, "second-id"]] as [number, string][]
  };
  assert.deepEqual(locateQueueJob(queue, "running-id"), { queueState: "running", queuePosition: 0, queueLength: 2 });
  assert.deepEqual(locateQueueJob(queue, "second-id"), { queueState: "waiting", queuePosition: 2, queueLength: 2 });
  assert.equal(locateQueueJob(queue, "missing-id"), null);
});

test("uploads stored references to ComfyUI before queueing a multi-reference workflow", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "emily-comfyui-"));
  const references = path.join(root, "data", "references");
  const photos = path.join(root, "data", "photos");
  const workflowFile = path.join(root, "workflow.json");
  await mkdir(references, { recursive: true });
  await writeFile(path.join(references, "emily-reference-1.jpg"), Buffer.from("reference"));
  await writeFile(path.join(references, "emily-reference-2.jpg"), Buffer.from("reference two"));
  await writeFile(workflowFile, JSON.stringify({
    2: { inputs: { seed: "__COMPANION_SEED__" }, class_type: "KSampler" },
    4: { inputs: { image: "__COMPANION_REFERENCE_IMAGE__" }, class_type: "LoadImage" },
    5: { inputs: { image: "__COMPANION_REFERENCE_IMAGE_2__" }, class_type: "LoadImage" }
  }));
  t.after(async () => rm(root, { recursive: true, force: true }));

  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  let submittedSeed: number | undefined;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/upload/image")) {
      assert.ok(init?.body instanceof FormData);
      return new Response(JSON.stringify({ name: (init.body.get("image") as File).name, type: "input" }), { status: 200 });
    }
    const submitted = JSON.parse(String(init?.body)) as { prompt: { 2?: { inputs?: { seed?: number } }; 4: { inputs: { image: string } }; 5: { inputs: { image: string } } } };
    submittedSeed = submitted.prompt[2]?.inputs?.seed;
    assert.equal(submitted.prompt[4].inputs.image, "emily-reference-1.jpg");
    assert.equal(submitted.prompt[5].inputs.image, "emily-reference-2.jpg");
    return new Response(JSON.stringify({ prompt_id: "prompt-1" }), { status: 200 });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const profile: WorkflowProfile = {
    id: "test", name: "Test", description: "", mode: "comfyui", workflowFile,
    placeholders: {}, capabilities: { referenceImage: true, poseControl: false, controlImage: false }
  };
  const service = new ImageService("http://comfy.test", root, references, photos);
  const result = await service.generate({ scene: "winter lodge" }, profile);
  assert.equal(result.comfyPromptId, "prompt-1");
  assert.ok(Number.isInteger(result.request.seed));
  assert.ok((result.request.seed ?? 0) >= 1 && (result.request.seed ?? 0) < 2_147_483_647);
  assert.equal(submittedSeed, result.request.seed);
  assert.deepEqual(calls, ["http://comfy.test/upload/image", "http://comfy.test/upload/image", "http://comfy.test/prompt"]);
});

test("marks an old queued request as retryable after ComfyUI loses its history", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "emily-comfyui-orphan-"));
  t.after(async () => rm(root, { recursive: true, force: true }));
  const service = new ImageService("http://comfy.test", root, root, root);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("{}", { status: 200 });
  t.after(() => { globalThis.fetch = originalFetch; });

  const record = await service.refresh({
    id: "orphaned",
    filename: "orphaned.json",
    createdAt: new Date(Date.now() - 11 * 60_000).toISOString(),
    status: "queued",
    workflowProfile: "test",
    prompt: "test",
    request: { scene: "test" },
    comfyPromptId: "missing-prompt"
  }, { queue_running: [], queue_pending: [] });

  assert.equal(record.status, "failed");
  assert.match(record.error ?? "", /restarted before completion/);
});
