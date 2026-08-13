import assert from "node:assert/strict";
import test from "node:test";
import { routePhotoRequest } from "../src/services/photo-router.js";
import { photoReplyGuidance } from "../src/services/ollama.js";

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
  const result = routePhotoRequest("Send a photo", { enabled: true, cooldownMinutes: 30, lastPhotoAt: "2026-01-01T11:45:00Z", now });
  assert.equal(result.reason, "cooldown");
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
