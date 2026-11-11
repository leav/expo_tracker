export const THEME_STORAGE_KEY = "expo-tracker-theme";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export function parseThemePreference(value: string | null | undefined): ThemePreference {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system";
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (preference === "system") {
    return systemDark ? "dark" : "light";
  }
  return preference;
}

export function applyResolvedTheme(
  theme: ResolvedTheme,
  root: { classList: { toggle(token: string, force?: boolean): unknown } },
) {
  root.classList.toggle("dark", theme === "dark");
}

export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var stored=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var systemDark=window.matchMedia("(prefers-color-scheme: dark)").matches;var resolved=stored==="light"||stored==="dark"?stored:(systemDark?"dark":"light");document.documentElement.classList.toggle("dark",resolved==="dark");}catch(e){}})();`;
