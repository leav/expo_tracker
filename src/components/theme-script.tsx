import { THEME_BOOTSTRAP_SCRIPT } from "../lib/theme";

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />;
}
