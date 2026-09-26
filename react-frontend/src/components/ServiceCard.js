import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Collapse,
  IconButton,
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
  isMoving,
  isDraggable = true,
  showGroup = false,
  isSelected,
  onSelect,
  onAction,
  onViewLogs,
  onDragStart,
  onDragEnd,
}) {
  const isBusy = ["queued", "waiting", "starting", "stopping"].includes(status.lifecycleState);
  const canStart = !isBusy && !status.running;
  const canStop = !isBusy && status.running;
  const canRestart = !isBusy;

  return (
    <Paper
      elevation={0}
      draggable={isDraggable && !isMoving}
      onDragStart={isDraggable ? (event) => {
        event.dataTransfer.setData("text/plain", service.name);
        event.dataTransfer.effectAllowed = "move";
        onDragStart(service.name);
      } : undefined}
      onDragEnd={isDraggable ? onDragEnd : undefined}
      sx={{
        p: 1.25,
        height: "100%",
        cursor: isMoving ? "progress" : isDraggable ? "grab" : "default",
        opacity: isMoving ? 0.6 : 1,
        ...(isDraggable ? { "&:active": { cursor: "grabbing" } } : {}),
        border: "1px solid",
        borderColor: status.error ? "error.light" : "divider",
        borderRadius: 3,
        backgroundColor: "rgba(255,255,255,0.94)",
      }}
    >
      <Stack spacing={0.75} sx={{ height: "100%", minWidth: 0 }}>
        <Box
          sx={{
            display: "flex",
            gap: 0.5,
            alignItems: "flex-start",
          }}
        >
          <Checkbox
            size="small"
            checked={isSelected === true}
            onChange={(event) => onSelect(event.target.checked)}
            inputProps={{ "aria-label": `Select ${service.name}` }}
            sx={{ p: 0.25, mt: -0.25 }}
          />

          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="subtitle2"
              title={service.name}
              sx={{ fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {service.name}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.3 }}
            >
              {service.description || "No description available"}
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap alignItems="center">
          <StatusChip state={status.lifecycleState} label={status.lifecycleLabel} />
          {status.lifecycleState !== "stopped" && status.healthLabel ? (
            <StatusChip state={status.healthState} label={status.healthLabel} />
          ) : null}
          {showGroup ? <Chip label={service.group || "Other"} size="small" /> : null}
          <Chip label={service.type || "Unknown"} size="small" variant="outlined" />
          {service.port ? <Chip label={`:${service.port}`} size="small" variant="outlined" /> : null}
          {service.hasBuild ? <Chip label="Build" size="small" color="warning" variant="outlined" /> : null}
        </Stack>

        {(service.dependsOn?.length || reverseDependencies.length) ? (
          <Typography
            variant="caption"
            color="text.secondary"
            title={[
              service.dependsOn?.length ? `Depends on: ${service.dependsOn.join(", ")}` : "",
              reverseDependencies.length ? `Required by: ${reverseDependencies.join(", ")}` : "",
            ].filter(Boolean).join(" | ")}
            sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {[
              service.dependsOn?.length ? `Depends on: ${service.dependsOn.join(", ")}` : "",
              reverseDependencies.length ? `Required by: ${reverseDependencies.join(", ")}` : "",
            ].filter(Boolean).join(" | ")}
          </Typography>
        ) : null}

        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 0.5, mt: "auto" }}>
          <Typography variant="caption" color={status.error ? "error.main" : "text.secondary"} noWrap>
            {isBusy ? status.message : ""}
          </Typography>
          <Stack direction="row" spacing={0}>
            <Tooltip title={canStart ? "Start" : isBusy ? "Service is busy" : "Service is already running"}>
              <span>
                <IconButton size="small" color="primary" aria-label={`Start ${service.name}`} onClick={() => onAction(service.name, "start")} disabled={!canStart}>
                  <PlayArrowIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={canStop ? "Stop" : isBusy ? "Service is busy" : "Service is already stopped"}>
              <span>
                <IconButton size="small" color="error" aria-label={`Stop ${service.name}`} onClick={() => onAction(service.name, "stop")} disabled={!canStop}>
                  <StopIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={canRestart ? "Restart" : "Service is busy"}>
              <span>
                <IconButton size="small" aria-label={`Restart ${service.name}`} onClick={() => onAction(service.name, "restart")} disabled={!canRestart}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="View logs">
              <IconButton size="small" aria-label={`View logs for ${service.name}`} onClick={() => onViewLogs(service.name)}>
                <LaunchIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

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
