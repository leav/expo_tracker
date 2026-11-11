"use client";

import { cn } from "cn";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import {
  applyResolvedTheme,
  parseThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "../lib/theme";

const options = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyPreference(preference: ThemePreference) {
  applyResolvedTheme(resolveTheme(preference, systemPrefersDark()), document.documentElement);
}

export function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference | null>(null);

  useEffect(() => {
    setPreference(parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY)));
  }, []);

  useEffect(() => {
    if (preference == null) return;
    applyPreference(preference);
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyPreference("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  function select(next: ThemePreference) {
    setPreference(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyPreference(next);
  }

  return (
    <div role="group" aria-label="Appearance" className="flex items-center rounded-md border">
      {options.map((option, index) => {
        const Icon = option.icon;
        const pressed = preference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-label={option.label}
            aria-pressed={pressed}
            onClick={() => select(option.value)}
            className={cn(
              "inline-flex size-8 items-center justify-center",
              index > 0 ? "border-l" : "",
              pressed ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
