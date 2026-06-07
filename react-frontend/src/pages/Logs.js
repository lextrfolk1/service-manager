import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Clear as ClearIcon,
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

function FileChip({ fileName, active, onClick }) {
  return (
    <Chip
      label={fileName}
      clickable
      onClick={onClick}
      color={active ? "primary" : "default"}
      variant={active ? "filled" : "outlined"}
      sx={{
        height: 28,
        maxWidth: 260,
        "& .MuiChip-label": {
          overflow: "hidden",
          textOverflow: "ellipsis",
        },
      }}
    />
  );
}

const Logs = forwardRef(({ openServices, activeServiceTab, onCloseService, onServiceTabChange, onAddService }, ref) => {
  const [services, setServices] = useState([]);
  const [serviceFilter, setServiceFilter] = useState("");
  const [selectedServiceName, setSelectedServiceName] = useState("");
  const [selectedLogFile, setSelectedLogFile] = useState("");
  const [logFiles, setLogFiles] = useState([]);
  const [logContent, setLogContent] = useState("(select a service to load logs)");
  const [searchQuery, setSearchQuery] = useState("");
  const [wrapped, setWrapped] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [pinnedServices, setPinnedServices] = useState([]);
  const eventSourceRef = useRef(null);

  const activeServiceFromTabs = openServices[activeServiceTab] || "";
  const currentService = selectedServiceName || activeServiceFromTabs || services[0]?.name || "";

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
      setLogFiles(files);
      setSelectedLogFile((previous) => (previous && files.includes(previous) ? previous : files[0] || ""));
      if (!files[0]) {
        setLogContent("(no log files available for this service)");
      }
    } catch (error) {
      setLogFiles([]);
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
    if (!currentService || !selectedLogFile) return;

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
  }, [currentService, selectedLogFile, stopStreaming]);

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
    startStreaming();
    return stopStreaming;
  }, [currentService, selectedLogFile, startStreaming, stopStreaming]);

  const displayedContent = useMemo(() => {
    if (!searchQuery.trim()) return logContent;
    return (
      logContent
        .split("\n")
        .filter((line) => line.toLowerCase().includes(searchQuery.toLowerCase()))
        .join("\n") || "(no matching lines)"
    );
  }, [logContent, searchQuery]);

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
      await navigator.clipboard.writeText(displayedContent);
    } catch {
      // ignore
    }
  };

  return (
    <Paper sx={{ ...shellCardSx, p: 2.25 }}>
      <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="caption" sx={{ color: "primary.main", fontWeight: 700, letterSpacing: 0.4 }}>
            LOG EXPLORER
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.25 }}>
            Service Logs
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.75, maxWidth: 760 }}>
            Open a service once and its latest log appears immediately. Switch files from the header instead of drilling through tabs and dialogs.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label={`${services.length} services`} variant="outlined" />
          <Chip label={`${logFiles.length} files`} variant="outlined" />
          <Chip label={streamChip.label} color={streamChip.color} variant={streamChip.color === "default" ? "outlined" : "filled"} />
        </Stack>
      </Stack>

      <Box sx={{ height: "calc(100% - 104px)", display: "grid", gridTemplateColumns: { xs: "1fr", xl: maximized ? "1fr" : "320px minmax(0, 1fr)" }, gap: 2, minHeight: 0 }}>
        {!maximized && (
          <Paper sx={{ ...panelSx, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <Box sx={{ p: 2, borderBottom: "1px solid rgba(148,163,184,0.16)" }}>
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
              {openServices.length > 0 ? (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                  {openServices.map((serviceName) => (
                    <Chip
                      key={serviceName}
                      label={serviceName}
                      size="small"
                      clickable
                      color={currentService === serviceName ? "primary" : "default"}
                      variant={currentService === serviceName ? "filled" : "outlined"}
                      onClick={() => setSelectedServiceName(serviceName)}
                      onDelete={() => onCloseService(serviceName)}
                    />
                  ))}
                </Stack>
              ) : null}
            </Box>

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
          </Paper>
        )}

        <Paper sx={{ ...panelSx, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {currentService ? (
            <>
              <Box sx={{ p: 2, borderBottom: "1px solid rgba(148,163,184,0.16)" }}>
                <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} justifyContent="space-between">
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography variant="h6" sx={{ fontWeight: 800 }}>
                        {currentService}
                      </Typography>
                      <Chip size="small" label={selectedLogFile || "No file"} variant="outlined" />
                      {loadingFiles ? <Chip size="small" label="Loading files…" color="warning" /> : null}
                    </Stack>
                    <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                      Latest file opens automatically. Switch files inline and keep the stream visible while investigating.
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                    <TextField
                      size="small"
                      placeholder="Search inside current log"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon fontSize="small" />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ minWidth: { xs: "100%", sm: 250 }, "& .MuiOutlinedInput-root": { borderRadius: 999 } }}
                    />
                    <Button variant="outlined" startIcon={<RefreshIcon />} onClick={refreshCurrentLog}>
                      Refresh
                    </Button>
                    <Tooltip title={wrapped ? "Disable wrap" : "Wrap lines"}>
                      <IconButton onClick={() => setWrapped((previous) => !previous)}>
                        <WrapTextIcon />
                      </IconButton>
                    </Tooltip>
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
                    <Tooltip title={maximized ? "Exit focus mode" : "Focus log area"}>
                      <IconButton onClick={() => setMaximized((previous) => !previous)}>
                        {maximized ? <FullscreenExitIcon /> : <FullscreenIcon />}
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>

                <Divider sx={{ my: 1.5 }} />

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                  <FolderOpenIcon sx={{ color: "text.secondary", fontSize: "1rem" }} />
                  {logFiles.length > 0 ? (
                    logFiles.map((fileName) => (
                      <FileChip
                        key={fileName}
                        fileName={fileName}
                        active={selectedLogFile === fileName}
                        onClick={() => setSelectedLogFile(fileName)}
                      />
                    ))
                  ) : (
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      No log files found for this service yet.
                    </Typography>
                  )}
                </Stack>
              </Box>

              <Box
                component="pre"
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
                {displayedContent}
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
