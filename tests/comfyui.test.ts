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

test("uploads a stored reference to ComfyUI before queueing the workflow", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "emily-comfyui-"));
  const references = path.join(root, "data", "references");
  const photos = path.join(root, "data", "photos");
  const workflowFile = path.join(root, "workflow.json");
  await mkdir(references, { recursive: true });
  await writeFile(path.join(references, "emily-reference-1.jpg"), Buffer.from("reference"));
  await writeFile(workflowFile, JSON.stringify({ 4: { inputs: { image: "__COMPANION_REFERENCE_IMAGE__" }, class_type: "LoadImage" } }));
  t.after(async () => rm(root, { recursive: true, force: true }));

  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/upload/image")) {
      assert.ok(init?.body instanceof FormData);
      assert.equal((init.body.get("image") as File).name, "emily-reference-1.jpg");
      return new Response(JSON.stringify({ name: "emily-reference-1.jpg", type: "input" }), { status: 200 });
    }
    const submitted = JSON.parse(String(init?.body)) as { prompt: { 4: { inputs: { image: string } } } };
    assert.equal(submitted.prompt[4].inputs.image, "emily-reference-1.jpg");
    return new Response(JSON.stringify({ prompt_id: "prompt-1" }), { status: 200 });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const profile: WorkflowProfile = {
    id: "test", name: "Test", description: "", mode: "comfyui", workflowFile,
    placeholders: {}, capabilities: { referenceImage: true, poseControl: false, controlImage: false }
  };
  const service = new ImageService("http://comfy.test", root, references, photos);
  const result = await service.generate({ scene: "winter lodge", referenceSlot: "emily-reference-1" }, profile);
  assert.equal(result.comfyPromptId, "prompt-1");
  assert.deepEqual(calls, ["http://comfy.test/upload/image", "http://comfy.test/prompt"]);
});
