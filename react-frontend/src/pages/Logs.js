import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Container,
  Typography,
  Paper,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  IconButton,
  Toolbar,
  Chip,
} from "@mui/material";
import {
  Refresh as RefreshIcon,
  WrapText as WrapIcon,
  Clear as ClearIcon,
  Fullscreen as MaximizeIcon,
  FullscreenExit as RestoreIcon,
} from "@mui/icons-material";
import api from "../services/api";

const Logs = () => {
  const [searchParams] = useSearchParams();
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState("");
  const [logFiles, setLogFiles] = useState([]);
  const [selectedLogFile, setSelectedLogFile] = useState("");
  const [logContent, setLogContent] = useState("(no log loaded)");
  const [isWrapped, setIsWrapped] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const logContentRef = useRef(null);
  const refreshIntervalRef = useRef(null);

  useEffect(() => {
    initLogsPage();
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedService) {
      loadLogFiles();
    }
  }, [selectedService]);

  useEffect(() => {
    if (selectedLogFile && selectedLogFile !== "No log files") {
      loadLog(false);
      if (autoRefresh) {
        startAutoRefresh();
      }
    } else {
      stopAutoRefresh();
    }
    return () => stopAutoRefresh();
  }, [selectedLogFile, autoRefresh]);

  const initLogsPage = async () => {
    try {
      const data = await api.get("/services");
      setServices(data.services || []);

      const serviceFromQuery = searchParams.get("service");
      if (
        serviceFromQuery &&
        data.services.some((s) => s.name === serviceFromQuery)
      ) {
        setSelectedService(serviceFromQuery);
      } else if (data.services.length > 0) {
        setSelectedService(data.services[0].name);
      }
    } catch (error) {
      console.error("Failed to load services:", error);
    }
  };

  const loadLogFiles = async () => {
    if (!selectedService) return;

    try {
      const data = await api.get(`/logs/${selectedService}`);
      const files = (data.files || []).sort().reverse();

      setLogFiles(files);

      if (files.length === 0) {
        setSelectedLogFile("No log files");
        setLogContent("(no log files available)");
      } else {
        setSelectedLogFile(files[0]);
      }
    } catch (error) {
      setLogFiles([]);
      setSelectedLogFile("Error loading logs");
      setLogContent(`Error loading log files: ${error.message}`);
    }
  };

  const loadLog = async (isRefresh = false) => {
    if (
      !selectedService ||
      !selectedLogFile ||
      selectedLogFile === "No log files"
    ) {
      return;
    }

    try {
      const data = await api.get(
        `/logs/${selectedService}/${encodeURIComponent(selectedLogFile)}`
      );

      const logElement = logContentRef.current;
      const wasAtBottom =
        logElement &&
        logElement.scrollHeight -
          logElement.scrollTop -
          logElement.clientHeight <
          40;

      setLogContent(data.content || "(empty)");

      // Auto-scroll to bottom if we were at bottom or it's not a refresh
      if (logElement && (!isRefresh || wasAtBottom)) {
        setTimeout(() => {
          logElement.scrollTop = logElement.scrollHeight;
        }, 0);
      }
    } catch (error) {
      setLogContent(`Error loading log: ${error.message}`);
    }
  };

  const startAutoRefresh = () => {
    stopAutoRefresh();
    refreshIntervalRef.current = setInterval(() => {
      loadLog(true);
    }, 2000);
  };

  const stopAutoRefresh = () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  };

  const toggleWrap = () => {
    setIsWrapped(!isWrapped);
  };

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
  };

  const clearLog = () => {
    setLogContent("");
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography
        variant="h4"
        component="h1"
        gutterBottom
        sx={{ fontWeight: 600 }}
      >
        Logs
      </Typography>

      {/* Controls */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Box
          sx={{
            display: "flex",
            gap: 3,
            alignItems: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Service</InputLabel>
            <Select
              value={selectedService}
              label="Service"
              onChange={(e) => setSelectedService(e.target.value)}
            >
              {services.map((service) => (
                <MenuItem key={service.name} value={service.name}>
                  {service.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 300 }}>
            <InputLabel>Log File</InputLabel>
            <Select
              value={selectedLogFile}
              label="Log File"
              onChange={(e) => setSelectedLogFile(e.target.value)}
              disabled={logFiles.length === 0}
            >
              {logFiles.length === 0 ? (
                <MenuItem disabled>No log files</MenuItem>
              ) : (
                logFiles.map((file) => (
                  <MenuItem key={file} value={file}>
                    {file}
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>

          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={() => loadLog(false)}
            disabled={!selectedLogFile || selectedLogFile === "No log files"}
          >
            Load Log
          </Button>

          <Chip
            label={autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
            color={autoRefresh ? "success" : "default"}
            onClick={toggleAutoRefresh}
            clickable
          />
        </Box>
      </Paper>

      {/* Log Viewer */}
      <Paper
        elevation={3}
        sx={{
          overflow: "hidden",
          backgroundColor: "#111",
          ...(isMaximized && {
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
          }),
        }}
      >
        {/* Toolbar */}
        <Toolbar
          sx={{
            backgroundColor: "#1f2937",
            color: "#f3f4f6",
            justifyContent: "space-between",
            minHeight: "48px !important",
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Log Output
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <IconButton
              size="small"
              onClick={toggleWrap}
              sx={{ color: "#e5e7eb" }}
              title={isWrapped ? "Unwrap text" : "Wrap text"}
            >
              <WrapIcon />
            </IconButton>
            <IconButton
              size="small"
              onClick={clearLog}
              sx={{ color: "#e5e7eb" }}
              title="Clear log"
            >
              <ClearIcon />
            </IconButton>
            <IconButton
              size="small"
              onClick={toggleMaximize}
              sx={{ color: "#e5e7eb" }}
              title={isMaximized ? "Restore" : "Maximize"}
            >
              {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
            </IconButton>
          </Box>
        </Toolbar>

        {/* Log Content */}
        <Box
          ref={logContentRef}
          component="pre"
          sx={{
            backgroundColor: "#111",
            color: "#e5e7eb",
            p: 2,
            height: isMaximized ? "calc(100vh - 48px)" : "70vh",
            fontSize: "0.875rem",
            overflow: "auto",
            whiteSpace: isWrapped ? "pre-wrap" : "pre",
            lineHeight: 1.45,
            fontFamily: "monospace",
            margin: 0,
          }}
        >
          {logContent}
        </Box>
      </Paper>
    </Container>
  );
};

export default Logs;
