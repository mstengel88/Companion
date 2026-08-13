import assert from "node:assert/strict";
import test from "node:test";
import { replaceDeep } from "../src/services/comfyui.js";

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
