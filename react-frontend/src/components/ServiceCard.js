import React, { useState, useMemo } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
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
  Check as CheckIcon,
  Code as CodeIcon,
  ContentCopy as ContentCopyIcon,
  CloudDownloadRounded as CloudDownloadIcon,
  FavoriteBorderRounded as FavoriteBorderIcon,
  KeyboardArrowDownRounded as KeyboardArrowDownIcon,
  Language as LanguageIcon,
  MenuBookRounded as MenuBookIcon,
  MoreVert as MoreVertIcon,
  OpenInNew as OpenInNewIcon,
  PlayArrowRounded as PlayArrowIcon,
  RefreshRounded as RefreshIcon,
  Settings as SettingsIcon,
  StorageRounded as StorageIcon,
  Tune as TuneIcon,
} from "@mui/icons-material";
import BranchSelector from "./BranchSelector";
import { CODE_FONT, STATUS_COLORS } from "../theme/tokens";
import { getServiceLinks, getDocsLabel, getHelpTopicForFailure, isFrontendService } from "../utils/serviceUtils";

function getServiceTypeIcon(type = "") {
  const t = type.toLowerCase();
  if (t === "database" || t === "redis" || t === "neo4j" || t === "postgresql" || t === "clickhouse") {
    return <StorageIcon sx={{ fontSize: 18, color: "#64748b" }} />;
  }
  if (t === "frontend" || t === "ui") {
    return <LanguageIcon sx={{ fontSize: 18, color: "#64748b" }} />;
  }
  return <CodeIcon sx={{ fontSize: 18, color: "#64748b" }} />;
}

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
  onGitPush,
  onEditRunConfig,
  runConfigCount = 0,
  buildMode = false,
  onFreePort,
  onViewLogs,
  onOpenHelp,
  onStartWithDependencies,
  onCloneService,
  onEditInAdmin,
  onDragStart,
  onDragEnd,
  layout = "compact",
}) {
  const isBusy = ["queued", "waiting", "starting", "stopping"].includes(status.lifecycleState);
  // Idle cards are visually dimmed so running (and failed / busy) services stand out in the grid.
  const isStopped = !status.running && !isBusy && !status.error;
  const canStart = !isBusy && !status.running;
  const canStop = !isBusy && status.running;
  const canRestart = !isBusy && status.running;

  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const isMenuOpen = Boolean(menuAnchorEl);
  const [linksAnchorEl, setLinksAnchorEl] = useState(null);
  const isLinksOpen = Boolean(linksAnchorEl);
  const [copiedLink, setCopiedLink] = useState(false);

  const links = useMemo(() => getServiceLinks(service), [service]);
  const primaryDocsLink = links.find((l) => l.isDocs);
  // Databases / listeners have no web endpoint; their menu offers the connection address to copy.
  const isNonHttp = links.length > 0 && links.every((l) => l.isCopyOnly);
  const baseAddress = isNonHttp ? links[0].url : `http://localhost:${service.port}`;
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

  // Status Badge styling mapping with distinct visual treatments for all states
  const statusInfo = useMemo(() => {
    if (status.error) {
      return { label: "Failed", bg: "#fef2f2", color: "#dc2626", border: "#fecaca", isTransitional: false };
    }
    if (status.lifecycleState === "starting") {
      const label = /^restart/i.test(status.message || "") ? "Restarting" : "Starting";
      return { label, bg: "#fffbeb", color: "#b45309", border: "#fef3c7", isTransitional: true };
    }
    if (status.lifecycleState === "stopping") {
      return { label: "Stopping", bg: "#fffbeb", color: "#b45309", border: "#fef3c7", isTransitional: true };
    }
    if (status.lifecycleState === "queued" || status.lifecycleState === "waiting") {
      return {
        label: status.lifecycleLabel || (status.lifecycleState === "queued" ? "Queued" : "Waiting"),
        bg: "#eff6ff",
        color: "#1d4ed8",
        border: "#dbeafe",
        isTransitional: true,
      };
    }
    if (status.running) {
      // Health in words when it's known, e.g. "Running · Unhealthy" (the dot alone was easy to miss).
      const health = status.healthState === "healthy" ? "Healthy" : status.healthState === "unhealthy" ? "Unhealthy" : "";
      return {
        label: health ? `Running · ${health}` : "Running",
        bg: health === "Unhealthy" ? "#fef2f2" : "#ecfdf3",
        color: health === "Unhealthy" ? "#b42318" : "#067647",
        border: health === "Unhealthy" ? "#fecaca" : "#abefc6",
        isTransitional: false,
      };
    }
    return { label: "Stopped", bg: "transparent", color: "#667085", border: "transparent", isTransitional: false };
  }, [status.error, status.running, status.healthState, status.lifecycleState, status.lifecycleLabel, status.message]);

  // Busy message tooltip & label
  const busyTooltip = useMemo(() => {
    if (!isBusy) return "";
    if (status.message) return status.message;
    if (status.lifecycleState === "starting") return "Service is starting...";
    if (status.lifecycleState === "stopping") return "Service is stopping...";
    if (status.lifecycleState === "waiting") return "Waiting for dependencies to start...";
    return "Service is queued...";
  }, [isBusy, status.message, status.lifecycleState]);

  // Live Resource Monitoring Strip with consistently aligned 3-column layout
  const renderLiveMetricsStrip = () => {
    if (!showLiveMetrics || !status.running || !metrics) return null;

    const cpuVal = parseFloat(metrics.cpuPercent) || 0;
    const cpuColor = cpuVal > 80 ? "#ef4444" : "#101828";

    return (
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 2,
          my: 1.5,
          flexShrink: 0,
        }}
      >
        <Box sx={{ minWidth: 0, textAlign: "left" }}>
          <Typography
            variant="caption"
            sx={{ fontSize: "0.75rem", color: "#667085", display: "block", lineHeight: 1.2, fontWeight: 500, mb: 0.35 }}
          >
            Memory
          </Typography>
          <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, color: "#101828", lineHeight: 1.2 }} noWrap>
            {metrics.memoryFormatted || "—"}
          </Typography>
        </Box>

        <Box sx={{ minWidth: 0, textAlign: "left" }}>
          <Typography
            variant="caption"
            sx={{ fontSize: "0.75rem", color: "#667085", display: "block", lineHeight: 1.2, fontWeight: 500, mb: 0.35 }}
          >
            CPU
          </Typography>
          <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, color: cpuColor, lineHeight: 1.2 }} noWrap>
            {metrics.cpuFormatted || "—"}
          </Typography>
        </Box>

        <Box sx={{ minWidth: 0, textAlign: "left" }}>
          <Typography
            variant="caption"
            sx={{ fontSize: "0.75rem", color: "#667085", display: "block", lineHeight: 1.2, fontWeight: 500, mb: 0.35 }}
          >
            Uptime
          </Typography>
          <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, color: "#101828", lineHeight: 1.2 }} noWrap>
            {metrics.uptimeFormatted || "—"}
          </Typography>
        </Box>
      </Box>
    );
  };

  const dependsOnCount = service.dependsOn?.length || 0;
  const requiredByCount = reverseDependencies?.length || 0;

  const dependencyTooltip = useMemo(() => {
    return [
      service.dependsOn?.length ? `Depends on: ${service.dependsOn.join(", ")}` : "",
      reverseDependencies?.length ? `Required by: ${reverseDependencies.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
  }, [service.dependsOn, reverseDependencies]);

  // Health is folded into the lifecycle pill as a dot (running services only)
  const healthDotColor = status.running
    ? { healthy: "#16a34a", unhealthy: "#dc2626", "port-open": "#64748b" }[status.healthState] || null
    : null;

  // Action Buttons (Primary Start/Stop + Secondary Circular Restart)
  const renderActionButtons = () =>
    isBusy ? (
      <Tooltip title={busyTooltip} placement="top" arrow>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, minWidth: 0, flex: "0 1 auto", overflow: "hidden" }}>
          <CircularProgress size={12} thickness={5} sx={{ color: "#d97706", flexShrink: 0 }} />
          <Typography
            variant="caption"
            sx={{
              fontSize: "0.74rem",
              fontWeight: 600,
              color: "#b45309",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
              overflow: "hidden",
            }}
          >
            {status.message || (status.lifecycleState === "stopping" ? "Stopping..." : "Starting...")}
          </Typography>
        </Box>
      </Tooltip>
    ) : (
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexShrink: 0 }}>
        {canStart ? (
          <Button
            variant="text"
            size="small"
            onClick={() => onAction(service.name, "start")}
            startIcon={<PlayArrowIcon sx={{ fontSize: 15 }} />}
            sx={{
              borderRadius: "20px",
              bgcolor: "rgba(25,118,210,0.08)",
              color: "#1565c0",
              textTransform: "none",
              fontSize: "0.8rem",
              fontWeight: 600,
              px: 2,
              height: 30,
              boxShadow: "none",
              "&:hover": { bgcolor: "rgba(25,118,210,0.16)" },
            }}
          >
            Start
          </Button>
        ) : canStop ? (
          <Button
            variant="outlined"
            size="small"
            onClick={() => onAction(service.name, "stop")}
            sx={{
              borderRadius: "20px",
              borderColor: "#d0d5dd",
              color: "#344054",
              bgcolor: "#ffffff",
              textTransform: "none",
              fontSize: "0.82rem",
              fontWeight: 600,
              px: 2.2,
              height: 30,
              boxShadow: "none",
              "&:hover": {
                borderColor: "#fda29b",
                color: "#d92d20",
                bgcolor: "rgba(217, 45, 32, 0.04)",
              },
            }}
          >
            Stop
          </Button>
        ) : null}

        {/* Secondary Action: Circular Restart button (running services only) */}
        {canRestart ? (
          <Tooltip title="Restart service" placement="top" arrow disableInteractive>
            <span>
              <IconButton
                size="small"
                aria-label={`Restart ${service.name}`}
                onClick={() => onAction(service.name, "restart")}
                disabled={!canRestart}
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  border: "1px solid #d0d5dd",
                  color: "#667085",
                  "&.Mui-disabled": { opacity: 0.4, borderColor: "#eaecf0" },
                  "&:hover": { bgcolor: "#f8fafc", borderColor: "#98a2b3", color: "#101828" },
                }}
              >
                <RefreshIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </span>
          </Tooltip>
        ) : null}
      </Stack>
    );

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
        p: 2,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        cursor: isMoving ? "progress" : isDraggable ? "grab" : "default",
        opacity: isMoving ? 0.6 : 1,
        ...(isDraggable ? { "&:active": { cursor: "grabbing" } } : {}),
        border: "1px solid",
        borderColor: status.error
          ? "rgba(239, 68, 68, 0.4)"
          : status.running
          ? "rgba(34, 197, 94, 0.4)"
          : isBusy
          ? "rgba(245, 158, 11, 0.35)"
          : "#eaecf0",
        borderRadius: "16px",
        backgroundColor: isStopped ? "#fafbfc" : "#ffffff",
        boxShadow: status.running
          ? `inset 4px 0 0 ${STATUS_COLORS.running}, 0 3px 12px rgba(34, 197, 94, 0.08)`
          : isBusy
          ? "0 3px 12px rgba(245, 158, 11, 0.07)"
          : "0 1px 3px rgba(15, 23, 42, 0.03)",
        transition: "all 0.2s ease-in-out",
        "&:hover": {
          boxShadow: status.running
            ? `inset 4px 0 0 ${STATUS_COLORS.running}, 0 6px 20px rgba(15, 23, 42, 0.08)`
            : "0 6px 20px rgba(15, 23, 42, 0.08)",
          borderColor: status.error
            ? "error.main"
            : status.running
            ? "rgba(34, 197, 94, 0.6)"
            : isBusy
            ? "warning.main"
            : "#cbd5e1",
        },
      }}
    >
      {/* 1. Header: Icon + Checkbox + Service Title + Status Pill (with health dot) + Overflow Menu */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1, mb: 0.5 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.75, minWidth: 0, flex: 1 }}>
          <Checkbox
            size="small"
            checked={isSelected === true}
            onChange={(event) => onSelect(event.target.checked)}
            inputProps={{ "aria-label": `Select ${service.name}` }}
            sx={{
              p: 0,
              mt: "1px",
              flexShrink: 0,
              opacity: isSelected ? 1 : 0.6,
              "&:hover": { opacity: 1 },
              transition: "opacity 0.15s ease",
            }}
          />
          <Box sx={{ flexShrink: 0, display: "flex", alignItems: "center", mt: "1px" }}>
            {getServiceTypeIcon(service.type)}
          </Box>
          <Tooltip title={service.name} placement="top" arrow disableInteractive>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 700,
                fontSize: "0.95rem",
                lineHeight: 1.25,
                color: isStopped ? STATUS_COLORS.stoppedText : "#101828",
                minWidth: 0,
                overflow: "hidden",
                overflowWrap: "anywhere",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {service.name}
            </Typography>
          </Tooltip>
        </Box>

        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexShrink: 0 }}>
          {/* Status Pill Badge: spinner for transitional states, health dot when running */}
          <Tooltip
            title={healthDotColor ? status.healthLabel || "" : ""}
            placement="top"
            arrow
           
            disableInteractive
          >
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.6,
                px: isStopped ? 0.25 : 1.25,
                py: 0.3,
                borderRadius: "12px",
                fontSize: "0.74rem",
                fontWeight: 600,
                bgcolor: statusInfo.bg,
                color: statusInfo.color,
                border: `1px solid ${statusInfo.border}`,
                lineHeight: 1,
              }}
            >
              {statusInfo.isTransitional ? (
                <CircularProgress size={10} thickness={6} color="inherit" sx={{ opacity: 0.9 }} />
              ) : status.running ? (
                <Box
                  component="span"
                  aria-label={status.healthLabel || status.healthState || "running"}
                  sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: healthDotColor || STATUS_COLORS.running, flexShrink: 0 }}
                />
              ) : isStopped ? (
                <Box
                  component="span"
                  aria-hidden
                  sx={{ width: 7, height: 7, borderRadius: "50%", border: `1.5px solid ${STATUS_COLORS.stopped}`, boxSizing: "border-box", flexShrink: 0 }}
                />
              ) : null}
              <span>{statusInfo.label}</span>
            </Box>
          </Tooltip>

          {/* Overflow Menu */}
          <IconButton
            size="small"
            onClick={(event) => {
              event.stopPropagation();
              setMenuAnchorEl(event.currentTarget);
            }}
            aria-label={`Options for ${service.name}`}
            sx={{ p: 0.25, color: "#64748b", "&:hover": { color: "#0f172a", bgcolor: "rgba(0,0,0,0.05)" } }}
          >
            <MoreVertIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Stack>
      </Box>

      {/* Overflow Menu Dropdown */}
      <Menu
        anchorEl={menuAnchorEl}
        open={isMenuOpen}
        onClose={() => setMenuAnchorEl(null)}
        onClick={(event) => event.stopPropagation()}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        PaperProps={{
          sx: {
            minWidth: 185,
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
          <ListItemText primary="Clone in Admin" primaryTypographyProps={{ fontSize: "0.82rem" }} />
        </MenuItem>

        {onEditRunConfig ? (
          <MenuItem
            onClick={() => {
              setMenuAnchorEl(null);
              onEditRunConfig(service.name);
            }}
            sx={{ py: 0.75 }}
          >
            <ListItemIcon sx={{ minWidth: 28 }}>
              <TuneIcon fontSize="small" sx={{ fontSize: 16 }} />
            </ListItemIcon>
            <ListItemText
              primary="Run configuration…"
              secondary={runConfigCount ? `${runConfigCount} value${runConfigCount === 1 ? "" : "s"} set` : "JVM options, arguments, env vars"}
              primaryTypographyProps={{ fontSize: "0.82rem" }}
              secondaryTypographyProps={{ fontSize: "0.7rem" }}
            />
          </MenuItem>
        ) : null}

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

        {!showGitBranches && service.enableGit !== false && status.git?.isGitRepo ? (
          <MenuItem
            onClick={() => {
              setMenuAnchorEl(null);
              if (onGitPull) onGitPull(service.name);
            }}
            sx={{ py: 0.75 }}
          >
            <ListItemIcon sx={{ minWidth: 28 }}>
              <CloudDownloadIcon fontSize="small" sx={{ fontSize: 16 }} />
            </ListItemIcon>
            <ListItemText primary="Git Pull" primaryTypographyProps={{ fontSize: "0.82rem" }} />
          </MenuItem>
        ) : null}
      </Menu>

      {/* App & API Endpoints Menu */}
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
              {isNonHttp ? "CONNECTION" : "APP & API ENDPOINTS"}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: "0.78rem", fontWeight: 600, fontFamily: CODE_FONT }} noWrap>
              {baseAddress}
            </Typography>
          </Box>
          <Tooltip title={copiedLink ? "Copied!" : isNonHttp ? "Copy address" : "Copy base URL"}>
            <IconButton
              size="small"
              aria-label={isNonHttp ? "Copy address" : "Copy base URL"}
              onClick={(e) => handleCopyUrl(baseAddress, e)}
              sx={{ p: 0.5, ml: 1, color: copiedLink ? "success.main" : "text.secondary" }}
            >
              {copiedLink ? <CheckIcon sx={{ fontSize: 16 }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>
        </Box>

        {links.map((link) => (
          <MenuItem
            key={link.id}
            {...(link.isCopyOnly
              ? { onClick: (event) => handleCopyUrl(link.url, event) }
              : { component: "a", href: link.url, target: "_blank", rel: "noreferrer", onClick: () => setLinksAnchorEl(null) })}
            sx={{ py: 0.75, px: 1.25, borderRadius: 1.5, mb: 0.25 }}
          >
            <ListItemIcon sx={{ minWidth: 28 }}>
              {link.isCopyOnly ? (
                <StorageIcon sx={{ fontSize: 17, color: "#64748b" }} />
              ) : link.isDocs ? (
                <MenuBookIcon sx={{ fontSize: 17, color: "#4f46e5" }} />
              ) : link.isHealth ? (
                <FavoriteBorderIcon sx={{ fontSize: 17, color: "#166534" }} />
              ) : (
                <LanguageIcon sx={{ fontSize: 17, color: "primary.main" }} />
              )}
            </ListItemIcon>
            <ListItemText
              primary={link.label}
              secondary={link.path}
              primaryTypographyProps={{ fontSize: "0.8rem", fontWeight: 600 }}
              secondaryTypographyProps={{ fontSize: "0.68rem", fontFamily: CODE_FONT, noWrap: true }}
            />
            {link.isCopyOnly ? (
              copiedLink ? (
                <CheckIcon sx={{ fontSize: 14, color: "success.main", ml: 1, flexShrink: 0 }} />
              ) : (
                <ContentCopyIcon sx={{ fontSize: 13, color: "text.disabled", ml: 1, flexShrink: 0 }} />
              )
            ) : (
              <OpenInNewIcon sx={{ fontSize: 13, color: "text.disabled", ml: 1, flexShrink: 0 }} />
            )}
          </MenuItem>
        ))}
      </Menu>

      {/* 2. Subheader Description: always one line high so cards in a row line up; blank when empty */}
      <Tooltip title={service.description || ""}>
        <Typography
          variant="body2"
          aria-hidden={service.description ? undefined : true}
          sx={{
            color: "#64748b",
            fontSize: "0.78rem",
            lineHeight: 1.35,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            mb: 1.25,
            flexShrink: 0,
          }}
        >
          {service.description || "\u00A0"}
        </Typography>
      </Tooltip>

      {/* 3. Soft Metadata Strip (Type, Port, Group, Config, Build, Dependencies) */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.6, alignItems: "center", mb: 1.5, flexShrink: 0 }}>
        {service.type ? (
          <Box
            sx={{
              px: 1.2,
              py: 0.2,
              borderRadius: "12px",
              bgcolor: "#f1f5f9",
              color: "#334155",
              fontSize: "0.74rem",
              fontWeight: 600,
              textTransform: "capitalize",
            }}
          >
            {service.type}
          </Box>
        ) : null}

        {service.port ? (
          // Split pill: the number copies the address in one click, the chevron opens the links menu.
          <Box
            component="span"
            sx={{
              display: "inline-flex",
              alignItems: "stretch",
              borderRadius: "12px",
              bgcolor: "#f1f5f9",
              color: "#334155",
              fontSize: "0.74rem",
              fontWeight: 600,
              fontFamily: CODE_FONT,
              overflow: "hidden",
              "& > span > button, & > button": {
                border: "none",
                background: "none",
                color: "inherit",
                font: "inherit",
                cursor: "pointer",
                transition: "background-color 0.15s ease",
                "&:hover": { bgcolor: "#e2e8f0", color: "#101828" },
              },
            }}
          >
            <Tooltip title={copiedLink ? "Copied!" : `Copy ${isNonHttp ? baseAddress : `localhost:${service.port}`}`} placement="top" arrow disableInteractive>
              <Box
                component="button"
                type="button"
                aria-label={`Copy ${isNonHttp ? baseAddress : `localhost:${service.port}`}`}
                onClick={(event) => handleCopyUrl(isNonHttp ? baseAddress : `localhost:${service.port}`, event)}
                sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, pl: 1.2, pr: 0.5, py: 0.2 }}
              >
                {copiedLink ? <CheckIcon sx={{ fontSize: 12, color: "success.main" }} /> : null}:{service.port}
              </Box>
            </Tooltip>
            <Tooltip title={isNonHttp ? "Connection address" : "App & API links"} placement="top" arrow disableInteractive>
              <Box
                component="button"
                type="button"
                aria-label={isNonHttp ? "Connection address" : "App and API links"}
                aria-haspopup="menu"
                onClick={(event) => {
                  event.stopPropagation();
                  setLinksAnchorEl(event.currentTarget.parentElement);
                }}
                sx={{ display: "inline-flex", alignItems: "center", px: 0.4, borderLeft: "1px solid #e2e8f0 !important" }}
              >
                <KeyboardArrowDownIcon sx={{ fontSize: 14, color: "#64748b" }} />
              </Box>
            </Tooltip>
          </Box>
        ) : null}

        {showGroup && service.group ? (
          <Box
            sx={{
              px: 1.2,
              py: 0.2,
              borderRadius: "12px",
              bgcolor: "#f1f5f9",
              color: "#334155",
              fontSize: "0.74rem",
              fontWeight: 500,
            }}
          >
            {service.group}
          </Box>
        ) : null}

        {runConfigCount > 0 && onEditRunConfig ? (
          <Tooltip title="Run configuration for this machine — click to edit" placement="top" arrow disableInteractive>
            <Box
              component="button"
              onClick={() => onEditRunConfig(service.name)}
              sx={{
                px: 1.2,
                py: 0.2,
                borderRadius: "12px",
                bgcolor: "rgba(13,148,136,0.1)",
                color: "#0f766e",
                fontSize: "0.74rem",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                "&:hover": { bgcolor: "rgba(13,148,136,0.18)" },
              }}
            >
              Config · {runConfigCount}
            </Box>
          </Tooltip>
        ) : null}

        {buildMode && service.hasBuild ? (
          <Box
            sx={{
              px: 1.2,
              py: 0.2,
              borderRadius: "12px",
              bgcolor: "rgba(245,158,11,0.12)",
              color: "#d97706",
              fontSize: "0.74rem",
              fontWeight: 600,
            }}
          >
            Build
          </Box>
        ) : null}

        {dependsOnCount || requiredByCount ? (
          <Tooltip title={dependencyTooltip} placement="top" arrow disableInteractive>
            <Box
              sx={{
                px: 1.2,
                py: 0.2,
                borderRadius: "12px",
                bgcolor: "#f1f5f9",
                color: "#334155",
                fontSize: "0.74rem",
                fontWeight: 500,
                whiteSpace: "nowrap",
                cursor: "default",
              }}
            >
              {[
                dependsOnCount ? `Needs ${dependsOnCount}` : "",
                requiredByCount ? `Used by ${requiredByCount}` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </Box>
          </Tooltip>
        ) : null}
      </Box>

      {/* 4. Git Branch Flow Rail */}
      {showGitBranches && service.enableGit !== false && status.git?.isGitRepo ? (
        <Box sx={{ mb: showLiveMetrics && status.running && metrics ? 1 : 1.5, flexShrink: 0 }}>
          <BranchSelector
            serviceName={service.name}
            gitInfo={status.git}
            isRunning={status.running}
            isBusy={isBusy}
            onBranchCheckout={onBranchCheckout}
            onGitPull={onGitPull}
            onGitPush={onGitPush}
            fullWidth
          />
        </Box>
      ) : null}

      {/* 5. Live Metrics Strip (Controlled by showLiveMetrics) */}
      {renderLiveMetricsStrip()}

      {/* 6. Bottom group pinned to the card baseline: error, footer */}
      <Box sx={{ mt: "auto", flexShrink: 0 }}>
        {/* Error Collapse Alert (above the footer so actions stay on the shared baseline) */}
        <Collapse in={Boolean(status.error)}>
          {status.error ? (
            <Alert
              severity="error"
              sx={{
                mb: 1.25,
                borderRadius: "12px",
                py: 0.25,
                px: 1.25,
                "& .MuiAlert-message": { fontSize: "0.75rem", py: 0.5, minWidth: 0, flex: 1 },
                "& .MuiAlert-icon": { py: 0.5, mr: 1 },
              }}
            >
              <Box sx={{ overflowWrap: "anywhere" }}>{status.error}</Box>
              {/* Actions sit under the message so they never squeeze it on a narrow card */}
              <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.5, ml: -0.75 }}>
                {onStartWithDependencies && getHelpTopicForFailure(status.message, status.error) === "dependencies" ? (
                  <Button
                    color="inherit"
                    size="small"
                    startIcon={<PlayArrowIcon sx={{ fontSize: 15 }} />}
                    onClick={() => onStartWithDependencies(service.name)}
                    sx={{ fontWeight: 700, whiteSpace: "nowrap", minWidth: 0, px: 0.75 }}
                  >
                    Start all needed
                  </Button>
                ) : null}
                {onOpenHelp ? (
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() =>
                      onOpenHelp({
                        tab: "troubleshooting",
                        section: getHelpTopicForFailure(status.message, status.error),
                      })
                    }
                    sx={{ minWidth: 0, px: 0.75 }}
                  >
                    Help
                  </Button>
                ) : null}
                <Button color="inherit" size="small" onClick={() => onViewLogs(service.name)} sx={{ minWidth: 0, px: 0.75 }}>
                  Logs
                </Button>
              </Stack>
            </Alert>
          ) : null}
        </Collapse>

        {/* Footer Row: Dependencies & Shortcuts (Left) + Primary Action & Restart (Right) */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 1,
            pt: 1.25,
            borderTop: "1px solid #f1f5f9",
            minHeight: 34,
          }}
        >
          {/* Left Side: Quick links (Logs, Docs / Web UI) */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0, flex: isBusy ? "0 0 auto" : 1, overflow: "hidden" }}>
            {/* Quick links: ALWAYS visible and interactive even during transitional states */}
            {onViewLogs ? (
              <Typography
                component="button"
                onClick={() => onViewLogs(service.name)}
                sx={{
                  background: "none",
                  border: "none",
                  color: "#101828",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  p: 0,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  "&:hover": { color: "#000000", textDecoration: "underline" },
                }}
              >
                Logs
              </Typography>
            ) : null}

            {primaryDocsLink ? (
              <Typography
                component="a"
                href={primaryDocsLink.url}
                target="_blank"
                rel="noreferrer"
                sx={{
                  color: "#101828",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  "&:hover": { color: "#000000", textDecoration: "underline" },
                }}
              >
                {docsBadgeLabel}
              </Typography>
            ) : isFrontend && service.port ? (
              <Typography
                component="a"
                href={`http://localhost:${service.port}/`}
                target="_blank"
                rel="noreferrer"
                sx={{
                  color: "#101828",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  "&:hover": { color: "#000000", textDecoration: "underline" },
                }}
              >
                Web UI
              </Typography>
            ) : null}
          </Box>

          {/* Right Side: Primary Action + Secondary Action, or progress message while busy */}
          {renderActionButtons()}
        </Box>
      </Box>

    </Paper>
  );
}

export default React.memo(ServiceCard);
