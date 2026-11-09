import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createOAuthState, googleOAuthCallbackCheck, verifyOAuthState } from "./oauth";

describe("oauth state", () => {
  it("accepts a freshly signed state and rejects a tampered one", () => {
    const secret = "test-session-secret";
    const now = 1_700_000_000_000;
    const state = createOAuthState(secret, now);
    assert.equal(verifyOAuthState(secret, state, now), true);
    assert.equal(verifyOAuthState("other-secret", state, now), false);
    const [nonce, timestamp, mac] = state.split(".");
    const flipped = nonce.startsWith("a") ? "b" : "a";
    assert.equal(verifyOAuthState(secret, `${flipped}${nonce.slice(1)}.${timestamp}.${mac}`, now), false);
  });

  it("rejects expired state", () => {
    const secret = "test-session-secret";
    const now = 1_700_000_000_000;
    const state = createOAuthState(secret, now);
    assert.equal(verifyOAuthState(secret, state, now + 11 * 60 * 1000), false);
  });
});

describe("googleOAuthCallbackCheck", () => {
  const secret = "test-session-secret";
  const now = 1_700_000_000_000;
  const appOrigin = "http://127.0.0.1:4747";

  it("accepts a matching signed cookie", () => {
    const state = createOAuthState(secret, now);
    const result = googleOAuthCallbackCheck({
      code: "code",
      state,
      cookie: state,
      secret,
      appOrigin,
      now,
    });
    assert.deepEqual(result, { ok: true, code: "code" });
  });

  it("tells the owner to use 127.0.0.1 when the cookie is missing", () => {
    const state = createOAuthState(secret, now);
    const result = googleOAuthCallbackCheck({
      code: "code",
      state,
      cookie: undefined,
      secret,
      appOrigin,
      now,
    });
    assert.equal(result.ok, false);
    if (result.ok) throw new Error("expected failure");
    assert.match(result.error, /127\.0\.0\.1:4747 \(not localhost\)/);
  });
});
