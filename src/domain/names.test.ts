import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { identityFromName, normalizeName } from "./names";

describe("alias and edition names", () => {
  it("folds case, punctuation, and Latin diacritics into one key", () => {
    assert.equal(normalizeName("ALA"), "ala");
    assert.equal(normalizeName("ala"), "ala");
    assert.equal(normalizeName("A.L.A."), "ala");
    assert.equal(normalizeName("Animé Los Angeles"), "animelosangeles");
  });

  it("treats year and season variants as the same series", () => {
    assert.equal(normalizeName("FanimeCon 26"), normalizeName("FanimeCon 27"));
    assert.equal(normalizeName("SacAnime Summer"), normalizeName("SacAnime Winter"));
  });

  it("keeps Chinese characters", () => {
    assert.equal(normalizeName("漫展"), "漫展");
  });

  it("rejects a name that normalizes to empty", () => {
    assert.equal(normalizeName("..."), "");
  });

  it("splits Comiket numbers and season cycles off the series key", () => {
    assert.deepEqual(identityFromName("Comic Market 108"), {
      key: "comiket",
      cycleLabel: "108",
      aliasCandidates: [],
    });
    assert.deepEqual(identityFromName("Comiket 109"), {
      key: "comiket",
      cycleLabel: "109",
      aliasCandidates: [],
    });
    assert.deepEqual(identityFromName("SacAnime Summer"), {
      key: "sacanime",
      cycleLabel: "summer",
      aliasCandidates: [],
    });
    assert.deepEqual(identityFromName("FanimeCon 27"), {
      key: "fanimecon",
      cycleLabel: "2027",
      aliasCandidates: [],
    });
    assert.deepEqual(identityFromName("SacAnime Summer 26"), {
      key: "sacanime",
      cycleLabel: "2026-summer",
      aliasCandidates: [],
    });
  });

  it("groups San José Made markets and parenthetical aliases", () => {
    assert.equal(normalizeName("SJ Made Winter Wonder Market"), "sanjosemade");
    assert.equal(identityFromName("SJ Made Winter Wonder Market").cycleLabel, "winter");
    assert.deepEqual(identityFromName("castlepoint (cpac)"), {
      key: "castlepoint",
      cycleLabel: null,
      aliasCandidates: ["cpac"],
    });
  });
});
