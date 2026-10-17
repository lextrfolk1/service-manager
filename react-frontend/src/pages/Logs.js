import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  DeleteSweepOutlined as ClearLogIcon,
  History as HistoryIcon,
  Inventory2Outlined as LegacyLogIcon,
  Check as CheckIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Close as CloseIcon,
  ContentCopy as ContentCopyIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  PushPin as PushPinIcon,
  Search as SearchIcon,
  SyncRounded as ReloadIcon,
  VerticalAlignBottomRounded as FollowIcon,
  WrapText as WrapTextIcon,
  PauseRounded as PauseIcon,
  PlayArrowRounded as ResumeIcon,
  ErrorOutline as ErrorIcon,
  FileDownloadOutlined as DownloadIcon,
  KeyboardOutlined as KeyboardIcon,
  TuneRounded as ViewOptionsIcon,
  TextIncrease as TextIncreaseIcon,
  TextDecrease as TextDecreaseIcon,
  UnfoldLess as CollapseIcon,
  KeyboardArrowUp as ArrowUpIcon,
  KeyboardArrowDown as ArrowDownIcon,
} from "@mui/icons-material";
import api from "../services/api";
import useServiceRunningStates from "../hooks/useServiceRunningStates";
import { CODE_FONT, SEARCH_INPUT_SX, STATUS_COLORS, TOP_BAR_HEIGHT } from "../theme/tokens";
import StatusDot from "../components/StatusDot";
import EmptyState from "../components/EmptyState";
import LogViewer from "../components/logViewer/LogViewer";
import {
  LEVELS,
  LEVEL_LABELS,
  appendToLogView,
  buildMatcher,
  buildRows,
  countLevels,
  createLogView,
  joinPlain,
  messageView,
  rowsToIndexes,
  visibleLineCount,
} from "../components/logViewer/logLines";

const SEARCH_DEBOUNCE_MS = 400;
const SEARCH_MIN_CHARS = 2;
const SEARCH_MAX_CHARS = 120;

// Edge-to-edge content card, same style as the Admin and Help content cards.
const contentCardSx = {
  border: "1px solid",
  borderColor: "divider",
};

const FILE_LIST_POLL_MS = 5000;
// Same backend the live stream connects to (EventSource and downloads bypass the dev proxy).
const LOG_API_BASE = "http://localhost:4000";

// Lines loaded around a search match that is outside the part of the log currently shown.
const MATCH_CONTEXT_LINES_BEFORE = 1000;
const MATCH_CONTEXT_LINES = 3000;

const FONT_SIZES = [11, 12, 13, 14, 16];
const VIEWER_SETTINGS_KEY = "struo_log_viewer_settings";
const DEFAULT_VIEWER_SETTINGS = {
  fontSize: 12,
  wrap: false,
  colorLevels: true,
  collapseStacks: true,
  levels: null, // null: all levels; otherwise the list of levels shown
  caseSensitive: false,
  regex: false,
  onlyMatching: false,
};

function loadViewerSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(VIEWER_SETTINGS_KEY) || "{}");
    return { ...DEFAULT_VIEWER_SETTINGS, ...(saved && typeof saved === "object" ? saved : {}) };
  } catch {
    return DEFAULT_VIEWER_SETTINGS;
  }
}

const LEVEL_CHIP_COLORS = { error: "#dc2626", warn: "#d97706", info: "#2563eb", debug: "#64748b", other: "#94a3b8" };

const SHORTCUTS = [
  ["Ctrl/⌘ F", "Search in this log"],
  ["Enter / Shift+Enter", "Next / previous match (in the search box)"],
  ["n / Shift+N", "Next / previous match"],
  ["e / Shift+E", "Next / previous error"],
  ["Ctrl/⌘ G", "Go to line"],
  ["Click / Shift+click line number", "Select a line / a range of lines"],
  ["Ctrl/⌘ C", "Copy selected lines (when no text is highlighted)"],
  ["Esc", "Clear line selection"],
  ["p", "Pause / resume live output"],
  ["End or Shift+G", "Jump to latest and follow"],
  ["Home", "Jump to top"],
  ["w", "Toggle line wrap"],
  ["+ / -", "Larger / smaller text"],
  ["?", "Show these shortcuts"],
];

function countNewlines(text) {
  let count = 0;
  for (let index = text.indexOf("\n"); index !== -1; index = text.indexOf("\n", index + 1)) count += 1;
  return count;
}

// Clipboard API needs a secure context (https or localhost); fall back to a hidden textarea otherwise.
async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) throw new Error("Copy was blocked");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad2 = (value) => String(value).padStart(2, "0");

// Run logs are named <service>_YYYY-MM-DD_HH-MM-SS[_N].log; older daily logs <service>-YYYY-MM-DD.log.
function parseLogFileName(fileName) {
  const run = fileName.match(/_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})(?:_\d+)?\.log$/);
  if (run) {
    const [, year, month, day, hours, minutes, seconds] = run.map(Number);
    return { isRun: true, startedAt: new Date(year, month - 1, day, hours, minutes, seconds) };
  }
  const daily = fileName.match(/-(\d{4})-(\d{2})-(\d{2})\.log$/);
  if (daily) {
    const [, year, month, day] = daily.map(Number);
    return { isRun: false, startedAt: new Date(year, month - 1, day) };
  }
  return { isRun: false, startedAt: null };
}

function formatDayLabel(date, now) {
  const startOfDay = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  if (dayDiff === 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

function formatClock(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m ${totalSeconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function formatAgo(ms) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86400)} d ago`;
}

function formatSize(bytes) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Human description of a log file for the run picker:
// { group: "Today", title: "Current run · 14:26:20", subtitle: "started 2 min ago · 12.4 KB", short: "…" }
function describeLogFile(fileName, detail, isCurrent, now) {
  const { isRun, startedAt } = parseLogFileName(fileName);
  const size = formatSize(detail?.size);
  if (!startedAt) {
    return { kind: "legacy", group: "Other", title: fileName, subtitle: size, short: fileName };
  }
  const group = formatDayLabel(startedAt, now);
  if (!isRun) {
    return {
      kind: "legacy",
      group,
      title: "Whole day (older log format)",
      subtitle: ["all runs that day in one file", size].filter(Boolean).join(" · "),
      short: `${group} · whole day`,
    };
  }
  const clock = formatClock(startedAt);
  if (isCurrent) {
    return {
      kind: "current",
      group,
      title: `Current run · started ${clock}`,
      subtitle: [`started ${formatAgo(now - startedAt)}`, size].filter(Boolean).join(" · "),
      short: `Current run · started ${clock}`,
    };
  }
  const ran = detail?.modifiedAt ? `ran ${formatDuration(detail.modifiedAt - startedAt.getTime())}` : "";
  return {
    kind: "run",
    group,
    title: `Run started ${clock}`,
    subtitle: [ran, size].filter(Boolean).join(" · "),
    short: `${group} ${clock}${ran ? ` · ${ran}` : ""}`,
  };
}

function prettifyStatus(status) {
  switch (status) {
    case "connected":
      return { label: "Live", color: "success" };
    case "connecting":
      return { label: "Connecting", color: "warning" };
    case "error":
      return { label: "Stream error", color: "error" };
    default:
      return { label: "Idle", color: "default" };
  }
}

function serviceInitials(name = "") {
  const parts = name.split(/[-_\s.]+/).filter((part) => part && !/^(service|svc|app)$/i.test(part));
  const letters = (parts.length ? parts : [name]).map((part) => part[0]).join("");
  return (letters.length > 1 ? letters : name.slice(0, 2)).slice(0, 3).toUpperCase();
}

function ExplorerItem({ service, active, pinned, running, onOpen, onPin }) {
  return (
    <Tooltip title={service.description || service.path || ""} placement="right">
      <Box
        role="button"
        tabIndex={0}
        aria-current={active ? "true" : undefined}
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen();
          }
        }}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          px: 1,
          py: 0.5,
          borderRadius: 1.5,
          cursor: "pointer",
          color: active ? "primary.main" : "text.primary",
          backgroundColor: active ? "color-mix(in srgb, var(--sm-accent) 10%, transparent)" : "transparent",
          transition: "background-color 0.12s ease",
          "&:hover": {
            backgroundColor: active ? "color-mix(in srgb, var(--sm-accent) 14%, transparent)" : "var(--c-bg-0f172a-005)",
          },
          "&:hover .explorer-pin, &:focus-within .explorer-pin": { opacity: 1 },
          "&:focus-visible": { outline: "2px solid color-mix(in srgb, var(--sm-accent) 50%, transparent)", outlineOffset: -2 },
        }}
      >
        <StatusDot running={running} />
        <Typography
          variant="body2"
          title={service.name}
          sx={{
            flex: 1,
            minWidth: 0,
            fontSize: "0.8rem",
            fontWeight: active ? 700 : 500,
            overflow: "hidden",
            overflowWrap: "anywhere",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {service.name}
        </Typography>
        {service.type ? (
          <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.68rem", flexShrink: 0 }}>
            {service.type}
          </Typography>
        ) : null}
        <IconButton
          className="explorer-pin"
          size="small"
          aria-label={pinned ? "Unpin service" : "Pin service"}
          onClick={(event) => {
            event.stopPropagation();
            onPin();
          }}
          color={pinned ? "primary" : "default"}
          sx={{ p: 0.25, opacity: pinned ? 1 : 0.6 }}
        >
          <PushPinIcon sx={{ fontSize: "0.9rem" }} />
        </IconButton>
      </Box>
    </Tooltip>
  );
}

function OpenServiceTabLabel({ serviceName, running, onClose }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
      <StatusDot running={running} />
      <Typography
        variant="body2"
        title={serviceName}
        sx={{
          fontWeight: 700,
          maxWidth: 160,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {serviceName}
      </Typography>
      <Box
        component="span"
        role="button"
        tabIndex={0}
        aria-label={`Close ${serviceName} logs`}
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }
        }}
        sx={{
          display: "inline-flex",
          p: 0.25,
          borderRadius: "50%",
          color: "text.secondary",
          "&:hover": { bgcolor: "var(--c-bg-0f172a-008)", color: "text.primary" },
        }}
      >
        <CloseIcon sx={{ fontSize: "0.95rem" }} />
      </Box>
    </Stack>
  );
}

const Logs = forwardRef(({ openServices, activeServiceTab, onCloseService, onServiceTabChange, onAddService, isActive = true }, ref) => {
  const [services, setServices] = useState([]);
  const [serviceFilter, setServiceFilter] = useState("");
  const [selectedServiceName, setSelectedServiceName] = useState("");
  const [selectedLogFile, setSelectedLogFile] = useState("");
  const [activeLogFiles, setActiveLogFiles] = useState([]);
  const [archivedLogFiles, setArchivedLogFiles] = useState([]);
  const [logFileDetails, setLogFileDetails] = useState({});
  // Lines on screen; see createLogView. windowed: an earlier part of the log is shown (loaded around a
  // search match or a "go to line"); live updates are paused until "Back to latest".
  const [logView, setLogView] = useState(() => messageView("(select a service to load logs)"));
  const { lineOffset: logLineOffset, windowed: logWindowed } = logView;
  const loadedLineCount = visibleLineCount(logView);
  const pendingScrollLineRef = useRef(null);
  const windowRequestRef = useRef(0);
  const viewerRef = useRef(null);
  const searchInputRef = useRef(null);
  const goToLineInputRef = useRef(null);
  const [serviceSearchState, setServiceSearchState] = useState({});
  const [viewerSettings, setViewerSettings] = useState(loadViewerSettings);
  const { fontSize, wrap: wrapped, colorLevels, collapseStacks, caseSensitive, regex: regexSearch, onlyMatching } = viewerSettings;
  const [selection, setSelection] = useState(null); // { anchor, from, to } file line numbers
  const [expandedFolds, setExpandedFolds] = useState(() => new Set()); // file line of each expanded stack fold
  const [paused, setPaused] = useState(false);
  const [pausedNewLines, setPausedNewLines] = useState(0);
  const pausedRef = useRef(false);
  const pausedBufferRef = useRef({ replace: null, chunks: [] });
  const [goToLineText, setGoToLineText] = useState("");
  const [notice, setNotice] = useState(""); // short message such as "No more errors in the loaded lines"
  const [copyMenuAnchor, setCopyMenuAnchor] = useState(null);
  const [viewMenuAnchor, setViewMenuAnchor] = useState(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [copiedLabel, setCopiedLabel] = useState("");
  const [following, setFollowing] = useState(true); // keep the view pinned to the newest line
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [copyState, setCopyState] = useState(""); // "" | "copied" | "failed" — brief feedback on the Copy button
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [pinnedServices, setPinnedServices] = useState([]);
  const [explorerCollapsed, setExplorerCollapsed] = useState(false);
  const eventSourceRef = useRef(null);
  const latestFileRef = useRef("");

  const activeServiceFromTabs = openServices[activeServiceTab] || "";
  const currentService = activeServiceFromTabs || selectedServiceName || services[0]?.name || "";
  const isArchivedSelection = archivedLogFiles.includes(selectedLogFile);
  // Newest first; recomputed each render so "x min ago" stays current as the file list refreshes.
  const now = new Date();
  const logFileOptions = [...activeLogFiles, ...archivedLogFiles].map((fileName) => ({
    fileName,
    ...describeLogFile(fileName, logFileDetails[fileName], fileName === activeLogFiles[0], now),
  }));
  const logFileOptionByName = Object.fromEntries(logFileOptions.map((option) => [option.fileName, option]));
  const isActiveSelection = activeLogFiles.includes(selectedLogFile);
  const currentSearchState = serviceSearchState[currentService] || {
    searchQuery: "",
    debouncedSearchQuery: "",
    searchResults: [],
    searchTotalMatches: 0,
    searchLoading: false,
    searchError: "",
    selectedMatchLine: null,
  };
  const {
    searchQuery,
    debouncedSearchQuery,
    searchResults,
    searchTotalMatches,
    searchLoading,
    searchError,
    selectedMatchLine,
  } = currentSearchState;
  const selectedMatchIndex = useMemo(
    () => searchResults.findIndex((match) => match.lineNumber === selectedMatchLine),
    [searchResults, selectedMatchLine]
  );
  const selectedMatch = selectedMatchIndex >= 0 ? searchResults[selectedMatchIndex] : null;

  const updateCurrentSearchState = useCallback((updates) => {
    if (!currentService) return;
    setServiceSearchState((previous) => ({
      ...previous,
      [currentService]: {
        searchQuery: "",
        debouncedSearchQuery: "",
        searchResults: [],
        searchTotalMatches: 0,
        searchLoading: false,
        searchError: "",
        selectedMatchLine: null,
        ...(previous[currentService] || {}),
        ...(typeof updates === "function" ? updates(previous[currentService] || {}) : updates),
      },
    }));
  }, [currentService]);

  useImperativeHandle(ref, () => ({
    addService: (serviceName) => {
      setSelectedServiceName(serviceName);
      if (!openServices.includes(serviceName)) {
        onAddService(serviceName);
      } else {
        onServiceTabChange(openServices.indexOf(serviceName));
      }
    },
  }));

  const stopStreaming = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setConnectionStatus("disconnected");
  }, []);

  const loadServices = useCallback(async () => {
    try {
      const data = await api.get("/services");
      setServices(data.services || []);
    } catch (error) {
      setServices([]);
      setLogView(messageView(`Unable to load services: ${error.message}`));
    }
  }, []);

  // silent: background refresh (no loading chip, keeps errors quiet).
  // When the user is viewing the latest run and a newer run appears (service restarted), switch to it.
  const loadLogFiles = useCallback(async (serviceName, { silent = false } = {}) => {
    if (!serviceName) return;
    if (!silent) setLoadingFiles(true);
    try {
      const data = await api.get(`/logs/${serviceName}`);
      const files = (data.files || []).sort().reverse();
      const archivedFiles = (data.archivedFiles || []).sort().reverse();
      const previousLatest = latestFileRef.current;
      latestFileRef.current = files[0] || "";
      setActiveLogFiles((previous) => (previous.join("|") === files.join("|") ? previous : files));
      setArchivedLogFiles((previous) => (previous.join("|") === archivedFiles.join("|") ? previous : archivedFiles));
      setLogFileDetails(data.details || {});
      setSelectedLogFile((previous) => {
        const followLatest = !previous || previous === previousLatest;
        if (!followLatest && (files.includes(previous) || archivedFiles.includes(previous))) {
          return previous;
        }
        return files[0] || archivedFiles[0] || "";
      });
      if (!files[0] && !archivedFiles[0]) {
        setLogView(messageView("(no log files available for this service)"));
      }
    } catch (error) {
      if (silent) return;
      setActiveLogFiles([]);
      setArchivedLogFiles([]);
      setSelectedLogFile("");
      setLogView(messageView(`Error loading log files: ${error.message}`));
    } finally {
      if (!silent) setLoadingFiles(false);
    }
  }, []);

  const refreshCurrentLog = useCallback(async () => {
    if (!currentService || !selectedLogFile) return;
    try {
      const data = await api.get(`/logs/${currentService}/${encodeURIComponent(selectedLogFile)}`);
      setLogView(createLogView(data.content || "", { lineOffset: data.lineOffset || 0 }));
    } catch (error) {
      setLogView(messageView(`Error loading log content: ${error.message}`));
    }
  }, [currentService, selectedLogFile]);

  const clearCurrentLog = useCallback(async () => {
    if (!currentService || !selectedLogFile) return;
    await api.post(`/logs/${currentService}/${encodeURIComponent(selectedLogFile)}/clear`);
    setLogView(createLogView(""));
  }, [currentService, selectedLogFile]);

  // Follow mode (viewer keeps the newest line in view) turns off when the user scrolls up.
  const handleFollowingChange = useCallback((atBottom) => {
    setFollowing((previous) => (previous === atBottom ? previous : atBottom));
  }, []);

  const updateViewerSettings = useCallback((updates) => {
    setViewerSettings((previous) => {
      const next = { ...previous, ...(typeof updates === "function" ? updates(previous) : updates) };
      try {
        localStorage.setItem(VIEWER_SETTINGS_KEY, JSON.stringify(next));
      } catch {
        // Settings still apply for this session
      }
      return next;
    });
  }, []);

  const resetPause = useCallback(() => {
    pausedRef.current = false;
    pausedBufferRef.current = { replace: null, chunks: [] };
    setPaused(false);
    setPausedNewLines(0);
  }, []);

  // Pause keeps the view still while output keeps arriving; resume applies everything buffered at once.
  const togglePause = useCallback(() => {
    if (!pausedRef.current) {
      pausedRef.current = true;
      setPaused(true);
      return;
    }
    const { replace, chunks } = pausedBufferRef.current;
    resetPause();
    if (replace || chunks.length) {
      setLogView((previous) => {
        const base = replace ? createLogView(replace.content || "", { lineOffset: replace.lineOffset || 0 }) : previous;
        return appendToLogView(base, chunks.join(""));
      });
    }
  }, [resetPause]);

  const startStreaming = useCallback(() => {
    stopStreaming();
    resetPause();
    if (!currentService || !selectedLogFile || !isActiveSelection) return;

    setConnectionStatus("connecting");
    const stream = new EventSource(`${LOG_API_BASE}/logs/${currentService}/${encodeURIComponent(selectedLogFile)}/stream`);

    stream.onopen = () => setConnectionStatus("connected");
    stream.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (pausedRef.current && (data.type === "replace" || data.type === "append")) {
          const buffer = pausedBufferRef.current;
          if (data.type === "replace") {
            pausedBufferRef.current = { replace: data, chunks: [] };
            setPausedNewLines(countNewlines(data.content || ""));
          } else {
            buffer.chunks.push(data.content || "");
            setPausedNewLines((count) => count + countNewlines(data.content || ""));
          }
          return;
        }
        if (data.type === "initial" || data.type === "replace") {
          setLogView(createLogView(data.content || "", { lineOffset: data.lineOffset || 0 }));
        } else if (data.type === "append") {
          setLogView((previous) => appendToLogView(previous, data.content || ""));
        }
      } catch {
        setConnectionStatus("error");
      }
    };
    stream.onerror = () => setConnectionStatus("error");
    eventSourceRef.current = stream;
  }, [currentService, isActiveSelection, resetPause, selectedLogFile, stopStreaming]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  useEffect(() => {
    if (activeServiceFromTabs) {
      setSelectedServiceName(activeServiceFromTabs);
    }
  }, [activeServiceFromTabs]);

  useEffect(() => {
    if (!activeServiceFromTabs && !selectedServiceName && services[0]?.name) {
      setSelectedServiceName(services[0].name);
    }
  }, [activeServiceFromTabs, selectedServiceName, services]);

  useEffect(() => {
    if (!currentService) return;
    setSelectedLogFile("");
    latestFileRef.current = "";
    loadLogFiles(currentService);
    return stopStreaming;
  }, [currentService, loadLogFiles, stopStreaming]);

  // Pick up new runs (service started/restarted) while the Logs tab is visible.
  useEffect(() => {
    if (!isActive || !currentService) return undefined;
    const interval = setInterval(() => loadLogFiles(currentService, { silent: true }), FILE_LIST_POLL_MS);
    return () => clearInterval(interval);
  }, [isActive, currentService, loadLogFiles]);

  useEffect(() => {
    setSelection(null);
    setExpandedFolds(new Set());
    setNotice("");
  }, [currentService, selectedLogFile]);

  useEffect(() => {
    if (!selectedLogFile || !currentService) return undefined;
    if (!isActiveSelection) {
      stopStreaming();
      return undefined;
    }
    startStreaming();
    return stopStreaming;
  }, [currentService, isActiveSelection, selectedLogFile, startStreaming, stopStreaming]);

  useEffect(() => {
    const handle = setTimeout(() => {
      const normalizedQuery = searchQuery.trim().slice(0, SEARCH_MAX_CHARS);
      updateCurrentSearchState({
        debouncedSearchQuery: normalizedQuery.length >= SEARCH_MIN_CHARS ? normalizedQuery : "",
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchQuery, updateCurrentSearchState]);

  useEffect(() => {
    let active = true;

    async function runSearch() {
      if (!currentService || !selectedLogFile || !debouncedSearchQuery) {
        updateCurrentSearchState({
          searchResults: [],
          searchTotalMatches: 0,
          searchLoading: false,
          searchError: "",
          selectedMatchLine: null,
        });
        return;
      }

      updateCurrentSearchState({
        searchLoading: true,
        searchError: "",
      });
      try {
        const data = await api.get(
          `/logs/${currentService}/${encodeURIComponent(selectedLogFile)}/search?q=${encodeURIComponent(debouncedSearchQuery)}&limit=200&case=${caseSensitive}&regex=${regexSearch}`
        );
        if (!active) return;
        updateCurrentSearchState({
          searchResults: data.matches || [],
          searchTotalMatches: data.totalMatches || 0,
          selectedMatchLine: (data.matches || [])[0]?.lineNumber || null,
        });
      } catch (error) {
        if (!active) return;
        updateCurrentSearchState({
          searchResults: [],
          searchTotalMatches: 0,
          selectedMatchLine: null,
          searchError: error.message || "Search is unavailable",
        });
      } finally {
        if (active) {
          updateCurrentSearchState({
            searchLoading: false,
          });
        }
      }
    }

    runSearch();
    return () => {
      active = false;
    };
  }, [caseSensitive, currentService, debouncedSearchQuery, regexSearch, selectedLogFile, updateCurrentSearchState]);

  const runningServices = useServiceRunningStates(services, isActive);

  const filteredServices = useMemo(() => {
    const term = serviceFilter.trim().toLowerCase();
    const serviceList = [...services].sort((left, right) => {
      const leftPinned = pinnedServices.includes(left.name) ? 1 : 0;
      const rightPinned = pinnedServices.includes(right.name) ? 1 : 0;
      if (leftPinned !== rightPinned) return rightPinned - leftPinned;
      return left.name.localeCompare(right.name);
    });

    if (!term) return serviceList;
    return serviceList.filter((service) =>
      [service.name, service.group, service.type, service.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [pinnedServices, serviceFilter, services]);

  const streamChip = prettifyStatus(connectionStatus);

  const matcher = useMemo(
    () => buildMatcher(debouncedSearchQuery, { caseSensitive, regex: regexSearch }),
    [caseSensitive, debouncedSearchQuery, regexSearch]
  );
  const levelFilter = useMemo(() => (viewerSettings.levels ? new Set(viewerSettings.levels) : null), [viewerSettings.levels]);
  const filterByMatch = onlyMatching && matcher && !matcher.error ? matcher : null;
  const rows = useMemo(
    () => buildRows(logView, { levels: levelFilter, matcher: filterByMatch, collapseStacks, expandedFolds }),
    [collapseStacks, expandedFolds, filterByMatch, levelFilter, logView]
  );
  const levelCounts = useMemo(() => countLevels(logView), [logView]);
  const layoutKey = `${logView.version}|${logLineOffset}|${viewerSettings.levels?.join(",") || "all"}|${filterByMatch ? debouncedSearchQuery : ""}|${caseSensitive}|${regexSearch}|${collapseStacks}|${expandedFolds.size}|${[...expandedFolds].join(",")}`;

  const lineIndex = useCallback((line) => line - logLineOffset - 1, [logLineOffset]);
  const isLineLoaded = useCallback(
    (lineNumber) => lineNumber > logLineOffset && lineNumber <= logLineOffset + loadedLineCount,
    [loadedLineCount, logLineOffset]
  );

  const showCopied = useCallback((label) => {
    setCopiedLabel(label);
    setCopyState("copied");
    setTimeout(() => setCopyState(""), 2000);
  }, []);

  const copyLines = useCallback(async (indexes, label) => {
    if (!indexes.length) return;
    try {
      await copyToClipboard(joinPlain(logView, indexes));
      showCopied(label || `Copied ${indexes.length.toLocaleString()} line${indexes.length === 1 ? "" : "s"}`);
    } catch {
      setCopyState("failed");
      setTimeout(() => setCopyState(""), 2500);
    }
  }, [logView, showCopied]);

  const selectedIndexes = useMemo(() => {
    if (!selection) return [];
    const first = Math.max(0, lineIndex(Math.min(selection.from, selection.to)));
    const last = Math.min(loadedLineCount - 1, lineIndex(Math.max(selection.from, selection.to)));
    const indexes = [];
    for (let index = first; index <= last; index += 1) indexes.push(index);
    return indexes;
  }, [lineIndex, loadedLineCount, selection]);

  const copySelectedLines = useCallback(() => copyLines(selectedIndexes), [copyLines, selectedIndexes]);
  const copyVisibleLines = useCallback(() => copyLines(rowsToIndexes(rows)), [copyLines, rows]);
  const copyAllLines = useCallback(() => {
    const indexes = [];
    for (let index = 0; index < loadedLineCount; index += 1) indexes.push(index);
    copyLines(indexes);
  }, [copyLines, loadedLineCount]);

  const downloadLogFile = useCallback(() => {
    if (!currentService || !selectedLogFile) return;
    const link = document.createElement("a");
    link.href = `${LOG_API_BASE}/logs/${currentService}/${encodeURIComponent(selectedLogFile)}/download`;
    link.download = selectedLogFile;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [currentService, selectedLogFile]);

  // Loads lines around a line that is not loaded, pausing live updates while they are shown.
  const loadLinesAround = useCallback(async (lineNumber) => {
    if (!currentService || !selectedLogFile) return;
    const requestId = windowRequestRef.current + 1;
    windowRequestRef.current = requestId;
    stopStreaming();
    resetPause();
    const startLine = Math.max(1, lineNumber - MATCH_CONTEXT_LINES_BEFORE);
    try {
      const data = await api.get(
        `/logs/${currentService}/${encodeURIComponent(selectedLogFile)}?startLine=${startLine}&count=${MATCH_CONTEXT_LINES}`
      );
      if (windowRequestRef.current !== requestId) return;
      if (!data.lineCount) {
        setNotice(`Line ${lineNumber.toLocaleString()} is past the end of this log.`);
        return;
      }
      pendingScrollLineRef.current = lineNumber;
      setLogView(createLogView(data.content || "", { lineOffset: data.lineOffset || 0, windowed: true }));
    } catch (error) {
      if (windowRequestRef.current !== requestId) return;
      setLogView(messageView(`Error loading log lines: ${error.message}`));
    }
  }, [currentService, resetPause, selectedLogFile, stopStreaming]);

  // Scroll once lines loaded by loadLinesAround have rendered.
  useEffect(() => {
    if (pendingScrollLineRef.current === null) return;
    viewerRef.current?.scrollToLine(pendingScrollLineRef.current);
    pendingScrollLineRef.current = null;
  }, [logView]);

  // Scrolls to a file line, loading it first when it is outside the loaded part.
  const revealLine = useCallback((lineNumber) => {
    setFollowing(false);
    setNotice("");
    if (isLineLoaded(lineNumber)) {
      viewerRef.current?.scrollToLine(lineNumber);
    } else {
      loadLinesAround(lineNumber);
    }
  }, [isLineLoaded, loadLinesAround]);

  const jumpToMatch = useCallback((lineNumber) => {
    updateCurrentSearchState({
      selectedMatchLine: lineNumber,
    });
    revealLine(lineNumber);
  }, [revealLine, updateCurrentSearchState]);

  const goToLine = useCallback(() => {
    const lineNumber = parseInt(goToLineText, 10);
    if (!lineNumber || lineNumber < 1) return;
    setSelection({ anchor: lineNumber, from: lineNumber, to: lineNumber });
    revealLine(lineNumber);
  }, [goToLineText, revealLine]);

  // Next/previous log entry at ERROR level within the loaded lines, starting from the selection or the top of the view.
  const moveToError = useCallback((direction) => {
    const fromLine = selection?.to ?? viewerRef.current?.getTopLine() ?? logLineOffset + 1;
    const step = direction === "next" ? 1 : -1;
    let index = lineIndex(fromLine) + (selection || direction === "previous" ? step : 0);
    for (; index >= 0 && index < loadedLineCount; index += step) {
      if (logView.starts[index] && logView.levels[index] === "error") {
        const lineNumber = logLineOffset + index + 1;
        setSelection({ anchor: lineNumber, from: lineNumber, to: lineNumber });
        revealLine(lineNumber);
        return;
      }
    }
    setNotice(
      direction === "next"
        ? "No more errors in the loaded lines."
        : logLineOffset > 0
          ? "No earlier errors in the loaded lines (earlier output isn't loaded — search for ERROR to reach it)."
          : "No earlier errors."
    );
  }, [lineIndex, loadedLineCount, logLineOffset, logView, revealLine, selection]);

  const handleGutterClick = useCallback((lineNumber, event) => {
    setSelection((previous) => {
      if (event.shiftKey && previous) return { anchor: previous.anchor, from: previous.anchor, to: lineNumber };
      if (previous && previous.from === lineNumber && previous.to === lineNumber) return null;
      return { anchor: lineNumber, from: lineNumber, to: lineNumber };
    });
  }, []);

  const toggleFold = useCallback((foldLine) => {
    setExpandedFolds((previous) => {
      const next = new Set(previous);
      if (next.has(foldLine)) next.delete(foldLine);
      else next.add(foldLine);
      return next;
    });
  }, []);

  const toggleLevel = useCallback((level) => {
    updateViewerSettings((previous) => {
      const current = new Set(previous.levels || LEVELS);
      if (current.has(level)) current.delete(level);
      else current.add(level);
      const levels = LEVELS.filter((item) => current.has(item));
      return { levels: levels.length === 0 || levels.length === LEVELS.length ? null : levels };
    });
  }, [updateViewerSettings]);

  const followLatest = useCallback(() => {
    setFollowing(true);
    viewerRef.current?.scrollToBottom();
  }, []);

  // Leaves an earlier part of the log and goes back to the newest output (live again for the current run).
  const showLatestLog = useCallback(() => {
    windowRequestRef.current += 1;
    setFollowing(true);
    setSelection(null);
    if (isActiveSelection) {
      startStreaming();
    } else {
      refreshCurrentLog();
    }
  }, [isActiveSelection, refreshCurrentLog, startStreaming]);

  const moveToSearchResult = useCallback((direction) => {
    if (!searchResults.length) return;
    const currentIndex = selectedMatchIndex >= 0 ? selectedMatchIndex : 0;
    const nextIndex =
      direction === "next"
        ? Math.min(searchResults.length - 1, currentIndex + 1)
        : Math.max(0, currentIndex - 1);
    jumpToMatch(searchResults[nextIndex].lineNumber);
  }, [jumpToMatch, searchResults, selectedMatchIndex]);

  const highlightMatchPreview = useCallback((line, query) => {
    if (!query) return line;
    const lowerLine = String(line).toLowerCase();
    const lowerQuery = query.toLowerCase();
    const matchIndex = lowerLine.indexOf(lowerQuery);
    if (matchIndex === -1) return line;
    const before = line.slice(0, matchIndex);
    const match = line.slice(matchIndex, matchIndex + query.length);
    const after = line.slice(matchIndex + query.length);
    return (
      <>
        {before}
        <Box component="mark" sx={{ backgroundColor: "rgba(250,204,21,0.45)", color: "inherit", px: 0.25, borderRadius: 0.5 }}>
          {match}
        </Box>
        {after}
      </>
    );
  }, []);

  // Keyboard shortcuts while the Logs tab is shown (see SHORTCUTS).
  useEffect(() => {
    if (!isActive || !currentService) return undefined;
    const handleKeyDown = (event) => {
      if (event.defaultPrevented) return;
      const target = event.target;
      const inField = target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key;

      if (modifier && !event.altKey && key.toLowerCase() === "f") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      if (modifier && !event.altKey && key.toLowerCase() === "g") {
        event.preventDefault();
        goToLineInputRef.current?.focus();
        goToLineInputRef.current?.select();
        return;
      }
      if (inField || document.querySelector('[role="dialog"], [role="menu"]')) return;
      if (modifier && key.toLowerCase() === "c") {
        if (selection && !window.getSelection()?.toString()) {
          event.preventDefault();
          copySelectedLines();
        }
        return;
      }
      if (modifier || event.altKey) return;

      const actions = {
        Escape: () => setSelection(null),
        n: () => moveToSearchResult("next"),
        N: () => moveToSearchResult("previous"),
        e: () => moveToError("next"),
        E: () => moveToError("previous"),
        p: togglePause,
        End: followLatest,
        G: followLatest,
        Home: () => {
          setFollowing(false);
          viewerRef.current?.scrollToTop();
        },
        w: () => updateViewerSettings((previous) => ({ wrap: !previous.wrap })),
        "+": () => updateViewerSettings((previous) => ({ fontSize: FONT_SIZES.find((size) => size > previous.fontSize) || previous.fontSize })),
        "=": () => updateViewerSettings((previous) => ({ fontSize: FONT_SIZES.find((size) => size > previous.fontSize) || previous.fontSize })),
        "-": () => updateViewerSettings((previous) => ({ fontSize: [...FONT_SIZES].reverse().find((size) => size < previous.fontSize) || previous.fontSize })),
        "?": () => setShortcutsOpen(true),
      };
      const action = actions[key];
      if (action) {
        event.preventDefault();
        action();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [copySelectedLines, currentService, followLatest, isActive, moveToError, moveToSearchResult, selection, togglePause, updateViewerSettings]);

  const renderSearchControls = () => (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <TextField
        size="small"
        placeholder="Search inside current log"
        inputRef={searchInputRef}
        value={searchQuery}
        onChange={(event) => updateCurrentSearchState({ searchQuery: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            moveToSearchResult(event.shiftKey ? "previous" : "next");
          } else if (event.key === "Escape") {
            event.currentTarget.querySelector("input")?.blur();
          }
        }}
        inputProps={{ "aria-label": "Search inside current log (Enter: next match, Shift+Enter: previous)" }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ fontSize: "1rem" }} />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end" sx={{ gap: 0.25 }}>
              {[
                ["caseSensitive", "Aa", "Match case"],
                ["regex", ".*", "Regular expression"],
              ].map(([setting, label, title]) => (
                <Tooltip key={setting} title={title}>
                  <Box
                    component="button"
                    type="button"
                    aria-pressed={Boolean(viewerSettings[setting])}
                    aria-label={title}
                    onClick={() => updateViewerSettings((previous) => ({ [setting]: !previous[setting] }))}
                    sx={{
                      border: "1px solid",
                      borderColor: viewerSettings[setting] ? "primary.main" : "transparent",
                      bgcolor: viewerSettings[setting] ? "color-mix(in srgb, var(--sm-accent) 12%, transparent)" : "transparent",
                      color: viewerSettings[setting] ? "primary.main" : "text.secondary",
                      borderRadius: 1,
                      px: 0.5,
                      py: 0,
                      cursor: "pointer",
                      font: "inherit",
                      fontFamily: CODE_FONT,
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      lineHeight: 1.6,
                    }}
                  >
                    {label}
                  </Box>
                </Tooltip>
              ))}
            </InputAdornment>
          ),
          sx: SEARCH_INPUT_SX,
        }}
        error={Boolean(matcher?.error)}
        sx={{ width: { xs: "100%", sm: 300 } }}
      />
      {searchQuery ? (
        <Button size="small" variant="text" onClick={() => updateCurrentSearchState({
          searchQuery: "",
          debouncedSearchQuery: "",
          searchResults: [],
          searchTotalMatches: 0,
          searchLoading: false,
          searchError: "",
          selectedMatchLine: null,
        })}>
          Clear
        </Button>
      ) : null}
      <Tooltip title={wrapped ? "Disable wrap (w)" : "Wrap lines (w)"}>
        <IconButton size="small" color={wrapped ? "primary" : "default"} onClick={() => updateViewerSettings({ wrap: !wrapped })}>
          <WrapTextIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );

  const renderFilterBar = () => (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 0.75,
        px: 1.5,
        py: 0.5,
        flexShrink: 0,
        borderBottom: "1px solid var(--c-border-94a3b8-016)",
      }}
    >
      {LEVELS.map((level) => {
        const shown = !viewerSettings.levels || viewerSettings.levels.includes(level);
        return (
          <Tooltip key={level} title={`${shown ? "Hide" : "Show"} ${LEVEL_LABELS[level].toLowerCase()} — loaded lines only`}>
            <Chip
              size="small"
              clickable
              onClick={() => toggleLevel(level)}
              label={`${LEVEL_LABELS[level]} ${levelCounts[level].toLocaleString()}`}
              variant={shown ? "filled" : "outlined"}
              sx={{
                ...compactChipSx,
                fontWeight: 700,
                color: shown ? "#fff" : "text.secondary",
                bgcolor: shown ? LEVEL_CHIP_COLORS[level] : "transparent",
                "&:hover": { bgcolor: shown ? LEVEL_CHIP_COLORS[level] : undefined, opacity: 0.9 },
              }}
            />
          </Tooltip>
        );
      })}
      <Tooltip title={debouncedSearchQuery ? "Show only lines matching the search" : "Type a search first"}>
        <span>
          <Chip
            size="small"
            clickable
            disabled={!debouncedSearchQuery}
            onClick={() => updateViewerSettings({ onlyMatching: !onlyMatching })}
            label="Only matching lines"
            color={onlyMatching && debouncedSearchQuery ? "primary" : "default"}
            variant={onlyMatching && debouncedSearchQuery ? "filled" : "outlined"}
            sx={compactChipSx}
          />
        </span>
      </Tooltip>
      {rows.length !== loadedLineCount && !logView.message ? (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {rowsToIndexes(rows).length.toLocaleString()} of {loadedLineCount.toLocaleString()} lines shown
        </Typography>
      ) : null}

      <Box sx={{ flex: 1 }} />

      {selectedIndexes.length ? (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            {selectedIndexes.length.toLocaleString()} line{selectedIndexes.length === 1 ? "" : "s"} selected
          </Typography>
          <Button size="small" startIcon={<ContentCopyIcon sx={{ fontSize: "0.9rem !important" }} />} onClick={copySelectedLines} sx={{ minWidth: 0, py: 0 }}>
            Copy
          </Button>
          <Button size="small" onClick={() => setSelection(null)} sx={{ minWidth: 0, py: 0 }}>
            Clear
          </Button>
        </Stack>
      ) : null}
      <Stack direction="row" spacing={0.25} alignItems="center" sx={{ flexShrink: 0 }}>
        <Tooltip title="Previous error (Shift+E)">
          <IconButton size="small" aria-label="Previous error" onClick={() => moveToError("previous")}>
            <ArrowUpIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Chip size="small" icon={<ErrorIcon sx={{ fontSize: "0.9rem !important" }} />} label="Errors" variant="outlined" sx={compactChipSx} />
        <Tooltip title="Next error (e)">
          <IconButton size="small" aria-label="Next error" onClick={() => moveToError("next")}>
            <ArrowDownIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      <TextField
        size="small"
        placeholder="Go to line"
        inputRef={goToLineInputRef}
        value={goToLineText}
        onChange={(event) => setGoToLineText(event.target.value.replace(/[^0-9]/g, ""))}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            goToLine();
          }
        }}
        inputProps={{ "aria-label": "Go to line (Ctrl/⌘ G)", inputMode: "numeric" }}
        InputProps={{ sx: { ...SEARCH_INPUT_SX, height: 28, fontSize: "0.75rem" } }}
        sx={{ width: 110 }}
      />
    </Box>
  );

  const renderNotices = () => {
    const items = [];
    if (logWindowed) {
      items.push(
        <Alert key="window" severity="info" icon={false} sx={{ py: 0, borderRadius: 0 }}
          action={<Button size="small" onClick={showLatestLog}>Back to latest</Button>}>
          Showing lines {(logLineOffset + 1).toLocaleString()}–{(logLineOffset + loadedLineCount).toLocaleString()} · live updates paused
        </Alert>
      );
    } else if (logLineOffset > 0) {
      items.push(
        <Alert key="trimmed" severity="info" icon={false} sx={{ py: 0, borderRadius: 0 }}
          action={<Button size="small" startIcon={<DownloadIcon />} onClick={downloadLogFile}>Download full log</Button>}>
          {logLineOffset.toLocaleString()} earlier lines aren't loaded. Search and "Go to line" still cover the whole file.
        </Alert>
      );
    }
    if (paused) {
      items.push(
        <Alert key="paused" severity="warning" icon={false} sx={{ py: 0, borderRadius: 0 }}
          action={<Button size="small" startIcon={<ResumeIcon />} onClick={togglePause}>Resume</Button>}>
          Live output paused{pausedNewLines ? ` · ${pausedNewLines.toLocaleString()} new line${pausedNewLines === 1 ? "" : "s"} waiting` : ""}
        </Alert>
      );
    }
    if (matcher?.error) {
      items.push(
        <Alert key="regex" severity="error" sx={{ py: 0, borderRadius: 0 }}>
          Invalid regular expression: {matcher.error}
        </Alert>
      );
    }
    if (notice) {
      items.push(
        <Alert key="notice" severity="info" sx={{ py: 0, borderRadius: 0 }} onClose={() => setNotice("")}>
          {notice}
        </Alert>
      );
    }
    return items.length ? <Box sx={{ flexShrink: 0 }}>{items}</Box> : null;
  };

  const openServiceFromExplorer = (serviceName) => {
    setSelectedServiceName(serviceName);
    if (!openServices.includes(serviceName)) {
      onAddService(serviceName);
    } else {
      onServiceTabChange(openServices.indexOf(serviceName));
    }
  };

  const compactChipSx = { fontSize: "0.7rem" };

  const renderFocusToggle = () => (
    <Tooltip title={maximized ? "Exit focus mode" : "Focus log area"}>
      <IconButton size="small" onClick={() => setMaximized((previous) => !previous)}>
        {maximized ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );

  const renderViewerTabs = () => (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1,
        minHeight: TOP_BAR_HEIGHT,
        flexShrink: 0,
        borderBottom: "1px solid var(--c-border-94a3b8-016)",
        backgroundColor: "var(--c-bg-f8fafc-088)",
      }}
    >
      <Tabs
        value={openServices.includes(currentService) ? openServices.indexOf(currentService) : false}
        onChange={(_, newValue) => {
          const serviceName = openServices[newValue];
          if (serviceName) {
            setSelectedServiceName(serviceName);
            onServiceTabChange(newValue);
          }
        }}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          minHeight: 32,
          flex: 1,
          minWidth: 0,
          "& .MuiTab-root": {
            minHeight: 32,
            textTransform: "none",
            minWidth: 0,
            px: 1,
            py: 0.25,
            borderRadius: 1.5,
            mr: 0.5,
            color: "text.secondary",
            border: "1px solid transparent",
            "&:hover": { backgroundColor: "var(--c-bg-0f172a-005)" },
          },
          "& .MuiTab-root.Mui-selected": {
            color: "primary.main",
            backgroundColor: "background.paper",
            borderColor: "color-mix(in srgb, var(--sm-accent) 35%, transparent)",
            boxShadow: "0 1px 3px var(--c-shadow-0f172a-008), inset 0 -2px 0 var(--sm-accent)",
          },
          "& .MuiTabs-indicator": {
            display: "none",
          },
        }}
      >
        {openServices.map((serviceName, index) => (
          <Tab
            key={serviceName}
            value={index}
            label={
              <OpenServiceTabLabel
                serviceName={serviceName}
                running={Boolean(runningServices[serviceName])}
                onClose={() => onCloseService(serviceName)}
              />
            }
          />
        ))}
      </Tabs>

      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexShrink: 0 }}>
        {renderFocusToggle()}
      </Stack>
    </Box>
  );

  const renderLogToolbar = () => (
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
      <Typography variant="subtitle2" noWrap sx={{ fontWeight: 800, maxWidth: 220 }}>
        {currentService}
      </Typography>
      {selectedLogFile ? (
        <Tooltip
          title={isArchivedSelection
            ? "A previous run of this service — read-only."
            : "The current run streams live while the service is writing to it. A restart starts a new run."}
        >
          <Chip
            size="small"
            label={isArchivedSelection ? "Previous run" : streamChip.label}
            color={isArchivedSelection ? "default" : streamChip.color}
            variant={isArchivedSelection || streamChip.color === "default" ? "outlined" : "filled"}
            sx={compactChipSx}
          />
        </Tooltip>
      ) : null}
      {activeLogFiles.length + archivedLogFiles.length > 0 ? (
        <Select
          size="small"
          value={selectedLogFile || ""}
          displayEmpty
          renderValue={(value) => (value ? logFileOptionByName[value]?.short || value : "Select run")}
          onChange={(event) => setSelectedLogFile(event.target.value)}
          sx={{ height: 28, maxWidth: 360, fontSize: "0.75rem", borderRadius: 1.5 }}
          MenuProps={{ PaperProps: { sx: { maxHeight: 460, py: 0.5 } } }}
        >
          {logFileOptions.flatMap((option, index) => {
            const items = [];
            if (index === 0 || logFileOptions[index - 1].group !== option.group) {
              items.push(
                <MenuItem key={`group-${option.group}`} disabled value={`__group_${option.group}`} sx={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4, opacity: "1 !important", color: "text.secondary", minHeight: 0, px: 2, pt: index === 0 ? 0.75 : 1.5, pb: 0.75, mt: index === 0 ? 0 : 0.75, borderTop: index === 0 ? 0 : "1px solid var(--c-border-94a3b8-025)" }}>
                  {option.group}
                </MenuItem>
              );
            }
            const kindStyles = {
              current: { color: "var(--c-text-059669)", background: "var(--c-bg-10b981-008)", border: STATUS_COLORS.running },
              run: { color: "var(--sm-accent-text)", background: "transparent", border: "transparent" },
              legacy: { color: "var(--c-text-94a3b8)", background: "transparent", border: "transparent" },
            }[option.kind];
            items.push(
              <MenuItem
                key={option.fileName}
                value={option.fileName}
                title={option.fileName}
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 1.25,
                  px: 1.5,
                  py: 1,
                  mx: 1,
                  my: 0.5,
                  minWidth: 300,
                  borderRadius: 1.5,
                  backgroundColor: kindStyles.background,
                  border: "1px solid",
                  borderColor: option.kind === "current" ? "var(--c-border-10b981-035)" : "var(--c-border-94a3b8-018)",
                }}
              >
                <Box sx={{ mt: 0.25, color: kindStyles.color, display: "flex" }}>
                  {option.kind === "current" ? (
                    <Box sx={{ width: 9, height: 9, m: "3px", borderRadius: "50%", backgroundColor: STATUS_COLORS.running, boxShadow: "0 0 0 3px var(--c-shadow-12b76a-02)" }} />
                  ) : option.kind === "run" ? (
                    <HistoryIcon sx={{ fontSize: 15 }} />
                  ) : (
                    <LegacyLogIcon sx={{ fontSize: 15 }} />
                  )}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: "0.82rem",
                      fontWeight: option.kind === "current" ? 700 : 500,
                      color: option.kind === "legacy" ? "text.secondary" : option.kind === "current" ? "var(--c-text-047857)" : "text.primary",
                      fontStyle: option.kind === "legacy" ? "italic" : "normal",
                    }}
                  >
                    {option.title}
                  </Typography>
                  {option.subtitle ? (
                    <Typography sx={{ fontSize: "0.72rem", color: "text.secondary", mt: 0.25 }}>{option.subtitle}</Typography>
                  ) : null}
                </Box>
              </MenuItem>
            );
            return items;
          })}
        </Select>
      ) : (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          No log files
        </Typography>
      )}
      {loadingFiles ? <Chip size="small" label="Loading files…" color="warning" sx={compactChipSx} /> : null}

      <Box sx={{ flex: 1 }} />

      {renderSearchControls()}
      <Tooltip title={following ? "Following new lines — scroll up to stop" : "Jump to latest and follow new lines (End)"}>
        <IconButton
          size="small"
          color={following ? "primary" : "default"}
          aria-pressed={following}
          aria-label="Follow new lines"
          onClick={followLatest}
        >
          <FollowIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {isActiveSelection && !logWindowed ? (
        <Tooltip title={paused ? "Resume live output (p)" : "Pause live output (p)"}>
          <IconButton size="small" aria-label={paused ? "Resume live output" : "Pause live output"} color={paused ? "warning" : "default"} onClick={togglePause}>
            {paused ? <ResumeIcon fontSize="small" /> : <PauseIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      ) : null}
      <Tooltip title="Reload log">
        <IconButton size="small" aria-label="Reload log" onClick={refreshCurrentLog}>
          <ReloadIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip
        open={copyState ? true : undefined}
        title={copyState === "copied" ? copiedLabel || "Copied" : copyState === "failed" ? "Couldn't copy — clipboard blocked" : "Copy or download"}
      >
        <IconButton size="small" aria-label="Copy log" onClick={(event) => setCopyMenuAnchor(event.currentTarget)} color={copyState === "failed" ? "error" : "default"}>
          {copyState === "copied" ? <CheckIcon fontSize="small" sx={{ color: "success.main" }} /> : <ContentCopyIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
      <Menu anchorEl={copyMenuAnchor} open={Boolean(copyMenuAnchor)} onClose={() => setCopyMenuAnchor(null)}>
        {[
          ["Copy selected lines", selectedIndexes.length, copySelectedLines, "Click line numbers (Shift+click for a range) to select"],
          ["Copy lines shown", rowsToIndexes(rows).length, copyVisibleLines, "Lines that pass the level and search filters, stack traces included"],
          ["Copy all loaded lines", loadedLineCount, copyAllLines, logLineOffset > 0 ? "Earlier lines aren't loaded — download for the whole file" : "The whole log"],
        ].map(([label, count, action, hint]) => (
          <MenuItem
            key={label}
            disabled={!count || Boolean(logView.message)}
            onClick={() => {
              setCopyMenuAnchor(null);
              action();
            }}
          >
            <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary={`${label} (${count.toLocaleString()})`} secondary={hint} secondaryTypographyProps={{ fontSize: "0.7rem" }} />
          </MenuItem>
        ))}
        <Divider />
        <MenuItem
          disabled={!selectedLogFile}
          onClick={() => {
            setCopyMenuAnchor(null);
            downloadLogFile();
          }}
        >
          <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Download full log file" secondary={selectedLogFile} secondaryTypographyProps={{ fontSize: "0.7rem" }} />
        </MenuItem>
      </Menu>
      <Tooltip title="View options">
        <IconButton size="small" aria-label="View options" onClick={(event) => setViewMenuAnchor(event.currentTarget)}>
          <ViewOptionsIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={viewMenuAnchor} open={Boolean(viewMenuAnchor)} onClose={() => setViewMenuAnchor(null)}>
        <MenuItem disableRipple sx={{ cursor: "default", "&:hover": { bgcolor: "transparent" } }}>
          <ListItemText primary="Text size" secondary={`${fontSize}px`} secondaryTypographyProps={{ fontSize: "0.7rem" }} />
          <IconButton size="small" aria-label="Smaller text" disabled={fontSize <= FONT_SIZES[0]}
            onClick={() => updateViewerSettings({ fontSize: [...FONT_SIZES].reverse().find((size) => size < fontSize) || fontSize })}>
            <TextDecreaseIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" aria-label="Larger text" disabled={fontSize >= FONT_SIZES[FONT_SIZES.length - 1]}
            onClick={() => updateViewerSettings({ fontSize: FONT_SIZES.find((size) => size > fontSize) || fontSize })}>
            <TextIncreaseIcon fontSize="small" />
          </IconButton>
        </MenuItem>
        <Divider />
        {[
          ["wrap", "Wrap long lines", <WrapTextIcon fontSize="small" />],
          ["colorLevels", "Color lines by level", <ErrorIcon fontSize="small" />],
          ["collapseStacks", "Collapse long stack traces", <CollapseIcon fontSize="small" />],
        ].map(([setting, label, icon]) => (
          <MenuItem key={setting} onClick={() => updateViewerSettings((previous) => ({ [setting]: !previous[setting] }))}>
            <ListItemIcon>{icon}</ListItemIcon>
            <ListItemText primary={label} />
            {viewerSettings[setting] ? <CheckIcon fontSize="small" sx={{ ml: 2, color: "primary.main" }} /> : <Box sx={{ width: 20, ml: 2 }} />}
          </MenuItem>
        ))}
        {expandedFolds.size ? (
          <MenuItem onClick={() => { setExpandedFolds(new Set()); setViewMenuAnchor(null); }}>
            <ListItemIcon><CollapseIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Collapse all opened stack traces" />
          </MenuItem>
        ) : null}
        <Divider />
        <MenuItem onClick={() => { setViewMenuAnchor(null); setShortcutsOpen(true); }}>
          <ListItemIcon><KeyboardIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Keyboard shortcuts" secondary="?" secondaryTypographyProps={{ fontSize: "0.7rem" }} />
        </MenuItem>
      </Menu>
      <Tooltip title="Clear log">
        <span>
          <IconButton size="small" aria-label="Clear log" onClick={() => setConfirmClearOpen(true)} disabled={!selectedLogFile}>
            <ClearLogIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );

  const renderSearchResults = () => (
    <Box sx={{ px: 1.5, py: 1, flexShrink: 0, borderBottom: "1px solid var(--c-border-94a3b8-016)" }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} sx={{ mb: 0.75 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
            Search results
          </Typography>
          <Chip
            size="small"
            label={searchLoading
              ? "Searching…"
              : `${searchTotalMatches} match${searchTotalMatches === 1 ? "" : "es"}`}
            color={searchLoading ? "warning" : "default"}
            variant="outlined"
            sx={compactChipSx}
          />
        </Stack>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Enter: next match · Shift+Enter: previous
        </Typography>
      </Stack>
      {searchError ? (
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          Search is unavailable right now: {searchError}. If the backend was updated recently, restart it and try again.
        </Alert>
      ) : !searchLoading ? (
        selectedMatch ? (
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "flex-start", md: "center" }}>
            <Typography variant="caption" sx={{ color: "primary.main", fontWeight: 700, flexShrink: 0 }}>
              Match {selectedMatchIndex + 1} of {searchResults.length} • Line {selectedMatch.lineNumber}
            </Typography>
            <Typography
              variant="body2"
              noWrap
              sx={{ flex: 1, minWidth: 0, fontFamily: CODE_FONT, fontSize: "0.75rem" }}
            >
              {selectedMatch.preview ? highlightMatchPreview(selectedMatch.preview, debouncedSearchQuery) : "(empty line)"}
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
              {!isLineLoaded(selectedMatch.lineNumber) ? (
                <Button size="small" variant="contained" disableElevation onClick={() => jumpToMatch(selectedMatch.lineNumber)}>
                  Show line
                </Button>
              ) : null}
              {logWindowed ? (
                <Button size="small" onClick={showLatestLog}>
                  Back to latest
                </Button>
              ) : null}
              <Button
                size="small"
                variant="outlined"
                onClick={() => moveToSearchResult("previous")}
                disabled={selectedMatchIndex <= 0}
              >
                Previous
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => moveToSearchResult("next")}
                disabled={selectedMatchIndex === -1 || selectedMatchIndex >= searchResults.length - 1}
              >
                Next
              </Button>
            </Stack>
          </Stack>
        ) : (
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            No matching lines found.
          </Typography>
        )
      ) : null}
    </Box>
  );

  return (
    <Box sx={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Paper
        elevation={0}
        sx={{
          ...contentCardSx,
          ...(maximized ? { borderRadius: 0 } : {}),
          flexGrow: 1,
          display: "flex",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: maximized ? "1fr" : explorerCollapsed ? "48px minmax(0, 1fr)" : "240px minmax(0, 1fr)",
            lg: maximized ? "1fr" : explorerCollapsed ? "48px minmax(0, 1fr)" : "280px minmax(0, 1fr)",
          },
          overflow: "hidden",
        }}
      >
        {!maximized && (
          <Box
            sx={{
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              borderRight: "1px solid var(--c-border-94a3b8-018)",
              backgroundColor: "var(--c-bg-f8fafc-06)",
            }}
          >
            <Box
              sx={{
                display: "flex",
                flexDirection: explorerCollapsed ? "column" : "row",
                alignItems: "center",
                gap: 0.5,
                px: 1,
                minHeight: TOP_BAR_HEIGHT,
                flexShrink: 0,
                borderBottom: "1px solid var(--c-border-94a3b8-016)",
              }}
            >
              {!explorerCollapsed ? (
                <TextField
                  fullWidth
                  size="small"
                  value={serviceFilter}
                  onChange={(event) => setServiceFilter(event.target.value)}
                  placeholder="Search services"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ fontSize: "1rem" }} />
                      </InputAdornment>
                    ),
                    sx: SEARCH_INPUT_SX,
                  }}
                />
              ) : null}
              <Tooltip title={explorerCollapsed ? "Expand explorer" : "Collapse explorer"}>
                <IconButton size="small" onClick={() => setExplorerCollapsed((previous) => !previous)}>
                  {explorerCollapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            </Box>

            {!explorerCollapsed ? (
              <Box sx={{ flexGrow: 1, overflow: "auto", p: 0.75, display: "flex", flexDirection: "column", gap: 0.25 }}>
                {filteredServices.map((service) => (
                  <ExplorerItem
                    key={service.name}
                    service={service}
                    active={currentService === service.name}
                    pinned={pinnedServices.includes(service.name)}
                    running={Boolean(runningServices[service.name])}
                    onOpen={() => openServiceFromExplorer(service.name)}
                    onPin={() =>
                      setPinnedServices((previous) =>
                        previous.includes(service.name)
                          ? previous.filter((item) => item !== service.name)
                          : [...previous, service.name]
                      )
                    }
                  />
                ))}
                {filteredServices.length === 0 ? (
                  <EmptyState title="No services match this filter" hint="Try a different search term." sx={{ p: 2 }} />
                ) : null}
              </Box>
            ) : (
              <Box sx={{ flexGrow: 1, overflow: "auto", p: 0.5, display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                {filteredServices.map((service) => (
                  <Tooltip
                    key={service.name}
                    title={`${service.name} (${runningServices[service.name] ? "running" : "stopped"})`}
                    placement="right"
                  >
                    <Box sx={{ position: "relative" }}>
                    <Chip
                      size="small"
                      clickable
                      color={currentService === service.name ? "primary" : "default"}
                      variant={currentService === service.name ? "filled" : "outlined"}
                      label={serviceInitials(service.name)}
                      aria-label={service.name}
                      onClick={() => openServiceFromExplorer(service.name)}
                      sx={{ width: 36, "& .MuiChip-label": { px: 0 } }}
                    />
                    <StatusDot
                      running={Boolean(runningServices[service.name])}
                      sx={{ position: "absolute", top: -1, right: -1, pointerEvents: "none", outline: "1.5px solid var(--c-border-ffffff)", bgcolor: runningServices[service.name] ? undefined : "var(--c-bg-ffffff)" }}
                    />
                    </Box>
                  </Tooltip>
                ))}
              </Box>
            )}
          </Box>
        )}

        <Box sx={{ minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {currentService ? (
            <>
              {renderViewerTabs()}
              {renderLogToolbar()}
              {debouncedSearchQuery ? renderSearchResults() : null}
              {renderFilterBar()}
              {renderNotices()}

              <LogViewer
                ref={viewerRef}
                view={logView}
                rows={rows}
                layoutKey={layoutKey}
                fontSize={fontSize}
                wrap={wrapped}
                colorLevels={colorLevels}
                matcher={matcher && !matcher.error ? matcher : null}
                selectedMatchLine={debouncedSearchQuery ? selectedMatchLine : null}
                selection={selection}
                following={following}
                onFollowingChange={handleFollowingChange}
                onGutterClick={handleGutterClick}
                onToggleFold={toggleFold}
                emptyText={filterByMatch || viewerSettings.levels ? "(no lines match the filters)" : "(empty log)"}
              />
            </>
          ) : (
            <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", p: 4 }}>
              <EmptyState title="No service selected" hint="Pick a service on the left to load its latest logs." />
            </Box>
          )}
        </Box>
      </Box>
      </Paper>

      <Dialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Log viewer shortcuts</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box component="dl" sx={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 2, rowGap: 0.75, m: 0 }}>
            {SHORTCUTS.map(([keys, description]) => (
              <Box key={keys} sx={{ display: "contents" }}>
                <Box component="dt" sx={{ fontFamily: CODE_FONT, fontSize: "0.75rem", fontWeight: 700, whiteSpace: "nowrap" }}>{keys}</Box>
                <Box component="dd" sx={{ m: 0, fontSize: "0.8rem", color: "text.secondary" }}>{description}</Box>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShortcutsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmClearOpen} onClose={() => setConfirmClearOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Clear this log?</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2">
            Empties <strong>{selectedLogFile}</strong> for {currentService}. This can't be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setConfirmClearOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              setConfirmClearOpen(false);
              clearCurrentLog();
            }}
          >
            Clear log
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});

export default Logs;
