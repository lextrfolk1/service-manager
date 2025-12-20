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
} from "@mui/material";
import { 
  Search as SearchIcon,
  Close as CloseIcon,
  Terminal as TerminalIcon
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

  useEffect(() => {
    loadServices();
  }, []);

  useEffect(() => {
    filterServices();
  }, [services, searchQuery]);

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

  const filterServices = () => {
    if (!searchQuery.trim()) {
      setFilteredServices(services);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = services.filter(
      (service) =>
        service.name.toLowerCase().includes(query) ||
        (service.description || "").toLowerCase().includes(query) ||
        (service.type || "").toLowerCase().includes(query)
    );

    setFilteredServices(filtered);
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
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Full Width Services Grid */}
      <Grid container spacing={2} sx={{ flexGrow: 1, p: 2, minHeight: 0 }}>
        <Grid item xs={12} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
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
            {/* Fixed Search Header */}
            <Box sx={{ p: 3, flexShrink: 0 }}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 3,
                    background: "rgba(255, 255, 255, 0.8)",
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            {/* Scrollable Services Grid */}
            <Box sx={{ flexGrow: 1, overflow: 'auto', px: 3, pb: 3 }}>
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
        </Grid>
      </Grid>

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
