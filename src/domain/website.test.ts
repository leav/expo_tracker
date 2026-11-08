import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hrefForWebsite } from "./website";

describe("hrefForWebsite", () => {
  it("returns null for blank or missing values", () => {
    assert.equal(hrefForWebsite(null), null);
    assert.equal(hrefForWebsite(undefined), null);
    assert.equal(hrefForWebsite(""), null);
    assert.equal(hrefForWebsite("   "), null);
  });

  it("keeps http and https urls", () => {
    assert.equal(hrefForWebsite("https://fanime.com"), "https://fanime.com");
    assert.equal(hrefForWebsite("http://example.com/path"), "http://example.com/path");
    assert.equal(hrefForWebsite("  https://example.com  "), "https://example.com");
  });

  it("prefixes host-like values with https", () => {
    assert.equal(hrefForWebsite("fanime.com"), "https://fanime.com/");
    assert.equal(hrefForWebsite("www.example.com/artists"), "https://www.example.com/artists");
  });

  it("rejects non-http schemes and non-host text", () => {
    assert.equal(hrefForWebsite("javascript:alert(1)"), null);
    assert.equal(hrefForWebsite("mailto:owner@example.com"), null);
    assert.equal(hrefForWebsite("tel:+15551212"), null);
    assert.equal(hrefForWebsite("ftp://files.example.com"), null);
    assert.equal(hrefForWebsite("not a url"), null);
    assert.equal(hrefForWebsite("localhost"), null);
  });
});
