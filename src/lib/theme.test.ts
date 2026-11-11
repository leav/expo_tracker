import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyResolvedTheme,
  parseThemePreference,
  resolveTheme,
  THEME_BOOTSTRAP_SCRIPT,
  THEME_STORAGE_KEY,
} from "./theme";

describe("theme preference", () => {
  it("parses stored values and defaults unknown input to system", () => {
    assert.equal(parseThemePreference("system"), "system");
    assert.equal(parseThemePreference("light"), "light");
    assert.equal(parseThemePreference("dark"), "dark");
    assert.equal(parseThemePreference(null), "system");
    assert.equal(parseThemePreference(undefined), "system");
    assert.equal(parseThemePreference("nope"), "system");
  });

  it("resolves system from the OS, and keeps explicit light or dark", () => {
    assert.equal(resolveTheme("system", true), "dark");
    assert.equal(resolveTheme("system", false), "light");
    assert.equal(resolveTheme("light", true), "light");
    assert.equal(resolveTheme("dark", false), "dark");
  });

  it("toggles the dark class from the resolved theme", () => {
    const tokens = new Set<string>();
    const root = {
      classList: {
        toggle(token: string, force?: boolean) {
          if (force) tokens.add(token);
          else tokens.delete(token);
        },
      },
    };

    applyResolvedTheme("dark", root);
    assert.equal(tokens.has("dark"), true);
    applyResolvedTheme("light", root);
    assert.equal(tokens.has("dark"), false);
  });

  it("keeps the bootstrap script aligned with the storage key", () => {
    assert.equal(THEME_BOOTSTRAP_SCRIPT.includes(THEME_STORAGE_KEY), true);
    assert.equal(THEME_BOOTSTRAP_SCRIPT.includes("prefers-color-scheme: dark"), true);
  });
});
