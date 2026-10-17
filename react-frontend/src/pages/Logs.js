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
  IconButton,
  InputAdornment,
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
} from "@mui/icons-material";
import api from "../services/api";
import useServiceRunningStates from "../hooks/useServiceRunningStates";
import { CODE_FONT, SEARCH_INPUT_SX, STATUS_COLORS, TOP_BAR_HEIGHT } from "../theme/tokens";
import StatusDot from "../components/StatusDot";
import EmptyState from "../components/EmptyState";

const SEARCH_DEBOUNCE_MS = 400;
const SEARCH_MIN_CHARS = 2;
const SEARCH_MAX_CHARS = 120;

// Edge-to-edge content card, same style as the Admin and Help content cards.
const contentCardSx = {
  border: "1px solid",
  borderColor: "divider",
};

const FILE_LIST_POLL_MS = 5000;
// Live output is kept to roughly this many characters; older lines are dropped from the view
// (search still covers the whole file on the server).
const MAX_LOG_CHARS = 2000000;
const TRIM_TO_LOG_CHARS = 1500000;
const LOG_LINE_STYLE = { display: "block", width: "100%", paddingLeft: 8, marginLeft: -8, borderLeft: "2px solid transparent" };
const SELECTED_LOG_LINE_STYLE = { ...LOG_LINE_STYLE, backgroundColor: "rgba(59,130,246,0.18)", borderLeft: "2px solid rgba(96,165,250,0.95)" };
const MATCH_MARK_STYLE = { backgroundColor: "rgba(250,204,21,0.45)", color: "inherit", padding: "0 2px", borderRadius: 4 };
const TRUNCATED_NOTICE_STYLE = { display: "block", color: "#64748b", fontStyle: "italic" };

// Appends output and drops the oldest whole lines once the view grows past MAX_LOG_CHARS.
// lineOffset counts file lines before the first line shown, so line numbers stay file-based.
function appendToLogView(view, chunk) {
  const content = view.content + chunk;
  if (content.length <= MAX_LOG_CHARS) return { content, lineOffset: view.lineOffset };
  const cutAt = content.indexOf("\n", content.length - TRIM_TO_LOG_CHARS);
  if (cutAt === -1) return { content, lineOffset: view.lineOffset };
  let dropped = 0;
  for (let index = content.indexOf("\n"); index !== -1 && index <= cutAt; index = content.indexOf("\n", index + 1)) {
    dropped += 1;
  }
  return { content: content.slice(cutAt + 1), lineOffset: view.lineOffset + dropped };
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
  const [logView, setLogView] = useState({ content: "(select a service to load logs)", lineOffset: 0 });
  const { content: logContent, lineOffset: logLineOffset } = logView;
  const [serviceSearchState, setServiceSearchState] = useState({});
  const [wrapped, setWrapped] = useState(false);
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
  const logContentRef = useRef(null);

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
      setLogView({ content: `Unable to load services: ${error.message}`, lineOffset: 0 });
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
        setLogView({ content: "(no log files available for this service)", lineOffset: 0 });
      }
    } catch (error) {
      if (silent) return;
      setActiveLogFiles([]);
      setArchivedLogFiles([]);
      setSelectedLogFile("");
      setLogView({ content: `Error loading log files: ${error.message}`, lineOffset: 0 });
    } finally {
      if (!silent) setLoadingFiles(false);
    }
  }, []);

  const refreshCurrentLog = useCallback(async () => {
    if (!currentService || !selectedLogFile) return;
    try {
      const data = await api.get(`/logs/${currentService}/${encodeURIComponent(selectedLogFile)}`);
      setLogView({ content: data.content || "(empty)", lineOffset: data.lineOffset || 0 });
    } catch (error) {
      setLogView({ content: `Error loading log content: ${error.message}`, lineOffset: 0 });
    }
  }, [currentService, selectedLogFile]);

  const clearCurrentLog = useCallback(async () => {
    if (!currentService || !selectedLogFile) return;
    await api.post(`/logs/${currentService}/${encodeURIComponent(selectedLogFile)}/clear`);
    setLogView({ content: "", lineOffset: 0 });
  }, [currentService, selectedLogFile]);

  // Follow mode: stay at the newest line while new output arrives; scrolling up pauses it.
  useEffect(() => {
    const element = logContentRef.current;
    if (!element || !following || debouncedSearchQuery) return;
    element.scrollTop = element.scrollHeight;
  }, [logContent, following, debouncedSearchQuery]);

  const handleLogScroll = useCallback((event) => {
    const element = event.currentTarget;
    const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 24;
    setFollowing((previous) => (previous === atBottom ? previous : atBottom));
  }, []);

  const startStreaming = useCallback(() => {
    stopStreaming();
    if (!currentService || !selectedLogFile || !isActiveSelection) return;

    setConnectionStatus("connecting");
    const base = "http://localhost:4000";
    const stream = new EventSource(`${base}/logs/${currentService}/${encodeURIComponent(selectedLogFile)}/stream`);

    stream.onopen = () => setConnectionStatus("connected");
    stream.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "initial" || data.type === "replace") {
          setLogView({ content: data.content || "(empty)", lineOffset: data.lineOffset || 0 });
        } else if (data.type === "append") {
          setLogView((previous) => appendToLogView(previous, data.content || ""));
        }
      } catch {
        setConnectionStatus("error");
      }
    };
    stream.onerror = () => setConnectionStatus("error");
    eventSourceRef.current = stream;
  }, [currentService, isActiveSelection, selectedLogFile, stopStreaming]);

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
          `/logs/${currentService}/${encodeURIComponent(selectedLogFile)}/search?q=${encodeURIComponent(debouncedSearchQuery)}&limit=50`
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
  }, [currentService, debouncedSearchQuery, selectedLogFile, updateCurrentSearchState]);

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

  const copyLogs = async () => {
    try {
      await navigator.clipboard.writeText(logContent);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    setTimeout(() => setCopyState(""), 2000);
  };

  const jumpToMatch = useCallback((lineNumber) => {
    updateCurrentSearchState({
      selectedMatchLine: lineNumber,
    });
    if (!logContentRef.current) return;
    const lineHeightPx = 19.2;
    logContentRef.current.scrollTop = Math.max(0, (lineNumber - logLineOffset - 3) * lineHeightPx);
  }, [logLineOffset, updateCurrentSearchState]);

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

  const highlightLogLine = useCallback((line, query) => {
    if (!query) return line || "\u00A0";

    const sourceLine = String(line || "");
    const lowerLine = sourceLine.toLowerCase();
    const lowerQuery = query.toLowerCase();

    if (!lowerLine.includes(lowerQuery)) {
      return sourceLine || "\u00A0";
    }

    const parts = [];
    let cursor = 0;
    let matchIndex = lowerLine.indexOf(lowerQuery);

    while (matchIndex !== -1) {
      if (matchIndex > cursor) {
        parts.push(sourceLine.slice(cursor, matchIndex));
      }
      parts.push(
        <mark key={`${matchIndex}-${cursor}`} style={MATCH_MARK_STYLE}>
          {sourceLine.slice(matchIndex, matchIndex + query.length)}
        </mark>
      );
      cursor = matchIndex + query.length;
      matchIndex = lowerLine.indexOf(lowerQuery, cursor);
    }

    if (cursor < sourceLine.length) {
      parts.push(sourceLine.slice(cursor));
    }

    return parts.length > 0 ? parts : "\u00A0";
  }, []);

  const renderedLogContent = useMemo(() => {
    if (!debouncedSearchQuery) {
      // Highlight the run header ([RUN STARTED], [RUN CONFIG], [RUN COMMAND]) written at the top of each run.
      const headerEnd = logContent.search(/\n(?!\[RUN [A-Z]+\])[^\n]*\n?/);
      const header = headerEnd === -1 ? logContent : logContent.slice(0, headerEnd + 1);
      if (!header.startsWith("[RUN ")) {
        if (logLineOffset > 0) {
          return (
            <>
              <span style={TRUNCATED_NOTICE_STYLE}>
                … {logLineOffset.toLocaleString()} earlier lines not shown (search covers the full file)
              </span>
              {logContent}
            </>
          );
        }
        return logContent;
      }
      return (
        <>
          {header.split("\n").filter(Boolean).map((line, index) => (
            <Box
              key={`run-header-${index}`}
              component="span"
              sx={{
                display: "block",
                color: line.startsWith("[RUN CONFIG]") ? "#5eead4" : line.startsWith("[RUN COMMAND]") ? "#93c5fd" : "#94a3b8",
                fontWeight: line.startsWith("[RUN STARTED]") ? 400 : 600,
              }}
            >
              {line}
            </Box>
          ))}
          {logContent.slice(header.length)}
        </>
      );
    }

    // Plain elements with shared style objects: this can be tens of thousands of lines.
    return logContent.split("\n").map((line, index) => {
      const lineNumber = logLineOffset + index + 1;
      return (
        <div key={lineNumber} style={selectedMatchLine === lineNumber ? SELECTED_LOG_LINE_STYLE : LOG_LINE_STYLE}>
          {highlightLogLine(line, debouncedSearchQuery)}
        </div>
      );
    });
  }, [debouncedSearchQuery, highlightLogLine, logContent, logLineOffset, selectedMatchLine]);

  const renderSearchControls = () => (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <TextField
        size="small"
        placeholder="Search inside current log"
        value={searchQuery}
        onChange={(event) => updateCurrentSearchState({ searchQuery: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            moveToSearchResult(event.shiftKey ? "previous" : "next");
          }
        }}
        inputProps={{ "aria-label": "Search inside current log (Enter: next match, Shift+Enter: previous)" }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ fontSize: "1rem" }} />
            </InputAdornment>
          ),
          sx: SEARCH_INPUT_SX,
        }}
        sx={{ width: { xs: "100%", sm: 240 } }}
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
      <Tooltip title={wrapped ? "Disable wrap" : "Wrap lines"}>
        <IconButton size="small" color={wrapped ? "primary" : "default"} onClick={() => setWrapped((previous) => !previous)}>
          <WrapTextIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );

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
      <Tooltip title={following ? "Following new lines — scroll up to pause" : "Jump to latest and follow new lines"}>
        <IconButton
          size="small"
          color={following ? "primary" : "default"}
          aria-pressed={following}
          aria-label="Follow new lines"
          onClick={() => {
            setFollowing(true);
            if (logContentRef.current) logContentRef.current.scrollTop = logContentRef.current.scrollHeight;
          }}
        >
          <FollowIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Reload log">
        <IconButton size="small" aria-label="Reload log" onClick={refreshCurrentLog}>
          <ReloadIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip
        open={copyState ? true : undefined}
        title={copyState === "copied" ? "Copied" : copyState === "failed" ? "Couldn't copy — clipboard blocked" : "Copy log"}
      >
        <IconButton size="small" aria-label="Copy log" onClick={copyLogs} color={copyState === "failed" ? "error" : "default"}>
          {copyState === "copied" ? <CheckIcon fontSize="small" sx={{ color: "success.main" }} /> : <ContentCopyIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
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
              {selectedMatch.lineNumber <= logLineOffset ? " (before the part of the log shown below)" : ""}
            </Typography>
            <Typography
              variant="body2"
              noWrap
              sx={{ flex: 1, minWidth: 0, fontFamily: CODE_FONT, fontSize: "0.75rem" }}
            >
              {selectedMatch.preview ? highlightMatchPreview(selectedMatch.preview, debouncedSearchQuery) : "(empty line)"}
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
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

              <Box
                component="pre"
                ref={logContentRef}
                onScroll={handleLogScroll}
                sx={{
                  flexGrow: 1,
                  minHeight: 0,
                  overflow: "auto",
                  m: 0,
                  px: 2,
                  py: 1.5,
                  backgroundColor: "#0f172a",
                  color: "#e2e8f0",
                  whiteSpace: wrapped ? "pre-wrap" : "pre",
                  fontFamily: CODE_FONT,
                  fontSize: "0.8rem",
                  lineHeight: 1.5,
                }}
              >
                {renderedLogContent}
              </Box>
            </>
          ) : (
            <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", p: 4 }}>
              <EmptyState title="No service selected" hint="Pick a service on the left to load its latest logs." />
            </Box>
          )}
        </Box>
      </Box>
      </Paper>

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
