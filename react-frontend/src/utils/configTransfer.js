// Import / Export of the configuration (services.json content and this machine's run-config.json).
// Export file shape:
//   { format, version, exportedAt, config: { basePaths, logs, presets, ui, dependencyCheck }, services, runConfig: { services } }
// A plain services.json ({ config, services }) is also accepted on import.
import { cleanRunConfig } from "../components/RunConfigEditor";
import { DEFAULT_CARD_STYLE, normalizeCardStyle } from "../components/cards/cardModel";

export const EXPORT_FORMAT = "struo-config";
export const EXPORT_VERSION = 1;
// Stands in for a secret value; importing or applying it keeps the value already saved on this machine.
export const HIDDEN_VALUE = "<hidden>";

// Same rule the backend uses to mask secrets in run logs.
const SECRET_NAME = /(pass(word|wd)?|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|auth|credential)/i;

export const TRANSFER_SECTIONS = [
  { id: "services", label: "Services and groups", hint: "Service definitions, dependencies and groups", exportByDefault: true },
  { id: "presets", label: "Presets", hint: "Named service lists for Start", exportByDefault: true },
  { id: "logs", label: "Log retention", hint: "Archive and cleanup settings", exportByDefault: true },
  { id: "settings", label: "General settings", hint: "Default card style and dependency check", exportByDefault: true },
  { id: "paths", label: "Paths", hint: "Folders on this machine", exportByDefault: false },
  { id: "runConfig", label: "Run configuration", hint: "This machine's JVM options, arguments and environment variables", exportByDefault: false },
];

const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export const isSecretName = (name) => SECRET_NAME.test(String(name || ""));

// Finds the first JSON syntax error with its line and column. Browser messages often give neither.
// Returns "" for valid JSON, otherwise e.g. "Line 12, column 5: Trailing comma before '}'".
export function describeJsonError(text) {
  const source = String(text || "");
  let i = 0;
  const fail = (message) => {
    throw Object.assign(new Error(message), { index: Math.min(i, source.length) });
  };
  const ws = () => {
    while (i < source.length && " \t\n\r".includes(source[i])) i += 1;
  };
  const string = () => {
    i += 1;
    while (i < source.length) {
      const c = source[i];
      if (c === '"') {
        i += 1;
        return;
      }
      if (c === "\\") i += 2;
      else if (c < " ") fail("Line break or control character inside a string");
      else i += 1;
    }
    fail("Unterminated string");
  };
  const value = () => {
    ws();
    const c = source[i];
    if (c === undefined) fail("Unexpected end of JSON");
    if (c === "{" || c === "[") {
      const close = c === "{" ? "}" : "]";
      i += 1;
      ws();
      if (source[i] === close) {
        i += 1;
        return;
      }
      for (;;) {
        ws();
        if (c === "{") {
          if (source[i] !== '"') fail("Expected a property name in double quotes");
          string();
          ws();
          if (source[i] !== ":") fail("Expected ':' after the property name");
          i += 1;
        }
        value();
        ws();
        if (source[i] === ",") {
          i += 1;
          ws();
          if (source[i] === close) fail(`Trailing comma before '${close}'`);
          continue;
        }
        if (source[i] === close) {
          i += 1;
          return;
        }
        fail(source[i] === undefined ? "Unexpected end of JSON" : `Expected ',' or '${close}'`);
      }
    }
    if (c === '"') return string();
    const number = /-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/y;
    number.lastIndex = i;
    if ((c === "-" || (c >= "0" && c <= "9")) && number.test(source)) {
      i = number.lastIndex;
      return;
    }
    const literal = ["true", "false", "null"].find((word) => source.startsWith(word, i));
    if (literal) {
      i += literal.length;
      return;
    }
    fail(`Unexpected character '${c}'`);
  };
  try {
    value();
    ws();
    if (i < source.length) fail("Unexpected text after the end of the JSON");
    return "";
  } catch (error) {
    const before = source.slice(0, error.index).split("\n");
    return `Line ${before.length}, column ${before[before.length - 1].length + 1}: ${error.message}`;
  }
}

// True when paths look like they come from a different OS (Windows drive paths on macOS/Linux, or the reverse).
export function pathsLookForeign(basePaths, platform) {
  const values = Object.values(basePaths || {}).map(String).filter(Boolean);
  if (!values.length || !platform || platform === "unknown") return false;
  const windowsStyle = (value) => /^[A-Za-z]:[\\/]/.test(value);
  return platform === "win32" ? values.every((value) => !windowsStyle(value)) : values.some(windowsStyle);
}

// Replaces secret-looking environment values with HIDDEN_VALUE.
export function maskRunConfig(runConfig) {
  const { services } = cleanRunConfig(runConfig);
  Object.values(services).forEach((entry) => {
    if (!entry.env) return;
    entry.env = Object.fromEntries(
      Object.entries(entry.env).map(([key, value]) => [key, isSecretName(key) && value !== "" ? HIDDEN_VALUE : value])
    );
  });
  return { services };
}

// Puts saved values back where HIDDEN_VALUE was left; a placeholder with nothing saved behind it is dropped.
export function unmaskRunConfig(incoming, current) {
  const saved = cleanRunConfig(current).services;
  const { services } = cleanRunConfig(incoming);
  Object.entries(services).forEach(([name, entry]) => {
    if (!entry.env) return;
    const env = {};
    Object.entries(entry.env).forEach(([key, value]) => {
      if (value !== HIDDEN_VALUE) env[key] = value;
      else if (saved[name]?.env?.[key] !== undefined) env[key] = saved[name].env[key];
    });
    if (Object.keys(env).length) entry.env = env;
    else delete entry.env;
    if (!Object.keys(entry).length) delete services[name];
  });
  return { services };
}

// Export file content for the chosen sections. Secret values are hidden unless includeSecrets is set.
export function buildExport(draftConfig, runConfig, sections, { includeSecrets = false } = {}) {
  const source = draftConfig.config || {};
  const config = {};
  if (sections.includes("paths")) config.basePaths = source.basePaths || {};
  if (sections.includes("logs")) config.logs = source.logs || {};
  if (sections.includes("presets")) config.presets = source.presets || null;
  if (sections.includes("settings")) {
    config.ui = { ...(source.ui || {}), cardStyle: normalizeCardStyle(source.ui?.cardStyle) };
    config.dependencyCheck = source.dependencyCheck !== false;
  }
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    ...(Object.keys(config).length ? { config } : {}),
    ...(sections.includes("services") ? { services: draftConfig.services || {} } : {}),
    ...(sections.includes("runConfig") ? { runConfig: includeSecrets ? cleanRunConfig(runConfig) : maskRunConfig(runConfig) } : {}),
  };
}

export function exportFileName(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `struo-config-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

// Parses an export file or a plain services.json. Returns { doc, available } or throws with a readable message.
export function parseImport(text) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (error) {
    throw new Error(`Not valid JSON. ${describeJsonError(text) || error.message}`);
  }
  if (!isPlainObject(doc)) throw new Error("The file must contain a JSON object");
  if (doc.format !== undefined && doc.format !== EXPORT_FORMAT) throw new Error(`Unknown format "${doc.format}"`);
  if (doc.version !== undefined && doc.version > EXPORT_VERSION) {
    throw new Error(`The file is version ${doc.version}; this app reads up to version ${EXPORT_VERSION}`);
  }
  if (doc.services !== undefined && !isPlainObject(doc.services)) throw new Error('"services" must be an object');
  if (doc.config !== undefined && !isPlainObject(doc.config)) throw new Error('"config" must be an object');
  if (doc.runConfig !== undefined && !isPlainObject(doc.runConfig?.services)) throw new Error('"runConfig.services" must be an object');
  const config = doc.config || {};
  const available = [];
  if (doc.services) available.push("services");
  if ("presets" in config) available.push("presets");
  if ("logs" in config) available.push("logs");
  if ("ui" in config || "dependencyCheck" in config) available.push("settings");
  if ("basePaths" in config) available.push("paths");
  if (doc.runConfig) available.push("runConfig");
  if (!available.length) throw new Error("No configuration found in this file");
  return { doc, available: TRANSFER_SECTIONS.map((s) => s.id).filter((id) => available.includes(id)) };
}

function keyChanges(label, before = {}, after = {}) {
  const added = Object.keys(after).filter((key) => !(key in before));
  const removed = Object.keys(before).filter((key) => !(key in after));
  const updated = Object.keys(after).filter((key) => key in before && !same(before[key], after[key]));
  const list = (names) => (names.length > 4 ? `${names.slice(0, 4).join(", ")} +${names.length - 4} more` : names.join(", "));
  const lines = [];
  if (added.length) lines.push({ kind: "added", text: `${label}: ${added.length} added (${list(added)})` });
  if (updated.length) lines.push({ kind: "changed", text: `${label}: ${updated.length} updated (${list(updated)})` });
  if (removed.length) lines.push({ kind: "removed", text: `${label}: ${removed.length} removed (${list(removed)})` });
  return lines;
}

// Works out the editor state after importing the chosen sections.
// current: { basePaths, services, logs, presets, effectivePresets, cardStyle, dependencyCheck, runConfig }
// mode "merge" adds and updates only; "replace" makes each chosen section exactly what the file has.
// Returns { next, changes } where next holds only the parts that change.
export function planImport(current, doc, sections, mode) {
  const replace = mode === "replace";
  const config = doc.config || {};
  const next = {};
  const changes = [];
  const pick = (id, label, before, incoming) => {
    if (!sections.includes(id)) return;
    const after = replace ? { ...(incoming || {}) } : { ...before, ...(incoming || {}) };
    const lines = keyChanges(label, before, after);
    if (lines.length) {
      next[id] = after;
      changes.push(...lines);
    }
  };
  pick("services", "Services", current.services, doc.services);
  pick("paths", "Paths", current.basePaths, config.basePaths);
  pick("logs", "Log retention", current.logs, config.logs);

  if (sections.includes("presets")) {
    const incoming = isPlainObject(config.presets) && Object.keys(config.presets).length ? config.presets : null;
    // Merging onto built-in presets keeps them, so they're copied in as the starting point.
    const after = replace ? incoming : incoming ? { ...current.effectivePresets, ...incoming } : current.presets;
    if (!same(after, current.presets)) {
      next.presets = after;
      changes.push(...(after ? keyChanges("Presets", current.effectivePresets, after) : [{ kind: "changed", text: "Presets: back to the built-in presets" }]));
    }
  }

  if (sections.includes("settings")) {
    if ("ui" in config || replace) {
      const cardStyle = normalizeCardStyle(config.ui?.cardStyle || DEFAULT_CARD_STYLE);
      if (cardStyle !== current.cardStyle) {
        next.cardStyle = cardStyle;
        changes.push({ kind: "changed", text: `Default card style: ${current.cardStyle} → ${cardStyle}` });
      }
    }
    if ("dependencyCheck" in config || replace) {
      const dependencyCheck = config.dependencyCheck !== false;
      if (dependencyCheck !== current.dependencyCheck) {
        next.dependencyCheck = dependencyCheck;
        changes.push({ kind: "changed", text: `Dependency check: ${dependencyCheck ? "on" : "off"}` });
      }
    }
  }

  if (sections.includes("runConfig")) {
    const before = cleanRunConfig(current.runConfig).services;
    const incoming = unmaskRunConfig(doc.runConfig, current.runConfig).services;
    let after = incoming;
    if (!replace) {
      after = { ...before };
      Object.entries(incoming).forEach(([name, entry]) => {
        const base = before[name] || {};
        const env = { ...(base.env || {}), ...(entry.env || {}) };
        after[name] = { ...base, ...entry, ...(Object.keys(env).length ? { env } : {}) };
      });
    }
    // Values are never listed: they may be secrets.
    const lines = keyChanges("Run configuration", before, after);
    if (lines.length) {
      next.runConfig = { services: after };
      changes.push(...lines);
    }
  }
  return { next, changes };
}
