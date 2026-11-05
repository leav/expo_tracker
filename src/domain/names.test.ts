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

  it("splits trailing years, seasons, and cycle numbers off the series key", () => {
    assert.deepEqual(identityFromName("Comic Market 108"), {
      key: "comicmarket",
      cycleLabel: "108",
      aliasCandidates: [],
    });
    assert.deepEqual(identityFromName("Comiket 109"), {
      key: "comiket",
      cycleLabel: "109",
      aliasCandidates: [],
    });
    assert.notEqual(normalizeName("Comic Market 108"), normalizeName("Comiket 109"));
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

  it("keeps differently timed SJ Made events as separate series", () => {
    assert.equal(normalizeName("SJ Made Winter Wonder Market"), "sjmadewinterwondermarket");
    assert.equal(normalizeName("SJMade Fest"), "sjmadefest");
    assert.notEqual(normalizeName("SJMade Fest"), normalizeName("SJMade Winter Wonder"));
    assert.equal(
      normalizeName("SJ Made Winter Wonder Market 2026"),
      normalizeName("SJ Made Winter Wonder Market 2027"),
    );
    assert.deepEqual(identityFromName("SJ Made Winter Wonder Market 2026"), {
      key: "sjmadewinterwondermarket",
      cycleLabel: "2026",
      aliasCandidates: [],
    });
  });

  it("extracts a parenthetical alias", () => {
    assert.deepEqual(identityFromName("castlepoint (cpac)"), {
      key: "castlepoint",
      cycleLabel: null,
      aliasCandidates: ["cpac"],
    });
  });
});
