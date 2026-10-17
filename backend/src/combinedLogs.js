// Combined live log of several services: one stream of the services' current runs, each line tagged with
// its service and the streams merged in time order. Used by the Logs page when config.logs.combinedView is on.
const fsp = require("fs/promises");
const logger = require("./logger");

const DEFAULT_LINES = 300; // initial lines per service
const MAX_LINES = 2000;
const TAIL_BYTES = 512 * 1024; // read per service for the initial lines
const MAX_READ_BYTES = 1024 * 1024; // new output read per service per poll; anything beyond is skipped
const POLL_MS = 1000;
const PARTIAL_FLUSH_MS = 3000; // a last line without "\n" is shown once it has stopped changing this long
const MAX_PARTIAL_BYTES = 64 * 1024;

// Timestamps near the start of a line: "2026-10-16T08:59:44.495+05:30", "2026-10-16 09:01:22,420", "9:12:47 am".
const ISO_TIME = /(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,9}))?\s*(Z|[+-]\d{2}:?\d{2})?/;
const CLOCK_TIME = /^\[?(\d{1,2}):(\d{2}):(\d{2})(?:[.,](\d{1,3}))?\s*([ap]m)?\b/i;
const RUN_FILE_TIME = /_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})(?:_\d+)?\.log$/;

function millis(fraction) {
  return fraction ? Number(fraction.slice(0, 3).padEnd(3, "0")) : 0;
}

// Time written at the start of a line (ms since epoch), or null. Times without a date are taken as today.
function lineTime(rawLine, now = Date.now()) {
  const head = logger.plainLine(rawLine.length > 160 ? rawLine.slice(0, 160) : rawLine).trimStart();
  const iso = ISO_TIME.exec(head);
  if (iso && iso.index < 40) {
    const [, year, month, day, hour, minute, second, fraction, zone] = iso;
    if (!zone) return new Date(+year, +month - 1, +day, +hour, +minute, +second, millis(fraction)).getTime();
    const offset = zone === "Z" || zone.includes(":") ? zone : `${zone.slice(0, 3)}:${zone.slice(3)}`;
    const parsed = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}.${String(millis(fraction)).padStart(3, "0")}${offset}`);
    return Number.isNaN(parsed) ? null : parsed;
  }
  const clock = CLOCK_TIME.exec(head);
  if (clock) {
    const [, hourText, minute, second, fraction, meridiem] = clock;
    let hour = Number(hourText);
    if (meridiem) hour = (hour % 12) + (meridiem.toLowerCase() === "pm" ? 12 : 0);
    const date = new Date(now);
    date.setHours(hour, Number(minute), Number(second), millis(fraction));
    const time = date.getTime();
    return time > now + 60000 ? time - 86400000 : time; // just after midnight: the line is from yesterday
  }
  return null;
}

function runStartTime(filePath) {
  const match = RUN_FILE_TIME.exec(filePath);
  return match ? new Date(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], +match[6]).getTime() : 0;
}

// Lines without a time of their own (stack traces, continuation lines) take the time of the line before,
// and a service's times never go backwards, so merging keeps each service's lines in their original order.
// A service that has written no times in this run uses the time new lines arrive (arrivedAt), so its live
// output still interleaves with the other services.
function tagLine(state, text, arrivedAt) {
  const own = lineTime(text);
  if (own !== null) state.hasTimes = true;
  const fallback = !state.hasTimes && arrivedAt ? arrivedAt : state.lastTime || state.runStart;
  const time = Math.max(own ?? fallback, state.lastTime || 0);
  state.lastTime = time;
  return { service: state.index, text, time };
}

// Complete lines written to the service's current run since the last read. initial: the newest lines only.
async function readNewLines(state, { initial = false, maxLines = DEFAULT_LINES } = {}) {
  const filePath = await logger.getCurrentLogPath(state.name);
  if (!filePath) return [];
  let size;
  try {
    ({ size } = await fsp.stat(filePath));
  } catch {
    return [];
  }
  if (filePath !== state.filePath || size < state.offset) {
    // A new run started (or the log was cleared): read the new file from its start.
    state.filePath = filePath;
    state.offset = 0;
    state.runStart = runStartTime(filePath);
    state.lastTime = 0;
    state.hasTimes = false;
    state.pending = null;
  }
  if (size <= state.offset) return [];

  const output = [];
  let start = state.offset;
  const limit = initial ? TAIL_BYTES : MAX_READ_BYTES;
  let dropFirst = false;
  if (size - start > limit) {
    if (!initial) output.push(`… ${Math.round((size - limit - start) / 1024)} KB of output skipped`);
    start = size - limit;
    dropFirst = true; // starts mid-line
  }

  const handle = await fsp.open(filePath, "r");
  let buffer;
  try {
    buffer = Buffer.alloc(size - start);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, start);
    buffer = buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }

  const firstNewline = buffer.indexOf(10);
  const from = !dropFirst ? 0 : firstNewline === -1 ? buffer.length : firstNewline + 1;
  const lastNewline = buffer.lastIndexOf(10);
  let end = lastNewline >= from ? lastNewline : from; // complete lines are buffer[from, end)
  let consumed = lastNewline >= from ? lastNewline + 1 : from;
  const now = Date.now();

  // A trailing line without "\n" (a prompt, or output still being written) is shown once it stops growing.
  const rest = buffer.length - consumed;
  if (rest > 0) {
    if (state.pending && state.pending.size === size && now - state.pending.since >= PARTIAL_FLUSH_MS && rest <= MAX_PARTIAL_BYTES) {
      end = buffer.length;
      consumed = buffer.length;
      state.pending = null;
    } else if (!state.pending || state.pending.size !== size) {
      state.pending = { size, since: now };
    }
  } else {
    state.pending = null;
  }
  state.offset = start + consumed;

  if (end > from) {
    const text = buffer.toString("utf8", from, end);
    text.split("\n").forEach((line) => {
      if (logger.plainLine(line).trim()) output.push(line.endsWith("\r") ? line.slice(0, -1) : line);
    });
  }
  const lines = initial ? output.slice(-maxLines) : output;
  return lines.map((line) => tagLine(state, line, initial ? null : now));
}

// Stable sort by time: lines with the same time keep their order.
function inTimeOrder(lines) {
  return lines.sort((a, b) => a.time - b.time).map((line) => [line.service, line.text]);
}

// Server-sent events: {type:"initial", services, lines:[[serviceIndex, text], …]} then {type:"append", lines}.
async function streamCombinedLogs(req, res, names, { lines = DEFAULT_LINES } = {}) {
  const maxLines = Math.min(Math.max(Number(lines) || DEFAULT_LINES, 1), MAX_LINES);
  const states = names.map((name, index) => ({ name, index, filePath: null, offset: 0, runStart: 0, lastTime: 0, hasTimes: false, pending: null }));
  let closed = false;
  let checking = false;
  let pollTimer = null;
  let heartbeatTimer = null;

  const send = (payload) => {
    if (!closed) res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };
  const cleanup = () => {
    closed = true;
    clearInterval(pollTimer);
    clearInterval(heartbeatTimer);
  };
  req.on("close", cleanup);
  req.on("aborted", cleanup);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Cache-Control"
  });

  const readAll = async (options) => {
    const results = await Promise.all(states.map((state) => readNewLines(state, options).catch((error) => {
      if (error.code !== "ENOENT") console.error(`Combined logs: error reading ${state.name}:`, error.message);
      return [];
    })));
    return inTimeOrder(results.flat());
  };

  send({ type: "initial", services: names, lines: await readAll({ initial: true, maxLines }) });
  if (closed) return;

  pollTimer = setInterval(async () => {
    if (checking || closed) return;
    checking = true;
    try {
      const newLines = await readAll();
      if (newLines.length) send({ type: "append", lines: newLines });
    } finally {
      checking = false;
    }
  }, POLL_MS);

  heartbeatTimer = setInterval(() => send({ type: "heartbeat" }), 30000);
}

module.exports = { streamCombinedLogs, lineTime };
