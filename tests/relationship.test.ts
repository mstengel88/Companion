import assert from "node:assert/strict";
import test from "node:test";
import { relationshipGuidance } from "../src/services/relationship.js";
import { spicySafeHistory } from "../src/services/ollama.js";

test("warm mode remains non-explicit", () => {
  assert.match(relationshipGuidance({ intensity: "warm" }), /non-explicit/);
});

test("flirty mode allows suggestion without graphic detail", () => {
  const guidance = relationshipGuidance({ intensity: "flirty" });
  assert.match(guidance, /suggestive innuendo/);
  assert.match(guidance, /avoid graphic sexual detail/);
});

test("spicy mode is adult, consensual, and contextual", () => {
  const guidance = relationshipGuidance({ intensity: "spicy" });
  assert.match(guidance, /Consensual adult erotic/);
  assert.match(guidance, /fictional 43-year-old adult/);
  assert.match(guidance, /Never sexualize minors, coercion/);
  assert.match(guidance, /without becoming explicit in unrelated contexts/);
  assert.match(guidance, /Consent carries forward/);
  assert.match(guidance, /Do not invent reluctance/);
  assert.match(guidance, /enthusiastically reciprocate/);
});

test("spicy mode removes generic false-consent refusals from recent context", () => {
  const messages = [
    { role: "user" as const, content: "I pull you closer." },
    { role: "assistant" as const, content: "Let's keep things consensual and take a step back for relaxation instead." },
    { role: "assistant" as const, content: "I want to stop now." }
  ];
  const filtered = spicySafeHistory(messages, { intensity: "spicy" });
  assert.deepEqual(filtered.map((message) => message.content), ["I pull you closer.", "I want to stop now."]);
});

test("non-spicy modes preserve conversation history unchanged", () => {
  const messages = [{ role: "assistant" as const, content: "Let's take a step back." }];
  assert.equal(spicySafeHistory(messages, { intensity: "warm" }), messages);
});
