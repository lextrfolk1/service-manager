// Shared UI values so every page uses the same status colours, fonts and sizes.

export const STATUS_COLORS = {
  running: "var(--c-text-12b76a)", // solid dot / accent bar
  runningText: "var(--c-text-067647)",
  stopped: "var(--c-text-98a2b3)", // hollow dot outline
  stoppedText: "var(--c-text-475467)",
  failed: "var(--c-text-dc2626)",
  failedText: "var(--c-text-b42318)",
  busy: "var(--c-text-d97706)",
};

export const CODE_FONT = '"Monaco", "Menlo", "Ubuntu Mono", monospace';

export const TOOLTIP_DELAY = 400; // ms, applied to every Tooltip via the theme
export const CHIP_HEIGHT = 22; // small label chips
export const TOP_BAR_HEIGHT = 44; // tab/tool bar at the top of Logs, Admin and Help
export const SEARCH_INPUT_SX = { height: 32, fontSize: "0.82rem", borderRadius: 999 }; // pill search boxes
