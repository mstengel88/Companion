import assert from "node:assert/strict";
import test from "node:test";
import { buildConversationWindow, rankMemories, styleGuidance } from "../src/services/conversation-context.js";
import type { Memory, Message } from "../src/types/domain.js";

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
  assert.match(guidance, /do not force a question every turn/);
  assert.match(guidance, /hey you/);
});

test("conversation window keeps the newest bounded messages in order", () => {
  const history: Message[] = Array.from({ length: 24 }, (_, index) => ({
    id: String(index), role: index % 2 ? "assistant" : "user", content: `message ${index}`, createdAt: new Date().toISOString()
  }));
  const window = buildConversationWindow(history, 6, 10_000);
  assert.equal(window.messages.length, 6);
  assert.equal(window.messages[0]?.content, "message 18");
  assert.equal(window.messages[5]?.content, "message 23");
  assert.equal(window.omittedMessages, 18);
  assert.match(window.continuity, /18 messages omitted/);
  assert.match(window.continuity, /message 17/);
});

test("conversation window respects its character budget", () => {
  const history: Message[] = [
    { id: "1", role: "user", content: "a".repeat(80), createdAt: new Date().toISOString() },
    { id: "2", role: "assistant", content: "b".repeat(80), createdAt: new Date().toISOString() },
    { id: "3", role: "user", content: "recent", createdAt: new Date().toISOString() }
  ];
  const window = buildConversationWindow(history, 16, 100);
  assert.deepEqual(window.messages.map((message) => message.content), ["b".repeat(80), "recent"]);
  assert.equal(window.includedCharacters, 86);
  assert.equal(window.omittedMessages, 1);
});
