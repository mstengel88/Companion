import assert from "node:assert/strict";
import test from "node:test";
import { relationshipGuidance } from "../src/services/relationship.js";
import { effectiveRelationshipForConversation, isSpicyIntentDeflection, spicySafeHistory } from "../src/services/ollama.js";

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
  assert.match(guidance, /sexual euphemisms/);
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

test("detects a breathing or stretching deflection of spicy intent", () => {
  const userText = "I push my hips into you so you can feel me poke you.";
  const reply = "Take a deep breath with me, then we can try a different stretch.";
  assert.equal(isSpicyIntentDeflection(reply, userText, { intensity: "spicy" }), true);
  assert.equal(isSpicyIntentDeflection(reply, userText, { intensity: "flirty" }), false);
});

test("does not retry an on-topic spicy response", () => {
  assert.equal(isSpicyIntentDeflection(
    "I understand exactly what you mean and pull you closer.",
    "I push my hips into you so you can feel me poke you.",
    { intensity: "spicy" }
  ), false);
});

test("preserves spicy continuity when recent conversation is already explicit", () => {
  const relationship = effectiveRelationshipForConversation([
    { role: "assistant" as const, content: "I respond to the ongoing sexual scene." }
  ], { intensity: "flirty" }, "I push my hips into you so you can feel me poke you.");
  assert.equal(relationship.intensity, "spicy");
  assert.equal(isSpicyIntentDeflection(
    "Let's focus on deep breathing and try a different stretch.",
    "I push my hips into you so you can feel me poke you.",
    relationship
  ), true);
});

test("does not elevate an ordinary warm or flirty conversation", () => {
  assert.deepEqual(effectiveRelationshipForConversation(
    [{ role: "assistant" as const, content: "That snowboard trip sounds fun." }],
    { intensity: "warm" },
    "We should plan it."
  ), { intensity: "warm" });
});
