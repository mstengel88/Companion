import assert from "node:assert/strict";
import test from "node:test";
import { routePhotoRequest } from "../src/services/photo-router.js";

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
