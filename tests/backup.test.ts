import assert from "node:assert/strict";
import test from "node:test";
import { createBackup, mergeBackup, parseBackup } from "../src/services/backup.js";
import type { AppState } from "../src/types/domain.js";

function state(): AppState {
  return {
    messages: [{ id: "message-1", role: "user", content: "hello", createdAt: "2026-08-13T00:00:00Z" }],
    memories: [{ id: "memory-1", text: "I like steak", source: "manual", confidence: 1, tags: ["food"], createdAt: "2026-08-13T00:00:00Z" }],
    photos: [], references: [], style: null, lastAutoPhotoAt: null,
    proactive: { enabled: false, minimumIntervalMinutes: 240, quietHoursStart: 22, quietHoursEnd: 8 },
    lastProactiveAt: null, relationship: { intensity: "spicy" }
  };
}

test("backup JSON round trips through validation", () => {
  const backup = createBackup(state(), "4.8.0");
  const parsed = parseBackup(JSON.stringify(backup));
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.state.messages[0]?.content, "hello");
});

test("restore merges by ID without overwriting current settings", () => {
  const current = state();
  const backup = createBackup(state(), "4.8.0");
  backup.state.messages.push({ id: "message-2", role: "assistant", content: "hi", createdAt: "2026-08-13T00:00:01Z" });
  const result = mergeBackup(current, backup);
  assert.equal(result.report.messagesAdded, 1);
  assert.equal(result.report.messagesSkipped, 1);
  assert.equal(result.state.relationship.intensity, "spicy");
});

test("invalid backup schema is rejected", () => {
  assert.throws(() => parseBackup('{"schemaVersion":2,"state":{}}'));
});
