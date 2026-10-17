import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Box } from "@mui/material";
import { CODE_FONT } from "../../theme/tokens";
import { ansiSegments, serviceColor } from "./logLines";

// Rows are rendered in blocks; only blocks near the viewport are in the DOM. Without wrapping every row is
// exactly one line high; with wrapping, block heights are measured after they render.
const BLOCK_SIZE = 100;
const OVERSCAN_PX = 800;

const LEVEL_CLASS = { error: "lv-error", warn: "lv-warn", debug: "lv-debug" };

const TOKEN_CHAR = /[\w.:-]/;

// The word under a double-click, widened to a whole ID such as a trace ID or UUID (selection stops at "-").
function wordAtSelection() {
  const selection = window.getSelection();
  const node = selection?.anchorNode;
  if (!node || node.nodeType !== Node.TEXT_NODE) return selection?.toString().trim() || "";
  const text = node.textContent;
  let start = Math.min(selection.anchorOffset, node === selection.focusNode ? selection.focusOffset : selection.anchorOffset);
  let end = node === selection.focusNode ? Math.max(selection.anchorOffset, selection.focusOffset) : text.length;
  while (start > 0 && TOKEN_CHAR.test(text[start - 1])) start -= 1;
  while (end < text.length && TOKEN_CHAR.test(text[end])) end += 1;
  const word = text.slice(start, end).replace(/^[.:-]+|[.:-]+$/g, "");
  // "traceId-spanId" (Spring) or a W3C traceparent "00-traceId-spanId-01": the trace ID is shared across services.
  const traceAndSpan = /(?:^|-)([0-9a-f]{32})-[0-9a-f]{16}(?:-[0-9a-f]{2})?$/i.exec(word);
  return traceAndSpan ? traceAndSpan[1] : word;
}

function rowLine(row, lineOffset) {
  return lineOffset + (typeof row === "number" ? row : row.start) + 1;
}

// Splits ANSI-colored segments at search match boundaries so matches can be highlighted.
function renderText(raw, plain, matcher) {
  const segments = ansiSegments(raw);
  const ranges = matcher ? matcher.ranges(plain) : [];
  if (!ranges.length) {
    if (segments.length === 1 && !segments[0].style) return plain || " ";
    if (!segments.length) return " ";
    return segments.map((segment, index) => (
      <span key={index} style={segment.style || undefined}>{segment.text}</span>
    ));
  }
  const output = [];
  let position = 0;
  let rangeIndex = 0;
  segments.forEach((segment, segmentIndex) => {
    const segmentEnd = position + segment.text.length;
    let cursor = position;
    while (cursor < segmentEnd) {
      while (rangeIndex < ranges.length && ranges[rangeIndex][1] <= cursor) rangeIndex += 1;
      const range = ranges[rangeIndex];
      const inMatch = range && range[0] <= cursor;
      const pieceEnd = Math.min(segmentEnd, inMatch ? range[1] : range ? range[0] : segmentEnd);
      const text = segment.text.slice(cursor - position, pieceEnd - position);
      const key = `${segmentIndex}-${cursor}`;
      output.push(
        inMatch ? (
          <mark key={key} className="lv-mark" style={segment.style || undefined}>{text}</mark>
        ) : (
          <span key={key} style={segment.style || undefined}>{text}</span>
        )
      );
      cursor = pieceEnd;
    }
    position = segmentEnd;
  });
  return output.length ? output : " ";
}

const LogViewer = forwardRef(function LogViewer(
  {
    view,
    rows,
    layoutKey,
    fontSize = 12,
    wrap = false,
    colorLevels = true,
    matcher = null,
    selectedMatchLine = null,
    selection = null,
    following = false,
    onFollowingChange,
    onGutterClick,
    onToggleFold,
    onServiceClick, // combined view: click on a service name
    onWordDoubleClick, // double-click on a word in a line, with the word (e.g. a trace ID)
    emptyText = "(empty log)",
  },
  ref
) {
  const containerRef = useRef(null);
  const lineHeight = Math.round(fontSize * 1.6);
  const [viewport, setViewport] = useState({ top: 0, height: 600 });
  const [measureTick, setMeasureTick] = useState(0);
  const measuredRef = useRef(new Map());
  const blockElementsRef = useRef(new Map());
  const pendingScrollRef = useRef(null); // { line, attempts }
  const frameRef = useRef(0);
  const lastRowsRef = useRef(null);
  const lastHeightRef = useRef(0);
  const followingRef = useRef(false);

  // Measured block heights are only valid for the same rows, wrap width and font.
  const fullLayoutKey = `${layoutKey}|${wrap}|${fontSize}`;
  const lastLayoutKeyRef = useRef(fullLayoutKey);
  if (lastLayoutKeyRef.current !== fullLayoutKey) {
    lastLayoutKeyRef.current = fullLayoutKey;
    measuredRef.current = new Map();
  }

  const blockCount = Math.ceil(rows.length / BLOCK_SIZE);
  // Top of each block (one entry per block, plus the total). measureTick changes when wrapped heights are measured.
  const blockOffsets = useMemo(() => {
    const offsets = new Array(blockCount + 1);
    offsets[0] = 0;
    for (let block = 0; block < blockCount; block += 1) {
      const rowsInBlock = Math.min(BLOCK_SIZE, rows.length - block * BLOCK_SIZE);
      const height = wrap ? measuredRef.current.get(block) ?? rowsInBlock * lineHeight : rowsInBlock * lineHeight;
      offsets[block + 1] = offsets[block] + height;
    }
    return offsets;
  }, [blockCount, fullLayoutKey, lineHeight, measureTick, rows.length, wrap]); // eslint-disable-line react-hooks/exhaustive-deps
  const totalHeight = blockOffsets[blockCount];

  // Last block whose top is at or above y.
  const blockAt = useCallback((y) => {
    let low = 0;
    let high = Math.max(0, blockCount - 1);
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (blockOffsets[middle] <= y) low = middle;
      else high = middle - 1;
    }
    return low;
  }, [blockCount, blockOffsets]);

  const firstBlock = blockCount ? blockAt(Math.max(0, viewport.top - OVERSCAN_PX)) : 0;
  const lastBlock = blockCount ? blockAt(viewport.top + viewport.height + OVERSCAN_PX) : -1;

  // Position of the row showing a file line (or the next visible one), and whether it sits in a collapsed fold.
  const findRow = useCallback((line) => {
    const target = line - view.lineOffset - 1;
    let low = 0;
    let high = rows.length - 1;
    let found = rows.length - 1;
    while (low <= high) {
      const middle = (low + high) >> 1;
      const row = rows[middle];
      const end = typeof row === "number" ? row : row.end; // fold rows sit at (or stand for) the end of their run
      if (end >= target) {
        found = middle;
        high = middle - 1;
      } else {
        low = middle + 1;
      }
    }
    return found;
  }, [rows, view.lineOffset]);

  const updateViewport = useCallback(() => {
    const element = containerRef.current;
    if (!element) return;
    setViewport((previous) =>
      previous.top === element.scrollTop && previous.height === element.clientHeight
        ? previous
        : { top: element.scrollTop, height: element.clientHeight }
    );
  }, []);

  const handleScroll = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      updateViewport();
      const element = containerRef.current;
      if (!element || !onFollowingChange) return;
      const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < lineHeight * 1.5;
      onFollowingChange(atBottom);
    });
  }, [lineHeight, onFollowingChange, updateViewport]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(() => updateViewport());
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameRef.current);
    };
  }, [updateViewport]);

  const scrollToLine = useCallback((line) => {
    const element = containerRef.current;
    if (!element || !rows.length) return;
    const position = findRow(line);
    const row = rows[position];
    if (row && typeof row !== "number" && !row.expanded && line - view.lineOffset - 1 >= row.start) {
      onToggleFold?.(rowLine(row, view.lineOffset)); // line is inside a collapsed stack trace
    }
    const block = Math.floor(position / BLOCK_SIZE);
    const estimate = blockOffsets[block] + (position % BLOCK_SIZE) * lineHeight;
    element.scrollTop = Math.max(0, estimate - element.clientHeight / 3);
    pendingScrollRef.current = { line, attempts: 0 };
    updateViewport();
  }, [blockOffsets, findRow, lineHeight, onToggleFold, rows, updateViewport, view.lineOffset]);

  useImperativeHandle(ref, () => ({
    scrollToLine,
    scrollToBottom: () => {
      const element = containerRef.current;
      if (element) element.scrollTop = element.scrollHeight;
    },
    scrollToTop: () => {
      const element = containerRef.current;
      if (element) element.scrollTop = 0;
    },
    // File line of the first row in view.
    getTopLine: () => {
      if (!rows.length) return null;
      const block = blockAt(viewport.top);
      const position = Math.min(rows.length - 1, block * BLOCK_SIZE + Math.max(0, Math.floor((viewport.top - blockOffsets[block]) / lineHeight)));
      return rowLine(rows[position], view.lineOffset);
    },
    focus: () => containerRef.current?.focus(),
  }), [blockAt, blockOffsets, lineHeight, rows, scrollToLine, view.lineOffset, viewport.top]);

  // After every render: record wrapped block heights, finish a pending "scroll to line", keep following.
  // Runs without a dependency list on purpose; it only sets state when a measured height actually changed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    if (wrap) {
      let changed = false;
      blockElementsRef.current.forEach((blockElement, block) => {
        const height = blockElement.offsetHeight;
        if (height && measuredRef.current.get(block) !== height) {
          measuredRef.current.set(block, height);
          changed = true;
        }
      });
      if (changed) {
        setMeasureTick((tick) => tick + 1);
        return;
      }
    }
    const pending = pendingScrollRef.current;
    if (pending) {
      const target = element.querySelector(`[data-line="${pending.line}"]`);
      if (target) {
        const offset = target.getBoundingClientRect().top - element.getBoundingClientRect().top;
        element.scrollTop += offset - element.clientHeight / 3;
        pendingScrollRef.current = null;
      } else if (pending.attempts >= 5) {
        pendingScrollRef.current = null;
      } else {
        pending.attempts += 1;
        updateViewport();
      }
      return;
    }
    // Snap to the newest line when content or layout changed (new rows, wrap/font change, re-measured heights).
    if (following && (lastRowsRef.current !== rows || lastHeightRef.current !== totalHeight || !followingRef.current)) {
      element.scrollTop = element.scrollHeight;
    }
    lastRowsRef.current = rows;
    lastHeightRef.current = totalHeight;
    followingRef.current = following;
  });

  const gutterWidth = `${String(view.lineOffset + view.raw.length).length + 1}ch`;
  const tagWidth = view.serviceNames ? `${Math.min(24, Math.max(...view.serviceNames.map((name) => name.length), 4))}ch` : 0;
  const fromLine = selection ? Math.min(selection.from, selection.to) : null;
  const toLine = selection ? Math.max(selection.from, selection.to) : null;

  const renderRow = (row) => {
    if (typeof row !== "number") {
      const startLine = rowLine(row, view.lineOffset);
      return (
        <div key={`fold-${row.start}-${row.expanded ? "open" : "closed"}`} className={`lv-row lv-fold ${colorLevels ? LEVEL_CLASS[view.levels[row.start]] || "" : ""}`}>
          <span className="lv-gutter" />
          <button type="button" className="lv-fold-button" onClick={() => onToggleFold?.(startLine)}>
            {row.expanded ? `▾ hide ${row.count} stack lines` : `▸ ${row.count} more stack lines`}
          </button>
        </div>
      );
    }
    const line = view.lineOffset + row + 1;
    const plain = view.plain[row];
    const classes = ["lv-row"];
    if (colorLevels && LEVEL_CLASS[view.levels[row]]) classes.push(LEVEL_CLASS[view.levels[row]]);
    if (plain.startsWith("[RUN ")) classes.push(plain.startsWith("[RUN CONFIG]") ? "lv-run-config" : plain.startsWith("[RUN COMMAND]") ? "lv-run-command" : "lv-run");
    if (fromLine !== null && line >= fromLine && line <= toLine) classes.push("lv-selected");
    if (line === selectedMatchLine) classes.push("lv-match-line");
    return (
      <div key={line} className={classes.join(" ")} data-line={line}>
        <span
          className="lv-gutter"
          title="Click to select · Shift+click to select a range"
          onMouseDown={(event) => {
            event.preventDefault();
            onGutterClick?.(line, event);
          }}
        >
          {line}
        </span>
        {view.services ? (
          <span
            className="lv-tag"
            title={onServiceClick ? `${view.serviceNames[view.services[row]]} · click to show only this service` : undefined}
            style={{ color: serviceColor(view.services[row]) }}
            onClick={onServiceClick ? () => onServiceClick(view.services[row]) : undefined}
          >
            {view.serviceNames[view.services[row]]}
          </span>
        ) : null}
        <span
          className="lv-text"
          onDoubleClick={onWordDoubleClick ? () => {
            const word = wordAtSelection();
            if (word) onWordDoubleClick(word);
          } : undefined}
        >
          {renderText(view.raw[row], plain, matcher)}
        </span>
      </div>
    );
  };

  blockElementsRef.current = new Map();
  const blocks = [];
  for (let block = firstBlock; block <= lastBlock; block += 1) {
    const start = block * BLOCK_SIZE;
    blocks.push(
      <div
        key={block}
        ref={(element) => {
          if (element) blockElementsRef.current.set(block, element);
        }}
      >
        {rows.slice(start, start + BLOCK_SIZE).map(renderRow)}
      </div>
    );
  }

  return (
    <Box
      ref={containerRef}
      tabIndex={0}
      onScroll={handleScroll}
      aria-label="Log output"
      sx={{
        flexGrow: 1,
        minHeight: 0,
        overflow: "auto",
        outline: "none",
        py: 1,
        backgroundColor: "#0f172a",
        color: "#e2e8f0",
        fontFamily: CODE_FONT,
        fontSize: `${fontSize}px`,
        lineHeight: `${lineHeight}px`,
        "& .lv-inner": { minWidth: "100%", width: wrap ? "100%" : "max-content" },
        "& .lv-row": {
          display: "flex",
          minHeight: lineHeight,
          whiteSpace: wrap ? "pre-wrap" : "pre",
          wordBreak: wrap ? "break-word" : "normal",
          borderLeft: "2px solid transparent",
        },
        "& .lv-gutter": {
          position: "sticky",
          left: 0,
          zIndex: 1,
          flexShrink: 0,
          width: gutterWidth,
          boxSizing: "content-box",
          pr: 1.5,
          pl: 1,
          textAlign: "right",
          color: "#475569",
          backgroundColor: "#0f172a",
          userSelect: "none",
          cursor: "pointer",
          "&:hover": { color: "#cbd5e1" },
        },
        "& .lv-text": { flex: 1, minWidth: 0, pr: 2 },
        "& .lv-tag": {
          flexShrink: 0,
          width: tagWidth,
          mr: 1.5,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontWeight: 600,
          cursor: onServiceClick ? "pointer" : "default",
          "&:hover": onServiceClick ? { textDecoration: "underline" } : {},
        },
        "& .lv-error": { backgroundColor: "rgba(239,68,68,0.08)", "& .lv-text": { color: "#fecaca" } },
        "& .lv-warn": { backgroundColor: "rgba(245,158,11,0.07)", "& .lv-text": { color: "#fde68a" } },
        "& .lv-debug .lv-text": { color: "#94a3b8" },
        "& .lv-run .lv-text": { color: "#94a3b8" },
        "& .lv-run-config .lv-text": { color: "#5eead4", fontWeight: 600 },
        "& .lv-run-command .lv-text": { color: "#93c5fd", fontWeight: 600 },
        "& .lv-selected": { backgroundColor: "rgba(148,163,184,0.22)", "& .lv-gutter": { color: "#e2e8f0", backgroundColor: "#334155" } },
        "& .lv-match-line": { backgroundColor: "rgba(59,130,246,0.2)", borderLeftColor: "rgba(96,165,250,0.95)" },
        "& .lv-mark": { backgroundColor: "rgba(250,204,21,0.45)", color: "inherit", borderRadius: "3px" },
        "& .lv-fold-button": {
          background: "none",
          border: 0,
          padding: 0,
          font: "inherit",
          color: "#93c5fd",
          cursor: "pointer",
          fontStyle: "italic",
          "&:hover": { textDecoration: "underline" },
        },
        "& .lv-empty": { px: 2, color: "#64748b", fontStyle: "italic" },
      }}
    >
      {view.message || !rows.length ? (
        <div className="lv-empty">{view.message || emptyText}</div>
      ) : (
        <div className="lv-inner">
          <div style={{ height: blockOffsets[firstBlock] }} />
          {blocks}
          <div style={{ height: totalHeight - blockOffsets[lastBlock + 1] }} />
        </div>
      )}
    </Box>
  );
});

export default LogViewer;
