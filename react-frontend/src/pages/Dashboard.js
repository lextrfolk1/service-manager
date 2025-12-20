import { useState, useEffect } from "react";
import {
  Grid,
  Typography,
  TextField,
  Paper,
  Box,
  CircularProgress,
  Alert,
  InputAdornment,
  Snackbar,
  IconButton,
  Chip,
  Stack,
} from "@mui/material";
import { 
  Search as SearchIcon,
  Close as CloseIcon,
  Terminal as TerminalIcon,
  FilterList as FilterListIcon,
  PlayArrow as RunningIcon,
  Stop as StoppedIcon,
  Code as CodeIcon,
  PlaylistPlay as StartAllIcon,
  StopCircle as StopAllIcon,
  Build as BuildIcon
} from "@mui/icons-material";
import ServiceCard from "../components/ServiceCard";
import api from "../services/api";

const Dashboard = ({ onViewLogs }) => {
  const [services, setServices] = useState([]);
  const [filteredServices, setFilteredServices] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [output, setOutput] = useState("(no actions yet)");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all"); // all, running, stopped
  const [typeFilter, setTypeFilter] = useState("all"); // all, java, npm, redis, etc.
  const [serviceStatuses, setServiceStatuses] = useState({}); // Store service statuses
  const [bulkActionInProgress, setBulkActionInProgress] = useState(false);
  const [currentBulkAction, setCurrentBulkAction] = useState(null);
  const [buildEnabled, setBuildEnabled] = useState(false); // Build flag state

  useEffect(() => {
    loadServices();
  }, []);

  useEffect(() => {
    if (services.length > 0) {
      loadServiceStatuses();
      // Set up periodic status checking every 5 seconds
      const interval = setInterval(loadServiceStatuses, 5000);
      return () => clearInterval(interval);
    }
  }, [services]);

  useEffect(() => {
    filterServices();
  }, [services, searchQuery, statusFilter, typeFilter, serviceStatuses]);

  const loadServices = async () => {
    try {
      setLoading(true);
      const data = await api.get("/services");
      setServices(data.services || []);
      setError(null);
    } catch (err) {
      setError(`Failed to load services: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadServiceStatuses = async () => {
    try {
      const statusPromises = services.map(async (service) => {
        try {
          const statusData = await api.get(`/service/${service.name}/status`);
          return { name: service.name, running: statusData.running };
        } catch (error) {
          return { name: service.name, running: false };
        }
      });

      const statuses = await Promise.all(statusPromises);
      const statusMap = {};
      statuses.forEach(status => {
        statusMap[status.name] = status.running;
      });
      setServiceStatuses(statusMap);
    } catch (error) {
      console.error('Failed to load service statuses:', error);
    }
  };

  const filterServices = () => {
    let filtered = [...services];

    // Apply text search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (service) =>
          service.name.toLowerCase().includes(query) ||
          (service.description || "").toLowerCase().includes(query) ||
          (service.type || "").toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((service) => {
        const isRunning = serviceStatuses[service.name] || false;
        return statusFilter === "running" ? isRunning : !isRunning;
      });
    }

    // Apply type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter((service) => {
        const categorizedType = categorizeServiceType(service.type);
        return categorizedType === typeFilter.toLowerCase();
      });
    }

    setFilteredServices(filtered);
  };

  // Get categorized service types for filter options
  const getServiceTypes = () => {
    const mainTypes = ['java', 'python', 'npm']; // Main types in desired order
    const allTypes = [...new Set(services.map(service => service.type).filter(Boolean))];
    
    // Check if there are any services with types other than java/python/npm
    const hasOtherTypes = allTypes.some(type => 
      !mainTypes.includes(type.toLowerCase())
    );
    
    // Return main types in order + "others" at the end if there are other types
    const result = [];
    
    // Add main types in specific order if they exist
    mainTypes.forEach(type => {
      if (allTypes.some(serviceType => serviceType.toLowerCase() === type)) {
        result.push(type);
      }
    });
    
    // Add "others" at the end if there are other types
    if (hasOtherTypes) {
      result.push('others');
    }
    
    return result; // Don't sort, maintain the order
  };

  // Helper function to categorize service type
  const categorizeServiceType = (serviceType) => {
    if (!serviceType) return 'others';
    const type = serviceType.toLowerCase();
    return ['java', 'python', 'npm'].includes(type) ? type : 'others';
  };

  const handleActionOutput = (newOutput) => {
    setOutput(newOutput);
    setShowToast(true);
  };

  // Sequential service management functions with config-based ordering
  const startAllServices = async (withBuild = false) => {
    setBulkActionInProgress(true);
    setCurrentBulkAction('starting');
    
    let outputLog = withBuild 
      ? "🚀 Building & Starting all services sequentially (config order)...\n\n"
      : "🚀 Starting all services sequentially (config order)...\n\n";
    handleActionOutput(outputLog);
    
    // Get services in config order by creating a map of service names to their config order
    const serviceOrderMap = {};
    Object.keys(services).forEach((serviceName, index) => {
      serviceOrderMap[serviceName] = index;
    });
    
    // Filter stopped services and sort them by config order
    const stoppedServices = services
      .filter(service => !serviceStatuses[service.name])
      .sort((a, b) => {
        const orderA = serviceOrderMap[a.name] ?? 999;
        const orderB = serviceOrderMap[b.name] ?? 999;
        return orderA - orderB;
      });
    
    for (let i = 0; i < stoppedServices.length; i++) {
      const service = stoppedServices[i];
      try {
        outputLog += `[${i + 1}/${stoppedServices.length}] ${withBuild ? 'Building & Starting' : 'Starting'} ${service.name}...\n`;
        handleActionOutput(outputLog);
        
        const endpoint = withBuild ? `/service/${service.name}/start?build=true` : `/service/${service.name}/start`;
        await api.post(endpoint);
        outputLog += `✅ ${service.name} ${withBuild ? 'built & started' : 'started'} successfully\n`;
        
        // Wait a bit between services to avoid overwhelming the system
        if (i < stoppedServices.length - 1) {
          outputLog += `⏳ Waiting 2 seconds before starting next service...\n\n`;
          handleActionOutput(outputLog);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        outputLog += `❌ Failed to ${withBuild ? 'build & start' : 'start'} ${service.name}: ${error.message}\n`;
      }
      handleActionOutput(outputLog);
    }
    
    outputLog += `\n🎉 Bulk ${withBuild ? 'build & start' : 'start'} operation completed! ${withBuild ? 'Built & started' : 'Started'} ${stoppedServices.length} services.`;
    handleActionOutput(outputLog);
    
    setBulkActionInProgress(false);
    setCurrentBulkAction(null);
    
    // Refresh service statuses after bulk operation
    setTimeout(() => {
      loadServiceStatuses();
    }, 1000);
  };

  const stopAllServices = async () => {
    setBulkActionInProgress(true);
    setCurrentBulkAction('stopping');
    
    let outputLog = "🛑 Stopping all services...\n\n";
    handleActionOutput(outputLog);
    
    const runningServices = services.filter(service => serviceStatuses[service.name]);
    
    // Stop services in parallel for faster shutdown
    const stopPromises = runningServices.map(async (service, index) => {
      try {
        outputLog += `[${index + 1}/${runningServices.length}] Stopping ${service.name}...\n`;
        handleActionOutput(outputLog);
        
        await api.post(`/service/${service.name}/stop`);
        outputLog += `✅ ${service.name} stopped successfully\n`;
        handleActionOutput(outputLog);
        return { service: service.name, success: true };
      } catch (error) {
        outputLog += `❌ Failed to stop ${service.name}: ${error.message}\n`;
        handleActionOutput(outputLog);
        return { service: service.name, success: false, error: error.message };
      }
    });
    
    await Promise.all(stopPromises);
    
    outputLog += `\n🏁 Bulk stop operation completed! Stopped ${runningServices.length} services.`;
    handleActionOutput(outputLog);
    
    setBulkActionInProgress(false);
    setCurrentBulkAction(null);
    
    // Refresh service statuses after bulk operation
    setTimeout(() => {
      loadServiceStatuses();
    }, 1000);
  };

  // Get counts for button labels
  const getServiceCounts = () => {
    const running = services.filter(service => serviceStatuses[service.name]).length;
    const stopped = services.filter(service => !serviceStatuses[service.name]).length;
    return { running, stopped, total: services.length };
  };

  const serviceCounts = getServiceCounts();

  const handleCloseToast = (_, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setShowToast(false);
  };

  // Calculate dynamic toast dimensions based on content
  const getToastDimensions = () => {
    const messageLength = output.length;
    const lineCount = output.split('\n').length;
    
    // Calculate width based on message length
    let width;
    if (messageLength < 50) {
      width = '300px';
    } else if (messageLength < 150) {
      width = '400px';
    } else if (messageLength < 300) {
      width = '500px';
    } else {
      width = '600px';
    }
    
    // Calculate height based on line count and content length
    let maxHeight;
    if (lineCount <= 2 && messageLength < 100) {
      maxHeight = '120px'; // Small messages
    } else if (lineCount <= 5 && messageLength < 300) {
      maxHeight = '200px'; // Medium messages
    } else if (lineCount <= 10 && messageLength < 800) {
      maxHeight = '300px'; // Large messages
    } else {
      maxHeight = '400px'; // Very large messages
    }
    
    return { width, maxHeight };
  };

  const toastDimensions = getToastDimensions();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="60vh">
        <CircularProgress size={60} sx={{ color: "white" }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
      {/* Fixed Search and Filter Header */}
      <Paper
        elevation={6}
        sx={{
          borderRadius: 3,
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(10px)",
          mb: 2,
          flexShrink: 0 // Prevent shrinking
        }}
      >
        {/* Horizontal Search and Filter Layout */}
        <Box sx={{ p: 3 }}>
          {/* Search and Filters Row */}
          <Box sx={{ 
            display: 'flex', 
            gap: 3, 
            alignItems: 'flex-start',
            flexWrap: { xs: 'wrap', lg: 'nowrap' }
          }}>
            {/* Filters Section */}
            <Box sx={{ 
              flex: 1,
              minWidth: { xs: '100%', lg: 'auto' }
            }}>
              {/* Filter Header */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <FilterListIcon sx={{ color: '#666', fontSize: '1.1rem' }} />
                <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, fontSize: '0.75rem' }}>
                  QUICK FILTERS & ACTIONS:
                </Typography>
              </Box>

              {/* Filter Chips with Bulk Actions */}
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                {/* Status Filters */}
                <Chip
                  label="All Status"
                  variant={statusFilter === "all" ? "filled" : "outlined"}
                  color={statusFilter === "all" ? "primary" : "default"}
                  onClick={() => setStatusFilter("all")}
                  size="small"
                  sx={{
                    borderRadius: 2,
                    fontSize: '0.75rem',
                    '&.MuiChip-filled': {
                      background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                      color: 'white'
                    }
                  }}
                />
                <Chip
                  icon={<RunningIcon sx={{ fontSize: '0.8rem' }} />}
                  label="Running"
                  variant={statusFilter === "running" ? "filled" : "outlined"}
                  color={statusFilter === "running" ? "success" : "default"}
                  onClick={() => setStatusFilter("running")}
                  size="small"
                  sx={{
                    borderRadius: 2,
                    fontSize: '0.75rem',
                    '&.MuiChip-filled': {
                      background: 'linear-gradient(45deg, #4CAF50 30%, #8BC34A 90%)',
                      color: 'white'
                    }
                  }}
                />
                <Chip
                  icon={<StoppedIcon sx={{ fontSize: '0.8rem' }} />}
                  label="Stopped"
                  variant={statusFilter === "stopped" ? "filled" : "outlined"}
                  color={statusFilter === "stopped" ? "error" : "default"}
                  onClick={() => setStatusFilter("stopped")}
                  size="small"
                  sx={{
                    borderRadius: 2,
                    fontSize: '0.75rem',
                    '&.MuiChip-filled': {
                      background: 'linear-gradient(45deg, #f44336 30%, #ff5722 90%)',
                      color: 'white'
                    }
                  }}
                />

                {/* Type Filters */}
                <Box sx={{ width: '1px', height: '20px', backgroundColor: '#ddd', mx: 0.5 }} />
                
                <Chip
                  label="All Types"
                  variant={typeFilter === "all" ? "filled" : "outlined"}
                  color={typeFilter === "all" ? "primary" : "default"}
                  onClick={() => setTypeFilter("all")}
                  size="small"
                  sx={{
                    borderRadius: 2,
                    fontSize: '0.75rem',
                    '&.MuiChip-filled': {
                      background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                      color: 'white'
                    }
                  }}
                />
                
                {getServiceTypes().map((type) => (
                  <Chip
                    key={type}
                    icon={<CodeIcon sx={{ fontSize: '0.8rem' }} />}
                    label={type === 'others' ? 'Others' : type.charAt(0).toUpperCase() + type.slice(1)}
                    variant={typeFilter === type ? "filled" : "outlined"}
                    color={typeFilter === type ? "secondary" : "default"}
                    onClick={() => setTypeFilter(type)}
                    size="small"
                    sx={{
                      borderRadius: 2,
                      fontSize: '0.75rem',
                      '&.MuiChip-filled': {
                        background: type === 'others' 
                          ? 'linear-gradient(45deg, #FF9800 30%, #FFC107 90%)'
                          : 'linear-gradient(45deg, #9C27B0 30%, #E91E63 90%)',
                        color: 'white'
                      }
                    }}
                  />
                ))}

                {/* Divider */}
                <Box sx={{ width: '1px', height: '20px', backgroundColor: '#ddd', mx: 0.5 }} />

                {/* Build Toggle */}
                <Chip
                  icon={<BuildIcon sx={{ fontSize: '0.8rem' }} />}
                  label="Build Mode"
                  variant={buildEnabled ? "filled" : "outlined"}
                  color={buildEnabled ? "warning" : "default"}
                  onClick={() => setBuildEnabled(!buildEnabled)}
                  size="small"
                  sx={{
                    borderRadius: 2,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    '&.MuiChip-filled': {
                      background: 'linear-gradient(45deg, #FF9800 30%, #FFC107 90%)',
                      color: 'white'
                    },
                    '&:hover': {
                      transform: 'translateY(-1px)',
                      boxShadow: buildEnabled 
                        ? '0 4px 12px rgba(255, 152, 0, 0.3)'
                        : '0 2px 8px rgba(0, 0, 0, 0.1)'
                    },
                    transition: 'all 0.2s ease'
                  }}
                />

                {/* Bulk Action Chips */}
                <Chip
                  icon={bulkActionInProgress && currentBulkAction === 'starting' ? 
                    <CircularProgress size={14} sx={{ color: 'inherit' }} /> : 
                    <StartAllIcon sx={{ fontSize: '0.8rem' }} />
                  }
                  label={bulkActionInProgress && currentBulkAction === 'starting' ? 
                    'Starting...' : 
                    buildEnabled 
                      ? `Build & Start All (${serviceCounts.stopped})`
                      : `Start All (${serviceCounts.stopped})`
                  }
                  onClick={() => startAllServices(buildEnabled)}
                  disabled={bulkActionInProgress || serviceCounts.stopped === 0}
                  size="small"
                  sx={{
                    borderRadius: 2,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: buildEnabled 
                      ? 'linear-gradient(45deg, #FF9800 30%, #4CAF50 90%)'
                      : 'linear-gradient(45deg, #4CAF50 30%, #8BC34A 90%)',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    '&:hover': {
                      background: buildEnabled
                        ? 'linear-gradient(45deg, #F57C00 30%, #45a049 90%)'
                        : 'linear-gradient(45deg, #45a049 30%, #7cb342 90%)',
                      transform: 'translateY(-1px)',
                      boxShadow: buildEnabled
                        ? '0 4px 12px rgba(255, 152, 0, 0.3)'
                        : '0 4px 12px rgba(76, 175, 80, 0.3)'
                    },
                    '&:disabled': {
                      background: '#e0e0e0',
                      color: '#999',
                      cursor: 'not-allowed',
                      transform: 'none',
                      boxShadow: 'none'
                    },
                    transition: 'all 0.2s ease'
                  }}
                />
                
                <Chip
                  icon={bulkActionInProgress && currentBulkAction === 'stopping' ? 
                    <CircularProgress size={14} sx={{ color: 'inherit' }} /> : 
                    <StopAllIcon sx={{ fontSize: '0.8rem' }} />
                  }
                  label={bulkActionInProgress && currentBulkAction === 'stopping' ? 
                    'Stopping...' : 
                    `Stop All (${serviceCounts.running})`
                  }
                  onClick={stopAllServices}
                  disabled={bulkActionInProgress || serviceCounts.running === 0}
                  size="small"
                  sx={{
                    borderRadius: 2,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: 'linear-gradient(45deg, #f44336 30%, #ff5722 90%)',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #d32f2f 30%, #f4511e 90%)',
                      transform: 'translateY(-1px)',
                      boxShadow: '0 4px 12px rgba(244, 67, 54, 0.3)'
                    },
                    '&:disabled': {
                      background: '#e0e0e0',
                      color: '#999',
                      cursor: 'not-allowed',
                      transform: 'none',
                      boxShadow: 'none'
                    },
                    transition: 'all 0.2s ease'
                  }}
                />
              </Stack>
            </Box>

            {/* Search Section */}
            <Box sx={{ 
              minWidth: { xs: '100%', lg: '350px' },
              maxWidth: { xs: '100%', lg: '400px' },
              flex: { xs: 'none', lg: '0 0 auto' },
              mt: { xs: 2, lg: 0 }
            }}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="🔍 Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="small"
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 3,
                    background: "rgba(255, 255, 255, 0.9)",
                    border: "2px solid transparent",
                    transition: "all 0.3s ease",
                    "&:hover": {
                      background: "rgba(255, 255, 255, 1)",
                      borderColor: "rgba(33, 150, 243, 0.3)",
                      boxShadow: "0 2px 8px rgba(33, 150, 243, 0.15)"
                    },
                    "&.Mui-focused": {
                      background: "rgba(255, 255, 255, 1)",
                      borderColor: "#2196F3",
                      boxShadow: "0 0 0 3px rgba(33, 150, 243, 0.1)"
                    }
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: '#2196F3', fontSize: '1.1rem' }} />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery && (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setSearchQuery("")}
                        sx={{
                          color: '#666',
                          p: 0.5,
                          '&:hover': {
                            color: '#f44336',
                            backgroundColor: 'rgba(244, 67, 54, 0.1)'
                          }
                        }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
              
              {/* Search Results Counter */}
              {searchQuery.trim() && (
                <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={`${filteredServices.length} Result${filteredServices.length !== 1 ? 's' : ''}`}
                    size="small"
                    sx={{
                      background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '0.7rem'
                    }}
                  />
                  <Typography variant="caption" sx={{ color: '#666', fontSize: '0.75rem' }}>
                    for "{searchQuery}"
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* Active Filters Summary */}
          {(statusFilter !== "all" || typeFilter !== "all" || searchQuery.trim()) && (
            <Box sx={{ mt: 2, p: 1.5, backgroundColor: 'rgba(33, 150, 243, 0.08)', borderRadius: 2 }}>
              <Typography variant="caption" sx={{ color: '#1976d2', fontWeight: 600, fontSize: '0.75rem' }}>
                Showing {filteredServices.length} of {services.length} services
                {searchQuery.trim() && ` • Search: "${searchQuery}"`}
                {statusFilter !== "all" && ` • Status: ${statusFilter}`}
                {typeFilter !== "all" && ` • Type: ${typeFilter}`}
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Scrollable Services Grid */}
      <Paper
        elevation={6}
        sx={{
          borderRadius: 3,
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(10px)",
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden'
        }}
      >
        <Box sx={{ 
          flexGrow: 1, 
          overflow: 'auto', 
          p: 3,
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'rgba(0,0,0,0.05)',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '4px',
            '&:hover': {
              background: 'rgba(0,0,0,0.3)',
            }
          }
        }}>
          <Grid container spacing={2}>
            {filteredServices.length === 0 ? (
              <Grid item xs={12}>
                <Paper
                  sx={{
                    p: 3,
                    textAlign: "center",
                    borderRadius: 2,
                    background: "rgba(255, 255, 255, 0.7)",
                  }}
                >
                  <Typography variant="body1" color="text.secondary">
                    No matching services found.
                  </Typography>
                </Paper>
              </Grid>
            ) : (
              filteredServices.map((service) => (
                <Grid item xs={12} sm={6} lg={4} key={service.name}>
                  <ServiceCard
                    service={service}
                    onActionOutput={handleActionOutput}
                    onViewLogs={onViewLogs}
                  />
                </Grid>
              ))
            )}
          </Grid>
        </Box>
      </Paper>

      {/* Dynamic Toast Message for Action Output */}
      <Snackbar
        open={showToast}
        autoHideDuration={10000} // 10 seconds
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        sx={{ 
          '& .MuiSnackbarContent-root': {
            width: toastDimensions.width,
            maxWidth: 'calc(100vw - 48px)',
            minWidth: '280px',
            padding: 0,
            backgroundColor: 'transparent',
            boxShadow: 'none'
          }
        }}
      >
        <Paper
          elevation={12}
          sx={{
            borderRadius: 3,
            background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
            color: "#e5e7eb",
            border: '1px solid rgba(254, 107, 139, 0.3)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.4), 0 0 20px rgba(254, 107, 139, 0.2)',
            overflow: 'hidden',
            maxHeight: toastDimensions.maxHeight,
            display: 'flex',
            flexDirection: 'column',
            transition: 'all 0.3s ease-in-out'
          }}
        >
          {/* Toast Header */}
          <Box sx={{ 
            px: 2, 
            py: 1.5, 
            borderBottom: '1px solid #333',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(254, 107, 139, 0.1)'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TerminalIcon sx={{ fontSize: '1.1rem', color: '#FE6B8B' }} />
              <Typography
                variant="subtitle2"
                sx={{
                  color: "#fff",
                  fontWeight: 600,
                  background: "linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  fontSize: "0.85rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}
              >
                Action Output
              </Typography>
            </Box>
            
            <IconButton
              size="small"
              onClick={handleCloseToast}
              sx={{ 
                color: "#fff", 
                p: 0.5,
                borderRadius: 1,
                '&:hover': { 
                  backgroundColor: 'rgba(255, 100, 100, 0.2)',
                  transform: 'scale(1.1)'
                },
                transition: 'all 0.2s ease'
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* Dynamic Toast Content */}
          <Box
            component="pre"
            sx={{
              backgroundColor: "#0a0e13",
              background: "linear-gradient(135deg, #0a0e13 0%, #1a1f2e 100%)",
              p: output.length < 100 ? 1 : 1.5, // Less padding for short messages
              fontSize: output.length < 50 ? "0.8rem" : "0.75rem", // Larger font for short messages
              lineHeight: output.length < 100 ? 1.5 : 1.4,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              overflow: "auto",
              fontFamily: "'Fira Code', 'Consolas', monospace",
              color: "#e1e7ef",
              margin: 0,
              flexGrow: 1,
              minHeight: output.length < 50 ? '40px' : '60px', // Minimum height based on content
              '&::-webkit-scrollbar': {
                width: '6px',
              },
              '&::-webkit-scrollbar-track': {
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '3px',
              },
              '&::-webkit-scrollbar-thumb': {
                background: 'rgba(254, 107, 139, 0.3)',
                borderRadius: '3px',
                '&:hover': {
                  background: 'rgba(254, 107, 139, 0.5)',
                }
              }
            }}
          >
            {output}
          </Box>

          {/* Auto-dismiss indicator */}
          <Box sx={{
            px: 2,
            py: 1,
            borderTop: '1px solid #333',
            background: 'rgba(254, 107, 139, 0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}>
            <Box sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: '#FE6B8B',
              animation: 'pulse 2s ease-in-out infinite'
            }} />
            <Typography variant="caption" sx={{ color: '#aaa', fontSize: '0.7rem' }}>
              Auto-dismiss in 10 seconds
            </Typography>
          </Box>
        </Paper>
      </Snackbar>

      {/* Add pulse animation */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}
      </style>
    </Box>
  );
};

export default Dashboard;
