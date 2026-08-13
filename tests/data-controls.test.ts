import test from "node:test";
import assert from "node:assert/strict";
import { clearConversation, clearMemories, clearStyle, removePhoto, removeReference, retryablePhoto } from "../src/services/data-controls.js";
import type { AppState } from "../src/types/domain.js";

function state(): AppState {
  return {
    messages: [{ id: "message-1", role: "assistant", content: "hello", createdAt: "2026-08-13T12:00:00Z", photoId: "photo-1" }],
    memories: [{ id: "memory-1", text: "likes snow", source: "chat", confidence: 1, tags: [], createdAt: "2026-08-13T12:00:00Z" }],
    photos: [{ id: "photo-1", filename: "photo-1.png", createdAt: "2026-08-13T12:00:00Z", status: "complete", workflowProfile: "mock", prompt: "snow", request: { scene: "snow" } }],
    references: [{ id: "emily-reference-1", filename: "emily-reference-1.png", sha256: "abc", mimeType: "image/png", bytes: 3, createdAt: "2026-08-13T12:00:00Z" }],
    style: { sampleCount: 1, averageWords: 2, emojiRate: 0, questionRate: 0, commonOpeners: [], updatedAt: "2026-08-13T12:00:00Z" },
    lastAutoPhotoAt: null,
    proactive: { enabled: false, minimumIntervalMinutes: 240, quietHoursStart: 22, quietHoursEnd: 8 },
    lastProactiveAt: null,
    relationship: { intensity: "flirty" }
  };
}

test("clearing a conversation preserves memories and delays proactive messages", () => {
  const current = state();
  assert.equal(clearConversation(current, "2026-08-13T13:00:00Z"), 1);
  assert.deepEqual(current.messages, []);
  assert.equal(current.memories.length, 1);
  assert.equal(current.lastProactiveAt, "2026-08-13T13:00:00Z");
});

test("memory and style controls clear only their target", () => {
  const current = state();
  assert.equal(clearMemories(current), 1);
  assert.equal(clearStyle(current), true);
  assert.deepEqual(current.memories, []);
  assert.equal(current.style, null);
  assert.equal(current.messages.length, 1);
});

test("removing a photo also detaches it from messages", () => {
  const current = state();
  assert.equal(removePhoto(current, "photo-1")?.filename, "photo-1.png");
  assert.deepEqual(current.photos, []);
  assert.equal(current.messages[0]?.photoId, undefined);
  assert.equal(removePhoto(current, "missing"), undefined);
});

test("removing a reference returns its local file metadata", () => {
  const current = state();
  assert.equal(removeReference(current, "emily-reference-1")?.filename, "emily-reference-1.png");
  assert.deepEqual(current.references, []);
  assert.equal(removeReference(current, "missing"), undefined);
});

test("only mock and failed photo requests can be retried", () => {
  const current = state();
  assert.equal(retryablePhoto(current, "photo-1"), undefined);
  current.photos[0]!.status = "mock";
  assert.equal(retryablePhoto(current, "photo-1")?.request.scene, "snow");
  current.photos[0]!.status = "failed";
  assert.equal(retryablePhoto(current, "photo-1")?.id, "photo-1");
});
