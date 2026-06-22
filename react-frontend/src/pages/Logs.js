import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
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
  FolderOpen as FolderOpenIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  PushPin as PushPinIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  WrapText as WrapTextIcon,
} from "@mui/icons-material";
import api from "../services/api";

const SEARCH_DEBOUNCE_MS = 400;
const SEARCH_MIN_CHARS = 2;
const SEARCH_MAX_CHARS = 120;

const shellCardSx = {
  height: "100%",
  borderRadius: 4,
  border: "1px solid rgba(148,163,184,0.2)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)",
  boxShadow: "0 24px 60px rgba(15,23,42,0.08)",
  overflow: "hidden",
};

const panelSx = {
  borderRadius: 3,
  border: "1px solid rgba(148,163,184,0.18)",
  backgroundColor: "rgba(255,255,255,0.9)",
  boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
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

function ExplorerItem({ service, active, pinned, onOpen, onPin }) {
  return (
    <Paper
      variant="outlined"
      onClick={onOpen}
      sx={{
        ...panelSx,
        p: 1.5,
        cursor: "pointer",
        borderColor: active ? "rgba(37,99,235,0.4)" : "rgba(148,163,184,0.18)",
        background: active
          ? "linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(124,58,237,0.08) 100%)"
          : "rgba(255,255,255,0.9)",
        transition: "all 0.16s ease",
        "&:hover": {
          borderColor: "rgba(37,99,235,0.32)",
          transform: "translateY(-1px)",
        },
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              {service.name}
            </Typography>
            {service.type ? <Chip size="small" label={service.type} sx={{ height: 22 }} /> : null}
            {service.group ? <Chip size="small" label={service.group} variant="outlined" sx={{ height: 22 }} /> : null}
          </Stack>
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
            {service.description || service.path || "Open latest log instantly"}
          </Typography>
        </Box>
        <Tooltip title={pinned ? "Pinned in quick access" : "Pin for quick access"}>
          <IconButton
            size="small"
            onClick={(event) => {
              event.stopPropagation();
              onPin();
            }}
            color={pinned ? "primary" : "default"}
          >
            <PushPinIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Paper>
  );
}

function FileChip({ fileName, active, onClick, live = false }) {
  return (
    <Chip
      label={live ? `${fileName} • Live` : fileName}
      clickable
      onClick={onClick}
      color={live ? "success" : active ? "primary" : "default"}
      variant={active ? "filled" : "outlined"}
      sx={{
        height: 28,
        maxWidth: 320,
        fontWeight: live ? 700 : 500,
        "& .MuiChip-label": {
          overflow: "hidden",
          textOverflow: "ellipsis",
        },
      }}
    />
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

const Logs = forwardRef(({ openServices, activeServiceTab, onCloseService, onServiceTabChange, onAddService }, ref) => {
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
  const currentService = selectedServiceName || activeServiceFromTabs || services[0]?.name || "";
  const isArchivedSelection = archivedLogFiles.includes(selectedLogFile);
  const isActiveSelection = activeLogFiles.includes(selectedLogFile);
  const liveFile = activeLogFiles[0] || "";
  const otherFiles = [...activeLogFiles.slice(1), ...archivedLogFiles];
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
    if (!selectedServiceName && activeServiceFromTabs) {
      setSelectedServiceName(activeServiceFromTabs);
    }
  }, [activeServiceFromTabs, selectedServiceName]);

  useEffect(() => {
    if (!selectedServiceName && services[0]?.name) {
      setSelectedServiceName(services[0].name);
    }
  }, [selectedServiceName, services]);

  useEffect(() => {
    if (!currentService) return;
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
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
      <TextField
        size="small"
        placeholder="Search inside current log"
        value={searchQuery}
        onChange={(event) => updateCurrentSearchState({ searchQuery: event.target.value })}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
        sx={{ minWidth: { xs: "100%", sm: 250 }, "& .MuiOutlinedInput-root": { borderRadius: 999 } }}
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
        <IconButton onClick={() => setWrapped((previous) => !previous)}>
          <WrapTextIcon />
        </IconButton>
      </Tooltip>
    </Stack>
  );

  const renderViewerTabs = () => (
    <Box
      sx={{
        px: maximized ? 1.5 : 1.5,
        pt: maximized ? 1 : 1.25,
        pb: maximized ? 1 : 0,
        borderBottom: "1px solid rgba(148,163,184,0.16)",
        backgroundColor: "rgba(248,250,252,0.88)",
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.25}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
      >
        <Tabs
          value={Math.max(0, openServices.indexOf(currentService))}
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
            minHeight: 40,
            flex: 1,
            minWidth: 0,
            "& .MuiTab-root": {
              minHeight: 40,
              textTransform: "none",
              minWidth: 0,
              px: 1.25,
              py: 0.5,
              borderRadius: 2,
              mr: 1,
              alignItems: "flex-start",
              color: "text.secondary",
            },
            "& .MuiTab-root.Mui-selected": {
              color: "text.primary",
              backgroundColor: "rgba(37,99,235,0.08)",
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

        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {maximized ? renderSearchControls() : null}
          {!maximized ? (
            <Chip
              size="small"
              variant="outlined"
              label={`${openServices.length} open`}
              sx={{ flexShrink: 0 }}
            />
          ) : null}
          <Tooltip title={maximized ? "Exit focus mode" : "Focus log area"}>
            <IconButton onClick={() => setMaximized((previous) => !previous)}>
              {maximized ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
    </Box>
  );

  return (
    <Paper
      sx={{
        ...shellCardSx,
        p: maximized ? 0 : 2.25,
        borderRadius: maximized ? 0 : shellCardSx.borderRadius,
      }}
    >
      {!maximized ? (
        <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} justifyContent="space-between" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="caption" sx={{ color: "primary.main", fontWeight: 700, letterSpacing: 0.4 }}>
              LOG EXPLORER
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.25 }}>
              Service Logs
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.75, maxWidth: 760 }}>
              Open a service once and its latest active log appears immediately. Only the current active file streams live; older files stay as static snapshots.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip label={`${services.length} services`} variant="outlined" />
            <Chip label={`${activeLogFiles.length + archivedLogFiles.length} files`} variant="outlined" />
            <Chip label={streamChip.label} color={streamChip.color} variant={streamChip.color === "default" ? "outlined" : "filled"} />
          </Stack>
        </Stack>
      ) : null}

      <Box
        sx={{
          height: maximized ? "100%" : "calc(100% - 104px)",
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            xl: maximized ? "1fr" : explorerCollapsed ? "56px minmax(0, 1fr)" : "320px minmax(0, 1fr)",
          },
          gap: 2,
          minHeight: 0,
        }}
      >
        {!maximized && (
          <Paper sx={{ ...panelSx, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <Box sx={{ p: explorerCollapsed ? 1 : 2, borderBottom: "1px solid rgba(148,163,184,0.16)" }}>
              <Stack
                direction={explorerCollapsed ? "column" : "row"}
                spacing={1}
                justifyContent="space-between"
                alignItems={explorerCollapsed ? "center" : "center"}
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
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 999 } }}
                  />
                ) : (
                  <Tooltip title="Service explorer">
                    <SearchIcon fontSize="small" color="action" />
                  </Tooltip>
                )}

                <Tooltip title={explorerCollapsed ? "Expand explorer" : "Collapse explorer"}>
                  <IconButton size="small" onClick={() => setExplorerCollapsed((previous) => !previous)}>
                    {explorerCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
                  </IconButton>
                </Tooltip>
              </Stack>

            </Box>

            {!explorerCollapsed ? (
              <Box sx={{ flexGrow: 1, overflow: "auto", p: 1.5, display: "flex", flexDirection: "column", gap: 1.25 }}>
                {filteredServices.map((service) => (
                  <ExplorerItem
                    key={service.name}
                    service={service}
                    active={currentService === service.name}
                    pinned={pinnedServices.includes(service.name)}
                    onOpen={() => {
                      setSelectedServiceName(service.name);
                      if (!openServices.includes(service.name)) {
                        onAddService(service.name);
                      } else {
                        onServiceTabChange(openServices.indexOf(service.name));
                      }
                    }}
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
              <Box sx={{ flexGrow: 1, overflow: "auto", p: 0.75, display: "flex", flexDirection: "column", alignItems: "center", gap: 0.75 }}>
                {filteredServices.slice(0, 18).map((service) => (
                  <Tooltip key={service.name} title={service.name} placement="right">
                    <Chip
                      size="small"
                      clickable
                      color={currentService === service.name ? "primary" : "default"}
                      variant={currentService === service.name ? "filled" : "outlined"}
                      label={service.name.slice(0, 2).toUpperCase()}
                      onClick={() => {
                        setSelectedServiceName(service.name);
                        if (!openServices.includes(service.name)) {
                          onAddService(service.name);
                        } else {
                          onServiceTabChange(openServices.indexOf(service.name));
                        }
                      }}
                      sx={{ width: 40, "& .MuiChip-label": { px: 0 } }}
                    />
                  </Tooltip>
                ))}
              </Box>
            )}
          </Paper>
        )}

        <Paper sx={{ ...panelSx, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {currentService ? (
            <>
              {openServices.length > 0 ? renderViewerTabs() : null}

              <Box sx={{ p: maximized ? 1.25 : 2, borderBottom: maximized ? "1px solid rgba(148,163,184,0.16)" : "1px solid rgba(148,163,184,0.16)" }}>
                {!maximized ? (
                  <>
                    <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} justifyContent="space-between">
                      <Box>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>
                          {currentService}
                          </Typography>
                          <Chip size="small" label={selectedLogFile || "No file"} variant="outlined" />
                          <Chip
                            size="small"
                            label={isArchivedSelection ? "Archived snapshot" : "Current live file"}
                            color={isArchivedSelection ? "default" : "success"}
                            variant={isArchivedSelection ? "outlined" : "filled"}
                          />
                          {loadingFiles ? <Chip size="small" label="Loading files…" color="warning" /> : null}
                        </Stack>
                        <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                          {isArchivedSelection
                            ? "Archived files are read-only snapshots."
                            : "Current log file streams live while the service is writing to it."}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                        {renderSearchControls()}
                        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={refreshCurrentLog}>
                          Refresh
                        </Button>
                        <Tooltip title="Copy visible content">
                          <IconButton onClick={copyLogs}>
                            <ContentCopyIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Clear current file">
                          <IconButton onClick={clearCurrentLog} disabled={!selectedLogFile}>
                            <ClearIcon />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>

                    <Divider sx={{ my: 1.5 }} />
                  </>
                ) : null}

                <Stack direction={{ xs: "column", lg: "row" }} spacing={1.25} alignItems={{ xs: "flex-start", lg: "center" }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    {!maximized ? <FolderOpenIcon sx={{ color: "text.secondary", fontSize: "1rem" }} /> : null}
                    {!maximized ? (
                      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                        Current
                      </Typography>
                    ) : null}
                    {liveFile ? (
                      <FileChip
                        fileName={liveFile}
                        active={selectedLogFile === liveFile}
                        live
                        onClick={() => setSelectedLogFile(liveFile)}
                      />
                    ) : (
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        No active file
                      </Typography>
                    )}
                  </Stack>

                  {otherFiles.length > 0 ? (
                    <FormControl size="small" sx={{ minWidth: { xs: "100%", md: 320 } }}>
                      <InputLabel>Other Files</InputLabel>
                      <Select
                        value={selectedLogFile !== liveFile ? selectedLogFile : ""}
                        label="Other Files"
                        onChange={(event) => setSelectedLogFile(event.target.value)}
                        sx={{ borderRadius: 999 }}
                      >
                        {activeLogFiles.slice(1).map((fileName) => (
                          <MenuItem key={fileName} value={fileName}>
                            {fileName}
                          </MenuItem>
                        ))}
                        {archivedLogFiles.length > 0 ? (
                          <MenuItem disabled value="__archive_header__">
                            Archived files
                          </MenuItem>
                        ) : null}
                        {archivedLogFiles.map((fileName) => (
                          <MenuItem key={fileName} value={fileName}>
                            {fileName}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : null}
                </Stack>

                {debouncedSearchQuery ? (
                  <Box sx={{ mt: 1.25 }}>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} sx={{ mb: 1 }}>
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
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 1.25,
                          borderRadius: 2,
                          backgroundColor: "rgba(248,250,252,0.75)",
                          borderColor: "rgba(148,163,184,0.16)",
                        }}
                      >
                        {selectedMatch ? (
                          <Stack spacing={1}>
                            <Stack direction={{ xs: "column", md: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }}>
                              <Typography variant="caption" sx={{ color: "primary.main", fontWeight: 700 }}>
                                Match {selectedMatchIndex + 1} of {searchResults.length} • Line {selectedMatch.lineNumber}
                              </Typography>
                              <Stack direction="row" spacing={1}>
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
                            <Typography variant="body2" sx={{ fontFamily: '"Monaco", "Menlo", "Ubuntu Mono", monospace', fontSize: "0.78rem", wordBreak: "break-word" }}>
                              {selectedMatch.preview ? highlightMatchPreview(selectedMatch.preview, debouncedSearchQuery) : "(empty line)"}
                            </Typography>
                          </Stack>
                        ) : (
                          <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            No matching lines found.
                          </Typography>
                        )}
                      </Paper>
                    ) : null}
                  </Box>
                ) : null}
              </Box>

              <Box
                component="pre"
                ref={logContentRef}
                sx={{
                  flexGrow: 1,
                  overflow: "auto",
                  m: 0,
                  p: 2,
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
        </Paper>
      </Box>
    </Paper>
  );
});

export default Logs;
