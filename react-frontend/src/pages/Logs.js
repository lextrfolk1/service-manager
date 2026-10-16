import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
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
  Clear as ClearIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Close as CloseIcon,
  ContentCopy as ContentCopyIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  PushPin as PushPinIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  WrapText as WrapTextIcon,
} from "@mui/icons-material";
import api from "../services/api";
import useServiceRunningStates from "../hooks/useServiceRunningStates";

const SEARCH_DEBOUNCE_MS = 400;
const SEARCH_MIN_CHARS = 2;
const SEARCH_MAX_CHARS = 120;

// Edge-to-edge content card, same style as the Admin and Help content cards.
const contentCardSx = {
  border: "1px solid",
  borderColor: "divider",
};

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

function ExplorerItem({ service, active, pinned, running, onOpen, onPin }) {
  return (
    <Tooltip title={service.description || service.path || ""} placement="right" enterDelay={500}>
      <Box
        onClick={onOpen}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          px: 1,
          py: 0.5,
          borderRadius: 1.5,
          cursor: "pointer",
          color: active ? "primary.main" : "text.primary",
          backgroundColor: active ? "rgba(37,99,235,0.1)" : "transparent",
          transition: "background-color 0.12s ease",
          "&:hover": {
            backgroundColor: active ? "rgba(37,99,235,0.14)" : "rgba(15,23,42,0.05)",
          },
          "&:hover .explorer-pin": { opacity: 1 },
        }}
      >
        <Box
          component="span"
          aria-label={running ? "Running" : "Stopped"}
          sx={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            flexShrink: 0,
            backgroundColor: running ? "#10b981" : "rgba(148,163,184,0.6)",
            boxShadow: running ? "0 0 0 2px rgba(16,185,129,0.18)" : "none",
          }}
        />
        <Typography
          variant="body2"
          noWrap
          sx={{ flex: 1, minWidth: 0, fontSize: "0.8rem", fontWeight: active ? 700 : 500 }}
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
          sx={{ p: 0.25, opacity: pinned ? 1 : 0.35 }}
        >
          <PushPinIcon sx={{ fontSize: "0.9rem" }} />
        </IconButton>
      </Box>
    </Tooltip>
  );
}

function OpenServiceTabLabel({ serviceName, onClose }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
      <Typography
        variant="body2"
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
      <IconButton
        size="small"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        sx={{ p: 0.25 }}
      >
        <CloseIcon sx={{ fontSize: "0.95rem" }} />
      </IconButton>
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
  const [logContent, setLogContent] = useState("(select a service to load logs)");
  const [serviceSearchState, setServiceSearchState] = useState({});
  const [wrapped, setWrapped] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [pinnedServices, setPinnedServices] = useState([]);
  const [explorerCollapsed, setExplorerCollapsed] = useState(false);
  const eventSourceRef = useRef(null);
  const logContentRef = useRef(null);

  const activeServiceFromTabs = openServices[activeServiceTab] || "";
  const currentService = activeServiceFromTabs || selectedServiceName || services[0]?.name || "";
  const isArchivedSelection = archivedLogFiles.includes(selectedLogFile);
  const isActiveSelection = activeLogFiles.includes(selectedLogFile);
  const liveFile = activeLogFiles[0] || "";
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
      setLogContent(`Unable to load services: ${error.message}`);
    }
  }, []);

  const loadLogFiles = useCallback(async (serviceName) => {
    if (!serviceName) return;
    setLoadingFiles(true);
    try {
      const data = await api.get(`/logs/${serviceName}`);
      const files = (data.files || []).sort().reverse();
      const archivedFiles = (data.archivedFiles || []).sort().reverse();
      setActiveLogFiles(files);
      setArchivedLogFiles(archivedFiles);
      setSelectedLogFile((previous) => {
        if (previous && (files.includes(previous) || archivedFiles.includes(previous))) {
          return previous;
        }
        return files[0] || archivedFiles[0] || "";
      });
      if (!files[0] && !archivedFiles[0]) {
        setLogContent("(no log files available for this service)");
      }
    } catch (error) {
      setActiveLogFiles([]);
      setArchivedLogFiles([]);
      setSelectedLogFile("");
      setLogContent(`Error loading log files: ${error.message}`);
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  const refreshCurrentLog = useCallback(async () => {
    if (!currentService || !selectedLogFile) return;
    try {
      const data = await api.get(`/logs/${currentService}/${encodeURIComponent(selectedLogFile)}`);
      setLogContent(data.content || "(empty)");
    } catch (error) {
      setLogContent(`Error loading log content: ${error.message}`);
    }
  }, [currentService, selectedLogFile]);

  const clearCurrentLog = useCallback(async () => {
    if (!currentService || !selectedLogFile) return;
    await api.post(`/logs/${currentService}/${encodeURIComponent(selectedLogFile)}/clear`);
    setLogContent("");
  }, [currentService, selectedLogFile]);

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
          setLogContent(data.content || "(empty)");
        } else if (data.type === "append") {
          setLogContent((previous) => previous + (data.content || ""));
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
    loadLogFiles(currentService);
    return stopStreaming;
  }, [currentService, loadLogFiles, stopStreaming]);

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
    } catch {
      // ignore
    }
  };

  const jumpToMatch = useCallback((lineNumber) => {
    updateCurrentSearchState({
      selectedMatchLine: lineNumber,
    });
    if (!logContentRef.current) return;
    const lineHeightPx = 19.2;
    logContentRef.current.scrollTop = Math.max(0, (lineNumber - 3) * lineHeightPx);
  }, [updateCurrentSearchState]);

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
        <Box
          key={`${matchIndex}-${cursor}`}
          component="mark"
          sx={{
            backgroundColor: "rgba(250,204,21,0.45)",
            color: "inherit",
            px: 0.25,
            borderRadius: 0.5,
          }}
        >
          {sourceLine.slice(matchIndex, matchIndex + query.length)}
        </Box>
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
      return logContent;
    }

    return logContent.split("\n").map((line, index) => {
      const lineNumber = index + 1;
      const isSelected = selectedMatchLine === lineNumber;

      return (
        <Box
          key={`${lineNumber}-${line}`}
          component="div"
          sx={{
            display: "block",
            width: "100%",
            backgroundColor: isSelected
              ? "rgba(59,130,246,0.18)"
              : "transparent",
            borderLeft: isSelected ? "2px solid rgba(96,165,250,0.95)" : "2px solid transparent",
            pl: 1,
            ml: -1,
          }}
        >
          {isSelected ? highlightLogLine(line, debouncedSearchQuery) : (line || "\u00A0")}
        </Box>
      );
    });
  }, [debouncedSearchQuery, highlightLogLine, logContent, selectedMatchLine]);

  const renderSearchControls = () => (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <TextField
        size="small"
        placeholder="Search inside current log"
        value={searchQuery}
        onChange={(event) => updateCurrentSearchState({ searchQuery: event.target.value })}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ fontSize: "1rem" }} />
            </InputAdornment>
          ),
          sx: { height: 30, fontSize: "0.8rem", borderRadius: 999 },
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

  const compactChipSx = { height: 22, fontSize: "0.7rem" };

  const renderStreamChip = () => (
    <Chip
      size="small"
      label={streamChip.label}
      color={streamChip.color}
      variant={streamChip.color === "default" ? "outlined" : "filled"}
      sx={compactChipSx}
    />
  );

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
        minHeight: 40,
        flexShrink: 0,
        borderBottom: "1px solid rgba(148,163,184,0.16)",
        backgroundColor: "rgba(248,250,252,0.88)",
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
          },
          "& .MuiTab-root.Mui-selected": {
            color: "text.primary",
            backgroundColor: "rgba(37,99,235,0.1)",
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
                onClose={() => onCloseService(serviceName)}
              />
            }
          />
        ))}
      </Tabs>

      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexShrink: 0 }}>
        {renderStreamChip()}
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
        borderBottom: "1px solid rgba(148,163,184,0.16)",
      }}
    >
      <Typography variant="subtitle2" noWrap sx={{ fontWeight: 800, maxWidth: 220 }}>
        {currentService}
      </Typography>
      {selectedLogFile ? (
        <Tooltip
          title={isArchivedSelection
            ? "Archived files are read-only snapshots."
            : "Current log file streams live while the service is writing to it."}
        >
          <Chip
            size="small"
            label={isArchivedSelection ? "Archived" : "Live file"}
            color={isArchivedSelection ? "default" : "success"}
            variant={isArchivedSelection ? "outlined" : "filled"}
            sx={compactChipSx}
          />
        </Tooltip>
      ) : null}
      {activeLogFiles.length + archivedLogFiles.length > 0 ? (
        <Select
          size="small"
          value={selectedLogFile || ""}
          displayEmpty
          renderValue={(value) => value || "Select log file"}
          onChange={(event) => setSelectedLogFile(event.target.value)}
          sx={{ height: 28, maxWidth: 320, fontSize: "0.75rem", borderRadius: 1.5 }}
        >
          {activeLogFiles.map((fileName) => (
            <MenuItem key={fileName} value={fileName} sx={{ fontSize: "0.8rem" }}>
              {fileName === liveFile ? `${fileName} • Live` : fileName}
            </MenuItem>
          ))}
          {archivedLogFiles.length > 0 ? (
            <MenuItem disabled value="__archive_header__" sx={{ fontSize: "0.75rem" }}>
              Archived files
            </MenuItem>
          ) : null}
          {archivedLogFiles.map((fileName) => (
            <MenuItem key={fileName} value={fileName} sx={{ fontSize: "0.8rem" }}>
              {fileName}
            </MenuItem>
          ))}
        </Select>
      ) : (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          No log files
        </Typography>
      )}
      {loadingFiles ? <Chip size="small" label="Loading files…" color="warning" sx={compactChipSx} /> : null}

      <Box sx={{ flex: 1 }} />

      {renderSearchControls()}
      <Tooltip title="Refresh log">
        <IconButton size="small" onClick={refreshCurrentLog}>
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Copy visible content">
        <IconButton size="small" onClick={copyLogs}>
          <ContentCopyIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Clear current file">
        <span>
          <IconButton size="small" onClick={clearCurrentLog} disabled={!selectedLogFile}>
            <ClearIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );

  const renderSearchResults = () => (
    <Box sx={{ px: 1.5, py: 1, flexShrink: 0, borderBottom: "1px solid rgba(148,163,184,0.16)" }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} sx={{ mb: 0.75 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
            Search Results
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
        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
          {searchLoading
            ? `Searching ${selectedLogFile}…`
            : `Full log remains unchanged • ${selectedLogFile} • debounced ${SEARCH_DEBOUNCE_MS}ms`}
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
              sx={{ flex: 1, minWidth: 0, fontFamily: '"Monaco", "Menlo", "Ubuntu Mono", monospace', fontSize: "0.75rem" }}
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
              borderRight: "1px solid rgba(148,163,184,0.18)",
              backgroundColor: "rgba(248,250,252,0.6)",
            }}
          >
            <Box
              sx={{
                display: "flex",
                flexDirection: explorerCollapsed ? "column" : "row",
                alignItems: "center",
                gap: 0.5,
                px: 1,
                minHeight: 40,
                flexShrink: 0,
                borderBottom: "1px solid rgba(148,163,184,0.16)",
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
                    sx: { height: 30, fontSize: "0.8rem", borderRadius: 999 },
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
                  <Alert severity="info">No services match this filter.</Alert>
                ) : null}
              </Box>
            ) : (
              <Box sx={{ flexGrow: 1, overflow: "auto", p: 0.5, display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                {filteredServices.slice(0, 18).map((service) => (
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
                      label={service.name.slice(0, 2).toUpperCase()}
                      onClick={() => openServiceFromExplorer(service.name)}
                      sx={{ width: 36, "& .MuiChip-label": { px: 0 } }}
                    />
                    <Box
                      component="span"
                      sx={{
                        position: "absolute",
                        top: -1,
                        right: -1,
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        border: "1px solid #fff",
                        backgroundColor: runningServices[service.name] ? "#10b981" : "rgba(148,163,184,0.8)",
                        pointerEvents: "none",
                      }}
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
                  fontFamily: '"Monaco", "Menlo", "Ubuntu Mono", monospace',
                  fontSize: "0.8rem",
                  lineHeight: 1.5,
                }}
              >
                {renderedLogContent}
              </Box>
            </>
          ) : (
            <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", p: 4 }}>
              <Alert severity="info">Select a service from the left to load its latest logs.</Alert>
            </Box>
          )}
        </Box>
      </Box>
      </Paper>
    </Box>
  );
});

export default Logs;
