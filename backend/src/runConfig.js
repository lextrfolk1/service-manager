// Run configuration: extra per-service parameters (environment variables, JVM arguments, program arguments)
// kept outside services.json and edited from Admin.
//
// Stored in run-config.json next to services.json. The file is optional and git-ignored: it is created the
// first time run configuration is saved from Admin, and if it is deleted, services simply run without extras.
//
// Commands in services.json keep working unchanged: values are injected at start time (see applyToCommand).

const fs = require("fs");
const path = require("path");
const { resolveConfigPath } = require("./configResolver");

function getFilePath() {
  return path.join(path.dirname(resolveConfigPath()), "run-config.json");
}

function normalize(data) {
  const services = data && typeof data.services === "object" && data.services ? data.services : {};
  return { services };
}

// Missing or unreadable file means "no run configuration".
function read() {
  try {
    return normalize(JSON.parse(fs.readFileSync(getFilePath(), "utf8")));
  } catch {
    return { services: {} };
  }
}

function write(data) {
  const local = normalize(data);
  fs.writeFileSync(getFilePath(), `${JSON.stringify(local, null, 2)}\n`, "utf8");
  return local;
}

// Which run configuration fields apply to each service type (keep in sync with Admin.js RUN_FIELDS_BY_TYPE).
// Types not listed (redis, neo4j, database, docker, …) only take environment variables.
const RUN_FIELDS_BY_TYPE = {
  java: ["jvmArgs", "args", "env"],
  python: ["args", "env"],
  listener: ["args", "env"],
  npm: ["args", "env"],
  "": ["args", "env"],
};

// Accepts JVM arguments with or without -D: "spring.profiles.active=dev -Xmx1g" → "-Dspring.profiles.active=dev -Xmx1g".
// Tokens already starting with "-" are kept as written; quoted values stay intact.
function normalizeJvmArgs(value) {
  const tokens = String(value || "").match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  return tokens.map((token) => (token.startsWith("-") ? token : `-D${token}`)).join(" ");
}

function getRunFields(type) {
  return RUN_FIELDS_BY_TYPE[type || ""] || ["env"];
}

// Values for one service with empty entries dropped (empty means "not set").
function forService(name, type) {
  let entry = {};
  try {
    entry = read().services[name] || {};
  } catch {
    entry = {};
  }
  const env = Object.fromEntries(
    Object.entries(entry.env || {}).filter(([key, value]) => key && value !== undefined && value !== null && String(value) !== "")
  );
  const fields = getRunFields(type);
  return {
    env: fields.includes("env") ? env : {},
    jvmArgs: fields.includes("jvmArgs") ? normalizeJvmArgs(entry.jvmArgs) : "",
    args: fields.includes("args") ? String(entry.args || "").trim() : "",
  };
}

// Injects jvmArgs/args into a command. Commands with ${jvmArgs}/${args} placeholders get them substituted;
// otherwise common launchers are recognised so services.json never has to change.
// Returns { command, extraEnv } — extraEnv is used when JVM args can't be placed in the command.
function applyToCommand(command, { jvmArgs = "", args = "" } = {}) {
  let result = String(command || "");
  const extraEnv = {};
  const hasJvmPlaceholder = result.includes("${jvmArgs}");
  const hasArgsPlaceholder = result.includes("${args}");
  result = result.split("${jvmArgs}").join(jvmArgs).split("${args}").join(args);

  const isSpringBootRun = /\bspring-boot:run\b/.test(result);

  if (jvmArgs && !hasJvmPlaceholder) {
    const jvmFlag = /(-Dspring-boot\.run\.jvmArguments=")([^"]*)(")/;
    if (isSpringBootRun && jvmFlag.test(result)) {
      result = result.replace(jvmFlag, (_, open, existing, close) => `${open}${existing ? `${existing} ` : ""}${jvmArgs}${close}`);
    } else if (isSpringBootRun) {
      result = result.replace(/\bspring-boot:run\b/, `spring-boot:run -Dspring-boot.run.jvmArguments="${jvmArgs}"`);
    } else if (/(^|[\s;&|(])java\s/.test(result)) {
      result = result.replace(/(^|[\s;&|(])java\s/, (match) => `${match}${jvmArgs} `);
    } else {
      extraEnv.JAVA_TOOL_OPTIONS = jvmArgs;
    }
  }

  if (args && !hasArgsPlaceholder) {
    const argsFlag = /(-Dspring-boot\.run\.arguments=")([^"]*)(")/;
    if (isSpringBootRun && argsFlag.test(result)) {
      result = result.replace(argsFlag, (_, open, existing, close) => `${open}${existing ? `${existing} ` : ""}${args}${close}`);
    } else if (isSpringBootRun) {
      result = result.replace(/\bspring-boot:run\b/, `spring-boot:run -Dspring-boot.run.arguments="${args}"`);
    } else if (/\bnpm\s+(run\s+\S+|start)\b/.test(result) && !/\bnpm\s+(run\s+\S+|start)\s+--(\s|$)/.test(result)) {
      result = `${result} -- ${args}`;
    } else {
      result = `${result} ${args}`;
    }
  }

  return { command: result.replace(/\s+$/, ""), extraEnv };
}

const SECRET_NAME = /(pass(word|wd)?|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|auth|credential)/i;

// Hides secrets in a command before it is written to a log: values of run configuration env vars, and
// NAME=value pairs whose name looks like a secret (e.g. OPENAI_API_KEY=…, -e CLICKHOUSE_PASSWORD=…).
function maskSecrets(command, env = {}) {
  let masked = String(command || "");
  Object.values(env)
    .filter((value) => String(value).length >= 3)
    .forEach((value) => {
      masked = masked.split(String(value)).join("***");
    });
  return masked.replace(/\b([A-Za-z_][A-Za-z0-9_.]*)=("[^"]*"|'[^']*'|[^\s"']+)/g, (match, name) =>
    SECRET_NAME.test(name) ? `${name}=***` : match
  );
}

// Header lines written at the top of each run log so it is clear what the run used.
// Env vars are listed by name only; the command has secrets masked.
function describeRun({ command, settings, extraEnv = {} }) {
  const lines = [];
  if (settings.jvmArgs) lines.push(`[RUN CONFIG] JVM arguments: ${maskSecrets(settings.jvmArgs, settings.env)}`);
  if (settings.args) lines.push(`[RUN CONFIG] Arguments: ${maskSecrets(settings.args, settings.env)}`);
  const envNames = Object.keys(settings.env || {});
  if (envNames.length) lines.push(`[RUN CONFIG] Environment: ${envNames.join(", ")} (values hidden)`);
  if (extraEnv.JAVA_TOOL_OPTIONS) lines.push("[RUN CONFIG] JVM arguments passed via JAVA_TOOL_OPTIONS");
  if (!lines.length) lines.push("[RUN CONFIG] none");
  lines.push(`[RUN COMMAND] ${maskSecrets(command, settings.env)}`);
  return `${lines.join("\n")}\n`;
}

module.exports = {
  normalizeJvmArgs,
  maskSecrets,
  describeRun,
  read,
  write,
  forService,
  getRunFields,
  applyToCommand,
  getFilePath,
};
