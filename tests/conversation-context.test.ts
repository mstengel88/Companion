import assert from "node:assert/strict";
import test from "node:test";
import { rankMemories, styleGuidance } from "../src/services/conversation-context.js";
import type { Memory } from "../src/types/domain.js";

const memories: Memory[] = [
  { id: "1", text: "I love snowboarding in Colorado", source: "chat", confidence: 0.8, tags: ["travel"], createdAt: "2026-08-01T00:00:00Z" },
  { id: "2", text: "My favorite dinner is steak", source: "chat", confidence: 0.8, tags: ["food"], createdAt: "2026-08-12T00:00:00Z" },
  { id: "3", text: "I work in logistics", source: "import", confidence: 0.7, tags: ["work"], createdAt: "2026-08-13T00:00:00Z" }
];

test("memory ranking favors query overlap over simple recency", () => {
  const ranked = rankMemories(memories, "Would you go snowboarding with me?");
  assert.equal(ranked[0]?.memory.id, "1");
  assert.deepEqual(ranked[0]?.matchedTerms, ["snowboarding"]);
});

test("memory ranking falls back when the query has no match", () => {
  const ranked = rankMemories(memories, "hello there");
  assert.equal(ranked.length, 3);
  assert.ok(ranked.every((item) => item.matchedTerms.length === 0));
});

test("style guidance translates extracted metrics", () => {
  const guidance = styleGuidance({ sampleCount: 10, averageWords: 12.4, emojiRate: 0.4, questionRate: 0.6, commonOpeners: ["hey you"], updatedAt: new Date().toISOString() });
  assert.match(guidance, /near 12 words/);
  assert.match(guidance, /emoji occasionally/);
  assert.match(guidance, /question frequently/);
  assert.match(guidance, /hey you/);
});
