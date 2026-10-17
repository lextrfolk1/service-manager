import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Autocomplete, Box, Button, Chip, IconButton, InputAdornment, TextField, Tooltip, Typography } from "@mui/material";
import {
  Check as CheckIcon,
  Close as CloseIcon,
  ContentCopy as ContentCopyIcon,
  FilterAlt as FilterIcon,
  PauseRounded as PauseIcon,
  PlayArrowRounded as ResumeIcon,
  VerticalAlignBottomRounded as FollowIcon,
} from "@mui/icons-material";
import { SEARCH_INPUT_SX, TOP_BAR_HEIGHT } from "../../theme/tokens";
import { copyToClipboard } from "../../utils/clipboard";
import LogViewer from "./LogViewer";
import { appendCombinedLines, buildMatcher, buildRows, createCombinedView, messageView, rowsToIndexes, serviceColor } from "./logLines";

const INITIAL_LINES = 300; // per service
const FILTER_DEBOUNCE_MS = 250;
const PROBLEM_LEVELS = new Set(["error", "warn"]);

const STATUS_CHIPS = {
  connecting: { label: "Connecting", color: "default" },
  live: { label: "Live", color: "success" },
  disconnected: { label: "Reconnecting", color: "warning" },
};

// Live log of several services in one list, in time order, each line tagged with its service. Filtering by a
// trace ID (double-click it in a line) follows one request across services. Shown when config.logs.combinedView is on.
export default function CombinedLogs({ apiBase, services, selected, onSelectedChange, isActive, fontSize, wrap, colorLevels, onClose }) {
  const [view, setView] = useState(() => messageView("(add services to see their logs together)"));
  const [status, setStatus] = useState("connecting");
  const [filterText, setFilterText] = useState("");
  const [filter, setFilter] = useState("");
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [soloService, setSoloService] = useState(null); // service index shown alone, or null for all
  const [paused, setPaused] = useState(false);
  const [pausedCount, setPausedCount] = useState(0);
  const [following, setFollowing] = useState(true);
  const [copied, setCopied] = useState("");
  const viewerRef = useRef(null);
  const pausedRef = useRef(false);
  const pausedLinesRef = useRef([]);

  useEffect(() => {
    const timer = setTimeout(() => setFilter(filterText.trim()), FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filterText]);

  const resetPause = useCallback(() => {
    pausedRef.current = false;
    pausedLinesRef.current = [];
    setPaused(false);
    setPausedCount(0);
  }, []);

  const namesKey = selected.join(",");
  useEffect(() => {
    if (!isActive || !namesKey) {
      if (!namesKey) setView(messageView("(add services to see their logs together)"));
      return undefined;
    }
    setStatus("connecting");
    setSoloService(null);
    resetPause();
    const stream = new EventSource(`${apiBase}/combined-logs/stream?names=${encodeURIComponent(namesKey)}&lines=${INITIAL_LINES}`);
    stream.onopen = () => setStatus("live");
    stream.onerror = () => setStatus("disconnected"); // EventSource reconnects by itself and gets a new "initial"
    stream.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (data.type === "initial") {
        resetPause();
        setStatus("live");
        setView(createCombinedView(data.services, data.lines));
      } else if (data.type === "append" && data.lines?.length) {
        if (pausedRef.current) {
          pausedLinesRef.current.push(...data.lines);
          setPausedCount(pausedLinesRef.current.length);
        } else {
          setView((previous) => (previous.services ? appendCombinedLines(previous, data.lines) : previous));
        }
      }
    };
    return () => stream.close();
  }, [apiBase, isActive, namesKey, resetPause]);

  const togglePause = () => {
    if (!pausedRef.current) {
      pausedRef.current = true;
      setPaused(true);
      return;
    }
    const lines = pausedLinesRef.current;
    resetPause();
    if (lines.length) setView((previous) => (previous.services ? appendCombinedLines(previous, lines) : previous));
  };

  const matcher = useMemo(() => (filter ? buildMatcher(filter) : null), [filter]);
  const shownServices = useMemo(() => (soloService === null ? null : new Set([soloService])), [soloService]);
  const rows = useMemo(
    () => buildRows(view, { matcher, levels: problemsOnly ? PROBLEM_LEVELS : null, services: shownServices, collapseStacks: false }),
    [matcher, problemsOnly, shownServices, view]
  );
  const filtered = Boolean(matcher || problemsOnly || shownServices);

  const followLatest = useCallback(() => {
    setFollowing(true);
    viewerRef.current?.scrollToBottom();
  }, []);
  const handleFollowingChange = useCallback((atBottom) => setFollowing((previous) => (previous === atBottom ? previous : atBottom)), []);

  const copyShown = async () => {
    const indexes = rowsToIndexes(rows);
    const text = indexes.map((index) => `[${view.serviceNames[view.services[index]]}] ${view.plain[index]}`).join("\n");
    try {
      await copyToClipboard(text);
      setCopied(`Copied ${indexes.length} line${indexes.length === 1 ? "" : "s"}`);
    } catch {
      setCopied("Copy failed");
    }
    setTimeout(() => setCopied(""), 1800);
  };

  const available = services.map((service) => service.name).filter((name) => !selected.includes(name));
  const colorOf = (name) => {
    const index = view.serviceNames ? view.serviceNames.indexOf(name) : -1;
    return index === -1 ? undefined : serviceColor(index);
  };
  const statusChip = STATUS_CHIPS[status] || STATUS_CHIPS.connecting;
  const soloName = soloService === null ? null : view.serviceNames?.[soloService];

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 0.75,
          px: 1.5,
          py: 0.75,
          minHeight: TOP_BAR_HEIGHT,
          flexShrink: 0,
          borderBottom: "1px solid var(--c-border-94a3b8-016)",
          backgroundColor: "var(--c-bg-f8fafc-088)",
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mr: 0.5 }}>Combined logs</Typography>
        {selected.length ? (
          <Tooltip title="The current run of each service streams live. Lines are ordered by the time written in them.">
            <Chip size="small" label={statusChip.label} color={statusChip.color} variant={statusChip.color === "default" ? "outlined" : "filled"} sx={{ fontSize: "0.7rem" }} />
          </Tooltip>
        ) : null}
        {selected.map((name) => (
          <Chip
            key={name}
            size="small"
            variant="outlined"
            label={name}
            onDelete={() => onSelectedChange(selected.filter((item) => item !== name))}
            sx={{
              fontSize: "0.72rem",
              fontWeight: 600,
              borderColor: colorOf(name) || undefined,
              "&::before": colorOf(name)
                ? { content: '""', width: 8, height: 8, borderRadius: "50%", backgroundColor: colorOf(name), ml: 1 }
                : {},
            }}
          />
        ))}
        <Autocomplete
          size="small"
          options={available}
          value={null}
          blurOnSelect
          clearOnBlur
          onChange={(_, name) => name && onSelectedChange([...selected, name])}
          renderInput={(params) => <TextField {...params} placeholder="Add service" />}
          sx={{ width: 190, "& .MuiInputBase-root": { py: "1px !important", fontSize: "0.8rem" } }}
        />
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Close the combined view">
          <IconButton size="small" onClick={onClose} aria-label="Close combined logs">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1,
          px: 1.5,
          py: 0.75,
          flexShrink: 0,
          borderBottom: "1px solid var(--c-border-94a3b8-016)",
        }}
      >
        <TextField
          size="small"
          value={filterText}
          onChange={(event) => setFilterText(event.target.value)}
          placeholder="Filter all services, e.g. a trace ID (double-click an ID in a line)"
          sx={{ flex: "1 1 320px", maxWidth: 520 }}
          InputProps={{
            sx: SEARCH_INPUT_SX,
            startAdornment: (
              <InputAdornment position="start">
                <FilterIcon sx={{ fontSize: "1rem" }} />
              </InputAdornment>
            ),
            endAdornment: filterText ? (
              <InputAdornment position="end">
                <IconButton size="small" aria-label="Clear filter" onClick={() => setFilterText("")}>
                  <CloseIcon sx={{ fontSize: "0.9rem" }} />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
        <Chip
          size="small"
          label="Errors & warnings"
          color={problemsOnly ? "primary" : "default"}
          variant={problemsOnly ? "filled" : "outlined"}
          onClick={() => setProblemsOnly((previous) => !previous)}
          sx={{ fontSize: "0.72rem" }}
        />
        {soloName ? (
          <Chip size="small" label={`Only ${soloName}`} onDelete={() => setSoloService(null)} sx={{ fontSize: "0.72rem" }} />
        ) : null}
        {view.services ? (
          <Typography variant="caption" sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
            {filtered ? `${rows.length.toLocaleString()} of ${view.raw.length.toLocaleString()} lines` : `${view.raw.length.toLocaleString()} lines`}
          </Typography>
        ) : null}
        <Box sx={{ flex: 1 }} />
        <Tooltip title={paused ? "Resume live updates" : "Pause live updates"}>
          <Button
            size="small"
            variant={paused ? "contained" : "text"}
            color={paused ? "warning" : "inherit"}
            startIcon={paused ? <ResumeIcon /> : <PauseIcon />}
            onClick={togglePause}
            disabled={!view.services}
            sx={{ textTransform: "none" }}
          >
            {paused ? `Resume${pausedCount ? ` (${pausedCount.toLocaleString()} new)` : ""}` : "Pause"}
          </Button>
        </Tooltip>
        <Tooltip title={filtered ? "Copy the lines shown, with their service names" : "Copy all lines, with their service names"}>
          <span>
            <Button
              size="small"
              color="inherit"
              startIcon={copied.startsWith("Copied") ? <CheckIcon /> : <ContentCopyIcon />}
              onClick={copyShown}
              disabled={!rows.length || !view.services}
              sx={{ textTransform: "none" }}
            >
              {copied || "Copy"}
            </Button>
          </span>
        </Tooltip>
        {!following ? (
          <Button size="small" startIcon={<FollowIcon />} onClick={followLatest} sx={{ textTransform: "none" }}>
            Jump to latest
          </Button>
        ) : null}
      </Box>

      <LogViewer
        ref={viewerRef}
        view={view}
        rows={rows}
        layoutKey={`combined|${view.version}|${view.lineOffset}|${filter}|${problemsOnly}|${soloService}`}
        fontSize={fontSize}
        wrap={wrap}
        colorLevels={colorLevels}
        matcher={matcher && !matcher.error ? matcher : null}
        following={following}
        onFollowingChange={handleFollowingChange}
        onServiceClick={(index) => setSoloService((previous) => (previous === index ? null : index))}
        onWordDoubleClick={(word) => setFilterText(word)}
        emptyText={filtered ? "(no lines match the filters)" : "(no output yet)"}
      />
    </>
  );
}
