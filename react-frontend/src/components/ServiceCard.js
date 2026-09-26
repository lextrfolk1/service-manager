import React, { useState, useMemo } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
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
  ArrowDropDown as ArrowDropDownIcon,
  Check as CheckIcon,
  ContentCopy as ContentCopyIcon,
  Description as DescriptionIcon,
  DownloadRounded as DownloadRoundedIcon,
  FavoriteBorderRounded as FavoriteBorderIcon,
  Language as LanguageIcon,
  Launch as LaunchIcon,
  MenuBookRounded as MenuBookIcon,
  MoreVert as MoreVertIcon,
  OpenInNew as OpenInNewIcon,
  PlayArrowRounded as PlayArrowIcon,
  RefreshRounded as RefreshIcon,
  Settings as SettingsIcon,
  SpeedRounded as SpeedIcon,
  StopRounded as StopIcon,
  Memory as MemoryIcon,
  AccessTime as AccessTimeIcon,
  WarningAmber as WarningAmberIcon,
} from "@mui/icons-material";
import StatusChip from "./StatusChip";
import BranchSelector from "./BranchSelector";
import { getServiceLinks, getDocsLabel, isFrontendService } from "../utils/serviceUtils";

function ServiceCard({
  service,
  status,
  reverseDependencies = [],
  isMoving,
  isDraggable = true,
  showGroup = false,
  showGitBranches = true,
  showLiveMetrics = false,
  metrics = null,
  isSelected,
  onSelect,
  onAction,
  onBranchCheckout,
  onGitPull,
  onFreePort,
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
  const [linksAnchorEl, setLinksAnchorEl] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isFreeingPort, setIsFreeingPort] = useState(false);
  const isLinksOpen = Boolean(linksAnchorEl);

  const hasPortConflict = Boolean(status?.portConflict?.hasConflict);
  const portConflict = status?.portConflict;

  const links = useMemo(() => getServiceLinks(service), [service]);
  const primaryDocsLink = links.find((l) => l.isDocs);
  const healthLink = links.find((l) => l.isHealth);
  const isNonHttp = links[0]?.isCopyOnly;
  const isFrontend = useMemo(() => isFrontendService(service), [service]);
  const docsBadgeLabel = useMemo(() => getDocsLabel(service), [service]);

  const handleCopyUrl = (url, event) => {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleFreePort = async (event) => {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (!onFreePort) return;
    setIsFreeingPort(true);
    try {
      await onFreePort(service.name);
    } finally {
      setIsFreeingPort(false);
    }
  };

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
        borderColor: hasPortConflict
          ? "error.main"
          : status.error
          ? "error.light"
          : status.running
          ? "rgba(34, 197, 94, 0.35)"
          : "rgba(148, 163, 184, 0.22)",
        borderRadius: 2.5,
        backgroundColor: "#ffffff",
        boxShadow: hasPortConflict
          ? "0 2px 10px rgba(239, 68, 68, 0.12)"
          : status.running
          ? "0 2px 8px rgba(34, 197, 94, 0.08)"
          : "0 1px 3px rgba(15, 23, 42, 0.04)",
        transition: "all 0.18s ease-in-out",
        "&:hover": {
          boxShadow: hasPortConflict
            ? "0 6px 18px rgba(239, 68, 68, 0.18)"
            : "0 6px 16px rgba(15, 23, 42, 0.08)",
          borderColor: hasPortConflict
            ? "error.dark"
            : status.error
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
        {hasPortConflict && portConflict ? (
          <MenuItem
            onClick={(e) => {
              setMenuAnchorEl(null);
              handleFreePort(e);
            }}
            disabled={isFreeingPort}
            sx={{
              py: 0.75,
              bgcolor: "rgba(239, 68, 68, 0.08)",
              "&:hover": { bgcolor: "rgba(239, 68, 68, 0.16)" },
            }}
          >
            <ListItemIcon sx={{ minWidth: 28, color: "error.main" }}>
              <WarningAmberIcon fontSize="small" sx={{ fontSize: 16 }} />
            </ListItemIcon>
            <ListItemText
              primary={isFreeingPort ? "Freeing port..." : `Kill & Free Port ${portConflict.port}`}
              secondary={`Terminate PID ${portConflict.pid}${portConflict.command ? ` (${portConflict.command})` : ""}`}
              primaryTypographyProps={{ fontSize: "0.82rem", fontWeight: 700, color: "error.main" }}
              secondaryTypographyProps={{ fontSize: "0.68rem", color: "error.dark" }}
            />
          </MenuItem>
        ) : null}

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

        {service.enableGit !== false && status.git?.isGitRepo ? (
          <MenuItem
            onClick={() => {
              setMenuAnchorEl(null);
              if (onGitPull) onGitPull(service.name);
            }}
            sx={{ py: 0.75 }}
          >
            <ListItemIcon sx={{ minWidth: 28 }}>
              <DownloadRoundedIcon fontSize="small" sx={{ fontSize: 16 }} />
            </ListItemIcon>
            <ListItemText primary="Git Pull" primaryTypographyProps={{ fontSize: "0.82rem" }} />
          </MenuItem>
        ) : null}

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

        {status.running && service.port ? (
          <>
            <Divider sx={{ my: 0.5 }} />
            <MenuItem
              component="a"
              href={`http://localhost:${service.port}/`}
              target="_blank"
              rel="noreferrer"
              onClick={() => setMenuAnchorEl(null)}
              sx={{ py: 0.75 }}
            >
              <ListItemIcon sx={{ minWidth: 28 }}>
                <LanguageIcon fontSize="small" sx={{ fontSize: 16, color: "primary.main" }} />
              </ListItemIcon>
              <ListItemText
                primary="Open Web UI / Root"
                secondary={`localhost:${service.port}`}
                primaryTypographyProps={{ fontSize: "0.82rem" }}
                secondaryTypographyProps={{ fontSize: "0.68rem" }}
              />
              <OpenInNewIcon sx={{ fontSize: 12, color: "text.disabled", ml: 0.5 }} />
            </MenuItem>

            {primaryDocsLink ? (
              <MenuItem
                component="a"
                href={primaryDocsLink.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => setMenuAnchorEl(null)}
                sx={{ py: 0.75 }}
              >
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <MenuBookIcon fontSize="small" sx={{ fontSize: 16, color: "#4f46e5" }} />
                </ListItemIcon>
                <ListItemText
                  primary={primaryDocsLink.label}
                  secondary={primaryDocsLink.path}
                  primaryTypographyProps={{ fontSize: "0.82rem", color: "#4f46e5", fontWeight: 600 }}
                  secondaryTypographyProps={{ fontSize: "0.68rem" }}
                />
                <OpenInNewIcon sx={{ fontSize: 12, color: "text.disabled", ml: 0.5 }} />
              </MenuItem>
            ) : null}

            {healthLink ? (
              <MenuItem
                component="a"
                href={healthLink.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => setMenuAnchorEl(null)}
                sx={{ py: 0.75 }}
              >
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <FavoriteBorderIcon fontSize="small" sx={{ fontSize: 16, color: "#166534" }} />
                </ListItemIcon>
                <ListItemText
                  primary="Health Endpoint"
                  secondary={healthLink.path}
                  primaryTypographyProps={{ fontSize: "0.82rem" }}
                  secondaryTypographyProps={{ fontSize: "0.68rem" }}
                />
                <OpenInNewIcon sx={{ fontSize: 12, color: "text.disabled", ml: 0.5 }} />
              </MenuItem>
            ) : null}
          </>
        ) : null}
      </Menu>

      {/* Direct App & API Links Dropdown Menu */}
      <Menu
        anchorEl={linksAnchorEl}
        open={isLinksOpen}
        onClose={() => setLinksAnchorEl(null)}
        onClick={(event) => event.stopPropagation()}
        transformOrigin={{ horizontal: "left", vertical: "top" }}
        anchorOrigin={{ horizontal: "left", vertical: "bottom" }}
        PaperProps={{
          sx: {
            minWidth: 270,
            maxWidth: 340,
            borderRadius: 2.5,
            boxShadow: "0 10px 30px rgba(15,23,42,0.16)",
            p: 0.5,
          },
        }}
      >
        <Box
          sx={{
            px: 1.5,
            py: 1,
            mb: 0.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            bgcolor: "rgba(15, 23, 42, 0.03)",
            borderRadius: 1.5,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" sx={{ fontSize: "0.68rem", fontWeight: 700, color: "text.secondary", display: "block" }}>
              APP & API ENDPOINTS
            </Typography>
            <Typography variant="body2" sx={{ fontSize: "0.78rem", fontWeight: 600, fontFamily: "monospace" }} noWrap>
              http://localhost:{service.port}
            </Typography>
          </Box>
          <Tooltip title={copiedLink ? "Copied!" : "Copy base URL"}>
            <IconButton
              size="small"
              onClick={(e) => handleCopyUrl(`http://localhost:${service.port}`, e)}
              sx={{ p: 0.5, ml: 1, color: copiedLink ? "success.main" : "text.secondary" }}
            >
              {copiedLink ? <CheckIcon sx={{ fontSize: 16 }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>
        </Box>

        {links.map((link) => {
          const isDocs = link.isDocs;
          const isHealth = link.isHealth;
          const isSpec = link.isSpec;

          return (
            <MenuItem
              key={link.id}
              component="a"
              href={link.url}
              target="_blank"
              rel="noreferrer"
              onClick={() => setLinksAnchorEl(null)}
              sx={{
                py: 0.75,
                px: 1.25,
                borderRadius: 1.5,
                mb: 0.25,
                "&:hover": {
                  bgcolor: isDocs
                    ? "rgba(99, 102, 241, 0.08)"
                    : isHealth
                    ? "rgba(34, 197, 94, 0.08)"
                    : "rgba(15, 23, 42, 0.04)",
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 28 }}>
                {isDocs ? (
                  <MenuBookIcon sx={{ fontSize: 17, color: "#4f46e5" }} />
                ) : isHealth ? (
                  <FavoriteBorderIcon sx={{ fontSize: 17, color: "#166534" }} />
                ) : isSpec ? (
                  <DescriptionIcon sx={{ fontSize: 17, color: "text.secondary" }} />
                ) : (
                  <LanguageIcon sx={{ fontSize: 17, color: "primary.main" }} />
                )}
              </ListItemIcon>
              <ListItemText
                primary={link.label}
                secondary={link.path}
                primaryTypographyProps={{
                  fontSize: "0.8rem",
                  fontWeight: isDocs || link.isRoot ? 600 : 500,
                  color: isDocs ? "#4f46e5" : "text.primary",
                }}
                secondaryTypographyProps={{
                  fontSize: "0.68rem",
                  fontFamily: "monospace",
                  color: "text.secondary",
                  noWrap: true,
                }}
              />
              <OpenInNewIcon sx={{ fontSize: 13, color: "text.disabled", ml: 1, flexShrink: 0 }} />
            </MenuItem>
          );
        })}
      </Menu>

      {/* Port Conflict Warning Banner */}
      {hasPortConflict && portConflict ? (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 0.75,
            p: 0.6,
            px: 1,
            mb: 1,
            borderRadius: 1.5,
            bgcolor: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, minWidth: 0, flex: 1 }}>
            <WarningAmberIcon sx={{ fontSize: 16, color: "error.main", flexShrink: 0 }} />
            <Tooltip
              title={`Port ${portConflict.port} is blocked by process PID ${portConflict.pid}${portConflict.command ? ` (${portConflict.command})` : ""}`}
            >
              <Typography
                variant="caption"
                sx={{
                  fontSize: "0.72rem",
                  fontWeight: 650,
                  color: "error.dark",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                Port {portConflict.port} in use by PID {portConflict.pid}
                {portConflict.command ? ` (${portConflict.command})` : ""}
              </Typography>
            </Tooltip>
          </Box>
          <Button
            size="small"
            variant="contained"
            color="error"
            disabled={isFreeingPort}
            onClick={handleFreePort}
            sx={{
              py: 0.2,
              px: 0.9,
              fontSize: "0.68rem",
              fontWeight: 700,
              minWidth: 0,
              textTransform: "none",
              boxShadow: "none",
              whiteSpace: "nowrap",
              borderRadius: 1,
              flexShrink: 0,
            }}
          >
            {isFreeingPort ? "Freeing..." : "Kill & Free Port"}
          </Button>
        </Box>
      ) : null}

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
          isNonHttp ? (
            <Tooltip title={copiedLink ? "Copied!" : `Click to copy localhost:${service.port}`}>
              <Chip
                label={`:${service.port}`}
                size="small"
                variant="outlined"
                onClick={(e) => handleCopyUrl(`localhost:${service.port}`, e)}
                clickable
                sx={{
                  height: 20,
                  fontSize: "0.68rem",
                  fontFamily: "monospace",
                  color: "text.secondary",
                  borderColor: "rgba(148, 163, 184, 0.3)",
                  "&:hover": {
                    borderColor: "primary.main",
                    color: "primary.main",
                  },
                }}
              />
            </Tooltip>
          ) : (
            <>
              {/* Port & Direct Links Dropdown Chip */}
              <Tooltip
                title={
                  hasPortConflict
                    ? `Port ${service.port} blocked by PID ${portConflict?.pid}${portConflict?.command ? ` (${portConflict.command})` : ""}`
                    : `Open App & API Links (port ${service.port})${!status.running ? " - Service stopped" : ""}`
                }
              >
                <Chip
                  label={`:${service.port}`}
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation();
                    setLinksAnchorEl(event.currentTarget);
                  }}
                  deleteIcon={
                    <ArrowDropDownIcon
                      sx={{ fontSize: "15px !important", color: "inherit !important", ml: "-4px !important" }}
                    />
                  }
                  onDelete={(event) => {
                    event.stopPropagation();
                    setLinksAnchorEl(event.currentTarget.parentElement || event.currentTarget);
                  }}
                  clickable
                  sx={{
                    height: 20,
                    fontSize: "0.68rem",
                    fontFamily: "monospace",
                    fontWeight: 600,
                    backgroundColor: hasPortConflict
                      ? "rgba(239, 68, 68, 0.08)"
                      : status.running
                      ? "rgba(34, 197, 94, 0.1)"
                      : "rgba(15, 23, 42, 0.04)",
                    color: hasPortConflict
                      ? "#dc2626"
                      : status.running
                      ? "#166534"
                      : "text.secondary",
                    border: "1px solid",
                    borderColor: hasPortConflict
                      ? "#ef4444"
                      : status.running
                      ? "rgba(34, 197, 94, 0.35)"
                      : "rgba(148, 163, 184, 0.3)",
                    "& .MuiChip-deleteIcon": { mr: 0.25 },
                    "&:hover": {
                      backgroundColor: hasPortConflict
                        ? "rgba(239, 68, 68, 0.16)"
                        : status.running
                        ? "rgba(34, 197, 94, 0.2)"
                        : "rgba(15, 23, 42, 0.08)",
                      borderColor: hasPortConflict ? "error.main" : status.running ? "rgba(34, 197, 94, 0.7)" : "primary.main",
                      color: hasPortConflict ? "#b91c1c" : status.running ? "#14532d" : "text.primary",
                    },
                  }}
                />
              </Tooltip>

              {/* If Port Conflict: Quick Kill & Free Port Chip */}
              {hasPortConflict ? (
                <Tooltip title={`Kill process PID ${portConflict?.pid} and free port ${service.port}`}>
                  <Chip
                    label={isFreeingPort ? "Freeing..." : "Free Port"}
                    size="small"
                    color="error"
                    clickable
                    disabled={isFreeingPort}
                    onClick={handleFreePort}
                    icon={<WarningAmberIcon sx={{ fontSize: "11px !important" }} />}
                    sx={{
                      height: 20,
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      "& .MuiChip-icon": { ml: 0.5, mr: -0.25 },
                    }}
                  />
                </Tooltip>
              ) : primaryDocsLink ? (
                /* Dedicated 1-Click Swagger / Docs Chip */
                <Tooltip
                  title={`Open ${primaryDocsLink.label}: ${primaryDocsLink.url}${!status.running ? " (service stopped)" : ""}`}
                >
                  <Chip
                    label={docsBadgeLabel}
                    size="small"
                    component="a"
                    href={primaryDocsLink.url}
                    target="_blank"
                    rel="noreferrer"
                    clickable
                    icon={<MenuBookIcon sx={{ fontSize: "11px !important" }} />}
                    sx={{
                      height: 20,
                      fontSize: "0.68rem",
                      fontWeight: 600,
                      backgroundColor: status.running ? "rgba(99, 102, 241, 0.09)" : "rgba(15, 23, 42, 0.03)",
                      color: status.running ? "#4f46e5" : "text.secondary",
                      border: "1px solid",
                      borderColor: status.running ? "rgba(99, 102, 241, 0.25)" : "rgba(148, 163, 184, 0.25)",
                      "& .MuiChip-icon": {
                        ml: 0.5,
                        mr: -0.25,
                        color: status.running ? "#4f46e5" : "inherit",
                      },
                      "&:hover": {
                        backgroundColor: status.running ? "rgba(99, 102, 241, 0.18)" : "rgba(99, 102, 241, 0.08)",
                        borderColor: "#4f46e5",
                        color: "#4f46e5",
                        "& .MuiChip-icon": { color: "#4f46e5" },
                      },
                    }}
                  />
                </Tooltip>
              ) : isFrontend ? (
                <Tooltip
                  title={`Open Web Application: http://localhost:${service.port}/${!status.running ? " (service stopped)" : ""}`}
                >
                  <Chip
                    label="Web UI"
                    size="small"
                    component="a"
                    href={`http://localhost:${service.port}/`}
                    target="_blank"
                    rel="noreferrer"
                    clickable
                    icon={<OpenInNewIcon sx={{ fontSize: "11px !important" }} />}
                    sx={{
                      height: 20,
                      fontSize: "0.68rem",
                      fontWeight: 600,
                      backgroundColor: status.running ? "rgba(14, 165, 233, 0.09)" : "rgba(15, 23, 42, 0.03)",
                      color: status.running ? "#0284c7" : "text.secondary",
                      border: "1px solid",
                      borderColor: status.running ? "rgba(14, 165, 233, 0.25)" : "rgba(148, 163, 184, 0.25)",
                      "& .MuiChip-icon": {
                        ml: 0.5,
                        mr: -0.25,
                        color: status.running ? "#0284c7" : "inherit",
                      },
                      "&:hover": {
                        backgroundColor: status.running ? "rgba(14, 165, 233, 0.18)" : "rgba(14, 165, 233, 0.08)",
                        borderColor: "#0284c7",
                        color: "#0284c7",
                        "& .MuiChip-icon": { color: "#0284c7" },
                      },
                    }}
                  />
                </Tooltip>
              ) : null}
            </>
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

      {/* 3.5 Live Resource Monitoring (CPU, RAM & Uptime) */}
      {/* 3.5 Live Resource Monitoring (CPU, RAM & Uptime) */}
      {showLiveMetrics && status.running && metrics ? (() => {
        const cpuVal = parseFloat(metrics.cpuPercent) || 0;
        const memMB = (metrics.memoryBytes || 0) / (1024 * 1024);
        const cpuColor = cpuVal > 80 ? '#ef4444' : cpuVal > 40 ? '#f59e0b' : '#10b981';
        const memColor = memMB > 512 ? '#ef4444' : memMB > 256 ? '#f59e0b' : '#3b82f6';
        const metricBadge = (icon, label, value, accentColor) => (
          <Tooltip title={`${label}: ${value}`} arrow placement="top">
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.4,
                px: 0.75,
                py: 0.3,
                borderRadius: '8px',
                bgcolor: `${accentColor}0D`,
                border: '1px solid',
                borderColor: `${accentColor}28`,
                transition: 'all 0.25s ease',
                cursor: 'default',
                '&:hover': {
                  bgcolor: `${accentColor}1A`,
                  borderColor: `${accentColor}40`,
                  transform: 'translateY(-1px)',
                  boxShadow: `0 2px 8px ${accentColor}18`,
                },
              }}
            >
              {React.cloneElement(icon, {
                sx: { fontSize: 12, color: accentColor, flexShrink: 0, opacity: 0.85 },
              })}
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  color: accentColor,
                  letterSpacing: '-0.01em',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  fontFeatureSettings: '"tnum"',
                }}
              >
                {value}
              </Typography>
            </Box>
          </Tooltip>
        );
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75, flexWrap: 'wrap' }}>
            {metricBadge(<MemoryIcon />, 'Memory', metrics.memoryFormatted, memColor)}
            {metricBadge(<SpeedIcon />, 'CPU', metrics.cpuFormatted, cpuColor)}
            {metricBadge(<AccessTimeIcon />, 'Uptime', metrics.uptimeFormatted, '#64748b')}
          </Box>
        );
      })() : null}

      {/* 4. Git Branch Selector */}
      {showGitBranches && service.enableGit !== false && status.git?.isGitRepo ? (
        <Box sx={{ mb: 1 }}>
          <BranchSelector
            serviceName={service.name}
            gitInfo={status.git}
            isRunning={status.running}
            isBusy={isBusy}
            onBranchCheckout={onBranchCheckout}
            onGitPull={onGitPull}
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
              <Stack direction="row" spacing={0.5} alignItems="center">
                {hasPortConflict ? (
                  <Button
                    color="inherit"
                    size="small"
                    disabled={isFreeingPort}
                    onClick={handleFreePort}
                    sx={{ fontWeight: 700, textTransform: "none", fontSize: "0.68rem" }}
                  >
                    {isFreeingPort ? "Freeing..." : "Free Port"}
                  </Button>
                ) : null}
                <Button color="inherit" size="small" onClick={() => onViewLogs(service.name)}>
                  Logs
                </Button>
              </Stack>
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
