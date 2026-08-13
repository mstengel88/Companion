import assert from "node:assert/strict";
import test from "node:test";
import { importConversation } from "../src/services/importer.js";
import { extractStyle } from "../src/services/extraction.js";

test("imports generic JSON messages", () => {
  const result = importConversation("export.json", JSON.stringify({ messages: [
    { sender: "Me", text: "I love mountain trips", timestamp: "2025-01-01T00:00:00Z" },
    { sender: "Emily", text: "Me too 😊 Want to plan one?" }
  ] }));
  assert.equal(result.messages.length, 2);
  assert.equal(result.messages[0]?.role, "user");
  assert.equal(result.messages[1]?.role, "assistant");
  assert.equal(result.adapter, "json");
});

test("imports ChatGPT-style mapping content and numeric timestamps", () => {
  const result = importConversation("conversations.json", JSON.stringify({ mapping: {
    one: { message: { author: { role: "user" }, create_time: 1_700_000_000, content: { parts: ["Remember my favorite trail"] } } },
    two: { message: { author: { role: "assistant" }, create_time: 1_700_000_010, content: { parts: ["I will 😊"] } } }
  } }));
  assert.equal(result.messages.length, 2);
  assert.equal(result.messages[0]?.content, "Remember my favorite trail");
  assert.equal(result.messages[0]?.createdAt, "2023-11-14T22:13:20.000Z");
});

test("imports role-tagged HTML and produces stable IDs", () => {
  const html = '<article data-role="user"><p>I like steak</p></article><article data-role="emily"><p>Good choice!</p></article>';
  const first = importConversation("chat.html", html);
  const second = importConversation("chat.html", html);
  assert.equal(first.adapter, "html");
  assert.equal(first.messages.length, 2);
  assert.deepEqual(first.messages.map((message) => message.id), second.messages.map((message) => message.id));
});

test("imports labeled text with stable IDs", () => {
  const raw = "Me: Do you remember Colorado?\nEmily: Of course I do.";
  const first = importConversation("chat.txt", raw);
  const second = importConversation("chat.txt", raw);
  assert.equal(first.messages.length, 2);
  assert.deepEqual(first.messages.map((message) => message.id), second.messages.map((message) => message.id));
});

test("extracts a bounded style profile", () => {
  const result = extractStyle([{ content: "Hey you 😊" }, { content: "Want to go riding?" }]);
  assert.equal(result.sampleCount, 2);
  assert.equal(result.emojiRate, 0.5);
  assert.equal(result.questionRate, 0.5);
});
