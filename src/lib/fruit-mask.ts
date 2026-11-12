export const FRUIT_EMOJIS = [
  "🍎",
  "🍊",
  "🍋",
  "🍌",
  "🍉",
  "🍇",
  "🍓",
  "🍑",
  "🍒",
  "🥝",
  "🍍",
  "🥭",
  "🥥",
  "🫐",
  "🍈",
  "🍏",
] as const;

const KEEP_WORDS = new Set(["con", "expo"]);

function hashWord(word: string): number {
  let hash = 5381;
  for (let index = 0; index < word.length; index += 1) {
    hash = Math.imul(hash, 33) ^ word.charCodeAt(index);
  }
  return hash >>> 0;
}

function fruitFor(word: string): string {
  return FRUIT_EMOJIS[hashWord(word.toLowerCase()) % FRUIT_EMOJIS.length] ?? "🍎";
}

function splitCamelCase(letters: string): string[] {
  return letters.split(/(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/);
}

function maskLetterRun(letters: string): string {
  return splitCamelCase(letters)
    .map((part) => (KEEP_WORDS.has(part.toLowerCase()) ? part : fruitFor(part)))
    .join("");
}

export function maskFruitWords(input: string): string {
  return input.replace(/[A-Za-z]+/g, maskLetterRun);
}
