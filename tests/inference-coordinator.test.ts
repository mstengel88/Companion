import assert from "node:assert/strict";
import test from "node:test";
import { InferenceCoordinator } from "../src/services/inference-coordinator.js";
import type { WorkflowProfile } from "../src/types/domain.js";

const comfyProfile: WorkflowProfile = {
  id: "test", name: "Test", description: "", mode: "comfyui", workflowFile: "test.json",
  placeholders: {}, capabilities: { referenceImage: false, poseControl: false, controlImage: false }
};
const mockProfile: WorkflowProfile = { ...comfyProfile, id: "mock", mode: "mock" };

test("unloads Ollama before real ComfyUI work", async () => {
  const events: string[] = [];
  const coordinator = new InferenceCoordinator({ unload: async () => { events.push("unload"); return { ok: true }; } }, "auto");
  const result = await coordinator.runImage(comfyProfile, async () => { events.push("image"); return 42; });
  assert.equal(result, 42);
  assert.deepEqual(events, ["unload", "image"]);
  assert.equal(coordinator.status().lastHandoffError, null);
});

test("does not unload for the mock provider", async () => {
  let unloads = 0;
  const coordinator = new InferenceCoordinator({ unload: async () => { unloads++; return { ok: true }; } }, "auto");
  await coordinator.runImage(mockProfile, async () => "done");
  assert.equal(unloads, 0);
});

test("serializes chat and image inference", async () => {
  const events: string[] = [];
  const coordinator = new InferenceCoordinator({ unload: async () => ({ ok: true }) }, "off");
  const chat = coordinator.runChat(async () => {
    events.push("chat-start");
    await new Promise((resolve) => setTimeout(resolve, 5));
    events.push("chat-end");
  });
  const image = coordinator.runImage(comfyProfile, async () => { events.push("image"); });
  await Promise.all([chat, image]);
  assert.deepEqual(events, ["chat-start", "chat-end", "image"]);
});
