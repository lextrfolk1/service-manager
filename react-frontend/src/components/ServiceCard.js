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
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Refresh as RestartIcon,
  Article as LogsIcon,
  Circle as StatusIcon,
} from "@mui/icons-material";
import api from "../services/api";

const ServiceCard = ({ service, onActionOutput, onViewLogs }) => {
  const [status, setStatus] = useState({ running: false, loading: true });

  useEffect(() => {
    refreshStatus();
  }, [service.name]);

  const refreshStatus = async () => {
    try {
      const statusData = await api.get(`/service/${service.name}/status`);
      setStatus({ running: statusData.running, loading: false });
    } catch (error) {
      setStatus({ running: false, loading: false });
    }
  };

  const executeAction = async (action) => {
    onActionOutput(`${action.toUpperCase()} ${service.name}...\n`);

    try {
      const result = await api.post(`/service/${service.name}/${action}`);
      onActionOutput(JSON.stringify(result, null, 2));
      await refreshStatus();
    } catch (error) {
      onActionOutput(`Error: ${error.message}`);
    }
  };

  const getStatusColor = () => {
    if (status.loading) return "default";
    return status.running ? "success" : "error";
  };

  const getTypeColor = (type) => {
    const colors = {
      java: "primary",
      python: "secondary",
      redis: "error",
      neo4j: "warning",
      npm: "success",
      listener: "info",
    };
    return colors[type?.toLowerCase()] || "default";
  };

  return (
    <Card
      elevation={4}
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: 3,
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(10px)",
        transition: "all 0.3s ease",
        "&:hover": {
          elevation: 8,
          transform: "translateY(-4px)",
          background: "rgba(255, 255, 255, 1)",
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            mb: 2,
          }}
        >
          <Typography
            variant="h6"
            component="h2"
            sx={{
              fontWeight: 700,
              background: "linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {service.name}
          </Typography>
          <Chip
            label={service.type || "Unknown"}
            color={getTypeColor(service.type)}
            size="small"
            sx={{
              fontWeight: 600,
              boxShadow: 1,
            }}
          />
        </Box>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 2, minHeight: "2.5em", lineHeight: 1.4 }}
        >
          {service.description || "No description available"}
        </Typography>

        <Box
          sx={{
            display: "flex",
            gap: 1,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {service.port && (
            <Chip
              label={`Port ${service.port}`}
              color="info"
              size="small"
              variant="filled"
              sx={{
                fontWeight: 600,
                background: "linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)",
              }}
            />
          )}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            {status.loading ? (
              <CircularProgress size={12} />
            ) : (
              <StatusIcon
                sx={{
                  fontSize: 12,
                  color: status.running ? "success.main" : "error.main",
                }}
              />
            )}
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
              {status.loading
                ? "Checking..."
                : status.running
                ? "Running"
                : "Stopped"}
            </Typography>
          </Box>
        </Box>
      </CardContent>

      <CardActions sx={{ p: 2, pt: 0 }}>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", width: "100%" }}>
          <Button
            variant="contained"
            startIcon={<StartIcon />}
            onClick={() => executeAction("start")}
            size="small"
            sx={{
              background: "linear-gradient(45deg, #4CAF50 30%, #45a049 90%)",
              boxShadow: "0 3px 5px 2px rgba(76, 175, 80, .3)",
              "&:hover": {
                background: "linear-gradient(45deg, #45a049 30%, #4CAF50 90%)",
              },
            }}
          >
            Start
          </Button>
          <Button
            variant="contained"
            startIcon={<StopIcon />}
            onClick={() => executeAction("stop")}
            size="small"
            sx={{
              background: "linear-gradient(45deg, #f44336 30%, #d32f2f 90%)",
              boxShadow: "0 3px 5px 2px rgba(244, 67, 54, .3)",
              "&:hover": {
                background: "linear-gradient(45deg, #d32f2f 30%, #f44336 90%)",
              },
            }}
          >
            Stop
          </Button>
          <Button
            variant="outlined"
            startIcon={<RestartIcon />}
            onClick={() => executeAction("restart")}
            size="small"
            sx={{
              borderColor: "#FF9800",
              color: "#FF9800",
              "&:hover": {
                borderColor: "#F57C00",
                backgroundColor: "rgba(255, 152, 0, 0.1)",
              },
            }}
          >
            Restart
          </Button>
          <Button
            variant="outlined"
            startIcon={<LogsIcon />}
            onClick={() => onViewLogs && onViewLogs(service.name)}
            size="small"
            sx={{
              borderColor: "#9C27B0",
              color: "#9C27B0",
              "&:hover": {
                borderColor: "#7B1FA2",
                backgroundColor: "rgba(156, 39, 176, 0.1)",
              },
            }}
          >
            Logs
          </Button>
        </Box>
      </CardActions>
    </Card>
  );
};

export default ServiceCard;
