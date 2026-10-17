// Pure helpers for the log viewer: splitting output into lines, detecting log levels and stack frames,
// parsing ANSI colors and matching search queries. No React here.

// The view keeps at most MAX_VIEW_LINES lines; older lines are dropped down to TRIM_VIEW_LINES
// (search and "show line" still reach the whole file through the backend).
export const MAX_VIEW_LINES = 200000;
const TRIM_VIEW_LINES = 150000;

export const LEVELS = ["error", "warn", "info", "debug", "other"];
export const LEVEL_LABELS = { error: "Errors", warn: "Warnings", info: "Info", debug: "Debug", other: "Other" };

const ANSI_SGR = /\x1b\[([0-9;]*)m/g; // eslint-disable-line no-control-regex
const ANSI_ANY = /\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07/g; // eslint-disable-line no-control-regex
const LEVEL_KEY_VALUE = /\blevel["']?\s*[=:]\s*["']?(fatal|error|err|warn(?:ing)?|info|debug|trace)\b/i;
const LEVEL_WORD = /\b(FATAL|SEVERE|ERROR|ERR|WARN(?:ING)?|INFO|DEBUG|TRACE)\b/;
const STACK_FRAME = /^\s+(at\s+\S|\.\.\. \d+ (more|common frames omitted)|File ".*", line \d+)/;

const LEVEL_ALIASES = {
  fatal: "error",
  severe: "error",
  error: "error",
  err: "error",
  warn: "warn",
  warning: "warn",
  info: "info",
  debug: "debug",
  trace: "debug",
};

// Text as a terminal would show it: ANSI codes removed and, for progress output that rewrites the line
// with "\r", only the last version kept.
export function plainText(rawLine) {
  let text = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
  if (text.includes("\r")) {
    const parts = text.split("\r").filter(Boolean);
    text = parts.length ? parts[parts.length - 1] : "";
  }
  return text.includes("\x1b") ? text.replace(ANSI_ANY, "") : text;
}

// Node / npm / Vite / webpack output has no level word, so it is recognised by its usual messages.
const TOOL_LEVELS = [
  ["error", /^\s*(?:Uncaught\s+)?(?:[A-Z]\w*)?Error(?:\s*\[\w+\])?:|Internal server error|Pre-transform error|Failed to (?:compile|resolve|load)|error while updating|Module not found/],
  ["warn", /^\s*(?:\(node:\d+\)\s+)?(?:\[\w+\]\s+)?(?:[A-Z]\w*)?Warning:|Could not Fast Refresh|Compiled with warnings/],
  // Also Struo's "[GIT PULL STDOUT]" headers, npm's "> name@1.0.0 dev" / "> vite" and dev-server "➜  Local:" lines.
  ["info", /\[vite\]|\bVITE v\d|[Cc]ompiled successfully|^\[[A-Z][A-Z ]+\]$|^> \S|^\s*➜/],
];

// Level written on the line itself (looks at the start of the line only), or null.
export function detectLevel(text) {
  const head = text.length > 300 ? text.slice(0, 300) : text;
  const match = LEVEL_KEY_VALUE.exec(head) || LEVEL_WORD.exec(head);
  if (match) return LEVEL_ALIASES[match[1].toLowerCase()] || null;
  const tool = TOOL_LEVELS.find(([, pattern]) => pattern.test(head));
  return tool ? tool[0] : null;
}

export function isStackFrame(text, previousWasFrame) {
  if (STACK_FRAME.test(text)) return true;
  // Python tracebacks: the source line under `File "...", line N` is indented further.
  return previousWasFrame && /^\s{4,}\S/.test(text);
}

// Adds lines to the per-line arrays; level is inherited from the line before when a line has none
// (stack traces and multi-line messages belong to the entry that started them).
function annotate(view, fromIndex) {
  const { plain, levels, starts, frames, raw } = view;
  for (let index = fromIndex; index < raw.length; index += 1) {
    const text = plainText(raw[index]);
    const level = detectLevel(text);
    plain[index] = text;
    starts[index] = Boolean(level); // the line names its own level, i.e. starts a log entry
    levels[index] = level || (index > 0 ? levels[index - 1] : "other");
    frames[index] = isStackFrame(text, index > 0 && frames[index - 1]);
  }
}

function trim(view) {
  if (view.raw.length <= MAX_VIEW_LINES) return view;
  const dropped = view.raw.length - TRIM_VIEW_LINES;
  return {
    ...view,
    raw: view.raw.slice(dropped),
    plain: view.plain.slice(dropped),
    levels: view.levels.slice(dropped),
    starts: view.starts.slice(dropped),
    frames: view.frames.slice(dropped),
    ...(view.services ? { services: view.services.slice(dropped) } : {}),
    lineOffset: view.lineOffset + dropped,
  };
}

// View of a log: raw lines plus derived per-line data. lineOffset counts file lines before raw[0], so
// file line number = lineOffset + index + 1. The last element holds output after the final "\n" (often "").
// windowed: an earlier part of the file is shown and live updates are paused. version changes only when the
// view is replaced (not on append), so the viewer knows when earlier lines may have changed.
let viewVersion = 0;

export function createLogView(content = "", { lineOffset = 0, windowed = false } = {}) {
  viewVersion += 1;
  const view = { raw: content.split("\n"), plain: [], levels: [], starts: [], frames: [], lineOffset, windowed, message: "", version: viewVersion };
  annotate(view, 0);
  return trim(view);
}

// A placeholder text shown instead of log lines (no service selected, load errors, …).
export function messageView(message) {
  return { ...createLogView(""), message };
}

export function appendToLogView(view, chunk) {
  if (!chunk) return view;
  if (view.message) return createLogView(chunk);
  const parts = chunk.split("\n");
  const lastIndex = view.raw.length - 1;
  const next = {
    ...view,
    raw: view.raw.slice(0, lastIndex).concat(view.raw[lastIndex] + parts[0], parts.slice(1)),
    plain: view.plain.slice(0, lastIndex),
    levels: view.levels.slice(0, lastIndex),
    starts: view.starts.slice(0, lastIndex),
    frames: view.frames.slice(0, lastIndex),
  };
  annotate(next, lastIndex);
  return trim(next);
}

// Combined view of several services: a log view plus services[i], the index in serviceNames of the service
// that wrote line i. Levels and stack frames carry over from the previous line of the same service, since
// lines of other services can come in between. entries: [[serviceIndex, rawLine], …], complete lines only.
export function createCombinedView(serviceNames, entries = []) {
  viewVersion += 1;
  const view = {
    raw: [], plain: [], levels: [], starts: [], frames: [], services: [],
    serviceNames, lastByService: {}, lineOffset: 0, windowed: false, message: "", version: viewVersion,
  };
  return appendCombinedLines(view, entries);
}

export function appendCombinedLines(view, entries) {
  if (!entries.length) return view;
  const next = {
    ...view,
    raw: view.raw.slice(), plain: view.plain.slice(), levels: view.levels.slice(), starts: view.starts.slice(),
    frames: view.frames.slice(), services: view.services.slice(), lastByService: { ...view.lastByService },
  };
  entries.forEach(([service, rawLine]) => {
    const text = plainText(rawLine);
    const level = detectLevel(text);
    const last = next.lastByService[service] || { level: "other", frame: false };
    const frame = isStackFrame(text, last.frame);
    next.raw.push(rawLine);
    next.plain.push(text);
    next.levels.push(level || last.level);
    next.starts.push(Boolean(level));
    next.frames.push(frame);
    next.services.push(service);
    next.lastByService[service] = { level: level || last.level, frame };
  });
  return trim(next);
}

const SERVICE_COLORS = ["#60a5fa", "#34d399", "#f472b6", "#fbbf24", "#a78bfa", "#22d3ee", "#fb923c", "#a3e635", "#f87171", "#2dd4bf", "#e879f9", "#facc15"];

// Color of a service's name in the combined view (readable on the dark log background).
export function serviceColor(index) {
  return SERVICE_COLORS[index % SERVICE_COLORS.length];
}

// Number of lines worth showing (the trailing "" after a final newline is not a line).
export function visibleLineCount(view) {
  const count = view.raw.length;
  return count > 0 && view.raw[count - 1] === "" ? count - 1 : count;
}

// Runs of at least this many stack frames are folded, keeping the first frame visible.
const MIN_FOLD_RUN = 4;

// Rows for the viewer: line indexes that pass the filters, with long stack-trace runs replaced by a fold row
// { start, end, count } (indexes of the hidden lines). An expanded run keeps its lines and gets a closing
// row { start, end, count, expanded: true } after them. Fold rows are keyed by the file line of `start`.
// services (combined view only): the service indexes to show.
export function buildRows(view, { levels = null, matcher = null, collapseStacks = true, expandedFolds = null, services = null } = {}) {
  const count = visibleLineCount(view);
  const indexes = [];
  for (let index = 0; index < count; index += 1) {
    if (levels && !levels.has(view.levels[index])) continue;
    if (services && !services.has(view.services[index])) continue;
    if (matcher && !matcher.test(view.plain[index])) continue;
    indexes.push(index);
  }
  if (!collapseStacks) return indexes;

  const rows = [];
  let position = 0;
  while (position < indexes.length) {
    const index = indexes[position];
    if (!view.frames[index]) {
      rows.push(index);
      position += 1;
      continue;
    }
    let runEnd = position;
    while (
      runEnd + 1 < indexes.length &&
      view.frames[indexes[runEnd + 1]] &&
      indexes[runEnd + 1] === indexes[runEnd] + 1
    ) {
      runEnd += 1;
    }
    if (runEnd - position + 1 < MIN_FOLD_RUN) {
      for (let item = position; item <= runEnd; item += 1) rows.push(indexes[item]);
    } else {
      rows.push(index);
      const fold = { start: indexes[position + 1], end: indexes[runEnd], count: runEnd - position };
      if (expandedFolds && expandedFolds.has(view.lineOffset + fold.start + 1)) {
        for (let item = position + 1; item <= runEnd; item += 1) rows.push(indexes[item]);
        rows.push({ ...fold, expanded: true });
      } else {
        rows.push(fold);
      }
    }
    position = runEnd + 1;
  }
  return rows;
}

// Line indexes behind a list of rows (folded lines included), e.g. for copying what is shown.
export function rowsToIndexes(rows) {
  const indexes = [];
  rows.forEach((row) => {
    if (typeof row === "number") indexes.push(row);
    else if (!row.expanded) for (let index = row.start; index <= row.end; index += 1) indexes.push(index);
  });
  return indexes;
}

// Level counts over the loaded lines, for the filter chips.
export function countLevels(view) {
  const counts = { error: 0, warn: 0, info: 0, debug: 0, other: 0 };
  const count = visibleLineCount(view);
  for (let index = 0; index < count; index += 1) {
    if (view.starts[index]) counts[view.levels[index]] += 1;
    else if (view.levels[index] === "other") counts.other += 1;
  }
  return counts;
}

// Lines as copied to the clipboard: plain text (no ANSI codes), joined with "\n".
export function joinPlain(view, indexes) {
  return indexes.map((index) => view.plain[index]).join("\n");
}

export function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// { test(text), ranges(text) -> [[start, end], …], error } for the search box options.
export function buildMatcher(query, { caseSensitive = false, regex = false } = {}) {
  if (!query) return null;
  let pattern;
  try {
    pattern = new RegExp(regex ? query : escapeRegExp(query), caseSensitive ? "g" : "gi");
  } catch (error) {
    return { error: error.message, test: () => false, ranges: () => [] };
  }
  const tester = new RegExp(pattern.source, caseSensitive ? "" : "i");
  return {
    error: "",
    test: (text) => tester.test(text),
    ranges: (text) => {
      const ranges = [];
      pattern.lastIndex = 0;
      let match = pattern.exec(text);
      while (match && ranges.length < 200) {
        if (match[0].length === 0) {
          pattern.lastIndex += 1;
        } else {
          ranges.push([match.index, match.index + match[0].length]);
        }
        match = pattern.exec(text);
      }
      return ranges;
    },
  };
}

// ANSI SGR colors tuned for the dark log background.
const ANSI_COLORS = ["#64748b", "#f87171", "#4ade80", "#facc15", "#60a5fa", "#e879f9", "#22d3ee", "#e2e8f0"];
const ANSI_BRIGHT_COLORS = ["#94a3b8", "#fca5a5", "#86efac", "#fde047", "#93c5fd", "#f0abfc", "#67e8f9", "#ffffff"];
const styleCache = new Map();

function styleFor(state) {
  const key = `${state.color || ""}|${state.background || ""}|${state.bold ? 1 : 0}|${state.dim ? 1 : 0}|${state.italic ? 1 : 0}|${state.underline ? 1 : 0}`;
  if (!styleCache.has(key)) {
    const style = {};
    if (state.color) style.color = state.color;
    if (state.background) style.backgroundColor = state.background;
    if (state.bold) style.fontWeight = 700;
    if (state.dim) style.opacity = 0.7;
    if (state.italic) style.fontStyle = "italic";
    if (state.underline) style.textDecoration = "underline";
    styleCache.set(key, Object.keys(style).length ? style : null);
  }
  return styleCache.get(key);
}

function applySgr(state, codes) {
  const values = codes === "" ? [0] : codes.split(";").map(Number);
  for (let index = 0; index < values.length; index += 1) {
    const code = values[index];
    if (code === 0) {
      Object.keys(state).forEach((key) => delete state[key]);
    } else if (code === 1) state.bold = true;
    else if (code === 2) state.dim = true;
    else if (code === 3) state.italic = true;
    else if (code === 4) state.underline = true;
    else if (code === 22) { state.bold = false; state.dim = false; }
    else if (code === 23) state.italic = false;
    else if (code === 24) state.underline = false;
    else if (code >= 30 && code <= 37) state.color = ANSI_COLORS[code - 30];
    else if (code >= 90 && code <= 97) state.color = ANSI_BRIGHT_COLORS[code - 90];
    else if (code === 39) delete state.color;
    else if (code >= 40 && code <= 47) state.background = ANSI_COLORS[code - 40];
    else if (code >= 100 && code <= 107) state.background = ANSI_BRIGHT_COLORS[code - 100];
    else if (code === 49) delete state.background;
    else if ((code === 38 || code === 48) && values[index + 1] === 5) index += 2; // 256-color: ignored
    else if ((code === 38 || code === 48) && values[index + 1] === 2) index += 4; // true color: ignored
  }
}

// [{ text, style }] for a raw line; texts concatenate to plainText(rawLine).
export function ansiSegments(rawLine) {
  let text = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
  if (text.includes("\r")) {
    const parts = text.split("\r").filter(Boolean);
    text = parts.length ? parts[parts.length - 1] : "";
  }
  if (!text.includes("\x1b")) return [{ text, style: null }];
  const segments = [];
  const state = {};
  let cursor = 0;
  ANSI_SGR.lastIndex = 0;
  let match = ANSI_SGR.exec(text);
  while (match) {
    if (match.index > cursor) {
      segments.push({ text: text.slice(cursor, match.index).replace(ANSI_ANY, ""), style: styleFor(state) });
    }
    applySgr(state, match[1]);
    cursor = match.index + match[0].length;
    match = ANSI_SGR.exec(text);
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor).replace(ANSI_ANY, ""), style: styleFor(state) });
  return segments.filter((segment) => segment.text);
}
