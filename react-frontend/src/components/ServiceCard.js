import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AccountTree as AccountTreeIcon,
  ContentCopy as ContentCopyIcon,
  Launch as LaunchIcon,
  MoreVert as MoreVertIcon,
  OpenInNew as OpenInNewIcon,
  PlayArrowRounded as PlayArrowIcon,
  RefreshRounded as RefreshIcon,
  Settings as SettingsIcon,
  StopRounded as StopIcon,
} from "@mui/icons-material";
import StatusChip from "./StatusChip";
import BranchSelector from "./BranchSelector";

function ServiceCard({
  service,
  status,
  reverseDependencies = [],
  isMoving,
  isDraggable = true,
  showGroup = false,
  showGitBranches = true,
  isSelected,
  onSelect,
  onAction,
  onBranchCheckout,
  onViewLogs,
  onCloneService,
  onEditInAdmin,
  onDragStart,
  onDragEnd,
}) {
  const isBusy = ["queued", "waiting", "starting", "stopping"].includes(status.lifecycleState);
  const canStart = !isBusy && !status.running;
  const canStop = !isBusy && status.running;
  const canRestart = !isBusy;
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const isMenuOpen = Boolean(menuAnchorEl);

  return (
    <Paper
      elevation={0}
      draggable={isDraggable && !isMoving}
      onDragStart={
        isDraggable
          ? (event) => {
              event.dataTransfer.setData("text/plain", service.name);
              event.dataTransfer.effectAllowed = "move";
              onDragStart(service.name);
            }
          : undefined
      }
      onDragEnd={isDraggable ? onDragEnd : undefined}
      sx={{
        p: 1.5,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        cursor: isMoving ? "progress" : isDraggable ? "grab" : "default",
        opacity: isMoving ? 0.6 : 1,
        ...(isDraggable ? { "&:active": { cursor: "grabbing" } } : {}),
        border: "1px solid",
        borderColor: status.error
          ? "error.light"
          : status.running
          ? "rgba(34, 197, 94, 0.35)"
          : "rgba(148, 163, 184, 0.22)",
        borderRadius: 2.5,
        backgroundColor: "#ffffff",
        boxShadow: status.running
          ? "0 2px 8px rgba(34, 197, 94, 0.08)"
          : "0 1px 3px rgba(15, 23, 42, 0.04)",
        transition: "all 0.18s ease-in-out",
        "&:hover": {
          boxShadow: "0 6px 16px rgba(15, 23, 42, 0.08)",
          borderColor: status.error
            ? "error.main"
            : status.running
            ? "rgba(34, 197, 94, 0.6)"
            : "primary.main",
        },
      }}
    >
      {/* 1. Header: Selection Checkbox + Service Title + StatusChip */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          mb: 0.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0, flex: 1 }}>
          <Checkbox
            size="small"
            checked={isSelected === true}
            onChange={(event) => onSelect(event.target.checked)}
            inputProps={{ "aria-label": `Select ${service.name}` }}
            sx={{ p: 0, flexShrink: 0 }}
          />
          <Tooltip title={service.name} enterDelay={500}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 750,
                fontSize: "0.88rem",
                textTransform: "uppercase",
                letterSpacing: "0.025em",
                mt: "-2px",
                lineHeight: 1.2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {service.name}
            </Typography>
          </Tooltip>
        </Box>

        <Box sx={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 0.25 }}>
          <StatusChip
            state={status.lifecycleState}
            label={status.lifecycleLabel}
            sx={{ height: 21, fontSize: "0.68rem", px: 0.25 }}
          />
          <Tooltip title="Options">
            <IconButton
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                setMenuAnchorEl(event.currentTarget);
              }}
              aria-label={`Options for ${service.name}`}
              sx={{
                p: 0.25,
                borderRadius: 1,
                color: "text.secondary",
                "&:hover": { color: "text.primary", bgcolor: "rgba(0,0,0,0.06)" },
              }}
            >
              <MoreVertIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* 3-dots Context Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={isMenuOpen}
        onClose={() => setMenuAnchorEl(null)}
        onClick={(event) => event.stopPropagation()}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        PaperProps={{
          sx: {
            minWidth: 175,
            borderRadius: 2,
            boxShadow: "0 10px 30px rgba(15,23,42,0.14)",
            py: 0.5,
          },
        }}
      >
        <MenuItem
          onClick={() => {
            setMenuAnchorEl(null);
            if (onCloneService) onCloneService(service);
          }}
          sx={{ py: 0.75 }}
        >
          <ListItemIcon sx={{ minWidth: 28 }}>
            <ContentCopyIcon fontSize="small" sx={{ fontSize: 16 }} />
          </ListItemIcon>
          <ListItemText primary="Clone in Admin" primaryTypographyProps={{ fontSize: "0.82rem", fontWeight: 600 }} />
        </MenuItem>

        <MenuItem
          onClick={() => {
            setMenuAnchorEl(null);
            if (onEditInAdmin) onEditInAdmin(service);
          }}
          sx={{ py: 0.75 }}
        >
          <ListItemIcon sx={{ minWidth: 28 }}>
            <SettingsIcon fontSize="small" sx={{ fontSize: 16 }} />
          </ListItemIcon>
          <ListItemText primary="Configure in Admin" primaryTypographyProps={{ fontSize: "0.82rem" }} />
        </MenuItem>

        <MenuItem
          onClick={() => {
            setMenuAnchorEl(null);
            if (onViewLogs) onViewLogs(service.name);
          }}
          sx={{ py: 0.75 }}
        >
          <ListItemIcon sx={{ minWidth: 28 }}>
            <LaunchIcon fontSize="small" sx={{ fontSize: 16 }} />
          </ListItemIcon>
          <ListItemText primary="View Logs" primaryTypographyProps={{ fontSize: "0.82rem" }} />
        </MenuItem>
      </Menu>

      {/* 2. Description (Consistent 2-line height for grid alignment) */}
      <Tooltip title={service.description || "No description provided"} enterDelay={600}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            lineHeight: 1.35,
            minHeight: "2.7em",
            fontSize: "0.75rem",
            mb: 1,
          }}
        >
          {service.description || "No description provided"}
        </Typography>
      </Tooltip>

      {/* 3. Metadata Tags ("tabls") */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "center", mb: 1 }}>
        {status.running && status.healthLabel ? (
          <StatusChip
            state={status.healthState}
            label={status.healthLabel}
            sx={{ height: 20, fontSize: "0.68rem" }}
          />
        ) : null}

        {showGroup && service.group ? (
          <Chip
            label={service.group}
            size="small"
            sx={{
              height: 20,
              fontSize: "0.68rem",
              fontWeight: 500,
              backgroundColor: "rgba(15, 23, 42, 0.05)",
              color: "text.primary",
            }}
          />
        ) : null}

        <Chip
          label={service.type || "unknown"}
          size="small"
          variant="outlined"
          sx={{
            height: 20,
            fontSize: "0.68rem",
            color: "text.secondary",
            borderColor: "rgba(148, 163, 184, 0.3)",
          }}
        />

        {service.port ? (
          status.running ? (
            <Tooltip title={`Open http://localhost:${service.port}`}>
              <Chip
                label={`:${service.port}`}
                size="small"
                component="a"
                href={`http://localhost:${service.port}`}
                target="_blank"
                rel="noreferrer"
                clickable
                icon={<OpenInNewIcon sx={{ fontSize: "11px !important" }} />}
                sx={{
                  height: 20,
                  fontSize: "0.68rem",
                  fontFamily: "monospace",
                  fontWeight: 600,
                  backgroundColor: "rgba(34, 197, 94, 0.1)",
                  color: "#166534",
                  border: "1px solid rgba(34, 197, 94, 0.3)",
                  "& .MuiChip-icon": { ml: 0.5, mr: -0.25 },
                  "&:hover": {
                    backgroundColor: "rgba(34, 197, 94, 0.2)",
                  },
                }}
              />
            </Tooltip>
          ) : (
            <Chip
              label={`:${service.port}`}
              size="small"
              variant="outlined"
              sx={{
                height: 20,
                fontSize: "0.68rem",
                fontFamily: "monospace",
                color: "text.secondary",
                borderColor: "rgba(148, 163, 184, 0.3)",
              }}
            />
          )
        ) : null}

        {service.hasBuild ? (
          <Chip
            label="Build"
            size="small"
            variant="outlined"
            color="warning"
            sx={{ height: 20, fontSize: "0.68rem", fontWeight: 600 }}
          />
        ) : null}
      </Box>

      {/* 4. Git Branch Selector */}
      {showGitBranches && service.enableGit !== false && status.git?.isGitRepo ? (
        <Box sx={{ mb: 1 }}>
          <BranchSelector
            serviceName={service.name}
            gitInfo={status.git}
            isRunning={status.running}
            isBusy={isBusy}
            onBranchCheckout={onBranchCheckout}
            fullWidth
          />
        </Box>
      ) : null}

      {/* 5. Footer: Context / Busy Message + Action Buttons */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 0.5,
          mt: "auto",
          pt: 0.75,
          borderTop: "1px solid",
          borderColor: "rgba(148, 163, 184, 0.15)",
          minHeight: 32,
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1, display: "flex", alignItems: "center" }}>
          {isBusy ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
              <CircularProgress size={12} thickness={5} />
              <Typography
                variant="caption"
                sx={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  color: "primary.main",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {status.message || "Working..."}
              </Typography>
            </Box>
          ) : (service.dependsOn?.length || reverseDependencies.length) ? (
            <Tooltip
              title={[
                service.dependsOn?.length ? `Depends on: ${service.dependsOn.join(", ")}` : "",
                reverseDependencies.length ? `Required by: ${reverseDependencies.join(", ")}` : "",
              ]
                .filter(Boolean)
                .join(" | ")}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  fontSize: "0.7rem",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  cursor: "default",
                }}
              >
                <AccountTreeIcon sx={{ fontSize: 13, opacity: 0.55, flexShrink: 0 }} />
                <span>
                  {service.dependsOn?.length
                    ? `deps (${service.dependsOn.length})`
                    : `req by (${reverseDependencies.length})`}
                </span>
              </Typography>
            </Tooltip>
          ) : (
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.7rem" }} noWrap>
              {status.running ? "Active" : "Idle"}
            </Typography>
          )}
        </Box>

        <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
          <Tooltip title={canStart ? "Start service" : isBusy ? "Service is busy" : "Service is already running"}>
            <span>
              <IconButton
                size="small"
                color="primary"
                aria-label={`Start ${service.name}`}
                onClick={() => onAction(service.name, "start")}
                disabled={!canStart}
                sx={{
                  p: 0.5,
                  borderRadius: 1.5,
                  "&:hover": { bgcolor: "rgba(25, 118, 210, 0.08)" },
                }}
              >
                <PlayArrowIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title={canStop ? "Stop service" : isBusy ? "Service is busy" : "Service is already stopped"}>
            <span>
              <IconButton
                size="small"
                color="error"
                aria-label={`Stop ${service.name}`}
                onClick={() => onAction(service.name, "stop")}
                disabled={!canStop}
                sx={{
                  p: 0.5,
                  borderRadius: 1.5,
                  "&:hover": { bgcolor: "rgba(211, 47, 47, 0.08)" },
                }}
              >
                <StopIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title={canRestart ? "Restart service" : "Service is busy"}>
            <span>
              <IconButton
                size="small"
                aria-label={`Restart ${service.name}`}
                onClick={() => onAction(service.name, "restart")}
                disabled={!canRestart}
                sx={{
                  p: 0.5,
                  borderRadius: 1.5,
                  "&:hover": { bgcolor: "rgba(0, 0, 0, 0.06)" },
                }}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="View logs">
            <IconButton
              size="small"
              aria-label={`View logs for ${service.name}`}
              onClick={() => onViewLogs(service.name)}
              sx={{
                p: 0.5,
                borderRadius: 1.5,
                "&:hover": { bgcolor: "rgba(0, 0, 0, 0.06)" },
              }}
            >
              <LaunchIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* 6. Error Collapse */}
      <Collapse in={Boolean(status.error)}>
        {status.error ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => onViewLogs(service.name)}>
                Logs
              </Button>
            }
            sx={{
              mt: 1,
              borderRadius: 1.5,
              py: 0,
              px: 1,
              "& .MuiAlert-message": { fontSize: "0.72rem", py: 0.5 },
            }}
          >
            {status.error}
          </Alert>
        ) : null}
      </Collapse>
    </Paper>
  );
}

export default ServiceCard;
