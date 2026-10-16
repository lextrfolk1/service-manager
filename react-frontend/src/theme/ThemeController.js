import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";
import { COLOR_VARS } from "./palettes";
import { CHIP_HEIGHT, TOOLTIP_DELAY } from "./tokens";

// Personal theme: a base (light / dark / graphite / warm / follow system) and an accent colour.
// Stored in this browser only. Components use CSS variables (palettes.js), so switching never re-styles code paths.

export const THEME_BASES = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "graphite", label: "Graphite", hint: "Neutral charcoal dark, crisp contrast" },
  { id: "soft", label: "Warm", hint: "Paper-like tones, softer contrast for long sessions" },
  { id: "system", label: "Follow system", hint: "Light or dark, like your computer" },
];

// Themes with dark surfaces (light text, dark scrollbars, lighter accent for text).
const DARK_BASES = ["dark", "graphite"];

export const ACCENTS = [
  { id: "blue", label: "Blue", main: "#2563eb", strong: "#1d4ed8", onDark: "#60a5fa" },
  { id: "indigo", label: "Indigo", main: "#4f46e5", strong: "#4338ca", onDark: "#818cf8" },
  { id: "teal", label: "Teal", main: "#0d9488", strong: "#0f766e", onDark: "#2dd4bf" },
  { id: "purple", label: "Purple", main: "#7c3aed", strong: "#6d28d9", onDark: "#a78bfa" },
  { id: "orange", label: "Orange", main: "#ea580c", strong: "#c2410c", onDark: "#fb923c" },
  { id: "rose", label: "Rose", main: "#e11d48", strong: "#be123c", onDark: "#fb7185" },
];

// Page / surface / text colours per base for MUI's own components (menus, dialogs, inputs, …).
const BASE_PALETTES = {
  light: { mode: "light", background: { default: "#f4f7fb", paper: "#ffffff" }, text: { primary: "#0f172a", secondary: "#475569" } },
  dark: {
    mode: "dark",
    background: { default: "#0b1220", paper: "#111827" },
    text: { primary: "#e5e7eb", secondary: "#94a3b8" },
    divider: "rgba(148, 163, 184, 0.2)",
  },
  soft: {
    mode: "light",
    background: { default: "#f1ebe0", paper: "#faf6ee" },
    text: { primary: "#3b3428", secondary: "#6b6152" },
    divider: "rgba(120, 100, 70, 0.18)",
  },
  graphite: {
    mode: "dark",
    background: { default: "#0c0c0d", paper: "#161617" },
    text: { primary: "#ededed", secondary: "#a1a1a1" },
    divider: "rgba(255, 255, 255, 0.12)",
  },
};

// App header / page background per base.
function shellVars(base, accent) {
  if (base === "dark") {
    return {
      "--sm-header-bg": "rgba(17, 24, 39, 0.85)",
      "--sm-app-bg": `radial-gradient(circle at top left, color-mix(in srgb, ${accent.main} 18%, transparent), transparent 26%), linear-gradient(180deg, #0b1220 0%, #0d1526 100%)`,
    };
  }
  if (base === "graphite") {
    return {
      "--sm-header-bg": "rgba(22, 22, 23, 0.9)",
      "--sm-app-bg": "linear-gradient(180deg, #0c0c0d 0%, #111112 100%)",
    };
  }
  if (base === "soft") {
    return {
      "--sm-header-bg": "rgba(250, 246, 238, 0.9)",
      "--sm-app-bg": "linear-gradient(180deg, #f6f1e7 0%, #efe8db 100%)",
    };
  }
  return {
    "--sm-header-bg": "rgba(255, 255, 255, 0.72)",
    "--sm-app-bg": `radial-gradient(circle at top left, color-mix(in srgb, ${accent.main} 16%, transparent), transparent 24%), radial-gradient(circle at top right, rgba(124,58,237,0.14), transparent 26%), linear-gradient(180deg, #f8fbff 0%, #eef2ff 42%, #f8fafc 100%)`,
  };
}

function cssVariables(base, accent) {
  const vars = {};
  Object.entries(COLOR_VARS).forEach(([name, values]) => {
    vars[name] = values[base] || values.light;
  });
  vars["--sm-accent"] = accent.main;
  vars["--sm-accent-strong"] = accent.strong;
  const isDark = DARK_BASES.includes(base);
  vars["--sm-accent-text"] = isDark ? accent.onDark : accent.main;
  // Elevated cards: shadows read well on light themes; on dark ones depth = lighter surface + faint edge.
  const elevated = isDark
    ? {
        "--sm-elevated-surface": base === "graphite" ? "#1f1f21" : "#1a2335",
        "--sm-elevated-edge": "rgba(255, 255, 255, 0.09)",
        "--sm-elevated-shadow": "0 1px 0 rgba(255, 255, 255, 0.05) inset, 0 8px 24px rgba(0, 0, 0, 0.45)",
        "--sm-elevated-shadow-hover": "0 1px 0 rgba(255, 255, 255, 0.07) inset, 0 14px 32px rgba(0, 0, 0, 0.55)",
      }
    : {
        "--sm-elevated-surface": "var(--c-bg-ffffff)",
        "--sm-elevated-edge": "transparent",
        "--sm-elevated-shadow": "0 10px 28px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.06)",
        "--sm-elevated-shadow-hover": "0 18px 40px rgba(15, 23, 42, 0.12), 0 4px 10px rgba(15, 23, 42, 0.08)",
      };
  return { ...vars, ...elevated, ...shellVars(base, accent), colorScheme: isDark ? "dark" : "light" };
}

function makeTheme(base, accent) {
  const palette = BASE_PALETTES[base] || BASE_PALETTES.light;
  return createTheme({
    palette: {
      ...palette,
      primary: { main: DARK_BASES.includes(base) ? accent.onDark : accent.main, dark: accent.strong, light: accent.onDark },
      secondary: { main: "#7c3aed", dark: "#5b21b6" },
      info: { main: "#0891b2" },
      success: { main: "#16a34a" },
      warning: { main: "#d97706" },
      error: { main: "#dc2626" },
    },
    typography: {
      fontFamily: '"IBM Plex Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      h3: { fontWeight: 800, letterSpacing: "-0.04em" },
      h4: { fontWeight: 800, letterSpacing: "-0.03em" },
      h5: { fontWeight: 800, letterSpacing: "-0.03em" },
      h6: { fontWeight: 700 },
      body2: { lineHeight: 1.55 },
    },
    components: {
      MuiPaper: { styleOverrides: { root: { backgroundImage: "none", borderRadius: 20 } } },
      MuiCard: { styleOverrides: { root: { borderRadius: 24 } } },
      MuiButton: { styleOverrides: { root: { borderRadius: 14, textTransform: "none", fontWeight: 700, paddingInline: 16 } } },
      MuiChip: { styleOverrides: { root: { borderRadius: 999, fontWeight: 600 }, sizeSmall: { height: CHIP_HEIGHT } } },
      MuiTooltip: { defaultProps: { enterDelay: TOOLTIP_DELAY, enterNextDelay: TOOLTIP_DELAY } },
      MuiTextField: { defaultProps: { variant: "outlined" } },
    },
  });
}

const ThemeSettingsContext = createContext({ base: "light", accent: "blue", resolvedBase: "light", setBase: () => {}, setAccent: () => {} });

export function useThemeSettings() {
  return useContext(ThemeSettingsContext);
}

function readSetting(key, allowed, fallback) {
  try {
    const value = localStorage.getItem(key);
    return allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeSetting(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the choice lasts for this session only.
  }
}

export default function ThemeController({ children }) {
  const [base, setBaseState] = useState(() => readSetting("struo_theme_base", THEME_BASES.map((b) => b.id), "light"));
  const [accentId, setAccentState] = useState(() => readSetting("struo_theme_accent", ACCENTS.map((a) => a.id), "blue"));
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches || false);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!query) return undefined;
    const onChange = (event) => setSystemDark(event.matches);
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);

  const setBase = useCallback((value) => {
    setBaseState(value);
    writeSetting("struo_theme_base", value);
  }, []);
  const setAccent = useCallback((value) => {
    setAccentState(value);
    writeSetting("struo_theme_accent", value);
  }, []);

  const resolvedBase = base === "system" ? (systemDark ? "dark" : "light") : base;
  const accent = ACCENTS.find((a) => a.id === accentId) || ACCENTS[0];
  const theme = useMemo(() => makeTheme(resolvedBase, accent), [resolvedBase, accent]);
  const rootVars = useMemo(() => cssVariables(resolvedBase, accent), [resolvedBase, accent]);
  const settings = useMemo(
    () => ({ base, accent: accent.id, resolvedBase, setBase, setAccent }),
    [base, accent.id, resolvedBase, setBase, setAccent]
  );

  return (
    <ThemeSettingsContext.Provider value={settings}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <GlobalStyles styles={{ ":root": rootVars }} />
        {children}
      </ThemeProvider>
    </ThemeSettingsContext.Provider>
  );
}
