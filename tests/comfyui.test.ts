import assert from "node:assert/strict";
import test from "node:test";
import { locateQueueJob, replaceDeep } from "../src/services/comfyui.js";

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
