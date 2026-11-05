export function compareCycleLabels(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true });
}
