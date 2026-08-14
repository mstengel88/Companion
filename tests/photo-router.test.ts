import assert from "node:assert/strict";
import test from "node:test";
import { routePhotoRequest } from "../src/services/photo-router.js";
import { englishLanguageGuidance, hasUnexpectedLanguageDrift, languageSafeHistory, photoCapabilityGuidance, photoReplyGuidance, photoSafeHistory } from "../src/services/ollama.js";

test("routes an explicit photo request", () => {
  const result = routePhotoRequest("Will you send me a snowboarding photo?", { enabled: true, cooldownMinutes: 30 });
  assert.equal(result.route, true);
  assert.equal(result.reason, "explicit-request");
  assert.match(result.request?.scene ?? "", /snowboarding/);
});

test("does not route ordinary chat", () => {
  const result = routePhotoRequest("How was your day?", { enabled: true, cooldownMinutes: 30 });
  assert.deepEqual(result, { route: false, reason: "none" });
});

test("respects cooldown", () => {
  const now = new Date("2026-01-01T12:00:00Z");
  const result = routePhotoRequest("What are you wearing?", { enabled: true, cooldownMinutes: 30, lastPhotoAt: "2026-01-01T11:45:00Z", now });
  assert.equal(result.reason, "cooldown");
});

test("routes the user's natural picture wording", () => {
  for (const message of [
    "I would like a picture of you please",
    "How about a pic of you in a black 2 piece bikini",
    "Can I have another selfie please?"
  ]) {
    const result = routePhotoRequest(message, { enabled: true, cooldownMinutes: 30 });
    assert.equal(result.route, true, message);
    assert.equal(result.reason, "explicit-request", message);
  }
});

test("direct picture requests bypass the automatic-photo cooldown", () => {
  const result = routePhotoRequest("I would like a picture of you please", {
    enabled: true,
    cooldownMinutes: 30,
    lastPhotoAt: "2026-01-01T11:59:00Z",
    now: new Date("2026-01-01T12:00:00Z")
  });
  assert.equal(result.route, true);
  assert.equal(result.reason, "explicit-request");
});

test("tells Emily when the local renderer accepted a chat photo request", () => {
  const guidance = photoReplyGuidance(true);
  assert.match(guidance, /local renderer accepted/i);
  assert.match(guidance, /brief, confident acknowledgment/i);
  assert.match(guidance, /do not claim/i);
});

test("adds no renderer claim to ordinary chat", () => {
  assert.equal(photoReplyGuidance(false), "");
});

test("the core prompt never treats fictional embodiment as a photo blocker", () => {
  const guidance = photoCapabilityGuidance();
  assert.match(guidance, /local renderer/i);
  assert.match(guidance, /never say that you lack a physical form/i);
  assert.match(guidance, /swimwear/i);
});

test("old false-capability replies do not anchor a new photo response", () => {
  const messages = [
    { id: "1", role: "user" as const, content: "A picture please", createdAt: "2026-01-01T00:00:00Z" },
    { id: "2", role: "assistant" as const, content: "I don't have a physical form, but I can describe a scene instead.", createdAt: "2026-01-01T00:00:01Z" },
    { id: "3", role: "assistant" as const, content: "I love snowboarding too.", createdAt: "2026-01-01T00:00:02Z" }
  ];
  assert.deepEqual(photoSafeHistory(messages, true).map((message) => message.id), ["1", "3"]);
  assert.equal(photoSafeHistory(messages, false).length, 3);
});

test("detects and removes unexpected language drift from English context", () => {
  const messages = [
    { role: "assistant" as const, content: "Stay close to me." },
    { role: "assistant" as const, content: "Stay close 更快请使用中文继续。" }
  ];
  assert.equal(hasUnexpectedLanguageDrift(messages[1]!.content, "keep going"), true);
  assert.equal(hasUnexpectedLanguageDrift(messages[1]!.content, "请继续"), false);
  assert.deepEqual(languageSafeHistory(messages, "keep going"), [messages[0]]);
  assert.equal(languageSafeHistory(messages, "请继续").length, 2);
  assert.match(englishLanguageGuidance(), /entirely in natural English/i);
});
