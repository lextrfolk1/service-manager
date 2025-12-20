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
  Code as CodeIcon
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

  // Helper function to get service status from our status map
  const getServiceStatus = (service) => {
    const isRunning = serviceStatuses[service.name];
    return isRunning ? "Running" : "Stopped";
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

  const handleCloseToast = (event, reason) => {
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
                  QUICK FILTERS:
                </Typography>
              </Box>

              {/* Filter Chips */}
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
