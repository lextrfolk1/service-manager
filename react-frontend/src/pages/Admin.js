import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Add as AddIcon,
  AutoAwesome as AutoAwesomeIcon,
  Close as CloseIcon,
  Code as CodeIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  FolderOpen as FolderOpenIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Storage as StorageIcon,
  WarningAmber as WarningAmberIcon,
} from "@mui/icons-material";
import api from "../services/api";
import { validateConfiguration } from "../utils/configValidation";

const shellCardSx = {
  borderRadius: 4,
  border: "1px solid rgba(148,163,184,0.2)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)",
  boxShadow: "0 24px 60px rgba(15,23,42,0.08)",
};

const panelSx = {
  borderRadius: 3,
  border: "1px solid rgba(148,163,184,0.18)",
  backgroundColor: "rgba(255,255,255,0.92)",
  boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
};

const sectionSx = {
  ...panelSx,
  p: 2.5,
};

const serviceTypeOptions = ["java", "python", "npm", "redis", "neo4j", "listener"];
const commonBasePathKeys = ["java", "python", "npm", "listener", "frontend", "backend", "microservices"];

function prettifyLabel(value = "") {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function tokenForBasePath(key) {
  return `\${basePaths.${key}}`;
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

function StatsStrip({ items }) {
  return (
    <Grid container spacing={1.5}>
      {items.map((item) => (
        <Grid item xs={6} md={3} key={item.label}>
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              borderRadius: 3,
              borderColor: "rgba(148,163,184,0.2)",
              background: item.background,
            }}
          >
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>
              {item.label}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {item.value}
            </Typography>
            {item.helper && (
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {item.helper}
              </Typography>
            )}
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}

function SectionTitle({ eyebrow, title, description, actions }) {
  return (
    <Stack
      direction={{ xs: "column", lg: "row" }}
      spacing={1.5}
      alignItems={{ xs: "flex-start", lg: "center" }}
      justifyContent="space-between"
      sx={{ mb: 2 }}
    >
      <Box>
        {eyebrow && (
          <Typography variant="caption" sx={{ color: "primary.main", fontWeight: 700, letterSpacing: 0.4 }}>
            {eyebrow}
          </Typography>
        )}
        <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.25 }}>
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.75, maxWidth: 760 }}>
            {description}
          </Typography>
        )}
      </Box>
      {actions && (
        <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
          {actions}
        </Stack>
      )}
    </Stack>
  );
}

function ServiceListItem({ serviceName, service, isSelected, onSelect, onDelete }) {
  return (
    <Box
      onClick={onSelect}
      sx={{
        px: 2,
        py: 1.5,
        borderBottom: "1px solid rgba(148,163,184,0.14)",
        cursor: "pointer",
        background: isSelected
          ? "linear-gradient(90deg, rgba(37,99,235,0.14) 0%, rgba(124,58,237,0.08) 100%)"
          : "transparent",
        borderLeft: isSelected ? "3px solid #2563eb" : "3px solid transparent",
        transition: "background-color 0.2s ease, border-color 0.2s ease",
        "&:hover": {
          backgroundColor: "rgba(148,163,184,0.08)",
        },
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.75 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {serviceName}
            </Typography>
            {service.type && <Chip size="small" label={service.type} sx={{ height: 22, fontWeight: 600 }} />}
            {service.group && (
              <Chip
                size="small"
                label={service.group}
                variant="outlined"
                sx={{ height: 22, borderColor: "rgba(99,102,241,0.28)" }}
              />
            )}
            {service.port ? <Chip size="small" label={`:${service.port}`} variant="outlined" sx={{ height: 22 }} /> : null}
          </Stack>
          <Typography variant="caption" sx={{ display: "block", color: "text.secondary", mb: 0.5 }}>
            {service.path || "No path configured"}
          </Typography>
          {service.description ? (
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                lineHeight: 1.35,
              }}
            >
              {service.description}
            </Typography>
          ) : null}
        </Box>
        <Tooltip title="Delete service">
          <IconButton
            color="error"
            size="small"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
}

function BasePathRow({ pathKey, pathValue, usageCount, onChange, onDelete, onBrowse }) {
  return (
    <Paper variant="outlined" sx={{ ...panelSx, p: 2 }}>
      <Stack spacing={1.5}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {prettifyLabel(pathKey)}
            </Typography>
            <Chip size="small" label={tokenForBasePath(pathKey)} sx={{ fontFamily: "monospace", height: 22 }} />
            <Chip size="small" variant="outlined" label={`${usageCount} services`} sx={{ height: 22 }} />
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" startIcon={<FolderOpenIcon />} onClick={onBrowse}>
              Browse
            </Button>
            <IconButton color="error" onClick={onDelete}>
              <DeleteIcon />
            </IconButton>
          </Stack>
        </Stack>

        <TextField
          fullWidth
          value={pathValue}
          label="Directory Path"
          onChange={(event) => onChange(event.target.value)}
          placeholder="~/Workspace/codebase/lextr"
          sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
        />

        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Use <strong>{tokenForBasePath(pathKey)}</strong> inside service paths and build commands.
        </Typography>
      </Stack>
    </Paper>
  );
}

function ServiceEditor({
  serviceName,
  service,
  services,
  basePaths,
  onServiceChange,
  onPickDirectory,
}) {
  const [pathTemplateKey, setPathTemplateKey] = useState("");
  const [pathSuffix, setPathSuffix] = useState("");
  const [servicePathBusy, setServicePathBusy] = useState(false);

  useEffect(() => {
    const pathValue = service.path || "";
    const match = pathValue.match(/\$\{basePaths\.(\w+)\}(?:\/(.*))?$/);
    if (match) {
      setPathTemplateKey(match[1] || "");
      setPathSuffix(match[2] || "");
      return;
    }
    setPathTemplateKey("");
    setPathSuffix("");
  }, [service.path]);

  const dependencyOptions = useMemo(
    () => Object.keys(services || {}).filter((candidate) => candidate !== serviceName),
    [serviceName, services]
  );

  const applyTemplatePath = () => {
    if (!pathTemplateKey) return;
    const suffix = pathSuffix.replace(/^\/+/, "");
    onServiceChange(
      serviceName,
      "path",
      suffix ? `\${basePaths.${pathTemplateKey}}/${suffix}` : `\${basePaths.${pathTemplateKey}}`
    );
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

  return (
    <Box sx={{ height: "100%", width: "100%", minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <Box
        sx={{
          px: 3,
          py: 2.25,
          background:
            "linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.95) 35%, rgba(37,99,235,0.88) 100%)",
          color: "white",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }}>
          <Box>
            <Typography variant="caption" sx={{ opacity: 0.75, letterSpacing: 0.4 }}>
              SERVICE EDITOR
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.25 }}>
              {serviceName}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.82, mt: 0.5 }}>
              Keep the same service features, but edit them in a denser layout with stronger guidance.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip size="small" label={service.type || "type missing"} sx={{ backgroundColor: "rgba(255,255,255,0.12)", color: "white" }} />
            {service.group ? <Chip size="small" label={service.group} sx={{ backgroundColor: "rgba(255,255,255,0.12)", color: "white" }} /> : null}
            {service.port ? <Chip size="small" label={`Port ${service.port}`} sx={{ backgroundColor: "rgba(255,255,255,0.12)", color: "white" }} /> : null}
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ flexGrow: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", p: 2.5 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} xl={7} sx={{ minHeight: 0, minWidth: 0 }}>
            <Stack spacing={2}>
              <Card variant="outlined" sx={sectionSx}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1.5 }}>
                  Overview
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth>
                      <InputLabel>Service Type</InputLabel>
                      <Select
                        value={service.type || ""}
                        label="Service Type"
                        onChange={(event) => onServiceChange(serviceName, "type", event.target.value)}
                        sx={{ borderRadius: 2.5 }}
                      >
                        {serviceTypeOptions.map((type) => (
                          <MenuItem key={type} value={type}>
                            {prettifyLabel(type)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Port"
                      type="number"
                      value={service.port || ""}
                      onChange={(event) => onServiceChange(serviceName, "port", event.target.value)}
                      placeholder="8080"
                      helperText="Leave empty for workers or tools without ports."
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Group"
                      value={service.group || ""}
                      onChange={(event) => onServiceChange(serviceName, "group", event.target.value)}
                      placeholder="Core / Data / Frontend"
                      helperText="Used for dashboard grouping."
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Description"
                      value={service.description || ""}
                      onChange={(event) => onServiceChange(serviceName, "description", event.target.value)}
                      multiline
                      minRows={2}
                      placeholder="Short operational note for teammates."
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
                    />
                  </Grid>
                </Grid>
              </Card>

              <Card variant="outlined" sx={sectionSx}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} sx={{ mb: 1.5 }}>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                      Service Location
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.25 }}>
                      Choose a folder directly or compose a reusable template from base paths.
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    startIcon={<FolderOpenIcon />}
                    onClick={browseForServicePath}
                    disabled={servicePathBusy}
                  >
                    {servicePathBusy ? "Opening…" : "Pick Folder"}
                  </Button>
                </Stack>

                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    label="Service Path"
                    value={service.path || ""}
                    onChange={(event) => onServiceChange(serviceName, "path", event.target.value)}
                    placeholder={String.raw`\${basePaths.java}/my-service`}
                    helperText="Absolute paths work, but base path templates are easier to maintain."
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
                  />

                  <Grid container spacing={1.5}>
                    <Grid item xs={12} md={4}>
                      <FormControl fullWidth>
                        <InputLabel>Base Path</InputLabel>
                        <Select
                          value={pathTemplateKey}
                          label="Base Path"
                          onChange={(event) => setPathTemplateKey(event.target.value)}
                          sx={{ borderRadius: 2.5 }}
                        >
                          {Object.keys(basePaths || {}).map((key) => (
                            <MenuItem key={key} value={key}>
                              {key}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={5}>
                      <TextField
                        fullWidth
                        label="Sub Path"
                        value={pathSuffix}
                        onChange={(event) => setPathSuffix(event.target.value)}
                        placeholder="services/config-service"
                        helperText="Optional folder appended to the selected base path."
                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Button fullWidth variant="contained" onClick={applyTemplatePath} disabled={!pathTemplateKey} sx={{ height: "100%" }}>
                        Apply Template
                      </Button>
                    </Grid>
                  </Grid>

                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      borderRadius: 2.5,
                      borderStyle: "dashed",
                      borderColor: "rgba(37,99,235,0.24)",
                      backgroundColor: "rgba(37,99,235,0.04)",
                    }}
                  >
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>
                      Template Preview
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: "monospace", wordBreak: "break-all" }}>
                      {pathTemplateKey
                        ? pathSuffix
                          ? `\${basePaths.${pathTemplateKey}}/${pathSuffix.replace(/^\/+/, "")}`
                          : `\${basePaths.${pathTemplateKey}}`
                        : "Pick a base path to generate a reusable template."}
                    </Typography>
                  </Paper>
                </Stack>
              </Card>

              <Card variant="outlined" sx={sectionSx}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1.5 }}>
                  Runtime Commands
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Start Command"
                      value={service.command || ""}
                      onChange={(event) => onServiceChange(serviceName, "command", event.target.value)}
                      placeholder="npm run dev"
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Stop Command"
                      value={service.stopCommand || ""}
                      onChange={(event) => onServiceChange(serviceName, "stopCommand", event.target.value)}
                      placeholder="redis-cli shutdown"
                      helperText="Optional explicit stop hook."
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Health Check Command"
                      value={service.healthCommand || ""}
                      onChange={(event) => onServiceChange(serviceName, "healthCommand", event.target.value)}
                      placeholder="curl -f http://localhost:8080/actuator/health"
                      helperText="Optional health gate for accurate readiness."
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Build Command"
                      value={service.build || ""}
                      onChange={(event) => onServiceChange(serviceName, "build", event.target.value)}
                      placeholder="mvn clean install -DskipTests"
                      helperText="Runs when build mode is enabled for startup."
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
                    />
                  </Grid>
                </Grid>
              </Card>
            </Stack>
          </Grid>

          <Grid item xs={12} xl={5} sx={{ minHeight: 0, minWidth: 0 }}>
            <Stack spacing={2}>
              <Card variant="outlined" sx={sectionSx}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1.5 }}>
                  Dependencies
                </Typography>
                <TextField
                  fullWidth
                  label="Depends On"
                  value={Array.isArray(service.dependsOn) ? service.dependsOn.join(", ") : service.dependsOn || ""}
                  onChange={(event) => onServiceChange(serviceName, "dependsOn", event.target.value)}
                  placeholder="config-service, redis"
                  helperText="Comma-separated service names required before this service starts."
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
                />
                <Box sx={{ mt: 1.5 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1 }}>
                    Quick insert
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {dependencyOptions.length > 0 ? (
                      dependencyOptions.map((dependency) => {
                        const isActive = (service.dependsOn || []).includes(dependency);
                        return (
                          <Chip
                            key={dependency}
                            size="small"
                            clickable
                            color={isActive ? "primary" : "default"}
                            variant={isActive ? "filled" : "outlined"}
                            label={dependency}
                            onClick={() => {
                              const nextDeps = new Set(service.dependsOn || []);
                              if (nextDeps.has(dependency)) {
                                nextDeps.delete(dependency);
                              } else {
                                nextDeps.add(dependency);
                              }
                              onServiceChange(serviceName, "dependsOn", Array.from(nextDeps).join(", "));
                            }}
                          />
                        );
                      })
                    ) : (
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        No other services available yet.
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </Card>

              <Card variant="outlined" sx={sectionSx}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
                  Tips
                </Typography>
                <Stack spacing={1}>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Prefer base path templates over hardcoded absolute paths to keep config portable.
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Add a health command for services that can open a port before they are truly ready.
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Use groups like <strong>Core</strong>, <strong>Data</strong>, and <strong>Frontend</strong> so the dashboard stays easy to scan.
                  </Typography>
                </Stack>
              </Card>
            </Stack>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}

const Admin = ({ onConfigReload }) => {
  const [currentTab, setCurrentTab] = useState(0);
  const [config, setConfig] = useState(null);
  const [rawConfig, setRawConfig] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState("info");
  const [basePaths, setBasePaths] = useState({});
  const [services, setServices] = useState({});
  const [selectedService, setSelectedService] = useState(null);
  const [serviceFilter, setServiceFilter] = useState("");
  const [addPathDialog, setAddPathDialog] = useState(false);
  const [addServiceDialog, setAddServiceDialog] = useState(false);
  const [editJsonDialog, setEditJsonDialog] = useState(false);
  const [newPathKey, setNewPathKey] = useState("");
  const [newPathValue, setNewPathValue] = useState("");
  const [newPathMode, setNewPathMode] = useState("browse");
  const [newPathTemplateBase, setNewPathTemplateBase] = useState("");
  const [newPathSuffix, setNewPathSuffix] = useState("");
  const [newServiceName, setNewServiceName] = useState("");
  const [isJsonReadOnly, setIsJsonReadOnly] = useState(true);
  const [pickerBusy, setPickerBusy] = useState(false);

  const validationResult = useMemo(
    () => validateConfiguration({ config: { basePaths }, services }),
    [basePaths, services]
  );

  const groupedServices = useMemo(() => getServiceGroups(services), [services]);

  const filteredServices = useMemo(() => {
    const term = serviceFilter.trim().toLowerCase();
    if (!term) return Object.entries(services);
    return Object.entries(services).filter(([serviceName, service]) => {
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
  }, [serviceFilter, services]);

  const filteredServiceNames = useMemo(() => new Set(filteredServices.map(([serviceName]) => serviceName)), [filteredServices]);

  const stats = useMemo(() => {
    const pathUsage = Object.keys(basePaths).reduce((count, key) => count + getPathUsageCount(key, services), 0);
    const groupsUsed = groupedServices.filter(([name]) => name !== "Ungrouped").length;
    return [
      {
        label: "Base paths",
        value: Object.keys(basePaths).length,
        helper: `${pathUsage} template references`,
        background: "linear-gradient(180deg, rgba(239,246,255,0.94) 0%, rgba(255,255,255,1) 100%)",
      },
      {
        label: "Services",
        value: Object.keys(services).length,
        helper: `${filteredServices.length} in current filter`,
        background: "linear-gradient(180deg, rgba(245,243,255,0.94) 0%, rgba(255,255,255,1) 100%)",
      },
      {
        label: "Groups",
        value: groupsUsed,
        helper: groupedServices.length ? `${groupedServices[0][0]} and more` : "No groups yet",
        background: "linear-gradient(180deg, rgba(236,253,245,0.94) 0%, rgba(255,255,255,1) 100%)",
      },
      {
        label: "Path usage",
        value: pathUsage,
        helper: "Template references across services",
        background: "linear-gradient(180deg, rgba(255,247,237,0.94) 0%, rgba(255,255,255,1) 100%)",
      },
    ];
  }, [basePaths, filteredServices.length, groupedServices, services]);

  const showSnackbar = useCallback((message, severity = "info") => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  }, []);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get("/config");
      setConfig(data);
      setBasePaths(data.config?.basePaths || {});
      setServices(data.services || {});
      setRawConfig(JSON.stringify(data, null, 2));
      if (onConfigReload) {
        onConfigReload();
      }
    } catch (error) {
      setSnackbarMessage(`Failed to load config: ${error.message}`);
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  }, [onConfigReload]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (selectedService && services[selectedService]) {
      return;
    }
    const firstVisible = filteredServices[0]?.[0] || Object.keys(services)[0] || null;
    setSelectedService(firstVisible);
  }, [filteredServices, selectedService, services]);

  const savePaths = async () => {
    if (validationResult.hasErrors) {
      showSnackbar("Fix validation errors before saving", "error");
      return;
    }
    setSaving(true);
    try {
      const updatedConfig = {
        ...config,
        config: {
          ...config.config,
          basePaths,
        },
      };
      await api.put("/config", updatedConfig);
      setConfig(updatedConfig);
      setRawConfig(JSON.stringify(updatedConfig, null, 2));
      showSnackbar("Base paths saved successfully", "success");
    } catch (error) {
      showSnackbar(`Failed to save base paths: ${error.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const saveServices = async () => {
    if (validationResult.hasErrors) {
      showSnackbar("Fix validation errors before saving", "error");
      return;
    }
    setSaving(true);
    try {
      const updatedConfig = {
        ...config,
        services,
      };
      await api.put("/config", updatedConfig);
      setConfig(updatedConfig);
      setRawConfig(JSON.stringify(updatedConfig, null, 2));
      showSnackbar("Services saved successfully", "success");
    } catch (error) {
      showSnackbar(`Failed to save services: ${error.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const saveRawConfig = async () => {
    setSaving(true);
    let parsedConfig;
    try {
      parsedConfig = JSON.parse(rawConfig);
    } catch (error) {
      showSnackbar(`Invalid JSON: ${error.message}`, "error");
      setSaving(false);
      return;
    }

    const validation = validateConfiguration(parsedConfig);
    if (validation.hasErrors) {
      showSnackbar("Raw JSON has validation errors. Fix them before saving.", "error");
      setSaving(false);
      return;
    }

    try {
      await api.put("/config", parsedConfig);
      setConfig(parsedConfig);
      setBasePaths(parsedConfig.config?.basePaths || {});
      setServices(parsedConfig.services || {});
      showSnackbar("Configuration saved successfully", "success");
    } catch (error) {
      showSnackbar(`Failed to save raw config: ${error.message}`, "error");
    } finally {
      setSaving(false);
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
        ? `${basePaths[newPathTemplateBase] || ""}${newPathSuffix ? `/${newPathSuffix.replace(/^\/+/, "")}` : ""}`
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

  const addNewService = () => {
    if (!newServiceName.trim()) return;
    setServices((prev) => ({
      ...prev,
      [newServiceName.trim()]: {
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
    setSelectedService(newServiceName.trim());
    setNewServiceName("");
    setAddServiceDialog(false);
    showSnackbar(`Service "${newServiceName.trim()}" added`, "success");
  };

  const removeService = (serviceName) => {
    setServices((prev) => {
      const nextServices = { ...prev };
      delete nextServices[serviceName];
      return nextServices;
    });
    if (selectedService === serviceName) {
      setSelectedService(null);
    }
  };

  const formatJson = () => {
    try {
      const parsed = JSON.parse(rawConfig);
      setRawConfig(JSON.stringify(parsed, null, 2));
      showSnackbar("JSON formatted successfully", "success");
    } catch (error) {
      showSnackbar(`Invalid JSON: ${error.message}`, "error");
    }
  };

  const confirmJsonEditing = () => {
    setIsJsonReadOnly(false);
    setEditJsonDialog(false);
    showSnackbar("JSON editing enabled. Use carefully.", "warning");
  };

  const cancelJsonEditing = () => {
    setIsJsonReadOnly(true);
    setRawConfig(JSON.stringify(config, null, 2));
    showSnackbar("JSON editor locked and unsaved edits discarded.", "info");
  };

  const saveRawConfigAndLock = async () => {
    await saveRawConfig();
    setIsJsonReadOnly(true);
  };

  if (loading) {
    return (
      <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress size={48} />
      </Box>
    );
  }

  return (
    <Box sx={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", flex: 1 }}>
      <Paper sx={{ ...shellCardSx, p: 2, mb: 2, flexShrink: 0 }}>
        <SectionTitle
          eyebrow="ADMIN CONTROL"
          title="Configuration Studio"
          description="Manage base paths, service definitions, and raw config from a compact workspace built for day-to-day operations."
          actions={[
            <Button key="reload" variant="outlined" startIcon={<RefreshIcon />} onClick={loadConfig} disabled={loading || saving}>
              Reload
            </Button>,
            <Chip
              key="picker"
              icon={<FolderOpenIcon />}
              label={pickerBusy ? "Folder picker active" : "Native path picker ready"}
              color={pickerBusy ? "warning" : "success"}
              variant={pickerBusy ? "filled" : "outlined"}
            />,
          ]}
        />

        <StatsStrip items={stats} />

        <Tabs
          value={currentTab}
          onChange={(_, value) => setCurrentTab(value)}
          sx={{
            mt: 2,
            minHeight: 44,
            "& .MuiTab-root": {
              minHeight: 44,
              borderRadius: 999,
              mr: 1,
              textTransform: "none",
              fontWeight: 700,
            },
            "& .MuiTabs-indicator": {
              display: "none",
            },
          }}
        >
          <Tab icon={<StorageIcon />} iconPosition="start" label="Base Paths" />
          <Tab icon={<SettingsIcon />} iconPosition="start" label="Services" />
          <Tab icon={<CodeIcon />} iconPosition="start" label="Raw JSON" />
        </Tabs>
      </Paper>

      <Box sx={{ flexGrow: 1, minHeight: 0, overflow: "hidden", display: "flex" }}>
        {currentTab === 0 && (
          <Paper sx={{ ...shellCardSx, height: "100%", width: "100%", p: 2.5, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}>
            <Box sx={{ flexShrink: 0 }}>
              <SectionTitle
                eyebrow="BASE PATHS"
                title="Path Library"
                description="Keep reusable directories in one place, then reference them throughout services with template tokens."
                actions={[
                  <Button key="save-paths" variant="contained" startIcon={<SaveIcon />} onClick={savePaths} disabled={saving}>
                    Save Paths
                  </Button>,
                  <Button key="add-path" variant="outlined" startIcon={<AddIcon />} onClick={() => openPathDialog()}>
                    Add Path
                  </Button>,
                ]}
              />
            </Box>

            <Box sx={{ flexGrow: 1, minHeight: 0, overflow: "hidden" }}>
              <Grid container spacing={2} sx={{ height: "100%", minHeight: 0, overflow: "hidden" }}>
                <Grid item xs={12} lg={8} sx={{ minHeight: 0, minWidth: 0, display: "flex" }}>
                  <Stack spacing={1.5} sx={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", pr: { lg: 1 }, pb: 0.5 }}>
                  {Object.entries(basePaths).map(([pathKey, pathValue]) => (
                    <BasePathRow
                      key={pathKey}
                      pathKey={pathKey}
                      pathValue={pathValue}
                      usageCount={getPathUsageCount(pathKey, services)}
                      onChange={(value) => setBasePaths((prev) => ({ ...prev, [pathKey]: value }))}
                      onDelete={() => removePath(pathKey)}
                      onBrowse={() => browseForExistingBasePath(pathKey)}
                    />
                  ))}
                  {Object.keys(basePaths).length === 0 ? (
                    <Paper variant="outlined" sx={{ ...panelSx, p: 3, textAlign: "center" }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                        No base paths configured yet
                      </Typography>
                      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
                        Start with common roots like your Lextr workspace, frontend folder, or backend microservices root.
                      </Typography>
                      <Button variant="contained" startIcon={<AddIcon />} onClick={() => openPathDialog()}>
                        Add First Path
                      </Button>
                    </Paper>
                  ) : null}
                </Stack>
                </Grid>

                <Grid item xs={12} lg={4} sx={{ minHeight: 0, minWidth: 0, display: "flex" }}>
                  <Stack spacing={2} sx={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", pb: 0.5 }}>
                  <Card variant="outlined" sx={sectionSx}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
                      Quick Tips
                    </Typography>
                    <Stack spacing={1}>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        Use short, stable keys like <strong>java</strong>, <strong>frontend</strong>, or <strong>microservices</strong>.
                      </Typography>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        Prefer a small set of shared roots, then append service-specific subfolders in the service editor.
                      </Typography>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        The new folder picker opens your local system dialog, so you can browse instead of pasting paths.
                      </Typography>
                    </Stack>
                  </Card>

                  <Card variant="outlined" sx={sectionSx}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1.25 }}>
                      Suggested Keys
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {commonBasePathKeys.map((key) => (
                        <Chip
                          key={key}
                          size="small"
                          clickable
                          label={key}
                          onClick={() => {
                            openPathDialog(key);
                          }}
                        />
                      ))}
                    </Stack>
                  </Card>

                  <Card variant="outlined" sx={sectionSx}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1.25 }}>
                      Usage Overview
                    </Typography>
                    <Stack spacing={1}>
                      {Object.keys(basePaths).map((key) => (
                        <Stack key={key} direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2">{key}</Typography>
                          <Chip size="small" variant="outlined" label={`${getPathUsageCount(key, services)} services`} />
                        </Stack>
                      ))}
                    </Stack>
                  </Card>

                  {validationResult.hasErrors ? (
                    <Alert severity="error" sx={{ borderRadius: 3 }}>
                      Save is blocked until required config issues are fixed.
                    </Alert>
                  ) : null}
                </Stack>
                </Grid>
              </Grid>
            </Box>
          </Paper>
        )}

        {currentTab === 1 && (
          <Paper sx={{ ...shellCardSx, height: "100%", width: "100%", p: 2.5, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}>
            <Box sx={{ flexShrink: 0 }}>
              <SectionTitle
                eyebrow="SERVICES"
                title="Service Configuration"
                description="Browse services in a compact list, then edit everything in a richer side-by-side workspace."
                actions={[
                  <Button key="save-services" variant="contained" startIcon={<SaveIcon />} onClick={saveServices} disabled={saving}>
                    Save Services
                  </Button>,
                  <Button key="add-service" variant="outlined" startIcon={<AddIcon />} onClick={() => setAddServiceDialog(true)}>
                    Add Service
                  </Button>,
                ]}
              />
            </Box>

            {validationResult.hasErrors ? (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 3, flexShrink: 0 }}>
                Save is blocked until required config issues are fixed.
              </Alert>
            ) : null}

            <Box sx={{ flexGrow: 1, minHeight: 0, overflow: "hidden" }}>
              <Grid container spacing={2} sx={{ height: "100%", minHeight: 0, overflow: "hidden" }}>
                <Grid item xs={12} xl={3.5} sx={{ minHeight: 0, minWidth: 0, display: "flex" }}>
                  <Paper sx={{ ...panelSx, height: "100%", width: "100%", display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, minWidth: 0 }}>
                  <Box sx={{ p: 2, borderBottom: "1px solid rgba(148,163,184,0.16)" }}>
                    <TextField
                      fullWidth
                      value={serviceFilter}
                      onChange={(event) => setServiceFilter(event.target.value)}
                      placeholder="Search services, groups, paths…"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon fontSize="small" />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 999 } }}
                    />
                    <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                      {groupedServices.slice(0, 6).map(([groupName, groupServices]) => (
                        <Chip
                          key={groupName}
                          size="small"
                          label={`${groupName} · ${groupServices.length}`}
                          variant="outlined"
                          onClick={() => setServiceFilter(groupName === "Ungrouped" ? "" : groupName)}
                        />
                      ))}
                    </Stack>
                  </Box>

                  <Box sx={{ flexGrow: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
                    {filteredServices.length === 0 ? (
                      <Box sx={{ p: 3, textAlign: "center" }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
                          No services match this filter
                        </Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          Try a different search term or clear the filter.
                        </Typography>
                      </Box>
                    ) : (
                      filteredServices.map(([serviceName, service]) => (
                        <ServiceListItem
                          key={serviceName}
                          serviceName={serviceName}
                          service={service}
                          isSelected={selectedService === serviceName}
                          onSelect={() => setSelectedService(serviceName)}
                          onDelete={() => removeService(serviceName)}
                        />
                      ))
                    )}
                  </Box>
                </Paper>
                </Grid>

                <Grid item xs={12} xl={8.5} sx={{ minHeight: 0, minWidth: 0, display: "flex" }}>
                  <Paper sx={{ ...panelSx, height: "100%", width: "100%", overflow: "hidden", minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  {selectedService && filteredServiceNames.has(selectedService) ? (
                    <ServiceEditor
                      serviceName={selectedService}
                      service={services[selectedService]}
                      services={services}
                      basePaths={basePaths}
                      onServiceChange={handleServiceChange}
                      onPickDirectory={pickDirectory}
                    />
                  ) : (
                    <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", p: 4 }}>
                      <Box sx={{ textAlign: "center", maxWidth: 420 }}>
                        <SettingsIcon sx={{ fontSize: 52, opacity: 0.28, mb: 2 }} />
                        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                          Pick a service to edit
                        </Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          The service editor stays focused on one service at a time so we can keep this screen compact without losing any features.
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Paper>
                </Grid>
              </Grid>
            </Box>
          </Paper>
        )}

        {currentTab === 2 && (
          <Paper sx={{ ...shellCardSx, height: "100%", width: "100%", p: 2.5, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}>
            <Box sx={{ flexShrink: 0 }}>
              <SectionTitle
                eyebrow="RAW JSON"
                title="Advanced Configuration"
                description="Keep this mode for advanced edits and bulk operations. The guided editors above remain the safest way to manage config."
                actions={[
                  <Button key="format" variant="outlined" onClick={formatJson} disabled={saving || isJsonReadOnly}>
                    Format JSON
                  </Button>,
                  !isJsonReadOnly ? (
                    <Button key="save-lock" variant="contained" startIcon={<SaveIcon />} onClick={saveRawConfigAndLock} disabled={saving}>
                      Save & Lock
                    </Button>
                  ) : (
                    <Button key="enable" variant="outlined" startIcon={<EditIcon />} onClick={() => setEditJsonDialog(true)}>
                      Enable Editing
                    </Button>
                  ),
                  !isJsonReadOnly ? (
                    <Button key="cancel" variant="outlined" color="error" startIcon={<CloseIcon />} onClick={cancelJsonEditing} disabled={saving}>
                      Cancel
                    </Button>
                  ) : null,
                ].filter(Boolean)}
              />
            </Box>

            {isJsonReadOnly ? (
              <Alert severity="info" sx={{ mb: 2, borderRadius: 3, flexShrink: 0 }}>
                JSON editing is locked. Use the structured tabs above for safer changes and fewer config mistakes.
              </Alert>
            ) : (
              <Alert severity="warning" sx={{ mb: 2, borderRadius: 3, flexShrink: 0 }}>
                Advanced mode is active. Invalid JSON or bad service references can break the manager.
              </Alert>
            )}

            <TextField
              fullWidth
              multiline
              value={rawConfig}
              onChange={(event) => setRawConfig(event.target.value)}
              disabled={saving || isJsonReadOnly}
              InputProps={{ readOnly: isJsonReadOnly }}
              sx={{
                flexGrow: 1,
                minHeight: 0,
                "& .MuiInputBase-input": {
                  fontFamily: '"Monaco", "Menlo", "Ubuntu Mono", monospace',
                  fontSize: "0.86rem",
                  lineHeight: 1.55,
                  backgroundColor: isJsonReadOnly ? "rgba(15,23,42,0.02)" : "transparent",
                },
                "& .MuiOutlinedInput-root": {
                  borderRadius: 3,
                  height: "100%",
                  "& textarea": {
                    height: "100% !important",
                    overflow: "auto !important",
                  },
                },
              }}
            />
          </Paper>
        )}
      </Box>

      <Dialog open={addPathDialog} onClose={closePathDialog} maxWidth="md" fullWidth>
        <DialogTitle
          sx={{
            background:
              "linear-gradient(135deg, rgba(15,23,42,1) 0%, rgba(37,99,235,0.94) 100%)",
            color: "white",
            py: 2.5,
          }}
        >
          <Stack direction="row" spacing={1.25} alignItems="center">
            <FolderOpenIcon />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Add Base Path
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.82 }}>
                Use the local folder picker or compose a reusable path template.
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={7}>
              <Stack spacing={2}>
                <TextField
                  autoFocus
                  label="Path Key"
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
                      label="Selected Directory"
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
                    label="Directory Path"
                    value={newPathValue}
                    onChange={(event) => setNewPathValue(event.target.value)}
                    placeholder="~/Workspace/codebase/lextr"
                    helperText="Absolute path or home-relative path."
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
                  />
                )}

                {newPathMode === "template" && (
                  <Grid container spacing={1.5}>
                    <Grid item xs={12} md={5}>
                      <FormControl fullWidth>
                        <InputLabel>Existing Base Path</InputLabel>
                        <Select
                          value={newPathTemplateBase}
                          label="Existing Base Path"
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
                        label="Sub Path"
                        value={newPathSuffix}
                        onChange={(event) => setNewPathSuffix(event.target.value)}
                        placeholder="services/shared"
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
                      backgroundColor: "rgba(15,23,42,0.03)",
                    }}
                  >
                    <Typography variant="body2" sx={{ fontFamily: "monospace", wordBreak: "break-all" }}>
                      {newPathMode === "template" && newPathTemplateBase
                        ? `${basePaths[newPathTemplateBase] || ""}${newPathSuffix ? `/${newPathSuffix.replace(/^\/+/, "")}` : ""}`
                        : newPathValue || "Choose a path source to preview the value"}
                    </Typography>
                  </Paper>

                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Services will reference it like:
                  </Typography>
                  <Chip
                    label={newPathKey ? tokenForBasePath(newPathKey) : String.raw`\${basePaths.your-key}`}
                    sx={{ width: "fit-content", fontFamily: "monospace" }}
                  />

                  <Alert severity="info" sx={{ borderRadius: 2.5 }}>
                    The folder picker opens on your local machine through the backend, which means you can choose real directories instead of typing them by hand.
                  </Alert>
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 1.5 }}>
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
            Add Base Path
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={addServiceDialog} onClose={() => setAddServiceDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Add New Service</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Service Name"
            margin="dense"
            value={newServiceName}
            onChange={(event) => setNewServiceName(event.target.value)}
            placeholder="my-new-service"
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1.5 }}>
          <Button onClick={() => setAddServiceDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={addNewService}>
            Add Service
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editJsonDialog} onClose={() => setEditJsonDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle
          sx={{
            background: "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
            color: "white",
            py: 2.5,
          }}
        >
          <Stack direction="row" spacing={1.25} alignItems="center">
            <WarningAmberIcon />
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Enable JSON Editing
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Alert severity="warning" sx={{ mb: 2, borderRadius: 2.5 }}>
            This is advanced mode. Invalid JSON or broken references can stop the application from loading correctly.
          </Alert>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            The structured editors validate ports, dependencies, and missing commands for you. Only use raw JSON when you need bulk edits or advanced config changes.
          </Typography>
          <Box component="ul" sx={{ pl: 2.5, m: 0, color: "text.secondary" }}>
            <li>Invalid JSON syntax will break saving</li>
            <li>Typos in service names can break dependencies</li>
            <li>Missing commands or duplicate ports can block startup flows</li>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1.5 }}>
          <Button onClick={() => setEditJsonDialog(false)}>Cancel</Button>
          <Button variant="contained" color="warning" startIcon={<EditIcon />} onClick={confirmJsonEditing}>
            I Understand
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ borderRadius: 2.5 }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Admin;
