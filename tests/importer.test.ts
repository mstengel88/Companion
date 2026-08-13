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
});

test("extracts a bounded style profile", () => {
  const result = extractStyle([{ content: "Hey you 😊" }, { content: "Want to go riding?" }]);
  assert.equal(result.sampleCount, 2);
  assert.equal(result.emojiRate, 0.5);
  assert.equal(result.questionRate, 0.5);
});
