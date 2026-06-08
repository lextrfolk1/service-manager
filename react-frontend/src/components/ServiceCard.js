import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Collapse,
  Divider,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Launch as LaunchIcon,
  Refresh as RefreshIcon,
  Stop as StopIcon,
  PlayArrow as PlayArrowIcon,
} from "@mui/icons-material";
import StatusChip from "./StatusChip";

function ServiceCard({
  service,
  status,
  reverseDependencies = [],
  isSelected,
  onSelect,
  onAction,
  onViewLogs,
}) {
  const isBusy = ["queued", "waiting", "starting", "stopping"].includes(status.lifecycleState);
  const canStart = !isBusy && !status.running;
  const canStop = !isBusy && status.running;
  const canRestart = !isBusy;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.25,
        border: "1px solid",
        borderColor: status.error ? "error.light" : "divider",
        borderRadius: 3,
        backgroundColor: "rgba(255,255,255,0.94)",
      }}
    >
      <Stack spacing={1}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              lg: "28px minmax(180px, 1.7fr) minmax(220px, 1.2fr) minmax(190px, 1fr) auto",
            },
            gap: 1.25,
            alignItems: "center",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", minWidth: 0 }}>
            <Checkbox
              checked={isSelected === true}
              onChange={(event) => onSelect(event.target.checked)}
              sx={{ p: 0.5, mr: 0.5 }}
            />
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              {service.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {service.description || "No description available"}
            </Typography>
          </Box>

          <Stack direction="row" spacing={0.75} flexWrap="wrap">
            <Chip label={service.group || "Other"} size="small" />
            <Chip label={service.type || "Unknown"} size="small" variant="outlined" />
            {service.port ? <Chip label={`:${service.port}`} size="small" variant="outlined" /> : null}
            {service.hasBuild ? <Chip label="Build" size="small" color="warning" variant="outlined" /> : null}
          </Stack>

          <Stack direction="row" spacing={0.75} flexWrap="wrap">
            <StatusChip state={status.lifecycleState} label={status.lifecycleLabel} />
            {status.lifecycleState !== "stopped" && status.healthLabel ? (
              <StatusChip state={status.healthState} label={status.healthLabel} />
            ) : null}
          </Stack>

          <Stack direction="row" spacing={0.75} flexWrap="wrap" justifyContent={{ xs: "flex-start", lg: "flex-end" }}>
            <Tooltip title={canStart ? "" : isBusy ? "Service is busy" : "Service is already running"}>
              <span>
                <Button size="small" variant="contained" startIcon={<PlayArrowIcon />} onClick={() => onAction(service.name, "start")} disabled={!canStart}>
                  Start
                </Button>
              </span>
            </Tooltip>
            <Tooltip title={canStop ? "" : isBusy ? "Service is busy" : "Service is already stopped"}>
              <span>
                <Button size="small" variant="outlined" color="error" startIcon={<StopIcon />} onClick={() => onAction(service.name, "stop")} disabled={!canStop}>
                  Stop
                </Button>
              </span>
            </Tooltip>
            <Tooltip title={canRestart ? "" : "Service is busy"}>
              <span>
                <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={() => onAction(service.name, "restart")} disabled={!canRestart}>
                  Restart
                </Button>
              </span>
            </Tooltip>
            <Button size="small" variant="text" endIcon={<LaunchIcon />} onClick={() => onViewLogs(service.name)}>
              Logs
            </Button>
          </Stack>
        </Box>

        {(service.dependsOn?.length || reverseDependencies.length) ? (
          <>
            <Divider />
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              {service.dependsOn?.length ? (
                <Typography variant="caption" color="text.secondary">
                  Depends on: {service.dependsOn.join(", ")}
                </Typography>
              ) : null}
              {reverseDependencies.length ? (
                <Typography variant="caption" color="text.secondary">
                  Required by: {reverseDependencies.join(", ")}
                </Typography>
              ) : null}
            </Box>
          </>
        ) : null}

        {status.message ? (
          <Typography variant="caption" color={status.error ? "error.main" : "text.secondary"}>
            {status.message}
          </Typography>
        ) : null}

        <Collapse in={Boolean(status.error)}>
          {status.error ? (
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={() => onViewLogs(service.name)}>
                  View logs
                </Button>
              }
              sx={{ borderRadius: 2 }}
            >
              {status.error}
            </Alert>
          ) : null}
        </Collapse>
      </Stack>
    </Paper>
  );
}

export default ServiceCard;
