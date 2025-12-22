import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  Box,
  CircularProgress,
} from "@mui/material";
import {
  Build as BuildIcon,
} from "@mui/icons-material";
import api from "../services/api";

const ServiceCard = ({ service, onActionOutput, onViewLogs }) => {
  const [status, setStatus] = useState({ running: false, loading: true });
  const [buildEnabled, setBuildEnabled] = useState(false);

  useEffect(() => {
    // On mount, check if there's a stale action state and do an immediate status check
    const actionState = getActionState();
    if (actionState) {
      const timeSinceAction = Date.now() - actionState.timestamp;
      // If action is older than 10 seconds, do an immediate status check
      if (timeSinceAction > 10000) {
        refreshStatus();
      }
    }
    
    refreshStatus();
    // Set up periodic status checking
    const interval = setInterval(refreshStatus, 2000); // Check every 2 seconds
    return () => clearInterval(interval);
  }, [service.name]);

  // Get persistent action state from localStorage
  const getActionState = () => {
    try {
      const stored = localStorage.getItem(`service-action-${service.name}`);
      if (stored) {
        const { action, timestamp } = JSON.parse(stored);
        // Clear if older than 45 seconds (increased timeout)
        if (Date.now() - timestamp > 45000) {
          localStorage.removeItem(`service-action-${service.name}`);
          return null;
        }
        return { action, timestamp };
      }
    } catch (error) {
      // Ignore localStorage errors
    }
    return null;
  };

  // Set persistent action state in localStorage
  const setActionState = (action) => {
    try {
      if (action) {
        localStorage.setItem(`service-action-${service.name}`, JSON.stringify({
          action,
          timestamp: Date.now()
        }));
      } else {
        localStorage.removeItem(`service-action-${service.name}`);
      }
    } catch (error) {
      // Ignore localStorage errors
    }
  };

  const refreshStatus = async () => {
    try {
      const statusData = await api.get(`/service/${service.name}/status`);
      const newRunningState = statusData.running;
      const isCheckable = statusData.checkable !== false; // Default to true if not specified
      
      const actionState = getActionState();
      
      // If we have a stored action, check if it should be cleared
      if (actionState) {
        const { action, timestamp } = actionState;
        const timeSinceAction = Date.now() - timestamp;
        
        // More aggressive clearing logic
        let shouldClear = false;
        
        if (action === 'starting') {
          // Clear if service is running OR if it's been more than 30 seconds
          shouldClear = newRunningState || timeSinceAction > 30000;
        } else if (action === 'stopping') {
          // Clear if service is stopped OR if it's been more than 20 seconds
          shouldClear = !newRunningState || timeSinceAction > 20000;
        } else if (action === 'restarting') {
          // Clear after 15 seconds or if status is stable
          shouldClear = timeSinceAction > 15000;
        }
        
        // Also clear if action is very old (45+ seconds)
        if (timeSinceAction > 45000) {
          shouldClear = true;
        }
        
        if (shouldClear) {
          setActionState(null);
        }
      }
      
      setStatus({ 
        running: newRunningState, 
        loading: false, 
        checkable: isCheckable 
      });
    } catch (error) {
      setStatus({ running: false, loading: false, checkable: true });
      // Don't clear action state on network errors - might be temporary
    }
  };

  const executeAction = async (action) => {
    const actionType = action === 'start' ? 'starting' : action === 'stop' ? 'stopping' : 'restarting';
    setActionState(actionType);
    
    const actionText = action === 'start' && buildEnabled ? 'BUILD & START' : action.toUpperCase();
    onActionOutput(`${actionText} ${service.name}...\n`);

    try {
      let endpoint = `/service/${service.name}/${action}`;
      if (action === 'start' && buildEnabled) {
        endpoint += '?build=true';
      }
      
      const result = await api.post(endpoint);
      onActionOutput(JSON.stringify(result, null, 2));
    } catch (error) {
      onActionOutput(`Error: ${error.message}`);
      setActionState(null); // Clear on error
    }
  };

  const getTypeColor = (type) => {
    const colors = {
      java: "#007396", // Java blue
      python: "#3776AB", // Python blue
      redis: "#A41E11", // Redis dark red (distinct from stop button)
      neo4j: "#008CC1", // Neo4j cyan
      npm: "#68A063", // Node.js green
      listener: "#9C27B0", // Purple
    };
    return colors[type?.toLowerCase()] || "#666";
  };

  const getStatusInfo = () => {
    if (status.loading) {
      return { text: "Checking...", color: "#666", dot: "#666" };
    }
    
    // Check if service status is unavailable
    if (status.checkable === false) {
      return { text: "Unavailable", color: "#FF9800", dot: "#FF9800" };
    }
    
    // Check for persistent action state
    const actionState = getActionState();
    if (actionState) {
      const { action, timestamp } = actionState;
      const timeSinceAction = Date.now() - timestamp;
      
      // If action is very recent (< 15 seconds), show it
      if (timeSinceAction < 15000) {
        const statusMap = {
          starting: { text: "Starting...", color: "#FF9800", dot: "#FF9800" },
          stopping: { text: "Stopping...", color: "#FF9800", dot: "#FF9800" },
          restarting: { text: "Restarting...", color: "#FF9800", dot: "#FF9800" }
        };
        return statusMap[action] || statusMap.starting;
      }
      
      // If action is older but status doesn't match expected outcome, show "Checking..."
      if (timeSinceAction < 30000) {
        if (
          (action === 'starting' && !status.running) ||
          (action === 'stopping' && status.running)
        ) {
          return { text: "Checking...", color: "#FF9800", dot: "#FF9800" };
        }
      }
      
      // If we get here, the action is probably stale, clear it
      setActionState(null);
    }
    
    return status.running 
      ? { text: "Running", color: "#4CAF50", dot: "#4CAF50" }
      : { text: "Stopped", color: "#f44336", dot: "#f44336" };
  };

  const statusInfo = getStatusInfo();
  const actionState = getActionState();
  const isActionInProgress = !!actionState;

  return (
    <Card
      elevation={2}
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: 2,
        background: "rgba(255, 255, 255, 0.98)",
        border: "1px solid rgba(0,0,0,0.08)",
        transition: "all 0.2s ease",
        "&:hover": {
          elevation: 4,
          transform: "translateY(-2px)",
          borderColor: "rgba(0,0,0,0.12)",
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1, p: 3 }}>
        {/* Header with name and status */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              color: "#333",
              fontSize: "1.1rem"
            }}
          >
            {service.name}
          </Typography>
          
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {status.loading || isActionInProgress ? (
              <CircularProgress size={16} />
            ) : (
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: statusInfo.dot,
                }}
              />
            )}
            <Typography 
              variant="caption" 
              sx={{ 
                fontWeight: 500,
                color: statusInfo.color
              }}
            >
              {statusInfo.text}
            </Typography>
          </Box>
        </Box>

        {/* Type and Port */}
        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
          <Box
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              backgroundColor: getTypeColor(service.type),
              color: "white",
              fontSize: "0.75rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.5
            }}
          >
            {service.type || "Unknown"}
          </Box>
          {service.port && (
            <Box
              sx={{
                px: 1.5,
                py: 0.5,
                borderRadius: 1,
                backgroundColor: "rgba(0,0,0,0.06)",
                color: "#666",
                fontSize: "0.75rem",
                fontWeight: 500
              }}
            >
              :{service.port}
            </Box>
          )}
        </Box>

        {/* Description */}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ 
            lineHeight: 1.4,
            fontSize: "0.875rem",
            minHeight: "2.5em",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden"
          }}
        >
          {service.description || "No description available"}
        </Typography>
      </CardContent>

      {/* Actions */}
      <CardActions sx={{ p: 2, pt: 0 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          {/* Build Toggle - only show for services that have build commands */}
          {service.type && ['java', 'npm'].includes(service.type.toLowerCase()) && (
            <Chip
              icon={<BuildIcon sx={{ fontSize: '0.7rem' }} />}
              label="Build Mode"
              variant={buildEnabled ? "filled" : "outlined"}
              color={buildEnabled ? "warning" : "default"}
              onClick={() => setBuildEnabled(!buildEnabled)}
              size="small"
              sx={{
                fontSize: '0.7rem',
                height: '24px',
                cursor: 'pointer',
                '&.MuiChip-filled': {
                  background: 'linear-gradient(45deg, #FF9800 30%, #FFC107 90%)',
                  color: 'white'
                },
                '&:hover': {
                  transform: 'scale(1.05)',
                  boxShadow: buildEnabled 
                    ? '0 2px 8px rgba(255, 152, 0, 0.3)'
                    : '0 1px 4px rgba(0, 0, 0, 0.1)'
                },
                transition: 'all 0.2s ease'
              }}
            />
          )}
          
          {/* Action Buttons - always on the right */}
          <Box sx={{ display: "flex", gap: 1, ml: "auto" }}>
            <Button
              variant="contained"
              onClick={() => executeAction("start")}
              size="small"
              disabled={status.running || isActionInProgress}
              sx={{
                backgroundColor: buildEnabled ? "#FF9800" : "#4CAF50",
                "&:hover": { 
                  backgroundColor: buildEnabled ? "#F57C00" : "#45a049" 
                },
                "&:disabled": { backgroundColor: "#e0e0e0" },
                borderRadius: 2,
                height: '32px',
                minHeight: '32px',
                maxHeight: '32px',
                minWidth: '60px'
              }}
            >
              {actionState?.action === 'starting' 
                ? (buildEnabled ? 'Building...' : 'Starting...') 
                : 'Start'
              }
            </Button>
            <Button
              variant="contained"
              onClick={() => executeAction("stop")}
              size="small"
              disabled={!status.running || isActionInProgress}
              sx={{
                backgroundColor: "#f44336",
                "&:hover": { backgroundColor: "#d32f2f" },
                "&:disabled": { backgroundColor: "#e0e0e0" },
                borderRadius: 2,
                height: '32px',
                minHeight: '32px',
                maxHeight: '32px',
                minWidth: '60px'
              }}
            >
              {actionState?.action === 'stopping' ? 'Stopping...' : 'Stop'}
            </Button>
            <Button
              variant="outlined"
              onClick={() => executeAction("restart")}
              size="small"
              disabled={isActionInProgress}
              sx={{
                borderColor: "#FF9800",
                color: "#FF9800",
                "&:hover": {
                  borderColor: "#F57C00",
                  backgroundColor: "rgba(255, 152, 0, 0.04)"
                },
                "&:disabled": { 
                  borderColor: "#e0e0e0",
                  color: "#e0e0e0"
                },
                borderRadius: 2,
                height: '32px',
                minHeight: '32px',
                maxHeight: '32px',
                minWidth: '70px'
              }}
            >
              {actionState?.action === 'restarting' ? 'Restarting...' : 'Restart'}
            </Button>
            <Button
              variant="outlined"
              onClick={() => onViewLogs && onViewLogs(service.name)}
              size="small"
              sx={{
                borderColor: "#666",
                color: "#666",
                "&:hover": {
                  borderColor: "#333",
                  backgroundColor: "rgba(0,0,0,0.04)"
                },
                borderRadius: 2,
                height: '32px',
                minHeight: '32px',
                maxHeight: '32px',
                minWidth: '50px'
              }}
            >
              Logs
            </Button>
          </Box>
        </Box>
      </CardActions>
    </Card>
  );
};

export default ServiceCard;
