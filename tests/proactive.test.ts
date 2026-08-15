import assert from "node:assert/strict";
import test from "node:test";
import { isQuietHour, proactivePrompt, shouldSendProactive } from "../src/services/proactive.js";
import type { AppState } from "../src/types/domain.js";

function state(overrides: Partial<AppState> = {}): AppState {
  return {
    messages: [], memories: [], photos: [], references: [], style: null, lastAutoPhotoAt: null,
    proactive: { enabled: true, minimumIntervalMinutes: 240, quietHoursStart: 22, quietHoursEnd: 8 },
    lastProactiveAt: null, relationship: { intensity: "flirty" }, ...overrides
  };
}

test("quiet hours can cross midnight", () => {
  const settings = state().proactive;
  assert.equal(isQuietHour(23, settings), true);
  assert.equal(isQuietHour(7, settings), true);
  assert.equal(isQuietHour(12, settings), false);
});

test("proactive messages are opt-in and interval limited", () => {
  const now = new Date("2026-08-13T12:00:00");
  assert.equal(shouldSendProactive(state({ proactive: { ...state().proactive, enabled: false } }), now), false);
  assert.equal(shouldSendProactive(state({ lastProactiveAt: "2026-08-13T10:00:00" }), now), false);
  assert.equal(shouldSendProactive(state({ lastProactiveAt: "2026-08-13T07:00:00" }), now), true);
});

test("prompt clearly prevents invented real-world events", () => {
  assert.match(proactivePrompt([]), /Do not pretend a real-world event occurred/);
});
