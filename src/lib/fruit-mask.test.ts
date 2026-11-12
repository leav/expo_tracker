import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FRUIT_EMOJIS, maskFruitWords } from "./fruit-mask";

function isFruit(value: string | undefined): boolean {
  return value != null && (FRUIT_EMOJIS as readonly string[]).includes(value);
}

describe("maskFruitWords", () => {
  it("replaces PascalCase words and keeps Con", () => {
    const chars = [...maskFruitWords("FanimeCon")];
    assert.equal(chars.slice(-3).join(""), "Con");
    assert.equal(isFruit(chars[0]), true);
    assert.equal(chars.length, 4);
  });

  it("keeps Expo after a space or underscore", () => {
    const spaced = [...maskFruitWords("Anime Expo")];
    const underscored = [...maskFruitWords("Anime_Expo")];
    assert.equal(spaced.slice(-5).join(""), " Expo");
    assert.equal(underscored.slice(-5).join(""), "_Expo");
    assert.equal(isFruit(spaced[0]), true);
    assert.equal(spaced[0], underscored[0]);
  });

  it("keeps brackets, digits, and Con", () => {
    const masked = maskFruitWords("[MOCK] Calendar Con");
    assert.match(masked, /^\[[🍎🍊🍋🍌🍉🍇🍓🍑🍒🥝🍍🥭🥥🫐🍈🍏]\] [🍎🍊🍋🍌🍉🍇🍓🍑🍒🥝🍍🥭🥥🫐🍈🍏] Con$/u);
    assert.equal(maskFruitWords("Comic Market 108").endsWith(" 108"), true);
    assert.match(maskFruitWords("Comic Market 108"), /^[🍎🍊🍋🍌🍉🍇🍓🍑🍒🥝🍍🥭🥥🫐🍈🍏] [🍎🍊🍋🍌🍉🍇🍓🍑🍒🥝🍍🥭🥥🫐🍈🍏] 108$/u);
  });

  it("keeps con and expo in any case, and fruits longer words", () => {
    assert.equal(maskFruitWords("con"), "con");
    assert.equal(maskFruitWords("Con"), "Con");
    assert.equal(maskFruitWords("CON"), "CON");
    assert.equal(maskFruitWords("expo"), "expo");
    assert.equal(maskFruitWords("Expo"), "Expo");
    assert.equal(maskFruitWords("EXPO"), "EXPO");
    assert.equal(isFruit([...maskFruitWords("convention")][0]), true);
    assert.equal(maskFruitWords("convention").includes("convention"), false);
    assert.equal(isFruit([...maskFruitWords("exposition")][0]), true);
    assert.equal(maskFruitWords("exposition").includes("exposition"), false);
  });

  it("masks notes with the same rule", () => {
    const masked = maskFruitWords("skip FanimeCon because 2 days");
    assert.match(masked, /^[🍎🍊🍋🍌🍉🍇🍓🍑🍒🥝🍍🥭🥥🫐🍈🍏] [🍎🍊🍋🍌🍉🍇🍓🍑🍒🥝🍍🥭🥥🫐🍈🍏]Con [🍎🍊🍋🍌🍉🍇🍓🍑🍒🥝🍍🥭🥥🫐🍈🍏] 2 [🍎🍊🍋🍌🍉🍇🍓🍑🍒🥝🍍🥭🥥🫐🍈🍏]$/u);
  });

  it("leaves empty text, numbers, and non-a-z scripts unchanged", () => {
    assert.equal(maskFruitWords(""), "");
    assert.equal(maskFruitWords("108"), "108");
    assert.equal(maskFruitWords("漫展"), "漫展");
    assert.equal(maskFruitWords("2027-109"), "2027-109");
  });

  it("picks a stable fruit for the same word", () => {
    assert.equal(maskFruitWords("Calendar"), maskFruitWords("Calendar"));
    const fanime = maskFruitWords("FanimeCon");
    assert.equal(maskFruitWords(`Visit ${"FanimeCon"} booth`).includes(fanime), true);
  });
});
