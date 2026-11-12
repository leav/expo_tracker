"use client";

import { cn } from "cn";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { maskFruitWords } from "../lib/fruit-mask";

type FruitMaskContextValue = {
  enabled: boolean;
  mask: (text: string) => string;
  toggle: () => void;
};

const FruitMaskContext = createContext<FruitMaskContextValue | null>(null);

export function FruitMaskProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const mask = useCallback((text: string) => (enabled ? maskFruitWords(text) : text), [enabled]);
  const toggle = useCallback(() => setEnabled((current) => !current), []);
  const value = useMemo(() => ({ enabled, mask, toggle }), [enabled, mask, toggle]);
  return <FruitMaskContext.Provider value={value}>{children}</FruitMaskContext.Provider>;
}

export function useFruitMask(): FruitMaskContextValue {
  const value = useContext(FruitMaskContext);
  if (!value) {
    throw new Error("useFruitMask must be used within FruitMaskProvider");
  }
  return value;
}

export function FruitMaskToggle() {
  const { enabled, toggle } = useFruitMask();
  return (
    <button
      type="button"
      aria-label="Mask names for screenshots"
      aria-pressed={enabled}
      onClick={toggle}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md border",
        enabled ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span aria-hidden>🍋</span>
    </button>
  );
}

type FruitSafeTextProps = {
  name: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  className: string;
  rows?: number;
  type?: string;
};

export function FruitSafeText({
  name,
  defaultValue = "",
  required,
  placeholder,
  className,
  rows,
  type = "text",
}: FruitSafeTextProps) {
  const { enabled, mask } = useFruitMask();

  if (enabled) {
    return (
      <>
        <div className={cn(className, rows != null ? "min-h-16 whitespace-pre-wrap" : "flex items-center")}>
          {mask(defaultValue)}
        </div>
        <input type="hidden" name={name} value={defaultValue} />
      </>
    );
  }

  if (rows != null) {
    return (
      <textarea
        name={name}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        rows={rows}
        className={className}
      />
    );
  }

  return (
    <input
      name={name}
      type={type}
      defaultValue={defaultValue}
      required={required}
      placeholder={placeholder}
      className={className}
    />
  );
}
