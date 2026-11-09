import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  googleConnectHostRedirect,
  googleConnectHref,
  googleOAuthNotReadyReason,
  googleSettingsHref,
  missingGoogleOAuthKeys,
} from "./config";

describe("missingGoogleOAuthKeys", () => {
  it("lists every empty key", () => {
    assert.deepEqual(missingGoogleOAuthKeys({}), [
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "SESSION_SECRET",
    ]);
  });

  it("treats whitespace as missing", () => {
    assert.deepEqual(
      missingGoogleOAuthKeys({ clientId: "  ", clientSecret: "secret", sessionSecret: "\t" }),
      ["GOOGLE_CLIENT_ID", "SESSION_SECRET"],
    );
  });

  it("returns empty when all three are set", () => {
    assert.deepEqual(
      missingGoogleOAuthKeys({
        clientId: "id",
        clientSecret: "secret",
        sessionSecret: "session",
      }),
      [],
    );
  });
});

describe("googleOAuthNotReadyReason", () => {
  it("asks for the client keys when either is missing", () => {
    assert.equal(
      googleOAuthNotReadyReason(["GOOGLE_CLIENT_ID"]),
      "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local to connect Google.",
    );
    assert.equal(
      googleOAuthNotReadyReason(["GOOGLE_CLIENT_SECRET", "SESSION_SECRET"]),
      "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local to connect Google.",
    );
  });

  it("asks for SESSION_SECRET when only that is missing", () => {
    assert.equal(
      googleOAuthNotReadyReason(["SESSION_SECRET"]),
      "Set SESSION_SECRET in .env.local to connect Google.",
    );
  });
});

describe("googleConnectHostRedirect", () => {
  it("leaves 127.0.0.1 alone and moves localhost onto the redirect origin", () => {
    assert.equal(googleConnectHostRedirect("127.0.0.1:4747"), null);
    assert.equal(googleConnectHostRedirect("localhost:4747"), googleConnectHref());
    assert.equal(googleConnectHostRedirect("localhost"), googleConnectHref());
  });

  it("points Settings at 127.0.0.1, not localhost", () => {
    assert.equal(googleSettingsHref(), "http://127.0.0.1:4747/settings");
  });
});
