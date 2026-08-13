import assert from "node:assert/strict";
import test from "node:test";
import { parseCookies, PinAuth } from "../src/services/auth.js";

const auth = new PinAuth("481726", "test-secret-that-is-longer-than-thirty-two-characters");

test("PIN comparison and signed sessions work", () => {
  assert.equal(auth.verifyPin("481726"), true);
  assert.equal(auth.verifyPin("000000"), false);
  const now = new Date("2026-08-13T12:00:00Z");
  const token = auth.issueSession(now, 60);
  assert.equal(auth.verifySession(token, new Date("2026-08-13T12:00:30Z")), true);
  assert.equal(auth.verifySession(token, new Date("2026-08-13T12:01:01Z")), false);
});

test("tampered sessions are rejected", () => {
  const token = auth.issueSession();
  assert.equal(auth.verifySession(`${token}x`), false);
  assert.equal(auth.verifySession("not-a-token"), false);
});

test("cookie parser handles multiple encoded values", () => {
  assert.deepEqual(parseCookies("theme=dark; emily_session=abc%2E123"), { theme: "dark", emily_session: "abc.123" });
});
