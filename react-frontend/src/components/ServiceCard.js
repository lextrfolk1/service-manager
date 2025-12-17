import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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

const ServiceCard = ({ service, onActionOutput }) => {
  const [status, setStatus] = useState({ running: false, loading: true });
  const navigate = useNavigate();

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

  const viewLogs = () => {
    navigate(`/logs?service=${encodeURIComponent(service.name)}`);
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
      node: "success",
    };
    return colors[type?.toLowerCase()] || "default";
  };

  return (
    <Card
      elevation={2}
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        transition: "all 0.2s",
        "&:hover": {
          elevation: 4,
          transform: "translateY(-2px)",
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            mb: 1,
          }}
        >
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {service.name}
          </Typography>
          <Chip
            label={service.type || "Unknown"}
            color={getTypeColor(service.type)}
            size="small"
            variant="outlined"
          />
        </Box>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 2, minHeight: "2.5em" }}
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
            <Typography variant="caption" color="text.secondary">
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
            color="primary"
          >
            Start
          </Button>
          <Button
            variant="outlined"
            startIcon={<StopIcon />}
            onClick={() => executeAction("stop")}
            size="small"
            color="error"
          >
            Stop
          </Button>
          <Button
            variant="outlined"
            startIcon={<RestartIcon />}
            onClick={() => executeAction("restart")}
            size="small"
          >
            Restart
          </Button>
          <Button
            variant="outlined"
            startIcon={<LogsIcon />}
            onClick={viewLogs}
            size="small"
          >
            Logs
          </Button>
        </Box>
      </CardActions>
    </Card>
  );
};

export default ServiceCard;
