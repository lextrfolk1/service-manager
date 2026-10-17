import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Add as AddIcon,
  ImportExport as ImportExportIcon,
  LockOutlined as LockIcon,
  LockOpenOutlined as LockOpenIcon,
  Palette as AppearanceIcon,
  AutoAwesome as AutoAwesomeIcon,
  ContentCopy as ContentCopyIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  FolderOpen as FolderOpenIcon,
  SyncRounded as SyncIcon,
  SettingsBackupRestore as ReloadConfigIcon,
  Save as SaveIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Article as LogsIcon,
  PlaylistPlay as PresetsIcon,
  Storage as StorageIcon,
  WarningAmber as WarningAmberIcon,
} from "@mui/icons-material";
import api from "../services/api";
import { validateConfiguration } from "../utils/configValidation";
import { getEffectivePresets, getStartupDependencies, normalizeService } from "../utils/serviceUtils";
import { RunConfigSection, cleanRunConfig, summarizeRunConfigChanges } from "../components/RunConfigEditor";
import StatusDot from "../components/StatusDot";
import ThemePicker from "../components/ThemePicker";
import EmptyState from "../components/EmptyState";
import ConfigTransferPanel from "../components/ConfigTransferPanel";
import { describeJsonError, maskRunConfig, unmaskRunConfig } from "../utils/configTransfer";
import useServiceRunningStates from "../hooks/useServiceRunningStates";
import { CODE_FONT, SEARCH_INPUT_SX, TOP_BAR_HEIGHT } from "../theme/tokens";
import { CARD_STYLES, DEFAULT_CARD_STYLE, ServiceCardView, normalizeCardStyle } from "../components/cards";

const panelSx = {
  borderRadius: 3,
  border: "1px solid var(--c-border-94a3b8-018)",
  backgroundColor: "var(--c-bg-ffffff-092)",
  boxShadow: "0 10px 30px var(--c-shadow-0f172a-005)",
};

const serviceTypeOptions = ["java", "python", "npm", "redis", "neo4j", "listener"];
const commonBasePathKeys = ["java", "python", "npm", "listener", "frontend", "backend", "microservices"];

function toConfigPayload(data) {
  if (!data) {
    return { config: {}, services: {} };
  }
  const { runtime, ...rest } = data;
  return rest;
}

function prettifyLabel(value = "") {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function prettifyPlatform(value = "") {
  if (value === "darwin") return "macOS";
  if (value === "win32") return "Windows";
  if (value === "linux") return "Linux";
  return value || "Unknown";
}

function tokenForBasePath(key) {
  return `\${basePaths.${key}}`;
}

function getPlatformPathSeparator(runtimePlatform) {
  return runtimePlatform === "win32" ? "\\" : "/";
}

function normalizePathSuffix(suffixValue = "", runtimePlatform = "unknown") {
  const separator = getPlatformPathSeparator(runtimePlatform);
  return String(suffixValue || "")
    .replace(/^[\\/]+/, "")
    .replace(/[\\/]+/g, separator);
}

function buildTemplatePathValue(baseKey, suffixValue, runtimePlatform = "unknown") {
  if (!baseKey) return "";
  const separator = getPlatformPathSeparator(runtimePlatform);
  const suffix = normalizePathSuffix(suffixValue, runtimePlatform);
  return suffix ? `\${basePaths.${baseKey}}${separator}${suffix}` : `\${basePaths.${baseKey}}`;
}

function getPathUsageCount(key, services) {
  const token = tokenForBasePath(key);
  return Object.values(services || {}).filter((service) => String(service.path || "").includes(token)).length;
}

function getServiceGroups(services) {
  const groupMap = new Map();
  Object.entries(services || {}).forEach(([serviceName, service]) => {
    const groupName = service.group?.trim() || "Ungrouped";
    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, []);
    }
    groupMap.get(groupName).push(serviceName);
  });
  return Array.from(groupMap.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function ServiceListItem({ serviceName, service, running, isSelected, hasError, onSelect, onDelete, onClone }) {
  return (
    <Box
      onClick={onSelect}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.5,
        py: 0.75,
        cursor: "pointer",
        borderLeft: isSelected ? "3px solid var(--sm-accent)" : "3px solid transparent",
        backgroundColor: isSelected ? "color-mix(in srgb, var(--sm-accent) 8%, transparent)" : "transparent",
        transition: "background-color 0.15s ease",
        "&:hover": {
          backgroundColor: isSelected ? "color-mix(in srgb, var(--sm-accent) 12%, transparent)" : "var(--c-bg-94a3b8-008)",
        },
        "&:hover .service-actions, &:focus-within .service-actions": { opacity: 1 },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
          <StatusDot running={running} />
          <Tooltip title={service.description || ""} placement="right">
            <Typography
              variant="body2"
              title={serviceName}
              sx={{
                fontWeight: isSelected ? 700 : 600,
                fontSize: "0.82rem",
                minWidth: 0,
                overflow: "hidden",
                overflowWrap: "anywhere",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {serviceName}
            </Typography>
          </Tooltip>
          {hasError ? <WarningAmberIcon color="error" sx={{ fontSize: 14, flexShrink: 0 }} /> : null}
          <Box sx={{ flex: 1 }} />
          {service.type ? (
            <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.68rem", flexShrink: 0 }}>
              {service.type}
            </Typography>
          ) : null}
          {service.port ? (
            <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.68rem", fontFamily: CODE_FONT, flexShrink: 0 }}>
              :{service.port}
            </Typography>
          ) : null}
        </Stack>
        <Typography variant="caption" component="div" noWrap sx={{ color: "text.secondary", fontSize: "0.7rem" }}>
          {service.path || "No path configured"}
        </Typography>
      </Box>
      <Stack
        className="service-actions"
        direction="row"
        spacing={0.25}
        sx={{ opacity: isSelected ? 1 : 0, transition: "opacity 0.15s ease", flexShrink: 0 }}
      >
        <Tooltip title="Clone service">
          <IconButton
            size="small"
            aria-label={`Clone ${serviceName}`}
            onClick={(event) => {
              event.stopPropagation();
              if (onClone) onClone();
            }}
            sx={{ p: 0.5, color: "text.secondary", "&:hover": { color: "primary.main" } }}
          >
            <ContentCopyIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete service">
          <IconButton
            size="small"
            color="error"
            aria-label={`Delete ${serviceName}`}
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            sx={{ p: 0.5 }}
          >
            <DeleteIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
}

function BasePathRow({ pathKey, pathValue, usageCount, onChange, onDelete, onBrowse, onCopyToken }) {
  const token = tokenForBasePath(pathKey);
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 2,
        py: 1,
        borderBottom: "1px solid var(--c-border-94a3b8-014)",
        "&:hover": { backgroundColor: "var(--c-bg-94a3b8-005)" },
      }}
    >
      <Box sx={{ width: { xs: 140, md: 220 }, flexShrink: 0, minWidth: 0 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
          {prettifyLabel(pathKey)}
        </Typography>
        <Tooltip title="Copy token">
          <Box
            component="button"
            type="button"
            onClick={onCopyToken}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              p: 0,
              border: 0,
              background: "none",
              cursor: "pointer",
              fontFamily: CODE_FONT,
              fontSize: "0.7rem",
              color: "text.secondary",
              "&:hover": { color: "primary.main" },
            }}
          >
            {token}
            <ContentCopyIcon sx={{ fontSize: 11 }} />
          </Box>
        </Tooltip>
      </Box>
      <TextField
        size="small"
        fullWidth
        value={pathValue}
        onChange={(event) => onChange(event.target.value)}
        placeholder="~/projects"
        InputProps={{
          sx: { fontFamily: CODE_FONT, fontSize: "0.82rem" },
          endAdornment: (
            <InputAdornment position="end">
              <Tooltip title="Browse folder">
                <IconButton size="small" edge="end" aria-label={`Browse folder for ${pathKey}`} onClick={onBrowse}>
                  <FolderOpenIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </InputAdornment>
          ),
        }}
      />
      <Tooltip title={`Used by ${usageCount} service${usageCount === 1 ? "" : "s"}`}>
        <Chip
          size="small"
          variant="outlined"
          label={`Used by ${usageCount}`}
          color={usageCount > 0 ? "primary" : "default"}
          sx={{ height: 22, minWidth: 72, flexShrink: 0 }}
        />
      </Tooltip>
      <Tooltip title="Delete path">
        <IconButton size="small" color="error" aria-label={`Delete path ${pathKey}`} onClick={onDelete} sx={{ flexShrink: 0 }}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

// Sample status for the Appearance previews: a running service on main (no health check result).
const PREVIEW_STATUS = {
  running: true,
  lifecycleState: "running",
  lifecycleLabel: "Running",
  healthState: "unknown",
  healthLabel: "",
  message: "Service is running",
  error: "",
  git: { isGitRepo: true, currentBranch: "main", hasUpstream: true, upstreamBranch: "origin/main", ahead: 0, behind: 0, isDirty: false, uncommittedCount: 0 },
};
const PREVIEW_METRICS = { memoryFormatted: "256 MB", cpuFormatted: "1.2%", cpuPercent: "1.2", uptimeFormatted: "Up 12m" };
// Made-up service for the previews, so no real service from the config is shown.
const PREVIEW_SAMPLE = {
  service: {
    name: "orders-service",
    type: "java",
    port: 8085,
    group: "Core",
    description: "Example service: manages customer orders",
    dependsOn: ["catalog-service"],
    docsPath: "/swagger-ui/index.html",
  },
  reverseDependencies: ["billing-service", "shipping-service"],
};
const noop = () => {};

// The real card component for a style, rendered with sample data. Look-only: clicks never reach it.
function LiveCardPreview({ styleId, sample }) {
  return (
    <Box aria-hidden sx={{ pointerEvents: "none", userSelect: "none" }}>
      <ServiceCardView
        cardStyle={styleId}
        service={sample.service}
        status={PREVIEW_STATUS}
        reverseDependencies={sample.reverseDependencies}
        isDraggable={false}
        showGroup
        showGitBranches
        showLiveMetrics
        metrics={PREVIEW_METRICS}
        isSelected={false}
        onSelect={noop}
        onAction={noop}
        onBranchCheckout={noop}
        onGitPull={noop}
        onGitPush={noop}
        onViewLogs={noop}
      />
    </Box>
  );
}

function EditorSection({ title, action, children }) {
  return (
    <Box sx={{ py: 2, borderBottom: "1px solid var(--c-border-94a3b8-016)", "&:last-of-type": { borderBottom: 0 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25, minHeight: 28 }}>
        <Typography variant="overline" sx={{ fontWeight: 800, color: "text.secondary", lineHeight: 1.5 }}>
          {title}
        </Typography>
        {action}
      </Stack>
      {children}
    </Box>
  );
}

function ServiceEditor({
  serviceName,
  service,
  services,
  basePaths,
  runtimePlatform,
  onServiceChange,
  onPickDirectory,
  onClone,
  onRename,
  runSettings,
  onRunSettingsChange,
  validationIssues = [],
}) {
  const [pathTemplateKey, setPathTemplateKey] = useState("");
  const [pathSuffix, setPathSuffix] = useState("");
  const [servicePathBusy, setServicePathBusy] = useState(false);
  const [pathMode, setPathMode] = useState("absolute");

  // Get errors for this specific service
  const serviceErrors = validationIssues.filter((issue) => issue.scope === serviceName);
  const getFieldError = (fieldName) => {
    return serviceErrors.find((error) => error.fieldName === fieldName)?.message || "";
  };
  const hasFieldError = (fieldName) => !!getFieldError(fieldName);
  const errorCount = serviceErrors.filter((issue) => issue.severity === "error").length;

  useEffect(() => {
    const pathValue = service.path || "";
    const match = pathValue.match(/\$\{basePaths\.(\w+)\}(?:[\\/](.*))?$/);
    if (match) {
      setPathMode("template");
      setPathTemplateKey(match[1] || "");
      setPathSuffix(match[2] || "");
      return;
    }
    setPathMode("absolute");
    setPathTemplateKey("");
    setPathSuffix("");
  }, [service.path]);

  const dependencyOptions = useMemo(
    () => Object.keys(services || {}).filter((candidate) => candidate !== serviceName),
    [serviceName, services]
  );

  const groupOptions = useMemo(
    () => [...new Set(Object.values(services || {}).map((entry) => entry.group?.trim()).filter(Boolean))].sort(),
    [services]
  );

  const dependsOnValue = getStartupDependencies(service);

  const buildTemplatePath = (baseKey, suffixValue) => {
    return buildTemplatePathValue(baseKey, suffixValue, runtimePlatform);
  };

  const resolvedTemplatePath = pathTemplateKey
    ? `${basePaths?.[pathTemplateKey] || ""}${pathSuffix ? `${getPlatformPathSeparator(runtimePlatform)}${normalizePathSuffix(pathSuffix, runtimePlatform)}` : ""}`
    : "";

  const handlePathModeChange = (mode) => {
    setPathMode(mode);
    if (mode === "template") {
      const fallbackKey = pathTemplateKey || Object.keys(basePaths || {})[0] || "";
      setPathTemplateKey(fallbackKey);
      if (fallbackKey) {
        onServiceChange(serviceName, "path", buildTemplatePath(fallbackKey, pathSuffix));
      }
    }
  };

  const handleTemplateBaseChange = (baseKey) => {
    setPathTemplateKey(baseKey);
    onServiceChange(serviceName, "path", buildTemplatePath(baseKey, pathSuffix));
  };

  const handleTemplateSuffixChange = (suffixValue) => {
    setPathSuffix(suffixValue);
    if (pathTemplateKey) {
      onServiceChange(serviceName, "path", buildTemplatePath(pathTemplateKey, suffixValue));
    }
  };

  const browseForServicePath = async () => {
    setServicePathBusy(true);
    try {
      const pickedPath = await onPickDirectory(service.path || "");
      if (pickedPath) {
        onServiceChange(serviceName, "path", pickedPath);
      }
    } finally {
      setServicePathBusy(false);
    }
  };

  const monoInputSx = { fontFamily: CODE_FONT, fontSize: "0.82rem" };
  const toggleButtonSx = { py: 0.25, px: 1.25, textTransform: "none", fontSize: "0.75rem" };

  return (
    <Box sx={{ height: "100%", width: "100%", minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1,
          px: 2.5,
          py: 1,
          minHeight: 52,
          flexShrink: 0,
          borderBottom: "1px solid var(--c-border-94a3b8-016)",
        }}
      >
        <Typography variant="subtitle1" noWrap sx={{ fontWeight: 800, minWidth: 0 }}>
          {serviceName}
        </Typography>
        {onRename && (
          <Tooltip title="Rename service">
            <IconButton size="small" aria-label={`Rename ${serviceName}`} onClick={onRename} sx={{ color: "text.secondary" }}>
              <EditIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
        <Chip size="small" label={service.type || "type missing"} color={service.type ? "default" : "warning"} />
        {service.port ? <Chip size="small" variant="outlined" label={`:${service.port}`} sx={{ fontFamily: CODE_FONT }} /> : null}
        {service.group ? <Chip size="small" variant="outlined" label={service.group} /> : null}
        {errorCount > 0 ? (
          <Chip size="small" color="error" label={`${errorCount} issue${errorCount === 1 ? "" : "s"}`} />
        ) : null}
        <Box sx={{ flex: 1 }} />
        {onClone && (
          <Button size="small" variant="outlined" startIcon={<ContentCopyIcon fontSize="small" />} onClick={onClone}>
            Clone
          </Button>
        )}
      </Box>

      <Box sx={{ flexGrow: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", px: 2.5 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) minmax(0, 1fr)" },
            columnGap: 4,
            alignItems: "start",
          }}
        >
          <Box sx={{ minWidth: 0 }}>
          <EditorSection title="General">
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Service type</InputLabel>
                  <Select
                    value={service.type || ""}
                    label="Service type"
                    onChange={(event) => onServiceChange(serviceName, "type", event.target.value)}
                  >
                    {serviceTypeOptions.map((type) => (
                      <MenuItem key={type} value={type}>
                        {prettifyLabel(type)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Port"
                  type="number"
                  value={service.port || ""}
                  onChange={(event) => onServiceChange(serviceName, "port", event.target.value)}
                  placeholder="Empty for workers / tools"
                  error={hasFieldError("port")}
                  helperText={getFieldError("port") || undefined}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Autocomplete
                  freeSolo
                  size="small"
                  options={groupOptions}
                  value={service.group || null}
                  inputValue={service.group || ""}
                  onChange={(_, value) => onServiceChange(serviceName, "group", value || "")}
                  onInputChange={(_, value, reason) => {
                    if (reason === "input" || reason === "clear") onServiceChange(serviceName, "group", value);
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Group" placeholder="Core / Data / Frontend" />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Description"
                  value={service.description || ""}
                  onChange={(event) => onServiceChange(serviceName, "description", event.target.value)}
                  placeholder="Short operational note for teammates"
                />
              </Grid>
            </Grid>
          </EditorSection>

          <EditorSection
            title="Location"
            action={
              <ToggleButtonGroup
                size="small"
                exclusive
                value={pathMode}
                onChange={(_, mode) => {
                  if (mode) handlePathModeChange(mode);
                }}
              >
                <ToggleButton value="absolute" sx={toggleButtonSx}>Direct path</ToggleButton>
                <ToggleButton value="template" sx={toggleButtonSx}>From base path</ToggleButton>
              </ToggleButtonGroup>
            }
          >
            {pathMode === "absolute" ? (
              <TextField
                fullWidth
                size="small"
                label="Service path"
                value={service.path || ""}
                onChange={(event) => onServiceChange(serviceName, "path", event.target.value)}
                placeholder={runtimePlatform === "win32" ? "C:\\projects\\my-service" : "~/projects/my-service"}
                error={hasFieldError("path")}
                helperText={getFieldError("path") || undefined}
                InputProps={{
                  sx: monoInputSx,
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="Browse folder">
                        <span>
                          <IconButton size="small" edge="end" aria-label="Browse folder" onClick={browseForServicePath} disabled={servicePathBusy}>
                            {servicePathBusy ? <CircularProgress size={16} /> : <FolderOpenIcon fontSize="small" />}
                          </IconButton>
                        </span>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
              />
            ) : (
              <>
                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Base path</InputLabel>
                      <Select
                        value={pathTemplateKey}
                        label="Base path"
                        renderValue={(value) => value}
                        onChange={(event) => handleTemplateBaseChange(event.target.value)}
                      >
                        {Object.keys(basePaths || {}).map((key) => (
                          <MenuItem key={key} value={key}>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="body2">{key}</Typography>
                              <Typography variant="caption" sx={{ color: "text.secondary", fontFamily: CODE_FONT }}>
                                {basePaths[key]}
                              </Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={8}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Sub path"
                      value={pathSuffix}
                      onChange={(event) => handleTemplateSuffixChange(event.target.value)}
                      placeholder={runtimePlatform === "win32" ? "services\\config-service" : "services/config-service"}
                      InputProps={{ sx: monoInputSx }}
                    />
                  </Grid>
                </Grid>
                <Typography
                  variant="caption"
                  component="div"
                  sx={{
                    mt: 0.75,
                    fontFamily: CODE_FONT,
                    wordBreak: "break-all",
                    color: hasFieldError("path") ? "error.main" : "text.secondary",
                  }}
                >
                  {hasFieldError("path")
                    ? getFieldError("path")
                    : pathTemplateKey
                      ? `${buildTemplatePath(pathTemplateKey, pathSuffix)}  →  ${resolvedTemplatePath}`
                      : "Choose a base path to build a reusable path."}
                </Typography>
              </>
            )}
          </EditorSection>

          <EditorSection title="Endpoints">
            <Grid container spacing={1.5}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="API docs path"
                  value={service.docsPath || ""}
                  onChange={(event) => onServiceChange(serviceName, "docsPath", event.target.value)}
                  placeholder="Auto-detected if empty, e.g. /swagger-ui/index.html"
                  InputProps={{ sx: monoInputSx }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Health check path"
                  value={service.healthPath || ""}
                  onChange={(event) => onServiceChange(serviceName, "healthPath", event.target.value)}
                  placeholder="Auto-detected if empty, e.g. /actuator/health"
                  InputProps={{ sx: monoInputSx }}
                />
              </Grid>
            </Grid>
          </EditorSection>
          </Box>

          <Box sx={{ minWidth: 0 }}>
          <EditorSection title="Commands">
            <Grid container spacing={1.5}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Start command"
                  required
                  value={service.command || ""}
                  onChange={(event) => onServiceChange(serviceName, "command", event.target.value)}
                  placeholder="npm run dev"
                  error={hasFieldError("command")}
                  helperText={getFieldError("command") || undefined}
                  InputProps={{ sx: monoInputSx }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Build command"
                  value={service.build || ""}
                  onChange={(event) => onServiceChange(serviceName, "build", event.target.value)}
                  placeholder="Runs when build mode is on, e.g. mvn clean install -DskipTests"
                  InputProps={{ sx: monoInputSx }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Stop command"
                  value={service.stopCommand || ""}
                  onChange={(event) => onServiceChange(serviceName, "stopCommand", event.target.value)}
                  placeholder="Optional, e.g. redis-cli shutdown"
                  InputProps={{ sx: monoInputSx }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Health check command"
                  value={service.healthCommand || ""}
                  onChange={(event) => onServiceChange(serviceName, "healthCommand", event.target.value)}
                  placeholder="Optional, e.g. curl -f http://localhost:8080/actuator/health"
                  InputProps={{ sx: monoInputSx }}
                />
              </Grid>
            </Grid>
          </EditorSection>

          {onRunSettingsChange ? (
            <EditorSection title="Run configuration">
              <RunConfigSection settings={runSettings} serviceType={service.type || ""} onChange={onRunSettingsChange} />
            </EditorSection>
          ) : null}

          <EditorSection title="Dependencies">
            <Autocomplete
              multiple
              size="small"
              filterSelectedOptions
              options={dependencyOptions}
              value={dependsOnValue}
              onChange={(_, value) => onServiceChange(serviceName, "dependsOn", value.join(", "))}
              ChipProps={{ size: "small" }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Depends on"
                  placeholder={dependsOnValue.length ? "" : "None — starts without waiting"}
                  error={hasFieldError("dependsOn")}
                  helperText={getFieldError("dependsOn") || "These services start first, in order, before this one."}
                />
              )}
            />
          </EditorSection>

          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// Serializes config for change detection: sorted keys, and empty values ("", null, undefined, [])
// treated the same as a missing field, so untouched optional fields don't count as edits.
function stableConfigString(value) {
  const normalize = (input) => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === "object") {
      return Object.keys(input)
        .sort()
        .reduce((result, key) => {
          const entry = input[key];
          const isEmpty = entry === "" || entry === null || entry === undefined || (Array.isArray(entry) && entry.length === 0);
          if (!isEmpty) result[key] = normalize(entry);
          return result;
        }, {});
    }
    return input;
  };
  return JSON.stringify(normalize(value));
}

// Defaults used by the backend when config.logs is not set (keep in sync with backend/src/logger.js).
const DEFAULT_LOG_SETTINGS = { previousRuns: "archive", retentionDays: 3, maxRuns: 20, combinedView: false };

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Preset changes for the save confirmation. null means "built-in presets".
function summarizePresetChanges(savedPresets, presets) {
  const before = savedPresets && Object.keys(savedPresets).length ? savedPresets : null;
  if (JSON.stringify(before) === JSON.stringify(presets)) return [];
  if (!presets) return [{ kind: "changed", text: "Presets: reset to built-in presets" }];
  if (!before) return [{ kind: "changed", text: `Presets: saved as custom presets (${Object.keys(presets).join(", ")})` }];
  const changes = [];
  new Set([...Object.keys(before), ...Object.keys(presets)]).forEach((name) => {
    if (!(name in before)) changes.push({ kind: "added", text: `Preset "${name}" (${presets[name].length} services)` });
    else if (!(name in presets)) changes.push({ kind: "removed", text: `Preset "${name}"` });
    else if (JSON.stringify(before[name]) !== JSON.stringify(presets[name])) {
      changes.push({ kind: "changed", text: `Preset "${name}": ${presets[name].length} services` });
    }
  });
  return changes;
}

// Lists what Save would change compared with the saved config: [{ kind: "added" | "removed" | "changed", text }].
function summarizeConfigChanges(savedConfig, basePaths, services, logSettings = {}, dependencyCheck = true, cardStyle = DEFAULT_CARD_STYLE) {
  const changes = [];
  const savedCardStyle = normalizeCardStyle(savedConfig?.config?.ui?.cardStyle);
  if (savedCardStyle !== cardStyle) {
    const label = (id) => CARD_STYLES.find((style) => style.id === id)?.label || id;
    changes.push({ kind: "changed", text: `Default card style: ${label(savedCardStyle)} → ${label(cardStyle)}` });
  }
  const savedDependencyCheck = savedConfig?.config?.dependencyCheck !== false;
  if (savedDependencyCheck !== dependencyCheck) {
    changes.push({ kind: "changed", text: `Dependency check: ${savedDependencyCheck ? "on" : "off"} → ${dependencyCheck ? "on" : "off"}` });
  }
  const savedLogs = savedConfig?.config?.logs || {};
  [
    ["previousRuns", "Log previous runs"],
    ["retentionDays", "Log retention (days)"],
    ["maxRuns", "Log max runs per service"],
    ["combinedView", "Combined log view"],
  ].forEach(([key, label]) => {
    const show = (value) => (typeof value === "boolean" ? (value ? "on" : "off") : value);
    const before = show(savedLogs[key] ?? DEFAULT_LOG_SETTINGS[key]);
    const after = show(logSettings[key] ?? DEFAULT_LOG_SETTINGS[key]);
    if (String(before) !== String(after)) changes.push({ kind: "changed", text: `${label}: ${before} → ${after}` });
  });
  const savedPaths = savedConfig?.config?.basePaths || {};
  const savedServices = savedConfig?.services || {};

  new Set([...Object.keys(savedPaths), ...Object.keys(basePaths)]).forEach((key) => {
    if (!(key in savedPaths)) changes.push({ kind: "added", text: `Base path "${key}" → ${basePaths[key]}` });
    else if (!(key in basePaths)) changes.push({ kind: "removed", text: `Base path "${key}"` });
    else if (savedPaths[key] !== basePaths[key]) {
      changes.push({ kind: "changed", text: `Base path "${key}": ${savedPaths[key]} → ${basePaths[key]}` });
    }
  });

  new Set([...Object.keys(savedServices), ...Object.keys(services)]).forEach((name) => {
    if (!(name in savedServices)) changes.push({ kind: "added", text: `Service "${name}"` });
    else if (!(name in services)) changes.push({ kind: "removed", text: `Service "${name}"` });
    else {
      const before = savedServices[name] || {};
      const after = services[name] || {};
      const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])]
        .filter((field) => stableConfigString({ v: before[field] }) !== stableConfigString({ v: after[field] }));
      const fieldLabels = { dependsOn: "dependencies" };
      const labels = [...new Set(fields.map((field) => fieldLabels[field] || field))];
      if (fields.length) changes.push({ kind: "changed", text: `Service "${name}": ${labels.join(", ")}` });
    }
  });

  return changes;
}

function getUniqueCloneName(baseName, existingServices) {
  const cleanBase = String(baseName || "service").replace(/-clone(-\d+)?$/, "");
  let candidate = `${cleanBase}-clone`;
  let counter = 1;
  while (existingServices && existingServices[candidate]) {
    counter += 1;
    candidate = `${cleanBase}-clone-${counter}`;
  }
  return candidate;
}

function getSuggestedPort(originalPort, existingServices) {
  if (!originalPort || isNaN(Number(originalPort))) return "";
  const existingPorts = new Set(
    Object.values(existingServices || {})
      .map((s) => Number(s?.port))
      .filter(Boolean)
  );
  let nextPort = Number(originalPort) + 1;
  while (existingPorts.has(nextPort) && nextPort < 65535) {
    nextPort += 1;
  }
  return nextPort <= 65535 ? nextPort : "";
}

const Admin = ({ onConfigReload, adminTarget, onClearAdminTarget, isActive = true }) => {
  const [currentTab, setCurrentTab] = useState(1); // Services is the main task
  const [groupChip, setGroupChip] = useState(""); // group filter for the services list ("" = all)
  const [confirmReloadOpen, setConfirmReloadOpen] = useState(false);
  const [confirmResetPresetsOpen, setConfirmResetPresetsOpen] = useState(false);
  const [cardStyle, setCardStyle] = useState(DEFAULT_CARD_STYLE); // config.ui.cardStyle (Appearance tab)
  // JSON editor: one document per file. touched = edited but not applied to the forms yet.
  const [jsonDocs, setJsonDocs] = useState({ services: { text: "", touched: false }, run: { text: "", touched: false } });
  const [jsonFile, setJsonFile] = useState("services"); // "services" (services.json) or "run" (run-config.json)
  const [jsonUnlocked, setJsonUnlocked] = useState(false); // the JSON editor is read-only until unlocked
  const jsonText = jsonDocs[jsonFile].text;
  const jsonTouched = jsonDocs[jsonFile].touched;
  const anyJsonTouched = jsonDocs.services.touched || jsonDocs.run.touched;
  const [pendingTab, setPendingTab] = useState(null); // tab to open after confirming unapplied JSON edits are discarded
  const [importCount, setImportCount] = useState(0); // bumped after an import so the JSON view is rebuilt
  const jsonParseError = useMemo(() => {
    if (!jsonText) return "";
    try {
      JSON.parse(jsonText);
      return "";
    } catch (error) {
      return describeJsonError(jsonText) || error.message;
    }
  }, [jsonText]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runtimeInfo, setRuntimeInfo] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState("info");
  const [basePaths, setBasePaths] = useState({});
  const [services, setServices] = useState({});
  const [selectedService, setSelectedService] = useState(null);
  const [serviceFilter, setServiceFilter] = useState("");
  const [addPathDialog, setAddPathDialog] = useState(false);
  const [addServiceDialog, setAddServiceDialog] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [serviceToRename, setServiceToRename] = useState("");
  const [newRenamedName, setNewRenamedName] = useState("");
  const [newPathKey, setNewPathKey] = useState("");
  const [newPathValue, setNewPathValue] = useState("");
  const [newPathMode, setNewPathMode] = useState("browse");
  const [newPathTemplateBase, setNewPathTemplateBase] = useState("");
  const [newPathSuffix, setNewPathSuffix] = useState("");
  const [newServiceName, setNewServiceName] = useState("");
  const [pickerBusy, setPickerBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null); // { kind: "path" | "service", name }
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [logSettings, setLogSettings] = useState({}); // config.logs; unset keys use DEFAULT_LOG_SETTINGS
  const [runConfig, setRunConfig] = useState({ services: {} }); // run-config.json (this machine only)
  const [presets, setPresets] = useState(null); // config.presets; null = built-in presets
  const [dependencyCheck, setDependencyCheck] = useState(true); // config.dependencyCheck (default on)
  const [selectedPresetName, setSelectedPresetName] = useState("");
  const [presetNameDraft, setPresetNameDraft] = useState("");
  const [presetNameError, setPresetNameError] = useState("");
  const [savedRunConfig, setSavedRunConfig] = useState({ services: {} });
  const [archiveStats, setArchiveStats] = useState(null);
  const [archiveStatsError, setArchiveStatsError] = useState("");
  const [confirmClearArchives, setConfirmClearArchives] = useState(false);
  const [clearingArchives, setClearingArchives] = useState(false);

  const processedTargetIdRef = useRef(null);

  const validationResult = useMemo(
    () => validateConfiguration({ config: { basePaths }, services }),
    [basePaths, services]
  );
  const runtimePlatform = runtimeInfo?.platform || "unknown";
  const validateForImport = useCallback(
    (nextServices, nextBasePaths) => validateConfiguration({ config: { basePaths: nextBasePaths }, services: nextServices }).issues,
    []
  );

  const groupedServices = useMemo(() => getServiceGroups(services), [services]);
  const serviceRefs = useMemo(() => Object.keys(services).map((name) => ({ name })), [services]);
  // Running dots in the service list; polls only while Admin › Services is visible.
  const runningStates = useServiceRunningStates(serviceRefs, isActive && currentTab === 1);

  const filteredServices = useMemo(() => {
    const term = serviceFilter.trim().toLowerCase();
    const inGroup = ([, service]) => !groupChip || (service.group?.trim() || "Ungrouped") === groupChip;
    if (!term) return Object.entries(services).filter(inGroup);
    return Object.entries(services).filter(inGroup).filter(([serviceName, service]) => {
      return [
        serviceName,
        service.group,
        service.type,
        service.description,
        service.path,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [serviceFilter, groupChip, services]);

  const showSnackbar = useCallback((message, severity = "info") => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  }, []);

  const loadConfig = useCallback(async ({ initial = false } = {}) => {
    if (initial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const data = await api.get("/config");
      const payload = toConfigPayload(data);
      setConfig(payload);
      setBasePaths(payload.config?.basePaths || {});
      setLogSettings(payload.config?.logs || {});
      setPresets(payload.config?.presets && Object.keys(payload.config.presets).length ? payload.config.presets : null);
      setDependencyCheck(payload.config?.dependencyCheck !== false);
      setCardStyle(normalizeCardStyle(payload.config?.ui?.cardStyle));
      setServices(payload.services || {});
      setRuntimeInfo(data.runtime || null);
      try {
        const loadedRunConfig = await api.get("/run-config");
        setRunConfig(loadedRunConfig || { services: {} });
        setSavedRunConfig(loadedRunConfig || { services: {} });
      } catch {
        setRunConfig({ services: {} });
        setSavedRunConfig({ services: {} });
      }
      if (onConfigReload) {
        onConfigReload();
      }
    } catch (error) {
      setSnackbarMessage(`Failed to load config: ${error.message}`);
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
    } finally {
      if (initial) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  }, [onConfigReload]);

  const cloneService = useCallback(
    async (serviceToClone) => {
      if (!serviceToClone) return;
      const baseName = typeof serviceToClone === "string" ? serviceToClone : serviceToClone.name;
      if (!baseName) return;

      let currentServices = services;
      if (!currentServices || Object.keys(currentServices).length === 0) {
        try {
          const res = await api.get("/config");
          const payload = toConfigPayload(res);
          currentServices = payload.services || {};
          setConfig(payload);
          setBasePaths(payload.config?.basePaths || {});
          setLogSettings(payload.config?.logs || {});
          setPresets(payload.config?.presets && Object.keys(payload.config.presets).length ? payload.config.presets : null);
          setDependencyCheck(payload.config?.dependencyCheck !== false);
          setServices(currentServices);
        } catch (e) {
          // ignore
        }
      }

      const sourceConfig =
        currentServices[baseName] ||
        (typeof serviceToClone === "object" ? serviceToClone : {});

      const newName = getUniqueCloneName(baseName, currentServices);
      const suggestedPort = getSuggestedPort(sourceConfig.port, currentServices);

      // Copy every configured field (docsPath, healthPath, gitAutoPull, daemon, …), then override
      // the values that must differ for the copy.
      const { name: _ignoredName, ...sourceFields } = sourceConfig;
      const cloned = {
        ...sourceFields,
        port: suggestedPort,
        dependsOn: Array.isArray(sourceConfig.dependsOn) ? [...sourceConfig.dependsOn] : [],
        description: sourceConfig.description
          ? `${sourceConfig.description} (Clone)`
          : "Cloned service",
      };

      const updatedServices = {
        ...currentServices,
        [newName]: cloned,
      };

      // Like other edits, the clone is only written to the config when the user clicks Save.
      setRunConfig((previous) =>
        previous.services?.[baseName]
          ? { services: { ...previous.services, [newName]: JSON.parse(JSON.stringify(previous.services[baseName])) } }
          : previous
      );
      setServices(updatedServices);
      setCurrentTab(1);
      setSelectedService(newName);
      setServiceFilter("");
      showSnackbar(
        `Cloned "${baseName}" as "${newName}" (Port: ${suggestedPort || "none"}). Review it and click Save.`,
        "info"
      );
    },
    [services, showSnackbar]
  );

  const editServiceInAdmin = useCallback(
    (serviceToEdit) => {
      if (!serviceToEdit) return;
      const serviceName = typeof serviceToEdit === "string" ? serviceToEdit : serviceToEdit.name;
      setCurrentTab(1);
      setSelectedService(serviceName);
      setServiceFilter("");
      showSnackbar(`Opened "${serviceName}" in Services configuration.`, "info");
    },
    [showSnackbar]
  );

  const handleOpenRename = (serviceName) => {
    setServiceToRename(serviceName);
    setNewRenamedName(serviceName);
    setRenameDialogOpen(true);
  };

  const handleConfirmRename = () => {
    const trimmed = newRenamedName.trim();
    if (!trimmed || trimmed === serviceToRename) {
      setRenameDialogOpen(false);
      return;
    }
    if (services[trimmed]) {
      showSnackbar(`Service "${trimmed}" already exists`, "error");
      return;
    }
    const updatedServices = {};
    Object.entries(services).forEach(([k, v]) => {
      if (k === serviceToRename) {
        updatedServices[trimmed] = v;
      } else {
        const updatedDeps = Array.isArray(v.dependsOn)
          ? v.dependsOn.map((dep) => (dep === serviceToRename ? trimmed : dep))
          : v.dependsOn;
        updatedServices[k] = { ...v, dependsOn: updatedDeps };
      }
    });
    // Like other edits, the rename is only written to the config when the user clicks Save.
    setPresets((previous) =>
      previous
        ? Object.fromEntries(Object.entries(previous).map(([name, list]) => [name, list.map((entry) => (entry === serviceToRename ? trimmed : entry))]))
        : previous
    );
    setRunConfig((previous) => {
      if (!previous.services?.[serviceToRename]) return previous;
      const { [serviceToRename]: moved, ...rest } = previous.services;
      return { services: { ...rest, [trimmed]: moved } };
    });
    setServices(updatedServices);
    setSelectedService(trimmed);
    setRenameDialogOpen(false);
    showSnackbar(`Renamed "${serviceToRename}" to "${trimmed}" and updated its dependents. Click Save to apply.`, "info");
  };

  useEffect(() => {
    if (!adminTarget || loading) return;
    if (adminTarget.id && processedTargetIdRef.current === adminTarget.id) return;
    if (adminTarget.id) {
      processedTargetIdRef.current = adminTarget.id;
    }

    if (adminTarget.action === "clone") {
      cloneService(adminTarget.service);
    } else if (adminTarget.action === "edit") {
      editServiceInAdmin(adminTarget.service);
    }

    const timer = setTimeout(() => {
      if (onClearAdminTarget) {
        onClearAdminTarget();
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [adminTarget, loading, cloneService, editServiceInAdmin, onClearAdminTarget]);

  useEffect(() => {
    loadConfig({ initial: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    if (selectedService) {
      if (services[selectedService]) {
        return;
      }
      if (Object.keys(services).length === 0) {
        return;
      }
    }
    const firstVisible = filteredServices[0]?.[0] || Object.keys(services)[0] || null;
    if (firstVisible && firstVisible !== selectedService) {
      setSelectedService(firstVisible);
    }
  }, [filteredServices, selectedService, services, loading]);

  const isConfigDirty = useMemo(() => {
    if (!config) return false;
    return (
      stableConfigString(basePaths) !== stableConfigString(config.config?.basePaths || {}) ||
      stableConfigString(services) !== stableConfigString(config.services || {}) ||
      stableConfigString(logSettings) !== stableConfigString(config.config?.logs || {}) ||
      JSON.stringify(presets) !== JSON.stringify(config.config?.presets && Object.keys(config.config.presets).length ? config.config.presets : null) ||
      dependencyCheck !== (config.config?.dependencyCheck !== false) ||
      cardStyle !== normalizeCardStyle(config.config?.ui?.cardStyle)
    );
  }, [basePaths, services, logSettings, presets, dependencyCheck, cardStyle, config]);
  const isRunConfigDirty = useMemo(
    () => JSON.stringify(cleanRunConfig(runConfig)) !== JSON.stringify(cleanRunConfig(savedRunConfig)),
    [runConfig, savedRunConfig]
  );
  const isDirty = isConfigDirty || isRunConfigDirty;

  useEffect(() => {
    if (!isDirty && !anyJsonTouched) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty, anyJsonTouched]);

  const errorIssues = useMemo(
    () => validationResult.issues.filter((issue) => issue.severity === "error"),
    [validationResult]
  );
  const servicesWithErrors = useMemo(() => new Set(errorIssues.map((issue) => issue.scope)), [errorIssues]);

  const pendingChanges = useMemo(
    () =>
      confirmSaveOpen
        ? [
            ...summarizeConfigChanges(config, basePaths, services, logSettings, dependencyCheck, cardStyle),
            ...summarizePresetChanges(config?.config?.presets, presets),
            ...summarizeRunConfigChanges(savedRunConfig, runConfig),
          ]
        : [],
    [confirmSaveOpen, config, basePaths, services, logSettings, presets, dependencyCheck, cardStyle, savedRunConfig, runConfig]
  );

  // Save never writes directly: it opens a confirmation listing every change first.
  const requestSave = () => {
    if (validationResult.hasErrors) {
      showSnackbar("Fix validation errors before saving", "error");
      return;
    }
    setConfirmSaveOpen(true);
  };

  // Saves base paths and services together so edits on either tab are never left behind.
  // Only called after the user confirms in the save dialog.
  // The configuration as it would be saved right now (saved file + unsaved edits).
  const buildDraftConfig = () => ({
    ...config,
    config: (() => {
      const { logs: _previousLogs, presets: _previousPresets, dependencyCheck: _previousCheck, ui: previousUi, ...restConfig } = config.config || {};
      const cleanedLogs = Object.fromEntries(
        Object.entries(logSettings).filter(([, value]) => value !== undefined && value !== "")
      );
      const { cardStyle: _previousCardStyle, ...restUi } = previousUi || {};
      const ui = { ...restUi, ...(cardStyle !== DEFAULT_CARD_STYLE ? { cardStyle } : {}) };
      return {
        ...restConfig,
        basePaths,
        ...(Object.keys(cleanedLogs).length ? { logs: cleanedLogs } : {}),
        ...(presets ? { presets } : {}),
        ...(dependencyCheck ? {} : { dependencyCheck: false }),
        ...(Object.keys(ui).length ? { ui } : {}),
      };
    })(),
    services,
  });

  // JSON editor: services.json and this machine's run-config.json, each edited as text and applied to
  // the forms on its own; Save still reviews and writes them. Run configuration secrets show as <hidden>.
  const jsonDraftText = (file) =>
    JSON.stringify(file === "run" ? maskRunConfig(runConfig) : buildDraftConfig(), null, 2);

  // Rebuilds the given files from the current draft, dropping their unapplied edits.
  const openJsonDraft = (files = ["services", "run"]) => {
    setJsonDocs((docs) => {
      const next = { ...docs };
      files.forEach((file) => {
        next[file] = { text: jsonDraftText(file), touched: false };
      });
      return next;
    });
    setJsonUnlocked(false);
  };

  // Rebuilds only the files without unapplied edits (after changes made elsewhere).
  const refreshJsonDrafts = () => {
    const files = ["services", "run"].filter((file) => !jsonDocs[file].touched);
    if (files.length) openJsonDraft(files);
  };

  const setJsonText = (text, touched = true) =>
    setJsonDocs((docs) => ({ ...docs, [jsonFile]: { text, touched: touched || docs[jsonFile].touched } }));

  const applyJsonDraft = () => {
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (error) {
      showSnackbar(`Invalid JSON: ${describeJsonError(jsonText) || error.message}`, "error");
      return;
    }
    if (!parsed || typeof parsed !== "object" || !parsed.services || typeof parsed.services !== "object" || Array.isArray(parsed.services)) {
      showSnackbar('The JSON needs a "services" object', "error");
      return;
    }
    if (jsonFile === "run") {
      setRunConfig(unmaskRunConfig(parsed, runConfig));
    } else {
      const nextConfig = parsed.config || {};
      setBasePaths(nextConfig.basePaths || {});
      setLogSettings(nextConfig.logs || {});
      setPresets(nextConfig.presets && Object.keys(nextConfig.presets).length ? nextConfig.presets : null);
      setDependencyCheck(nextConfig.dependencyCheck !== false);
      setCardStyle(normalizeCardStyle(nextConfig.ui?.cardStyle));
      setServices(parsed.services);
    }
    setJsonDocs((docs) => ({ ...docs, [jsonFile]: { ...docs[jsonFile], touched: false } }));
    setJsonUnlocked(false);
    showSnackbar(`${jsonFile === "run" ? "run-config.json" : "services.json"} applied to the editor — review and Save to write it`, "success");
  };

  // Import / Export: an import only changes the editor state; Save still reviews and writes it.
  const applyImport = (next) => {
    if (next.services) setServices(next.services);
    if (next.paths) setBasePaths(next.paths);
    if (next.logs) setLogSettings(next.logs);
    if ("presets" in next) setPresets(next.presets);
    if (next.cardStyle) setCardStyle(next.cardStyle);
    if ("dependencyCheck" in next) setDependencyCheck(next.dependencyCheck);
    if (next.runConfig) setRunConfig(next.runConfig);
    setImportCount((count) => count + 1);
  };

  useEffect(() => {
    if (importCount) refreshJsonDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importCount]);

  const saveConfig = async () => {
    setConfirmSaveOpen(false);
    if (validationResult.hasErrors) {
      showSnackbar("Fix validation errors before saving", "error");
      return;
    }
    setSaving(true);
    try {
      const updatedConfig = buildDraftConfig();
      if (isConfigDirty) {
        await api.put("/config", updatedConfig);
        setConfig(updatedConfig);
      }
      if (isRunConfigDirty) {
        // Apply only the services edited here on top of the latest file, so quick edits made from the
        // Dashboard in the meantime are not overwritten.
        const mine = cleanRunConfig(runConfig).services;
        const before = cleanRunConfig(savedRunConfig).services;
        const latest = cleanRunConfig(await api.get("/run-config").catch(() => ({ services: {} }))).services;
        new Set([...Object.keys(mine), ...Object.keys(before)]).forEach((name) => {
          if (JSON.stringify(mine[name] || null) === JSON.stringify(before[name] || null)) return;
          if (mine[name]) latest[name] = mine[name];
          else delete latest[name];
        });
        const merged = { services: latest };
        await api.put("/run-config", merged);
        setRunConfig(merged);
        setSavedRunConfig(merged);
      }
      if (onConfigReload) {
        onConfigReload();
      }
      showSnackbar("Configuration saved", "success");
    } catch (error) {
      showSnackbar(`Failed to save configuration: ${error.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const effectiveLogSettings = { ...DEFAULT_LOG_SETTINGS, ...Object.fromEntries(Object.entries(logSettings).filter(([, value]) => value !== undefined && value !== "")) };

  // Numbers are clamped to 1..max; an empty field means "use the default".
  const updateLogSetting = (key, rawValue, max) => {
    setLogSettings((previous) => {
      const next = { ...previous };
      if (key === "previousRuns") {
        if (rawValue === undefined) delete next.previousRuns;
        else next.previousRuns = rawValue;
        return next;
      }
      const parsed = parseInt(rawValue, 10);
      if (Number.isNaN(parsed)) delete next[key];
      else next[key] = Math.min(Math.max(parsed, 1), max);
      return next;
    });
  };

  const loadArchiveStats = useCallback(async () => {
    setArchiveStatsError("");
    try {
      setArchiveStats(await api.get("/log-archive/stats"));
    } catch (error) {
      setArchiveStats(null);
      setArchiveStatsError(`Could not load log storage: ${error.message}`);
    }
  }, []);

  const clearArchives = async () => {
    setConfirmClearArchives(false);
    setClearingArchives(true);
    try {
      const result = await api.post("/log-archive/clear", {});
      showSnackbar(`Freed ${formatBytes(result.deleted?.bytes || 0)} — deleted ${result.deleted?.files || 0} previous run logs.`, "success");
    } catch (error) {
      showSnackbar(`Could not delete previous runs: ${error.message}`, "error");
    } finally {
      setClearingArchives(false);
      loadArchiveStats();
    }
  };

  useEffect(() => {
    if (currentTab === 2) loadArchiveStats();
  }, [currentTab, loadArchiveStats]);

  // Presets: effective list (configured or built-in), selection and edits.
  const serviceList = useMemo(() => Object.entries(services).map(([name, svc]) => ({ name, ...svc })), [services]);
  const effectivePresets = useMemo(() => getEffectivePresets(serviceList, presets), [serviceList, presets]);
  const transferState = useMemo(
    () => ({ basePaths, services, logs: logSettings, presets, effectivePresets, cardStyle, dependencyCheck, runConfig }),
    [basePaths, services, logSettings, presets, effectivePresets, cardStyle, dependencyCheck, runConfig]
  );
  const presetNames = Object.keys(effectivePresets);
  const activePresetName = effectivePresets[selectedPresetName] ? selectedPresetName : presetNames[0] || "";
  const serviceGroupsForPresets = useMemo(() => {
    const groups = new Map();
    serviceList.map(normalizeService).forEach((svc) => {
      if (!groups.has(svc.group)) groups.set(svc.group, []);
      groups.get(svc.group).push(svc.name);
    });
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [serviceList]);

  useEffect(() => {
    setPresetNameDraft(activePresetName);
    setPresetNameError("");
  }, [activePresetName]);

  // Any edit turns built-in presets into configured ones (all of them, so none are lost).
  const updatePresetServices = (name, list) => {
    setPresets({ ...effectivePresets, [name]: list });
  };

  const renamePreset = (oldName, rawNewName) => {
    const newName = rawNewName.trim();
    if (newName === oldName) {
      setPresetNameError("");
      return;
    }
    if (!newName) {
      setPresetNameError("Name is required");
      return;
    }
    if (effectivePresets[newName]) {
      setPresetNameError(`A preset named "${newName}" already exists`);
      return;
    }
    setPresetNameError("");
    setPresets(Object.fromEntries(Object.entries(effectivePresets).map(([name, list]) => [name === oldName ? newName : name, list])));
    setSelectedPresetName(newName);
    showSnackbar(`Preset renamed to "${newName}" — Save to keep it`, "info");
  };

  const addPreset = () => {
    let name = "New preset";
    let counter = 2;
    while (effectivePresets[name]) {
      name = `New preset ${counter}`;
      counter += 1;
    }
    setPresets({ ...effectivePresets, [name]: [] });
    setSelectedPresetName(name);
  };

  const copyToken = async (pathKey) => {
    try {
      await navigator.clipboard.writeText(tokenForBasePath(pathKey));
      showSnackbar(`Copied ${tokenForBasePath(pathKey)}`, "success");
    } catch {
      showSnackbar("Could not copy to clipboard", "error");
    }
  };

  const handleServiceChange = (serviceName, field, value) => {
    setServices((prev) => ({
      ...prev,
      [serviceName]: {
        ...prev[serviceName],
        [field]:
          field === "port"
            ? parseInt(value, 10) || ""
            : field === "dependsOn"
              ? String(value)
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean)
              : value,
      },
    }));
  };

  const pickDirectory = useCallback(
    async (initialPath = "") => {
      setPickerBusy(true);
      try {
        const response = await api.post("/system/pick-directory", { initialPath });
        if (response.cancelled) {
          return null;
        }
        return response.path || null;
      } catch (error) {
        showSnackbar(`Folder picker failed: ${error.message}`, "error");
        return null;
      } finally {
        setPickerBusy(false);
      }
    },
    [showSnackbar]
  );

  const resetPathDialog = () => {
    setNewPathKey("");
    setNewPathValue("");
    setNewPathMode("browse");
    setNewPathTemplateBase("");
    setNewPathSuffix("");
  };

  const openPathDialog = (prefillKey = "") => {
    resetPathDialog();
    if (prefillKey) {
      setNewPathKey(prefillKey);
    }
    setAddPathDialog(true);
  };

  const closePathDialog = () => {
    setAddPathDialog(false);
    resetPathDialog();
  };

  const addNewPath = () => {
    const finalPath =
      newPathMode === "template" && newPathTemplateBase
        ? `${basePaths[newPathTemplateBase] || ""}${newPathSuffix ? `${getPlatformPathSeparator(runtimePlatform)}${normalizePathSuffix(newPathSuffix, runtimePlatform)}` : ""}`
        : newPathValue;

    if (!newPathKey || !finalPath) {
      return;
    }

    setBasePaths((prev) => ({
      ...prev,
      [newPathKey.trim()]: finalPath.trim(),
    }));
    showSnackbar(`Base path "${newPathKey}" added successfully`, "success");
    closePathDialog();
  };

  const browseForNewPath = async () => {
    const pickedPath = await pickDirectory(newPathValue || basePaths[newPathTemplateBase] || "");
    if (pickedPath) {
      setNewPathMode("browse");
      setNewPathValue(pickedPath);
    }
  };

  const browseForExistingBasePath = async (pathKey) => {
    const pickedPath = await pickDirectory(basePaths[pathKey] || "");
    if (pickedPath) {
      setBasePaths((prev) => ({ ...prev, [pathKey]: pickedPath }));
    }
  };

  const removePath = (pathKey) => {
    setBasePaths((prev) => {
      const nextPaths = { ...prev };
      delete nextPaths[pathKey];
      return nextPaths;
    });
  };

  const newServiceKey = newServiceName.trim().replace(/\s+/g, "-");
  const newServiceError = !newServiceKey
    ? ""
    : services[newServiceKey]
    ? `A service named "${newServiceKey}" already exists`
    : "";

  const addNewService = () => {
    if (!newServiceKey || newServiceError) return;
    setServiceFilter("");
    setGroupChip("");
    setServices((prev) => ({
      ...prev,
      [newServiceKey]: {
        type: "",
        port: "",
        path: "",
        command: "",
        stopCommand: "",
        healthCommand: "",
        build: "",
        group: "",
        dependsOn: [],
        description: "",
      },
    }));
    setSelectedService(newServiceKey);
    setNewServiceName("");
    setAddServiceDialog(false);
    showSnackbar(`Service "${newServiceKey}" added — Save to keep it`, "success");
  };

  const confirmPendingDelete = () => {
    if (!pendingDelete) return;
    if (pendingDelete.kind === "path") {
      removePath(pendingDelete.name);
    } else if (pendingDelete.kind === "preset") {
      const { [pendingDelete.name]: _removed, ...rest } = effectivePresets;
      setPresets(rest);
    } else {
      removeService(pendingDelete.name);
    }
    showSnackbar(`Deleted ${pendingDelete.kind} "${pendingDelete.name}". Click Save to apply.`, "info");
    setPendingDelete(null);
  };

  const pendingDeleteImpact = useMemo(() => {
    if (!pendingDelete) return "";
    if (pendingDelete.kind === "preset") {
      return `It starts ${(effectivePresets[pendingDelete.name] || []).length} services. The services themselves are not affected.`;
    }
    if (pendingDelete.kind === "path") {
      const count = getPathUsageCount(pendingDelete.name, services);
      return count > 0
        ? `${count} service${count === 1 ? " uses" : "s use"} ${tokenForBasePath(pendingDelete.name)} and will no longer resolve.`
        : "No services use this path.";
    }
    const dependents = Object.entries(services)
      .filter(([, svc]) => Array.isArray(svc.dependsOn) && svc.dependsOn.includes(pendingDelete.name))
      .map(([name]) => name);
    return dependents.length > 0
      ? `Depended on by: ${dependents.join(", ")}.`
      : "No other services depend on it.";
  }, [pendingDelete, services, effectivePresets]);

  const removeService = (serviceName) => {
    setPresets((previous) =>
      previous
        ? Object.fromEntries(Object.entries(previous).map(([name, list]) => [name, list.filter((entry) => entry !== serviceName)]))
        : previous
    );
    setRunConfig((previous) => {
      if (!previous.services?.[serviceName]) return previous;
      const { [serviceName]: _removed, ...rest } = previous.services;
      return { services: rest };
    });
    setServices((prev) => {
      const nextServices = { ...prev };
      delete nextServices[serviceName];
      return nextServices;
    });
    if (selectedService === serviceName) {
      setSelectedService(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress size={48} />
      </Box>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        height: "100%",
        minHeight: 0,
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      {/* Top bar inside the card: tabs on the left, actions on the right (same pattern as Logs and Help) */}
      <Box
        sx={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          columnGap: 1,
          px: 1,
          minHeight: TOP_BAR_HEIGHT,
          borderBottom: "1px solid var(--c-border-94a3b8-016)",
          backgroundColor: "var(--c-bg-f8fafc-088)",
        }}
      >
        <Tabs
          value={currentTab}
          onChange={(_, value) => {
            // Unapplied JSON edits would otherwise be left behind silently.
            if (currentTab === 5 && value !== 5 && anyJsonTouched) {
              setPendingTab(value);
              return;
            }
            // Fresh JSON views of the current draft, except files with un-applied edits.
            if (value === 5) refreshJsonDrafts();
            setCurrentTab(value);
          }}
          sx={{
            minHeight: TOP_BAR_HEIGHT,
            "& .MuiTab-root": {
              minHeight: TOP_BAR_HEIGHT,
              textTransform: "none",
              fontWeight: 700,
              px: 1.5,
            },
          }}
        >
          <Tab icon={<StorageIcon fontSize="small" />} iconPosition="start" label={`Paths (${Object.keys(basePaths).length})`} />
          <Tab icon={<SettingsIcon fontSize="small" />} iconPosition="start" label={`Services (${Object.keys(services).length})`} />
          <Tab icon={<LogsIcon fontSize="small" />} iconPosition="start" label="Logs" />
          <Tab icon={<PresetsIcon fontSize="small" />} iconPosition="start" label={`Presets (${presetNames.length})`} />
          <Tab icon={<AppearanceIcon fontSize="small" />} iconPosition="start" label="Appearance" />
          <Tab icon={<ImportExportIcon fontSize="small" />} iconPosition="start" label="Import / Export" />
        </Tabs>

        <Box sx={{ flex: 1 }} />

        <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.5, pr: 0.5 }}>
          {isDirty ? <Chip size="small" color="warning" variant="outlined" label="Unsaved changes" /> : null}
          <Tooltip
            title={
              dependencyCheck
                ? "On: a service won't start while a dependency is stopped, and waits for dependencies that are still starting. Applies after Save."
                : "Off: services start without checking their dependencies (start order is still followed). Applies after Save."
            }
          >
            <FormControlLabel
              control={<Switch size="small" checked={dependencyCheck} onChange={(event) => setDependencyCheck(event.target.checked)} />}
              label={<Typography variant="caption" sx={{ fontWeight: 600 }}>Dependency check</Typography>}
              sx={{ mr: 0.5, whiteSpace: "nowrap" }}
            />
          </Tooltip>
          {runtimeInfo ? (
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
              {prettifyPlatform(runtimeInfo.platform)}
              {runtimeInfo?.overrideActive ? " • Override active" : ""}
            </Typography>
          ) : null}
          <Tooltip title={isDirty ? "Reload saved configuration (discards unsaved changes)" : "Reload saved configuration"}>
            <span>
              <IconButton
                size="small"
                aria-label="Reload saved configuration"
                onClick={() => (isDirty ? setConfirmReloadOpen(true) : loadConfig())}
                disabled={refreshing || saving}
              >
                {refreshing ? <CircularProgress size={16} /> : <ReloadConfigIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
          {currentTab <= 3 && currentTab !== 2 ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => (currentTab === 0 ? openPathDialog() : currentTab === 3 ? addPreset() : setAddServiceDialog(true))}
            >
              {currentTab === 0 ? "Add path" : currentTab === 3 ? "Add preset" : "Add service"}
            </Button>
          ) : null}
          <Button
            size="small"
            variant="contained"
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
            onClick={requestSave}
            disabled={saving || !isDirty}
          >
            Save
          </Button>
        </Stack>
      </Box>

      {errorIssues.length > 0 ? (
        <Alert
          severity="error"
          sx={{ flexShrink: 0, py: 0.25, borderRadius: 0, borderBottom: "1px solid var(--c-border-dc2626-02)", "& .MuiAlert-message": { width: "100%" } }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            Fix {errorIssues.length} issue{errorIssues.length === 1 ? "" : "s"} before saving
          </Typography>
          <Box sx={{ maxHeight: 88, overflowY: "auto" }}>
            {errorIssues.map((issue, idx) => (
              <Box
                key={idx}
                component="button"
                type="button"
                onClick={() => {
                  setCurrentTab(1);
                  setServiceFilter("");
                  setSelectedService(issue.scope);
                }}
                sx={{
                  display: "block",
                  p: 0,
                  border: 0,
                  background: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  font: "inherit",
                  fontSize: "0.8rem",
                  color: "inherit",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                <strong>{issue.scope}:</strong> {issue.message}
              </Box>
            ))}
          </Box>
        </Alert>
      ) : null}

      {/* Content Area */}
      <Box sx={{ flexGrow: 1, minHeight: 0, overflow: "hidden", display: "flex" }}>
        {currentTab === 0 && (
          <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, overflowY: "auto" }}>
            <Box
              sx={{
                px: 2,
                py: 1,
                borderBottom: "1px solid var(--c-border-94a3b8-016)",
                backgroundColor: "var(--c-bg-f8fafc-08)",
              }}
            >
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Base paths are shared folder roots. Use a path's token (click to copy) inside service paths and commands so the config stays portable.
              </Typography>
            </Box>
            {Object.entries(basePaths).map(([pathKey, pathValue]) => (
              <BasePathRow
                key={pathKey}
                pathKey={pathKey}
                pathValue={pathValue}
                usageCount={getPathUsageCount(pathKey, services)}
                onChange={(value) => setBasePaths((prev) => ({ ...prev, [pathKey]: value }))}
                onDelete={() => setPendingDelete({ kind: "path", name: pathKey })}
                onBrowse={() => browseForExistingBasePath(pathKey)}
                onCopyToken={() => copyToken(pathKey)}
              />
            ))}
            {Object.keys(basePaths).length === 0 ? (
              <Box sx={{ p: 4, textAlign: "center" }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  No base paths configured yet
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
                  Start with common roots like your Lextr workspace, frontend folder, or backend microservices root.
                </Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => openPathDialog()}>
                  Add First Path
                </Button>
              </Box>
            ) : null}
          </Box>
        )}

        {currentTab === 1 && (
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "240px minmax(0, 1fr)", lg: "280px minmax(0, 1fr)" },
              gridTemplateRows: { xs: "minmax(0, 40%) minmax(0, 1fr)", md: "minmax(0, 1fr)" },
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                borderRight: { md: "1px solid var(--c-text-94a3b8-018)" },
                borderBottom: { xs: "1px solid var(--c-text-94a3b8-018)", md: 0 },
                backgroundColor: "var(--c-bg-f8fafc-06)",
              }}
            >
              <Box sx={{ p: 1, flexShrink: 0, borderBottom: "1px solid var(--c-border-94a3b8-016)" }}>
                <TextField
                  fullWidth
                  size="small"
                  value={serviceFilter}
                  onChange={(event) => setServiceFilter(event.target.value)}
                  placeholder="Search services, groups, paths…"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ fontSize: "1rem" }} />
                      </InputAdornment>
                    ),
                    sx: SEARCH_INPUT_SX,
                  }}
                />
                <Stack direction="row" spacing={0.5} sx={{ mt: 0.75 }} flexWrap="wrap" useFlexGap>
                  {groupedServices.map(([groupName, groupServices]) => (
                    <Chip
                      key={groupName}
                      size="small"
                      label={`${groupName} · ${groupServices.length}`}
                      variant={groupChip === groupName ? "filled" : "outlined"}
                      color={groupChip === groupName ? "primary" : "default"}
                      aria-pressed={groupChip === groupName}
                      onClick={() => setGroupChip((previous) => (previous === groupName ? "" : groupName))}
                      sx={{ fontSize: "0.7rem" }}
                    />
                  ))}
                </Stack>
              </Box>

              <Box sx={{ flexGrow: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
                {filteredServices.length === 0 ? (
                  <EmptyState title="No services match this filter" hint="Try a different search term or clear the filter." />
                ) : (
                  filteredServices.map(([serviceName, service]) => (
                    <ServiceListItem
                      key={serviceName}
                      serviceName={serviceName}
                      service={service}
                      running={Boolean(runningStates[serviceName])}
                      isSelected={selectedService === serviceName}
                      hasError={servicesWithErrors.has(serviceName)}
                      onSelect={() => setSelectedService(serviceName)}
                      onDelete={() => setPendingDelete({ kind: "service", name: serviceName })}
                      onClone={() => cloneService(serviceName)}
                    />
                  ))
                )}
              </Box>
            </Box>

            <Box sx={{ minHeight: 0, minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {selectedService && services[selectedService] ? (
                <ServiceEditor
                  serviceName={selectedService}
                  service={services[selectedService]}
                  services={services}
                  basePaths={basePaths}
                  runtimePlatform={runtimePlatform}
                  onServiceChange={handleServiceChange}
                  onPickDirectory={pickDirectory}
                  onClone={() => cloneService(selectedService)}
                  onRename={() => handleOpenRename(selectedService)}
                  runSettings={runConfig.services?.[selectedService] || {}}
                  onRunSettingsChange={(next) =>
                    setRunConfig((previous) => ({ services: { ...previous.services, [selectedService]: next } }))
                  }
                  validationIssues={validationResult.issues}
                />
              ) : (
                <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <EmptyState icon={<SettingsIcon />} title="No service selected" hint="Pick a service on the left, or add a new one." />
                </Box>
              )}
            </Box>
          </Box>
        )}
        {currentTab === 2 && (
          <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, overflowY: "auto", p: { xs: 2, md: 3 } }}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 3fr) minmax(0, 2fr)" }, gap: 2.5, alignItems: "start" }}>
              <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2.5, p: 2.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Log retention</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
                  Every start or restart writes a new log. Choose what happens to earlier runs. The current run of each
                  service is never deleted. Changes apply after you Save.
                </Typography>

                <Typography variant="overline" sx={{ fontWeight: 800, color: "text.secondary" }}>Previous runs</Typography>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={effectiveLogSettings.previousRuns}
                  onChange={(_, value) => value && updateLogSetting("previousRuns", value === DEFAULT_LOG_SETTINGS.previousRuns ? undefined : value)}
                  sx={{ display: "flex", mb: 1, "& .MuiToggleButton-root": { flex: 1, textTransform: "none", py: 1, alignItems: "flex-start", flexDirection: "column", textAlign: "left" } }}
                >
                  <ToggleButton value="archive">
                    <Typography sx={{ fontWeight: 700, fontSize: "0.85rem" }}>Archive</Typography>
                    <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>Keep earlier runs for a limited time</Typography>
                  </ToggleButton>
                  <ToggleButton value="delete">
                    <Typography sx={{ fontWeight: 700, fontSize: "0.85rem" }}>Delete</Typography>
                    <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>Remove earlier runs when a new run starts</Typography>
                  </ToggleButton>
                </ToggleButtonGroup>

                <Grid container spacing={2} sx={{ mt: 0.5 }}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Keep archived runs for (days)"
                      value={logSettings.retentionDays ?? ""}
                      placeholder={`${DEFAULT_LOG_SETTINGS.retentionDays} (default)`}
                      onChange={(event) => updateLogSetting("retentionDays", event.target.value, 365)}
                      disabled={effectiveLogSettings.previousRuns === "delete"}
                      InputLabelProps={{ shrink: true }}
                      inputProps={{ min: 1, max: 365 }}
                      helperText="Older archived runs are deleted permanently."
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Keep at most (runs per service)"
                      value={logSettings.maxRuns ?? ""}
                      placeholder={`${DEFAULT_LOG_SETTINGS.maxRuns} (default)`}
                      onChange={(event) => updateLogSetting("maxRuns", event.target.value, 500)}
                      disabled={effectiveLogSettings.previousRuns === "delete"}
                      InputLabelProps={{ shrink: true }}
                      inputProps={{ min: 1, max: 500 }}
                      helperText="Beyond this, the oldest runs are deleted."
                    />
                  </Grid>
                </Grid>

                <Alert severity="info" sx={{ mt: 2 }}>
                  {effectiveLogSettings.previousRuns === "delete"
                    ? "Only the current run of each service is kept. Earlier runs are deleted as soon as a service starts again."
                    : `Earlier runs are kept for up to ${effectiveLogSettings.retentionDays} day${effectiveLogSettings.retentionDays === 1 ? "" : "s"} and at most ${effectiveLogSettings.maxRuns} per service, whichever limit is reached first.`}
                </Alert>

                <Box sx={{ mt: 2.5, pt: 2, borderTop: "1px solid var(--c-border-94a3b8-02)" }}>
                  <Typography variant="overline" sx={{ fontWeight: 800, color: "text.secondary" }}>Log viewer</Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={logSettings.combinedView === true}
                        onChange={(event) =>
                          setLogSettings((previous) => {
                            const { combinedView: _previousCombinedView, ...rest } = previous;
                            return event.target.checked ? { ...rest, combinedView: true } : rest;
                          })
                        }
                      />
                    }
                    label={<Typography variant="body2" sx={{ fontWeight: 700 }}>Combined log view</Typography>}
                    sx={{ display: "flex", ml: 0, gap: 1 }}
                  />
                  <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                    Adds a Combined logs button to the Logs page: several services in one live view, ordered by time and
                    tagged with their service. Filter by a trace ID to follow one request across services. Off by default.
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2.5, p: 2.5 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Old logs on disk</Typography>
                  <Tooltip title="Reload">
                    <IconButton size="small" aria-label="Reload old log stats" onClick={loadArchiveStats}>
                      <SyncIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>

                {!archiveStats ? (
                  <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
                    {archiveStatsError || "Loading…"}
                  </Typography>
                ) : archiveStats.files === 0 ? (
                  <Box sx={{ mt: 1.5, p: 2, borderRadius: 2, backgroundColor: "var(--c-bg-10b981-006)", border: "1px solid var(--c-border-10b981-02)" }}>
                    <Typography sx={{ fontWeight: 700 }}>Nothing to clean up</Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                      No logs from earlier runs are stored. Logs of runs in progress are never counted here.
                    </Typography>
                  </Box>
                ) : (
                  <>
                    <Typography sx={{ fontSize: "2rem", fontWeight: 800, lineHeight: 1.1, mt: 1.5 }}>
                      {formatBytes(archiveStats.bytes)}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                      {archiveStats.files} log file{archiveStats.files === 1 ? "" : "s"} from runs that have already ended,
                      across {archiveStats.services} service{archiveStats.services === 1 ? "" : "s"}. Logs of runs in progress are not included.
                    </Typography>

                    <Box sx={{ mt: 2.5, pt: 2, borderTop: "1px solid var(--c-border-94a3b8-02)" }}>
                      <Typography sx={{ fontWeight: 700, fontSize: "0.9rem" }}>Free up this space</Typography>
                      <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.25, mb: 1.5 }}>
                        Removes all previous run logs for every service now. Services keep running and keep logging to their
                        current run. This cannot be undone.
                      </Typography>
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={clearingArchives ? <CircularProgress size={14} color="inherit" /> : <DeleteIcon />}
                        onClick={() => setConfirmClearArchives(true)}
                        disabled={clearingArchives}
                      >
                        Delete previous run logs · free {formatBytes(archiveStats.bytes)}
                      </Button>
                    </Box>
                  </>
                )}
              </Box>
            </Box>
          </Box>
        )}

        {currentTab === 3 && (
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "240px minmax(0, 1fr)", lg: "280px minmax(0, 1fr)" },
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                borderRight: { md: "1px solid var(--c-text-94a3b8-018)" },
                backgroundColor: "var(--c-bg-f8fafc-06)",
              }}
            >
              <Box sx={{ p: 1.5, borderBottom: "1px solid var(--c-border-94a3b8-016)" }}>
                <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.78rem" }}>
                  {presets
                    ? "Custom presets saved in the configuration."
                    : "Built-in presets (based on service groups). Editing any preset saves all of them to the configuration."}
                </Typography>
                {presets ? (
                  <Button size="small" sx={{ mt: 0.5, px: 0 }} onClick={() => setConfirmResetPresetsOpen(true)}>
                    Reset to built-in presets
                  </Button>
                ) : null}
              </Box>
              <Box sx={{ flex: 1, overflowY: "auto", p: 0.75 }}>
                {presetNames.map((name) => {
                  const active = name === activePresetName;
                  return (
                    <Box
                      key={name}
                      component="button"
                      type="button"
                      onClick={() => setSelectedPresetName(name)}
                      sx={{
                        display: "flex",
                        width: "100%",
                        alignItems: "center",
                        gap: 1,
                        px: 1.25,
                        py: 1,
                        mb: 0.25,
                        border: 0,
                        borderRadius: 1.5,
                        cursor: "pointer",
                        textAlign: "left",
                        font: "inherit",
                        color: "text.primary",
                        backgroundColor: active ? "color-mix(in srgb, var(--sm-accent) 8%, transparent)" : "transparent",
                        boxShadow: active ? "inset 3px 0 0 var(--sm-accent)" : "none",
                        "&:hover": { backgroundColor: active ? "color-mix(in srgb, var(--sm-accent) 12%, transparent)" : "var(--c-bg-94a3b8-008)" },
                      }}
                    >
                      <Typography sx={{ flex: 1, fontSize: "0.85rem", fontWeight: active ? 700 : 600 }} noWrap>
                        {name}
                      </Typography>
                      <Chip size="small" label={effectivePresets[name].length} sx={{ fontWeight: 700 }} />
                    </Box>
                  );
                })}
              </Box>
            </Box>

            <Box sx={{ minHeight: 0, overflowY: "auto", p: { xs: 2, md: 3 } }}>
              {activePresetName ? (
                <Box sx={{ maxWidth: 900 }}>
                  <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 2.5 }}>
                    <TextField
                      size="small"
                      label="Preset name"
                      value={presetNameDraft}
                      onChange={(event) => setPresetNameDraft(event.target.value)}
                      onBlur={() => renamePreset(activePresetName, presetNameDraft)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") renamePreset(activePresetName, presetNameDraft);
                      }}
                      error={presetNameError !== ""}
                      helperText={presetNameError || " "}
                      sx={{ flex: 1 }}
                    />
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => setPendingDelete({ kind: "preset", name: activePresetName })}
                    >
                      Delete
                    </Button>
                  </Stack>

                  <Typography variant="overline" sx={{ fontWeight: 800, color: "text.secondary" }}>
                    Services started by this preset
                  </Typography>
                  <Autocomplete
                    multiple
                    size="small"
                    filterSelectedOptions
                    options={Object.keys(services)}
                    value={effectivePresets[activePresetName]}
                    onChange={(_, value) => updatePresetServices(activePresetName, value)}
                    ChipProps={{ size: "small" }}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          {...getTagProps({ index })}
                          key={option}
                          size="small"
                          label={option}
                          color={services[option] ? "default" : "error"}
                          variant={services[option] ? "filled" : "outlined"}
                        />
                      ))
                    }
                    renderInput={(params) => <TextField {...params} placeholder="Add services" />}
                  />
                  {effectivePresets[activePresetName].some((name) => !services[name]) ? (
                    <Typography variant="caption" sx={{ color: "error.main", display: "block", mt: 0.5 }}>
                      Red services no longer exist and are skipped when the preset runs.
                    </Typography>
                  ) : null}

                  <Typography variant="overline" sx={{ fontWeight: 800, color: "text.secondary", display: "block", mt: 2.5 }}>
                    Add a whole group
                  </Typography>
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    {serviceGroupsForPresets.map(([group, members]) => (
                      <Chip
                        key={group}
                        size="small"
                        clickable
                        icon={<AddIcon />}
                        label={`${group} (${members.length})`}
                        onClick={() =>
                          updatePresetServices(activePresetName, [...new Set([...effectivePresets[activePresetName], ...members])])
                        }
                      />
                    ))}
                  </Stack>
                  <Typography variant="body2" sx={{ color: "text.secondary", mt: 3 }}>
                    Running a preset starts these services (and anything they depend on) in dependency order. Changes
                    apply after you Save.
                  </Typography>
                </Box>
              ) : (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  No presets. Use "Add preset" to create one.
                </Typography>
              )}
            </Box>
          </Box>
        )}

        {currentTab === 4 && (
          <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, overflowY: "auto", p: { xs: 2, md: 3 } }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Theme</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5, maxWidth: 720 }}>
              Just for you: applies immediately and is remembered in this browser. It is not part of Save and doesn't change the
              configuration.
            </Typography>
            <ThemePicker />
            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Default card style</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 2, maxWidth: 720 }}>
              How services appear on the Dashboard for everyone using this configuration. Each person can still pick their own
              style in Dashboard › View › Card style. Changes apply after you Save. Previews show an example service
              (running, on main).
            </Typography>
            <Box
              role="radiogroup"
              aria-label="Default card style"
              sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 2, maxWidth: 1200, alignItems: "stretch" }}
            >
              {CARD_STYLES.map((style) => {
                const active = cardStyle === style.id;
                return (
                  <Box
                    key={style.id}
                    role="radio"
                    tabIndex={0}
                    aria-checked={active}
                    aria-label={`${style.label} card style`}
                    onClick={() => setCardStyle(style.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setCardStyle(style.id);
                      }
                    }}
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      textAlign: "left",
                      font: "inherit",
                      cursor: "pointer",
                      p: 1.5,
                      borderRadius: 2.5,
                      border: "2px solid",
                      borderColor: active ? "primary.main" : "divider",
                      bgcolor: active ? "color-mix(in srgb, var(--sm-accent) 4%, transparent)" : "background.paper",
                      "&:hover": { borderColor: active ? "primary.main" : "var(--c-border-94a3b8)" },
                      "&:focus-visible": { outline: "2px solid color-mix(in srgb, var(--sm-accent) 50%, transparent)", outlineOffset: 2 },
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.25 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", flex: 1 }}>{style.label}</Typography>
                      {style.id === DEFAULT_CARD_STYLE ? <Chip size="small" variant="outlined" label="Default" /> : null}
                    </Stack>
                    <Typography sx={{ fontSize: "0.78rem", color: "text.secondary", mb: 1.25, minHeight: "2.8em", lineHeight: 1.4 }}>
                      {style.description}
                    </Typography>
                    <Box>
                      <LiveCardPreview styleId={style.id} sample={PREVIEW_SAMPLE} />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {currentTab === 5 && (
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              gap: 2,
              p: { xs: 2, md: 2.5 },
              overflow: { xs: "auto", md: "hidden" },
            }}
          >
            <Box sx={{ width: { xs: "100%", md: 400 }, flexShrink: 0, overflow: { md: "auto" } }}>
              <ConfigTransferPanel
                getDraftConfig={buildDraftConfig}
                runConfig={runConfig}
                current={transferState}
                onApplyImport={applyImport}
                showSnackbar={showSnackbar}
                validate={validateForImport}
                platform={runtimePlatform}
              />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0, minHeight: { xs: 480, md: 0 }, display: "flex", flexDirection: "column" }}>
              <Box
                sx={{
                  flex: 1,
                  minHeight: 320,
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 2,
                  overflow: "hidden",
                  border: "1px solid",
                  borderColor: jsonParseError ? "error.main" : jsonUnlocked ? "primary.main" : "var(--c-border-94a3b8-025)",
                  backgroundColor: "background.paper",
                }}
              >
                <Tabs
                  value={jsonFile}
                  onChange={(_, value) => setJsonFile(value)}
                  aria-label="Configuration file"
                  sx={{
                    minHeight: 40,
                    px: 1,
                    backgroundColor: "var(--c-bg-f8fafc)",
                    borderBottom: "1px solid var(--c-border-94a3b8-016)",
                    "& .MuiTab-root": { minHeight: 40, textTransform: "none", fontWeight: 700, px: 1.5 },
                  }}
                >
                  {[
                    { value: "services", file: "services.json", scope: "Shared" },
                    { value: "run", file: "run-config.json", scope: "This machine" },
                  ].map((tab) => (
                    <Tab
                      key={tab.value}
                      value={tab.value}
                      label={
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <Box component="span" sx={{ fontFamily: CODE_FONT, fontSize: "0.82rem" }}>
                            {tab.file}
                          </Box>
                          <Chip size="small" variant="outlined" label={tab.scope} sx={{ height: 18, fontSize: "0.65rem", fontWeight: 600 }} />
                          {jsonDocs[tab.value].touched ? (
                            <Box
                              component="span"
                              title="Not applied"
                              sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "warning.main" }}
                            />
                          ) : null}
                        </Stack>
                      }
                    />
                  ))}
                </Tabs>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  flexWrap="wrap"
                  useFlexGap
                  sx={{ px: 1.5, py: 1, borderBottom: "1px solid var(--c-border-94a3b8-016)" }}
                >
                  <Chip
                    size="small"
                    icon={jsonUnlocked ? <LockOpenIcon /> : <LockIcon />}
                    label={jsonUnlocked ? "Editing" : "Read-only"}
                    color={jsonUnlocked ? "primary" : "default"}
                    variant="outlined"
                  />
                  {jsonTouched ? <Chip size="small" color="warning" variant="outlined" label="Not applied" /> : null}
                  <Typography sx={{ flex: 1, minWidth: 160, fontSize: "0.78rem", color: jsonParseError ? "error.main" : "text.secondary" }}>
                    {jsonParseError ||
                      (jsonUnlocked
                        ? "Apply to editor loads it into the forms; Save writes it."
                        : jsonFile === "run"
                          ? "This machine only, never committed. Secret values show as <hidden> and are kept unless you replace them."
                          : "Shared configuration, committed to git.")}
                  </Typography>
                  {jsonUnlocked ? (
                    <>
                      <Button
                        size="small"
                        onClick={() => {
                          try {
                            setJsonText(JSON.stringify(JSON.parse(jsonText), null, 2), false);
                          } catch (error) {
                            showSnackbar(`Invalid JSON: ${error.message}`, "error");
                          }
                        }}
                      >
                        Format
                      </Button>
                      {jsonTouched ? (
                        <Button size="small" onClick={() => openJsonDraft([jsonFile])}>
                          Discard
                        </Button>
                      ) : (
                        <Button size="small" startIcon={<LockIcon />} onClick={() => setJsonUnlocked(false)}>
                          Lock
                        </Button>
                      )}
                      <Button size="small" variant="contained" onClick={applyJsonDraft} disabled={!jsonTouched || Boolean(jsonParseError)}>
                        Apply to editor
                      </Button>
                    </>
                  ) : (
                    <Button size="small" variant="outlined" startIcon={<LockOpenIcon />} onClick={() => setJsonUnlocked(true)}>
                      Unlock to edit
                    </Button>
                  )}
                </Stack>
                <Box
                  component="textarea"
                  value={jsonText}
                  readOnly={!jsonUnlocked}
                  spellCheck={false}
                  aria-label={jsonFile === "run" ? "run-config.json" : "services.json"}
                  onChange={(event) => setJsonText(event.target.value)}
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    width: "100%",
                    m: 0,
                    p: 1.75,
                    border: 0,
                    outline: 0,
                    resize: "none",
                    whiteSpace: "pre",
                    overflow: "auto",
                    fontFamily: CODE_FONT,
                    fontSize: "0.8rem",
                    lineHeight: 1.55,
                    tabSize: 2,
                    color: jsonUnlocked ? "text.primary" : "text.secondary",
                    backgroundColor: jsonUnlocked ? "background.paper" : "var(--c-bg-f8fafc)",
                    cursor: jsonUnlocked ? "text" : "default",
                  }}
                />
              </Box>
            </Box>
          </Box>
        )}

      </Box>

      <Dialog open={addPathDialog} onClose={closePathDialog} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Add base path</DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid item xs={12} md={7}>
              <Stack spacing={2}>
                <TextField
                  autoFocus
                  label="Path key"
                  value={newPathKey}
                  onChange={(event) => setNewPathKey(event.target.value.replace(/\s+/g, "-"))}
                  placeholder="java, frontend, microservices"
                  helperText={String.raw`Stored as \${basePaths.key} and reused throughout service paths.`}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
                />

                <Box>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1 }}>
                    Suggested keys
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {commonBasePathKeys.map((key) => (
                      <Chip key={key} size="small" clickable label={key} onClick={() => setNewPathKey(key)} />
                    ))}
                  </Stack>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1 }}>
                    Path source
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {[
                      { value: "browse", label: "Browse Local Folder" },
                      { value: "manual", label: "Enter Path Manually" },
                      { value: "template", label: "Compose from Existing Base Path" },
                    ].map((option) => (
                      <Chip
                        key={option.value}
                        clickable
                        color={newPathMode === option.value ? "primary" : "default"}
                        variant={newPathMode === option.value ? "filled" : "outlined"}
                        label={option.label}
                        onClick={() => setNewPathMode(option.value)}
                      />
                    ))}
                  </Stack>
                </Box>

                {newPathMode === "browse" && (
                  <Stack spacing={1.5}>
                    <TextField
                      label="Selected directory"
                      value={newPathValue}
                      onChange={(event) => setNewPathValue(event.target.value)}
                      placeholder="Use Browse to pick a local folder"
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
                    />
                    <Button variant="outlined" startIcon={<FolderOpenIcon />} onClick={browseForNewPath} disabled={pickerBusy}>
                      {pickerBusy ? "Opening Folder Picker…" : "Browse Folder"}
                    </Button>
                  </Stack>
                )}

                {newPathMode === "manual" && (
                  <TextField
                    label="Directory path"
                    value={newPathValue}
                    onChange={(event) => setNewPathValue(event.target.value)}
                    placeholder={runtimePlatform === "win32" ? "C:\\projects" : "~/projects"}
                    helperText="Absolute path or home-relative path."
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
                  />
                )}

                {newPathMode === "template" && (
                  <Grid container spacing={1.5}>
                    <Grid item xs={12} md={5}>
                      <FormControl fullWidth>
                        <InputLabel>Existing base path</InputLabel>
                        <Select
                          value={newPathTemplateBase}
                          label="Existing base path"
                          onChange={(event) => setNewPathTemplateBase(event.target.value)}
                          sx={{ borderRadius: 2.5 }}
                        >
                          {Object.keys(basePaths).map((key) => (
                            <MenuItem key={key} value={key}>
                              {key}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={7}>
                      <TextField
                        fullWidth
                        label="Sub path"
                        value={newPathSuffix}
                        onChange={(event) => setNewPathSuffix(event.target.value)}
                        placeholder={runtimePlatform === "win32" ? "services\\shared" : "services/shared"}
                        helperText="Optional folder appended to the selected base path."
                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
                      />
                    </Grid>
                  </Grid>
                )}
              </Stack>
            </Grid>

            <Grid item xs={12} md={5}>
              <Paper variant="outlined" sx={{ ...panelSx, p: 2, height: "100%" }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <AutoAwesomeIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                      Preview
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Final base path value stored in config:
                  </Typography>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      borderRadius: 2.5,
                      borderStyle: "dashed",
                      backgroundColor: "var(--c-bg-0f172a-003)",
                    }}
                  >
                    <Typography variant="body2" sx={{ fontFamily: CODE_FONT, wordBreak: "break-all" }}>
                      {newPathMode === "template" && newPathTemplateBase
                        ? `${basePaths[newPathTemplateBase] || ""}${newPathSuffix ? `${getPlatformPathSeparator(runtimePlatform)}${normalizePathSuffix(newPathSuffix, runtimePlatform)}` : ""}`
                        : newPathValue || "Choose a path source to preview the value"}
                    </Typography>
                  </Paper>

                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Services will reference it like:
                  </Typography>
                  <Chip
                    label={newPathKey ? tokenForBasePath(newPathKey) : String.raw`\${basePaths.your-key}`}
                    sx={{ width: "fit-content", fontFamily: CODE_FONT }}
                  />

                  <Alert severity="info" sx={{ borderRadius: 2.5 }}>
                    The folder picker opens on your local machine through the backend, which means you can choose real directories instead of typing them by hand.
                  </Alert>
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={closePathDialog}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={addNewPath}
            disabled={
              !newPathKey ||
              !(
                (newPathMode === "template" && newPathTemplateBase) ||
                (newPathMode !== "template" && newPathValue)
              )
            }
          >
            Add base path
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={addServiceDialog} onClose={() => setAddServiceDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Add new service</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Service name"
            margin="dense"
            value={newServiceName}
            onChange={(event) => setNewServiceName(event.target.value.replace(/\s+/g, "-"))}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addNewService();
              }
            }}
            error={Boolean(newServiceError)}
            helperText={newServiceError || "Spaces become dashes, e.g. billing-service"}
            placeholder="my-new-service"
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setAddServiceDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={addNewService} disabled={!newServiceKey || Boolean(newServiceError)}>
            Add service
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmSaveOpen} onClose={() => setConfirmSaveOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Save configuration?</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>
            These changes will be saved:
          </Typography>
          <Stack spacing={0.75} sx={{ maxHeight: 320, overflowY: "auto" }}>
            {pendingChanges.map((change, index) => (
              <Stack key={index} direction="row" spacing={1} alignItems="flex-start">
                <Chip
                  size="small"
                  label={change.kind === "added" ? "Added" : change.kind === "removed" ? "Removed" : "Changed"}
                  color={change.kind === "added" ? "success" : change.kind === "removed" ? "error" : "warning"}
                  variant="outlined"
                  sx={{ fontSize: "0.68rem", fontWeight: 700, minWidth: 72, flexShrink: 0 }}
                />
                <Typography variant="body2" sx={{ wordBreak: "break-word" }}>{change.text}</Typography>
              </Stack>
            ))}
            {pendingChanges.length === 0 ? (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>No changes to save.</Typography>
            ) : null}
          </Stack>
          {isRunConfigDirty ? (
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1.5 }}>
              Run configuration is saved on this machine only and is never committed. Values are not shown here.
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setConfirmSaveOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={saveConfig}
            disabled={saving || pendingChanges.length === 0}
          >
            Save {pendingChanges.length} change{pendingChanges.length === 1 ? "" : "s"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmClearArchives} onClose={() => setConfirmClearArchives(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Delete previous run logs?</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2">
            {archiveStats
              ? `This frees ${formatBytes(archiveStats.bytes)} by permanently deleting ${archiveStats.files} log files from earlier runs across ${archiveStats.services} services.`
              : "All logs from earlier runs will be deleted permanently."}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1 }}>
            Running services are not affected — they keep logging to their current run. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setConfirmClearArchives(false)}>Cancel</Button>
          <Button variant="contained" color="error" startIcon={<DeleteIcon />} onClick={clearArchives}>
            Delete and free space
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          Delete {pendingDelete?.kind} "{pendingDelete?.name}"?
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {pendingDeleteImpact}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1 }}>
            The change is applied when you click Save. Reload discards it.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
          <Button variant="contained" color="error" startIcon={<DeleteIcon />} onClick={confirmPendingDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmResetPresetsOpen} onClose={() => setConfirmResetPresetsOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Reset to built-in presets?</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2">
            Your custom presets are replaced by the built-in ones (one per service group).
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1 }}>
            The change is applied when you click Save. Reload discards it.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setConfirmResetPresetsOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              setConfirmResetPresetsOpen(false);
              setPresets(null);
            }}
          >
            Reset presets
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={pendingTab !== null} onClose={() => setPendingTab(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Leave without applying?</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2">
            Your changes in the JSON editor haven't been applied to the forms yet. Apply them first, or discard them and leave.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setPendingTab(null)}>Keep editing</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              openJsonDraft();
              setCurrentTab(pendingTab);
              setPendingTab(null);
            }}
          >
            Discard and leave
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmReloadOpen} onClose={() => setConfirmReloadOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Discard unsaved changes?</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2">
            Reloading replaces your edits with the saved configuration. This can't be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setConfirmReloadOpen(false)}>Keep editing</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              setConfirmReloadOpen(false);
              loadConfig();
            }}
          >
            Discard and reload
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={renameDialogOpen} onClose={() => setRenameDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Rename service</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Renaming <strong>{serviceToRename}</strong> will update the service key and its dependency references.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="New service name"
            value={newRenamedName}
            onChange={(e) => setNewRenamedName(e.target.value.replace(/\s+/g, "-"))}
            placeholder="e.g. auth-service-v2"
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setRenameDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleConfirmRename}
            disabled={!newRenamedName.trim() || newRenamedName.trim() === serviceToRename}
          >
            Rename
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={snackbarSeverity === "error" ? null : 4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ borderRadius: 2.5 }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default Admin;
