import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import {
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
  Grid,
  Tabs,
  Tab,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import {
  Refresh as RefreshIcon,
  WrapText as WrapIcon,
  Clear as ClearIcon,
  Close as CloseIcon,
  Add as AddIcon,
} from "@mui/icons-material";
import api from "../services/api";

const LogViewer = ({ serviceName, onClose, isActive }) => {
  const [logFiles, setLogFiles] = useState([]);
  const [selectedLogFile, setSelectedLogFile] = useState("");
  const [logContent, setLogContent] = useState("(no log loaded)");
  const [isWrapped, setIsWrapped] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const logContentRef = useRef(null);
  const refreshIntervalRef = useRef(null);

  useEffect(() => {
    if (serviceName && isActive) {
      loadLogFiles();
    }
  }, [serviceName, isActive]);

  useEffect(() => {
    if (selectedLogFile && selectedLogFile !== "No log files" && isActive) {
      loadLog(false);
      if (autoRefresh) {
        startAutoRefresh();
      }
    } else {
      stopAutoRefresh();
    }
    return () => stopAutoRefresh();
  }, [selectedLogFile, autoRefresh, isActive]);

  const loadLogFiles = async () => {
    if (!serviceName) return;

    try {
      const data = await api.get(`/logs/${serviceName}`);
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
    if (!serviceName || !selectedLogFile || selectedLogFile === "No log files") {
      return;
    }

    try {
      const data = await api.get(
        `/logs/${serviceName}/${encodeURIComponent(selectedLogFile)}`
      );

      const logElement = logContentRef.current;
      const wasAtBottom =
        logElement &&
        logElement.scrollHeight - logElement.scrollTop - logElement.clientHeight < 40;

      setLogContent(data.content || "(empty)");

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
    if (isActive) {
      refreshIntervalRef.current = setInterval(() => {
        loadLog(true);
      }, 2000);
    }
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

  const clearLog = () => {
    setLogContent("");
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  return (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      minHeight: 0 
    }}>
      {/* Fixed Controls */}
      <Paper
        elevation={3}
        sx={{
          p: 2,
          borderRadius: 2,
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(10px)",
          mb: 2,
          flexShrink: 0,
          minHeight: 'auto'
        }}
      >
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Log File</InputLabel>
              <Select
                value={selectedLogFile}
                label="Log File"
                onChange={(e) => setSelectedLogFile(e.target.value)}
                disabled={logFiles.length === 0}
                sx={{
                  borderRadius: 2,
                  background: "rgba(255, 255, 255, 0.8)",
                }}
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
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={() => loadLog(false)}
              disabled={!selectedLogFile || selectedLogFile === "No log files"}
              fullWidth
              size="small"
              sx={{
                background: "linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)",
                boxShadow: "0 3px 5px 2px rgba(33, 203, 243, .3)",
                borderRadius: 2,
              }}
            >
              Refresh
            </Button>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Chip
              label={autoRefresh ? "Auto ON" : "Auto OFF"}
              color={autoRefresh ? "success" : "default"}
              onClick={toggleAutoRefresh}
              clickable
              size="small"
              sx={{
                fontWeight: 600,
                ...(autoRefresh && {
                  background: "linear-gradient(45deg, #4CAF50 30%, #45a049 90%)",
                  color: "white",
                }),
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <IconButton
              onClick={onClose}
              color="error"
              size="small"
              sx={{
                background: "linear-gradient(45deg, #f44336 30%, #d32f2f 90%)",
                color: "white",
                "&:hover": {
                  background: "linear-gradient(45deg, #d32f2f 30%, #f44336 90%)",
                },
              }}
            >
              <CloseIcon />
            </IconButton>
          </Grid>
        </Grid>
      </Paper>

      {/* Log Content Panel - Only this scrolls */}
      <Paper
        elevation={6}
        sx={{
          borderRadius: 3,
          background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden' // Prevent this container from scrolling
        }}
      >
        <Toolbar
          sx={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "#fff",
            justifyContent: "space-between",
            minHeight: "48px !important",
            flexShrink: 0 // Prevent toolbar from shrinking
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {serviceName} - Log Output
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <IconButton
              size="small"
              onClick={toggleWrap}
              sx={{ 
                color: "#fff",
                "&:hover": { backgroundColor: "rgba(255,255,255,0.1)" }
              }}
              title={isWrapped ? "Unwrap text" : "Wrap text"}
            >
              <WrapIcon />
            </IconButton>
            <IconButton
              size="small"
              onClick={clearLog}
              sx={{ 
                color: "#fff",
                "&:hover": { backgroundColor: "rgba(255,255,255,0.1)" }
              }}
              title="Clear log"
            >
              <ClearIcon />
            </IconButton>
          </Box>
        </Toolbar>

        <Box
          ref={logContentRef}
          component="pre"
          sx={{
            backgroundColor: "#0d1117",
            color: "#e5e7eb",
            p: 2,
            fontSize: "0.8rem",
            overflow: "auto",
            whiteSpace: isWrapped ? "pre-wrap" : "pre",
            lineHeight: 1.4,
            fontFamily: '"Monaco", "Menlo", "Ubuntu Mono", monospace',
            margin: 0,
            border: "1px solid #333",
            flexGrow: 1,
          }}
        >
          {logContent}
        </Box>
      </Paper>
    </Box>
  );
};

const Logs = forwardRef(({ openServices, activeServiceTab, onCloseService, onServiceTabChange, onAddService }, ref) => {
  const [services, setServices] = useState([]);
  const [availableService, setAvailableService] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);

  useImperativeHandle(ref, () => ({
    addService: (serviceName) => {
      onAddService(serviceName);
    }
  }));

  useEffect(() => {
    initLogsPage();
  }, []);

  const initLogsPage = async () => {
    try {
      const data = await api.get("/services");
      setServices(data.services || []);
    } catch (error) {
      console.error("Failed to load services:", error);
    }
  };

  const addServiceTab = () => {
    if (availableService && !openServices.includes(availableService)) {
      onAddService(availableService);
      setAvailableService("");
      setShowAddDialog(false);
    }
  };

  const closeServiceTab = (serviceName) => {
    onCloseService(serviceName);
  };

  const handleServiceTabChange = (_, newValue) => {
    onServiceTabChange(newValue);
  };

  const availableServicesToAdd = services.filter(service => !openServices.includes(service.name));

  return (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      position: 'relative'
    }}>
      {/* Fixed Service Tabs - Never shrink */}
      {openServices.length > 0 && (
        <Paper
          elevation={3}
          sx={{
            borderRadius: 0,
            borderBottomLeftRadius: 2,
            borderBottomRightRadius: 2,
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            position: 'relative',
            flexShrink: 0,
            minHeight: 48,
            maxHeight: 48
          }}
        >
          {/* Tab Count Indicator */}
          {openServices.length > 3 && (
            <Box
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                backgroundColor: 'rgba(255,255,255,0.2)',
                borderRadius: '12px',
                px: 1.5,
                py: 0.5,
                zIndex: 1
              }}
            >
              <Typography variant="caption" sx={{ color: 'white', fontWeight: 600, fontSize: '0.7rem' }}>
                {openServices.length} services
              </Typography>
            </Box>
          )}
          
          <Tabs
            value={activeServiceTab}
            onChange={handleServiceTabChange}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{
              height: 48,
              minHeight: 48,
              '& .MuiTab-root': {
                color: 'white',
                fontWeight: 600,
                textTransform: 'none',
                minHeight: 48,
                maxHeight: 48,
                minWidth: 120,
                maxWidth: 200,
                '&.Mui-selected': {
                  color: '#fff',
                  backgroundColor: 'rgba(255,255,255,0.15)'
                },
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.1)'
                }
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#fff',
                height: 3
              },
              '& .MuiTabs-scrollButtons': {
                color: 'white',
                '&.Mui-disabled': {
                  opacity: 0.3
                }
              },
              '& .MuiTabScrollButton-root': {
                backgroundColor: 'rgba(255,255,255,0.1)',
                margin: '0 4px',
                borderRadius: 1,
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.2)'
                }
              }
            }}
          >
            {openServices.map((serviceName) => (
              <Tab
                key={serviceName}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {serviceName}
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeServiceTab(serviceName);
                      }}
                      sx={{ 
                        color: 'white', 
                        ml: 1,
                        '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' }
                      }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                }
              />
            ))}
          </Tabs>
        </Paper>
      )}

      {/* Fixed Height Log Content Area */}
      <Box sx={{ 
        flexGrow: 1, 
        display: 'flex', 
        flexDirection: 'column',
        minHeight: 0 // Important for flex children
      }}>
        {openServices.length > 0 ? (
          openServices.map((serviceName) => (
            <Box
              key={serviceName}
              sx={{
                display: activeServiceTab === openServices.indexOf(serviceName) ? 'flex' : 'none',
                height: '100%',
                flexDirection: 'column',
                p: 2,
                minHeight: 0 // Important for flex children
              }}
            >
              <LogViewer
                serviceName={serviceName}
                onClose={() => closeServiceTab(serviceName)}
                isActive={activeServiceTab === openServices.indexOf(serviceName)}
              />
            </Box>
          ))
        ) : (
          <Box
            sx={{
              flexGrow: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: 4
            }}
          >
            <Paper
              sx={{
                p: 6,
                textAlign: "center",
                borderRadius: 3,
                background: "rgba(255, 255, 255, 0.9)",
                backdropFilter: "blur(10px)",
                maxWidth: 500
              }}
            >
              <Typography 
                variant="h5" 
                gutterBottom
                sx={{
                  fontWeight: 600,
                  background: "linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  mb: 2,
                }}
              >
                Service Logs
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Click "Logs" on any service card in the Dashboard to start monitoring, or add a service below.
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setShowAddDialog(true)}
                disabled={availableServicesToAdd.length === 0}
                sx={{
                  background: "linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)",
                  boxShadow: "0 3px 5px 2px rgba(255, 105, 135, .3)",
                  borderRadius: 2,
                  px: 4,
                  py: 1.5
                }}
              >
                Add Service to Monitor
              </Button>
            </Paper>
          </Box>
        )}
      </Box>

      {/* Simple Floating Add Button - Only when services are open */}
      {openServices.length > 0 && availableServicesToAdd.length > 0 && (
        <Fab
          color="primary"
          onClick={() => setShowAddDialog(true)}
          sx={{
            position: 'absolute',
            bottom: 24,
            right: 24,
            background: "linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)",
            '&:hover': {
              background: "linear-gradient(45deg, #FF8E53 30%, #FE6B8B 90%)",
            }
          }}
        >
          <AddIcon />
        </Fab>
      )}

      {/* Add Service Dialog */}
      <Dialog 
        open={showAddDialog} 
        onClose={() => setShowAddDialog(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%)",
            backdropFilter: "blur(10px)",
          }
        }}
      >
        <DialogTitle
          sx={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            fontWeight: 700,
            fontSize: "1.5rem",
            textAlign: "center",
            py: 3,
            borderRadius: "12px 12px 0 0"
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <AddIcon sx={{ fontSize: 28 }} />
            Add Service to Monitor
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ p: 4 }}>
          <Typography 
            variant="body1" 
            color="text.secondary" 
            sx={{ mb: 3, textAlign: 'center', lineHeight: 1.6 }}
          >
            Select a service to start monitoring its logs. You can add multiple services and switch between them using tabs.
          </Typography>
          
          <FormControl fullWidth>
            <InputLabel 
              sx={{ 
                fontWeight: 600,
                "&.Mui-focused": { 
                  color: "#667eea" 
                }
              }}
            >
              Select Service
            </InputLabel>
            <Select
              value={availableService}
              label="Select Service"
              onChange={(e) => setAvailableService(e.target.value)}
              sx={{ 
                borderRadius: 2,
                "& .MuiOutlinedInput-notchedOutline": {
                  borderWidth: 2,
                },
                "&:hover .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#667eea",
                },
                "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#667eea",
                }
              }}
            >
              {availableServicesToAdd.length === 0 ? (
                <MenuItem disabled>
                  <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    All services are already being monitored
                  </Typography>
                </MenuItem>
              ) : (
                availableServicesToAdd.map((service) => (
                  <MenuItem 
                    key={service.name} 
                    value={service.name}
                    sx={{
                      py: 2,
                      borderRadius: 1,
                      mx: 1,
                      my: 0.5,
                      "&:hover": {
                        backgroundColor: "rgba(102, 126, 234, 0.1)",
                      }
                    }}
                  >
                    <Box sx={{ width: '100%' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body1" sx={{ fontWeight: 600, color: "#333" }}>
                          {service.name}
                        </Typography>
                        <Chip 
                          label={service.type || "Unknown"} 
                          size="small"
                          sx={{
                            backgroundColor: "rgba(102, 126, 234, 0.1)",
                            color: "#667eea",
                            fontWeight: 600,
                            fontSize: "0.75rem"
                          }}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                        {service.description || 'No description available'}
                      </Typography>
                      {service.port && (
                        <Typography variant="caption" sx={{ color: "#667eea", fontWeight: 600, mt: 0.5, display: 'block' }}>
                          Port: {service.port}
                        </Typography>
                      )}
                    </Box>
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>
          
          {availableService && (
            <Paper
              elevation={2}
              sx={{
                mt: 3,
                p: 3,
                borderRadius: 2,
                background: "linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)",
                border: "1px solid rgba(102, 126, 234, 0.2)"
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "#667eea", mb: 1 }}>
                Selected Service:
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                {availableService}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {services.find(s => s.name === availableService)?.description || 'No description'}
              </Typography>
            </Paper>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 4, pt: 2, gap: 2 }}>
          <Button 
            onClick={() => setShowAddDialog(false)}
            variant="outlined"
            sx={{
              borderColor: "#ccc",
              color: "#666",
              borderRadius: 2,
              px: 3,
              py: 1,
              fontWeight: 600,
              "&:hover": {
                borderColor: "#999",
                backgroundColor: "rgba(0,0,0,0.04)"
              }
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={addServiceTab}
            disabled={!availableService}
            startIcon={<AddIcon />}
            sx={{
              background: "linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)",
              borderRadius: 2,
              px: 4,
              py: 1,
              fontWeight: 600,
              boxShadow: "0 4px 12px rgba(254, 107, 139, 0.3)",
              "&:hover": {
                background: "linear-gradient(45deg, #FF8E53 30%, #FE6B8B 90%)",
                boxShadow: "0 6px 16px rgba(254, 107, 139, 0.4)",
              },
              "&:disabled": {
                background: "#ccc",
                boxShadow: "none"
              }
            }}
          >
            Add Service
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});

export default Logs;
