import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  ButtonBase,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Paper,
  Popover,
  Select,
  Skeleton,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  FilterList as FilterListIcon,
  PlayArrow as PlayArrowIcon,
  Refresh as RefreshIcon,
  Check as CheckIcon,
  SyncRounded as SyncIcon,
  Tune as TuneIcon,
  Search as SearchIcon,
  Stop as StopIcon,
} from "@mui/icons-material";
import { CARD_STYLES, DEFAULT_CARD_STYLE, ServiceCardView, normalizeCardStyle } from "../components/cards";
import HoverSubmenu from "../components/HoverSubmenu";
import { ACCENTS, THEME_BASES, useThemeSettings } from "../theme/ThemeController";
import { LOOKS, findLook } from "../theme/looks";
import { SEARCH_INPUT_SX, STATUS_COLORS } from "../theme/tokens";
import { RunConfigDialog, cleanRunConfig, countRunConfigValues } from "../components/RunConfigEditor";
import api from "../services/api";
import usePageVisible from "../hooks/usePageVisible";
import {
  DEFAULT_GROUPS,
  buildDependencyMap,
  buildReverseDependencyMap,
  categorizeFailure,
  getEffectivePresets,
  normalizeService,
  topoSortServices,
} from "../utils/serviceUtils";

const AUTO_REFRESH_INTERVAL_MS = 30000;
const EMPTY_LIST = [];

function isSameJson(a, b) {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}
const SERVICE_GRID_SX = {
  display: "grid",
  gridTemplateColumns: {
    xs: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
    sm: "repeat(auto-fill, minmax(max(260px, calc((100% - 32px) / 4)), 1fr))",
    lg: "repeat(auto-fill, minmax(max(270px, calc((100% - 48px) / 5)), 1fr))",
  },
  gap: { xs: 1, sm: 1.25, lg: 1.5 },
  alignItems: "stretch",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeFilterValue(value) {
  return String(value || "").trim().toLowerCase();
}

function formatLifecycleLabel(state) {
  const labels = {
    idle: "Idle",
    queued: "Queued",
    waiting: "Waiting",
    starting: "Starting",
    running: "Running",
    healthy: "Healthy",
    unhealthy: "Unhealthy",
    stopping: "Stopping",
    stopped: "Stopped",
    failed: "Failed",
    blocked: "Port Blocked",
  };
  return labels[state] || "Unknown";
}

function deriveBaseState(status) {
  if (!status) {
    return {
      running: false,
      lifecycleState: "idle",
      lifecycleLabel: "Idle",
      healthState: "unknown",
      healthLabel: "Health unknown",
      message: "Waiting for first status poll",
      error: "",
      git: null,
    };
  }

  const lifecycleState = status.running ? "running" : "stopped";
  const healthState = status.healthState || "unknown";
  const checkable = status.checkable !== false;

  return {
    running: Boolean(status.running),
    lifecycleState,
    lifecycleLabel: formatLifecycleLabel(lifecycleState),
    healthState,
    healthLabel:
      healthState === "healthy"
        ? "Healthy"
        : healthState === "unhealthy"
          ? "Unhealthy"
          : healthState === "port-open"
            ? "" // the Running status chip already says this
          : lifecycleState === "stopped"
            ? ""
            : checkable
              ? "Health unknown"
              : "No health check",
    message: status.running
      ? healthState === "healthy"
        ? "Service is healthy"
        : healthState === "port-open"
          ? "Service port is open"
        : "Service is running but health is unavailable"
      : "Service is stopped",
    error: "",
    git: status.git || null,
  };
}

function mergeDisplayState(baseState, uiState) {
  if (!uiState) return baseState;

  // If the service is running according to the backend status, do not mask it with stale failed UI states
  if (baseState.running) {
    if (uiState.lifecycleState === "stopping" && Date.now() - uiState.updatedAt < 5000) {
      return {
        ...baseState,
        ...uiState,
        lifecycleLabel: formatLifecycleLabel("stopping"),
        git: baseState.git,
      };
    }
    return {
      ...baseState,
      git: baseState.git,
    };
  }

  const stickyStates = ["queued", "waiting", "starting", "stopping", "failed"];
  if (stickyStates.includes(uiState.lifecycleState)) {
    return {
      ...baseState,
      ...uiState,
      lifecycleLabel: formatLifecycleLabel(uiState.lifecycleState),
      healthLabel:
        uiState.healthState === "healthy"
          ? "Healthy"
          : uiState.healthState === "unhealthy"
            ? "Unhealthy"
            : "Health unknown",
      git: baseState.git,
    };
  }

  if (Date.now() - uiState.updatedAt < 15000) {
    return {
      ...baseState,
      ...uiState,
      lifecycleState: baseState.lifecycleState,
      lifecycleLabel: baseState.lifecycleLabel,
      healthState: baseState.healthState,
      healthLabel: baseState.healthLabel,
      git: baseState.git,
    };
  }

  return baseState;
}

const Dashboard = forwardRef(({ onViewLogs, onOpenHelp, onCloneService, onEditInAdmin, isActive = true }, ref) => {
  const [services, setServices] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [uiStates, setUiStates] = useState({});
  const [selectedServices, setSelectedServices] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [preset, setPreset] = useState("Core");
  const [buildEnabled, setBuildEnabled] = useState(false);
  const [groupedView, setGroupedView] = useState(() => {
    const saved = localStorage.getItem("struo_grouped_view");
    return saved !== null ? saved === "true" : false;
  });
  const [showGitBranches, setShowGitBranches] = useState(() => {
    const saved = localStorage.getItem("struo_show_git_branches");
    return saved !== null ? saved === "true" : true;
  });
  const [showLiveMetrics, setShowLiveMetrics] = useState(() => {
    const saved = localStorage.getItem("struo_show_live_metrics");
    return saved !== null ? saved === "true" : false;
  });
  const [metrics, setMetrics] = useState({});
  const [refreshingNow, setRefreshingNow] = useState(false);
  const [draggedServiceName, setDraggedServiceName] = useState("");
  const [dragOverGroup, setDragOverGroup] = useState("");
  const [movingServiceName, setMovingServiceName] = useState("");
  const [pendingMove, setPendingMove] = useState(null); // { serviceName, from, to } awaiting confirmation
  const [runConfig, setRunConfig] = useState({ services: {} }); // run-config.json (this machine only)
  const [runConfigTarget, setRunConfigTarget] = useState(""); // service whose run configuration dialog is open
  const [savingRunConfig, setSavingRunConfig] = useState(false);
  const [configuredPresets, setConfiguredPresets] = useState(null); // config.presets; null = built-in presets
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);
  const [dependencyCheck, setDependencyCheck] = useState(true); // config.dependencyCheck (Admin switch)
  const [adminCardStyle, setAdminCardStyle] = useState(DEFAULT_CARD_STYLE); // config.ui.cardStyle (Admin › Appearance)
  const [personalCardStyle, setPersonalCardStyle] = useState(() => {
    try {
      const saved = localStorage.getItem("struo_card_style") || "";
      return CARD_STYLES.some((style) => style.id === saved) ? saved : "";
    } catch {
      return "";
    }
  }); // "" = use the Admin default
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("struo_collapsed_groups") || "{}") || {};
    } catch {
      return {};
    }
  }); // { [group]: true } = collapsed; groups are expanded by default
  const [filtersAnchorEl, setFiltersAnchorEl] = useState(null);
  const [viewAnchorEl, setViewAnchorEl] = useState(null);
  const { base: themeBase, accent: accentId, setBase: setThemeBase, setAccent } = useThemeSettings();
  const [bulkConfirm, setBulkConfirm] = useState(null); // { action: "start" | "stop", count } awaiting confirmation
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState({ open: false, message: "", severity: "info" });

  useEffect(() => {
    try {
      localStorage.setItem("struo_collapsed_groups", JSON.stringify(collapsedGroups));
    } catch {
      // Storage unavailable: collapse state just isn't remembered.
    }
  }, [collapsedGroups]);

  const normalizedServices = useMemo(
    () => services.map((service) => normalizeService(service)),
    [services]
  );

  const presets = useMemo(
    () => getEffectivePresets(normalizedServices, configuredPresets),
    [normalizedServices, configuredPresets]
  );
  const presetNames = Object.keys(presets);
  const activePreset = presets[preset] ? preset : presetNames[0] || "";

  const reverseDependencies = useMemo(
    () => buildReverseDependencyMap(normalizedServices),
    [normalizedServices]
  );

  const previousDisplayStatesRef = useRef({});
  const displayStates = useMemo(() => {
    const previous = previousDisplayStatesRef.current;
    const next = {};
    normalizedServices.forEach((service) => {
      const merged = mergeDisplayState(
        deriveBaseState(statuses[service.name]),
        uiStates[service.name]
      );
      next[service.name] = isSameJson(previous[service.name], merged) ? previous[service.name] : merged;
    });
    previousDisplayStatesRef.current = next;
    return next;
  }, [normalizedServices, statuses, uiStates]);

  const groups = useMemo(() => {
    const dynamic = new Set(normalizedServices.map((service) => service.group));
    return [...DEFAULT_GROUPS.filter((group) => dynamic.has(group)), ...[...dynamic].filter((group) => !DEFAULT_GROUPS.includes(group))];
  }, [normalizedServices]);

  const filteredServices = useMemo(() => {
    return normalizedServices.filter((service) => {
      const state = displayStates[service.name];
      const normalizedSearch = normalizeFilterValue(searchQuery);
      const normalizedTypeFilter = normalizeFilterValue(typeFilter);
      const normalizedGroupFilter = normalizeFilterValue(groupFilter);
      const normalizedServiceType = normalizeFilterValue(service.type);
      const normalizedServiceGroup = normalizeFilterValue(service.group);

      const matchesSearch =
        !normalizedSearch ||
        normalizeFilterValue(service.name).includes(normalizedSearch) ||
        normalizeFilterValue(service.description).includes(normalizedSearch) ||
        normalizedServiceType.includes(normalizedSearch) ||
        normalizedServiceGroup.includes(normalizedSearch);

      const matchesType = normalizedTypeFilter === "all" || normalizedServiceType === normalizedTypeFilter;
      const matchesGroup = normalizedGroupFilter === "all" || normalizedServiceGroup === normalizedGroupFilter;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "running" && state.running) ||
        (statusFilter === "healthy" && state.healthState === "healthy") ||
        (statusFilter === "failed" && state.lifecycleState === "failed") ||
        (statusFilter === "waiting" && state.lifecycleState === "waiting") ||
        (statusFilter === "stopped" && !state.running && state.lifecycleState !== "failed") ||
        (statusFilter === "needs-attention" &&
          (state.lifecycleState === "failed" || state.healthState === "unhealthy"));

      return matchesSearch && matchesType && matchesGroup && matchesStatus;
    });
  }, [normalizedServices, displayStates, searchQuery, statusFilter, typeFilter, groupFilter]);

  const groupedServices = useMemo(() => {
    const availableGroups = [...new Set(filteredServices.map((service) => service.group))];
    return availableGroups
      .map((group) => ({
        group,
        services: filteredServices.filter((service) => service.group === group),
      }))
      .filter((entry) => entry.services.length > 0);
  }, [filteredServices]);

  useEffect(() => {
    loadServices(true);
    loadRunConfig();
    loadPresets();
  }, []);

  // Background polling runs only while the Dashboard tab is shown and the browser tab is visible.
  const pageVisible = usePageVisible();
  const pollingActive = isActive && pageVisible;

  useEffect(() => {
    if (!pollingActive || !normalizedServices.length) return undefined;
    loadServiceStatuses(normalizedServices);
    const interval = setInterval(() => loadServiceStatuses(normalizedServices), 5000);
    return () => clearInterval(interval);
  }, [normalizedServices, pollingActive]);

  useEffect(() => {
    if (!showLiveMetrics) {
      setMetrics({});
      return undefined;
    }
    if (!pollingActive) return undefined;

    let isSubscribed = true;
    async function fetchMetrics() {
      try {
        const data = await api.get("/services/metrics");
        if (isSubscribed && data?.metrics) {
          // Keep unchanged per-service objects so memoized cards whose numbers didn't move skip re-rendering.
          setMetrics((previous) => {
            let changed = Object.keys(previous).length !== Object.keys(data.metrics).length;
            const next = {};
            Object.entries(data.metrics).forEach(([name, value]) => {
              if (isSameJson(previous[name], value)) {
                next[name] = previous[name];
              } else {
                next[name] = value;
                changed = true;
              }
            });
            return changed ? next : previous;
          });
        }
      } catch (e) {
        // Non-blocking
      }
    }

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3500);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [showLiveMetrics, pollingActive]);

  useEffect(() => {
    if (!pollingActive) return undefined;
    const interval = setInterval(async () => {
      const latest = await loadServices(false);
      loadRunConfig();
      loadPresets();
      if (latest.length) await loadServiceStatuses(latest.map(normalizeService));
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [pollingActive]);

  useImperativeHandle(ref, () => ({
    refreshServices: loadServices,
  }));

  async function loadPresets() {
    try {
      const data = await api.get("/config");
      const next = data?.config?.presets && Object.keys(data.config.presets).length ? data.config.presets : null;
      setConfiguredPresets((previous) => (isSameJson(previous, next) ? previous : next));
      setDependencyCheck(data?.config?.dependencyCheck !== false);
      setAdminCardStyle(normalizeCardStyle(data?.config?.ui?.cardStyle));
    } catch {
      // Keep the current presets if the config can't be read
    }
  }

  // Saves the ticked services as a preset (after the user confirmed in the dialog).
  async function handleSavePreset() {
    const name = newPresetName.trim();
    if (!name || selectedServices.length === 0) return;
    setSavingPreset(true);
    try {
      const updatedConfig = await api.get("/config");
      delete updatedConfig.runtime;
      const currentServices = Object.entries(updatedConfig.services || {}).map(([serviceName, definition]) => ({ name: serviceName, ...definition }));
      // First custom save turns the built-in presets into configured ones so none are lost.
      const basePresets = getEffectivePresets(currentServices, updatedConfig.config?.presets);
      const nextPresets = { ...basePresets, [name]: [...selectedServices] };
      updatedConfig.config = { ...(updatedConfig.config || {}), presets: nextPresets };
      await api.put("/config", updatedConfig);
      setConfiguredPresets(nextPresets);
      setPreset(name);
      setSavePresetOpen(false);
      showToast(`Preset "${name}" saved with ${selectedServices.length} services`, "success");
    } catch (err) {
      showToast(`Could not save preset: ${err.message}`, "error");
    } finally {
      setSavingPreset(false);
    }
  }

  // Manual refresh: re-check every service now instead of waiting for the 30s auto refresh.
  async function handleRefreshNow() {
    setRefreshingNow(true);
    try {
      const latest = await loadServices(false);
      loadRunConfig();
      loadPresets();
      if (latest.length) await loadServiceStatuses(latest.map(normalizeService));
    } catch (err) {
      showToast(`Couldn't refresh: ${err.message || "unknown error"}`, "error");
    } finally {
      setRefreshingNow(false);
    }
  }

  async function loadRunConfig() {
    try {
      const data = await api.get("/run-config");
      setRunConfig((previous) => (isSameJson(previous, data) ? previous : data || { services: {} }));
    } catch {
      // Older backend without run configuration: keep cards as they are
    }
  }

  // Saves one service's run configuration on top of the latest file, then optionally restarts it.
  async function handleSaveRunConfig(serviceName, draft, restartAfterSave) {
    setSavingRunConfig(true);
    try {
      const latest = cleanRunConfig(await api.get("/run-config").catch(() => ({ services: {} })));
      const entry = cleanRunConfig({ services: { [serviceName]: draft } }).services[serviceName];
      if (entry) latest.services[serviceName] = entry;
      else delete latest.services[serviceName];
      const saved = await api.put("/run-config", latest);
      setRunConfig(saved || latest);
      setRunConfigTarget("");
      showToast(
        restartAfterSave
          ? `Run configuration saved — restarting ${serviceName}`
          : `Run configuration saved for ${serviceName}. It applies the next time it starts.`,
        "success"
      );
      if (restartAfterSave) executeSingleAction(serviceName, "restart");
    } catch (err) {
      showToast(`Could not save run configuration: ${err.message}`, "error");
    } finally {
      setSavingRunConfig(false);
    }
  }

  async function loadServices(showSpinner = false) {
    try {
      if (showSpinner) setLoading(true);
      const data = await api.get("/services");
      const nextServices = data.services || [];
      setServices((previous) => (isSameJson(previous, nextServices) ? previous : nextServices));
      setError("");
      return data.services || [];
    } catch (err) {
      setError(`Failed to load services: ${err.message}`);
      return [];
    } finally {
      if (showSpinner) setLoading(false);
    }
  }

  async function moveServiceToGroup(serviceName, targetGroup) {
    const service = normalizedServices.find((entry) => entry.name === serviceName);
    if (!service || service.group === targetGroup || movingServiceName) return;

    setMovingServiceName(serviceName);
    try {
      const updatedConfig = await api.get("/config");
      delete updatedConfig.runtime;
      const updatedServices = {
        ...updatedConfig.services,
        [serviceName]: {
          ...updatedConfig.services[serviceName],
          group: targetGroup,
        },
      };

      await api.put("/config", { ...updatedConfig, services: updatedServices });
      setServices(Object.entries(updatedServices).map(([name, definition]) => ({ name, ...definition })));
      showToast(`${serviceName} moved to ${targetGroup}`, "success");
    } catch (err) {
      showToast(`Could not move ${serviceName}: ${err.message}`, "error");
    } finally {
      setMovingServiceName("");
    }
  }

  async function refreshSingleStatus(serviceName) {
    try {
      const data = await api.get(`/service/${serviceName}/status`);
      setStatuses((previous) => ({ ...previous, [serviceName]: data }));
      return data;
    } catch (err) {
      return null;
    }
  }

  async function loadServiceStatuses(serviceList) {
    let statuses = {};
    try {
      const names = serviceList.map((service) => service.name).join(",");
      const data = await api.get(`/services/status?names=${encodeURIComponent(names)}`);
      statuses = data?.statuses || {};
    } catch (err) {
      // Leave every status as null below
    }
    const results = serviceList.map((service) => [service.name, statuses[service.name] || null]);

    setStatuses((previous) => {
      let changed = false;
      const next = { ...previous };
      results.forEach(([name, status]) => {
        if (!isSameJson(previous[name], status)) {
          next[name] = status;
          changed = true;
        }
      });
      return changed ? next : previous;
    });
  }

  function showToast(message, severity = "info") {
    setToast({ open: true, message, severity });
  }

  function setUiState(name, patch) {
    setUiStates((previous) => ({
      ...previous,
      [name]: {
        ...(previous[name] || {}),
        ...patch,
        updatedAt: Date.now(),
      },
    }));
  }



  async function executeSingleAction(serviceName, action) {
    const service = normalizedServices.find((entry) => entry.name === serviceName);
    if (!service) return;

    const actionLabel = action === "restart" ? "Restarting" : action === "stop" ? "Stopping" : "Starting";
    setUiState(serviceName, {
      lifecycleState: action === "stop" ? "stopping" : "starting",
      message: `${actionLabel} ${serviceName}...`,
      error: "",
    });

    try {
      await api.post(
        action === "start"
          ? `/service/${serviceName}/start${buildEnabled && service.hasBuild ? "?build=true" : ""}`
          : `/service/${serviceName}/${action}`
      );

      await sleep(500);
      const latestStatus = await refreshSingleStatus(serviceName);
      const nextState =
        action === "stop"
          ? "stopped"
          : latestStatus?.healthState === "healthy"
            ? "healthy"
            : latestStatus?.running
              ? "running"
              : "starting";

      setUiState(serviceName, {
        lifecycleState: nextState,
        message:
          action === "stop"
            ? "Service stopped successfully"
            : nextState === "healthy"
              ? "Service is healthy"
              : "Service started successfully",
        error: "",
      });
      showToast(`${serviceName} ${action} completed`, "success");
    } catch (err) {
      const reason = categorizeFailure(err);
      const rawError = err.error || err.message || "";
      // Sanitize raw proxy / network errors — don't leak to UI
      const sanitizeError = (msg) => {
        if (!msg) return reason;
        if (/proxy error|ECONNREFUSED|ECONNRESET|ETIMEDOUT|fetch failed|network/i.test(msg))
          return "Unable to reach the backend server. Is it running?";
        if (/ENOENT|spawn/i.test(msg))
          return "Service executable not found. Check your configuration.";
        if (/EADDRINUSE/i.test(msg))
          return "Port is already in use.";
        return msg;
      };
      const latestStatus = await refreshSingleStatus(serviceName);
      if (latestStatus?.running) {
        setUiState(serviceName, {
          lifecycleState: latestStatus.healthState === "healthy" ? "healthy" : "running",
          healthState: latestStatus.healthState || "healthy",
          message: latestStatus.healthState === "healthy" ? "Service is healthy" : "Service is running",
          error: "",
        });
      } else {
        setUiState(serviceName, {
          lifecycleState: "failed",
          healthState: "unhealthy",
          message: reason,
          error: sanitizeError(rawError),
        });
        // No toast: the card's red box already shows the reason with Help and Logs.
      }
    }
  }

  async function handleBranchCheckout(serviceName, targetBranch, restart = false) {
    const service = normalizedServices.find((entry) => entry.name === serviceName);
    if (!service) return;

    // Immediately update local status so the card reflects the new branch instantly without delay
    setStatuses((previous) => ({
      ...previous,
      [serviceName]: {
        ...(previous[serviceName] || {}),
        git: {
          ...(previous[serviceName]?.git || {}),
          currentBranch: targetBranch,
        },
      },
    }));

    try {
      const result = await api.post(`/service/${serviceName}/git/checkout`, {
        branch: targetBranch,
        restart,
      });

      if (restart && result.restarted) {
        setUiState(serviceName, {
          lifecycleState: "starting",
          message: `Restarting on branch ${targetBranch}...`,
          error: "",
        });
      }

      await refreshSingleStatus(serviceName);
      loadServiceStatuses(normalizedServices);

      showToast(result.message || `Switched ${serviceName} to branch ${targetBranch}`, "success");
      return result;
    } catch (err) {
      await refreshSingleStatus(serviceName);
      const msg = err.details || err.message || err.error || "Branch switch failed";
      showToast(`${serviceName}: ${msg}`, "error");
      throw err;
    }
  }

  async function handleGitPull(serviceName, restart = false) {
    const service = normalizedServices.find((entry) => entry.name === serviceName);
    if (!service) return;

    try {
      const result = await api.post(`/service/${serviceName}/git/pull`, {
        restart,
      });

      if (restart && result.restarted) {
        setUiState(serviceName, {
          lifecycleState: "starting",
          message: `Restarting after git pull...`,
          error: "",
        });
      }

      await refreshSingleStatus(serviceName);
      loadServiceStatuses(normalizedServices);

      showToast(result.message || `Pulled latest changes for ${serviceName}`, "success");
      return result;
    } catch (err) {
      await refreshSingleStatus(serviceName);
      const msg = err.details || err.message || err.error || "Git pull failed";
      showToast(`${serviceName}: ${msg}`, "error");
      throw err;
    }
  }

  async function handleGitPush(serviceName) {
    try {
      const result = await api.post(`/service/${serviceName}/git/push`, {});
      await refreshSingleStatus(serviceName);
      showToast(result.message || `Pushed branch for ${serviceName}`, "success");
      return result;
    } catch (err) {
      await refreshSingleStatus(serviceName);
      const msg = err.details || err.message || err.error || "Git push failed";
      showToast(`${serviceName}: ${msg}`, "error");
      throw err;
    }
  }



  function getExpandedStartTargets(initialTargets) {
    const byName = Object.fromEntries(normalizedServices.map((service) => [service.name, service]));
    const expanded = new Set();

    function include(name) {
      if (expanded.has(name) || !byName[name]) return;
      expanded.add(name);
      (byName[name].dependsOn || []).forEach(include);
    }

    initialTargets.forEach(include);
    return [...expanded];
  }

  async function executeStartFlow(initialTargets) {
    const targetNames = getExpandedStartTargets(initialTargets);
    const toStartNames = targetNames.filter((name) => !displayStates[name]?.running);
    if (!toStartNames.length) {
      showToast("All requested services are already running", "info");
      return;
    }

    const alreadyRunning = new Set(targetNames.filter((name) => displayStates[name]?.running));
    const orderedServices = topoSortServices(
      normalizedServices.filter((service) => toStartNames.includes(service.name))
    );
    const pending = new Set(orderedServices.map((service) => service.name));
    const completed = new Set(alreadyRunning);
    const failed = new Set();
    const serviceMap = Object.fromEntries(normalizedServices.map((service) => [service.name, service]));
    const dependencyMap = buildDependencyMap(normalizedServices);

    // Initial queued state only for services being started
    orderedServices.forEach((service) => {
      setUiState(service.name, {
        lifecycleState: service.dependsOn?.length ? "waiting" : "queued",
        message: service.dependsOn?.length
          ? `Waiting for ${service.dependsOn.join(", ")}`
          : "Queued for startup",
        error: "",
      });
    });

    // Start each service as soon as its own dependencies are up (not in fixed waves), so independent services
    // never wait for unrelated slow ones. A failed dependency blocks only the services that need it.
    const inFlight = new Set();
    const dependenciesOf = (name) => (dependencyMap[name] || []).filter((dependency) => serviceMap[dependency]);
    const isReady = (name) => dependenciesOf(name).every((dependency) => completed.has(dependency) || (!pending.has(dependency) && !failed.has(dependency)));
    const isBlocked = (name) => dependenciesOf(name).some((dependency) => failed.has(dependency));

    const startOne = async (name) => {
      setUiState(name, {
        lifecycleState: "starting",
        message: "Starting now",
        error: "",
      });
      try {
        await api.post(
          `/service/${name}/start${buildEnabled && serviceMap[name].hasBuild ? "?build=true" : ""}`
        );
        await sleep(500);
        const latestStatus = await refreshSingleStatus(name);
        const nextState = latestStatus?.healthState === "healthy" ? "healthy" : latestStatus?.running ? "running" : "starting";
        setUiState(name, {
          lifecycleState: nextState,
          message: nextState === "healthy" ? "Healthy" : "Running",
          error: "",
        });
        completed.add(name);
      } catch (err) {
        const reason = categorizeFailure(err);
        setUiState(name, {
          lifecycleState: "failed",
          healthState: "unhealthy",
          message: reason,
          error: err.error || err.message,
        });
        failed.add(name);
      }
    };

    await new Promise((finish) => {
      const pump = () => {
        // Anything whose dependency failed can't start.
        let blockedFound = true;
        while (blockedFound) {
          blockedFound = false;
          for (const name of [...pending]) {
            if (inFlight.has(name) || !isBlocked(name)) continue;
            const failedDependencies = dependenciesOf(name).filter((dependency) => failed.has(dependency));
            setUiState(name, {
              lifecycleState: "failed",
              healthState: "unhealthy",
              message: "Blocked by dependency failure",
              error: `Needs ${failedDependencies.join(", ")}, which failed to start`,
            });
            failed.add(name);
            pending.delete(name);
            blockedFound = true;
          }
        }

        [...pending]
          .filter((name) => !inFlight.has(name) && isReady(name))
          .forEach((name) => {
            inFlight.add(name);
            startOne(name).then(() => {
              inFlight.delete(name);
              pending.delete(name);
              pump();
            });
          });

        if (inFlight.size === 0) {
          // Nothing running and nothing startable: either done, or the rest can never start.
          [...pending].forEach((name) => {
            setUiState(name, {
              lifecycleState: "failed",
              healthState: "unhealthy",
              message: "Blocked by dependency failure",
              error: "A required dependency failed to start",
            });
            failed.add(name);
            pending.delete(name);
          });
          finish();
        }
      };
      pump();
    });

    const startedCount = completed.size - alreadyRunning.size;
    if (failed.size > 0) {
      showToast(`Started ${startedCount} of ${toStartNames.length} services (${failed.size} failed)`, "warning");
    } else {
      showToast(`Started ${startedCount} service${startedCount === 1 ? "" : "s"}`, "success");
    }
  }

  async function executeStopFlow(targetNames) {
    const runningTargets = targetNames.filter((name) => displayStates[name]?.running);
    if (!runningTargets.length) {
      showToast("All selected services are already stopped", "info");
      return;
    }

    const order = topoSortServices(normalizedServices.filter((service) => runningTargets.includes(service.name)))
      .map((service) => service.name)
      .reverse();

    // Mark all as stopping on the cards — no progress panel needed
    order.forEach((name) => {
      setUiState(name, {
        lifecycleState: "stopping",
        message: "Stopping service",
        error: "",
      });
    });

    const results = await Promise.allSettled(
      order.map(async (name) => {
        try {
          await api.post(`/service/${name}/stop`);
          await sleep(300);
          await refreshSingleStatus(name);
          setUiState(name, {
            lifecycleState: "stopped",
            message: "Stopped",
            error: "",
          });
        } catch (err) {
          const reason = categorizeFailure(err);
          setUiState(name, {
            lifecycleState: "failed",
            healthState: "unhealthy",
            message: reason,
            error: err.error || err.message,
          });
          throw err;
        }
      })
    );

    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      showToast(`Stopped ${order.length - failed} of ${order.length} services (${failed} failed)`, "warning");
    } else {
      showToast(`Stopped ${order.length} service${order.length === 1 ? "" : "s"}`, "success");
    }
  }

  // Start all / Stop all ask first when they affect more than one service.
  function requestBulk(action) {
    const count = normalizedServices.filter((service) =>
      action === "stop" ? displayStates[service.name]?.running : !displayStates[service.name]?.running
    ).length;
    if (count > 1) {
      setBulkConfirm({ action, count });
    } else if (action === "stop") {
      handleBulkStopAll();
    } else {
      handleBulkStartAll();
    }
  }

  async function handleBulkStartAll() {
    try {
      await executeStartFlow(normalizedServices.map((service) => service.name), "Start all services");
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function handleBulkStopAll() {
    try {
      await executeStopFlow(normalizedServices.map((service) => service.name), "Stop all services");
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function handleStartSelected() {
    if (!selectedServices.length) return;
    try {
      await executeStartFlow(selectedServices, "Start selected services");
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function handleStopSelected() {
    if (!selectedServices.length) return;
    try {
      await executeStopFlow(selectedServices, "Stop selected services");
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function handleRestartSelected() {
    if (!selectedServices.length) return;
    try {
      await executeStopFlow(selectedServices, "Restart selected services");
      await executeStartFlow(selectedServices, "Restart selected services");
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function handleStartPreset() {
    const known = new Set(normalizedServices.map((service) => service.name));
    const presetServices = (presets[activePreset] || []).filter((name) => known.has(name));
    if (presetServices.length === 0) {
      showToast(`Preset "${activePreset}" has no services to start`, "warning");
      return;
    }
    try {
      await executeStartFlow(presetServices, `Start preset: ${activePreset}`);
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  // Stable handler identities so memoized ServiceCards only re-render when their own data changes.
  const latestHandlersRef = useRef({});
  // "Start X first" fix: start the service together with its stopped dependencies, in order.
  async function handleStartWithDependencies(serviceName) {
    try {
      await executeStartFlow([serviceName]);
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  latestHandlersRef.current = {
    executeSingleAction,
    handleStartWithDependencies,
    handleBranchCheckout,
    handleGitPull,
    handleGitPush,
    toggleSelection,
    onViewLogs,
    onOpenHelp,
    onCloneService,
    onEditInAdmin,
  };
  const cardHandlers = useMemo(() => ({
    onAction: (...args) => latestHandlersRef.current.executeSingleAction(...args),
    onStartWithDependencies: (...args) => latestHandlersRef.current.handleStartWithDependencies(...args),
    onBranchCheckout: (...args) => latestHandlersRef.current.handleBranchCheckout(...args),
    onGitPull: (...args) => latestHandlersRef.current.handleGitPull(...args),
    onGitPush: (...args) => latestHandlersRef.current.handleGitPush(...args),
    onEditRunConfig: (serviceName) => setRunConfigTarget(serviceName),
    onViewLogs: (...args) => latestHandlersRef.current.onViewLogs?.(...args),
    onOpenHelp: (...args) => latestHandlersRef.current.onOpenHelp?.(...args),
    onCloneService: (...args) => latestHandlersRef.current.onCloneService?.(...args),
    onEditInAdmin: (...args) => latestHandlersRef.current.onEditInAdmin?.(...args),
    onDragEnd: () => {
      setDraggedServiceName("");
      setDragOverGroup("");
    },
  }), []);
  const selectHandlersRef = useRef(new Map());
  function getSelectHandler(name) {
    if (!selectHandlersRef.current.has(name)) {
      selectHandlersRef.current.set(name, (checked) => latestHandlersRef.current.toggleSelection(name, checked));
    }
    return selectHandlersRef.current.get(name);
  }

  function toggleSelection(name, checked) {
    setSelectedServices((previous) =>
      checked ? [...new Set([...previous, name])] : previous.filter((serviceName) => serviceName !== name)
    );
  }

  function toggleSelectFiltered(checked) {
    const names = filteredServices.map((service) => service.name);
    setSelectedServices((previous) => {
      if (checked) return [...new Set([...previous, ...names])];
      return previous.filter((name) => !names.includes(name));
    });
  }

  const allFilteredSelected =
    filteredServices.length > 0 &&
    filteredServices.every((service) => selectedServices.includes(service.name));
  const someFilteredSelected =
    filteredServices.some((service) => selectedServices.includes(service.name)) && !allFilteredSelected;

  const activeFilterCount = [statusFilter, groupFilter, typeFilter].filter((value) => value !== "all").length;

  const effectiveCardStyle = normalizeCardStyle(personalCardStyle || adminCardStyle);
  const choosePersonalCardStyle = (value) => {
    setPersonalCardStyle(value);
    try {
      if (value) localStorage.setItem("struo_card_style", value);
      else localStorage.removeItem("struo_card_style");
    } catch {
      // Storage unavailable: the choice lasts for this session only.
    }
  };

  // At-a-glance state summary; each count filters the grid (click again to clear).
  const stateSummary = normalizedServices.reduce(
    (counts, service) => {
      const state = displayStates[service.name] || {};
      if (state.lifecycleState === "failed") counts.failed += 1;
      else if (state.running) counts.running += 1;
      else counts.stopped += 1;
      return counts;
    },
    { running: 0, stopped: 0, failed: 0 }
  );

  function resetFilters() {
    setStatusFilter("all");
    setGroupFilter("all");
    setTypeFilter("all");
  }

  if (loading) {
    return (
      <Box sx={{ ...SERVICE_GRID_SX, p: 1.25 }}>
        {Array.from({ length: 10 }, (_, index) => (
          <Skeleton key={index} variant="rounded" height={190} sx={{ borderRadius: "16px" }} />
        ))}
      </Box>
    );
  }

  if (error) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => loadServices(true)}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", gap: 2, minHeight: 0 }}>
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          border: "1px solid",
          borderColor: "divider",
          background: "linear-gradient(180deg, var(--c-bg-ffffff-094) 0%, var(--c-bg-f8fafc-096) 100%)",
          boxShadow: "0 14px 34px var(--c-shadow-0f172a-005)",
        }}
      >
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="contained" startIcon={<PlayArrowIcon />} onClick={() => requestBulk("start")} sx={{ height: 32 }}>
              Start all
            </Button>
            <Button size="small" variant="outlined" color="error" startIcon={<StopIcon />} onClick={() => requestBulk("stop")} sx={{ height: 32 }}>
              Stop all
            </Button>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ px: 0.5 }} role="group" aria-label="Service state summary">
            {[
              { key: "running", label: "running", count: stateSummary.running, dot: { bgcolor: STATUS_COLORS.running }, color: STATUS_COLORS.runningText },
              { key: "stopped", label: "stopped", count: stateSummary.stopped, dot: { border: `1.5px solid ${STATUS_COLORS.stopped}` }, color: STATUS_COLORS.stoppedText },
              { key: "failed", label: "failed", count: stateSummary.failed, dot: { bgcolor: STATUS_COLORS.failed }, color: stateSummary.failed ? STATUS_COLORS.failedText : STATUS_COLORS.stopped },
            ].map((item) => {
              const active = statusFilter === item.key;
              return (
                <ButtonBase
                  key={item.key}
                  onClick={() => setStatusFilter(active ? "all" : item.key)}
                  aria-pressed={active}
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.6,
                    px: 1,
                    height: 32,
                    borderRadius: "16px",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    color: item.color,
                    border: "1px solid",
                    borderColor: active ? item.color : "transparent",
                    bgcolor: active ? "var(--c-bg-0f172a-004)" : "transparent",
                    "&:hover": { bgcolor: "var(--c-bg-0f172a-005)" },
                  }}
                >
                  <Box component="span" sx={{ width: 8, height: 8, borderRadius: "50%", boxSizing: "border-box", ...item.dot }} />
                  <Box component="span" sx={{ fontWeight: 800 }}>{item.count}</Box>
                  {item.label}
                </ButtonBase>
              );
            })}
            <Tooltip title={refreshingNow ? "Refreshing…" : "Refresh status now (also refreshes every 30s)"}>
              <span>
                <IconButton size="small" aria-label="Refresh status now" onClick={handleRefreshNow} disabled={refreshingNow}>
                  <SyncIcon
                    fontSize="small"
                    sx={{
                      animation: refreshingNow ? "struo-spin 0.8s linear infinite" : "none",
                      "@keyframes struo-spin": { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
                    }}
                  />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />

          {/* Preset: pick + run as one compact control */}
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Select
              size="small"
              value={activePreset}
              onChange={(event) => setPreset(event.target.value)}
              renderValue={(value) => (
                <Box component="span" sx={{ fontSize: "0.82rem" }}>
                  <Box component="span" sx={{ color: "text.secondary" }}>Preset: </Box>
                  {value}
                </Box>
              )}
              inputProps={{ "aria-label": "Preset" }}
              sx={{ height: 32, minWidth: 170, maxWidth: 240, fontSize: "0.82rem" }}
            >
              {presetNames.map((option) => (
                <MenuItem key={option} value={option} sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                  <span>{option}</span>
                  <Typography component="span" sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                    {presets[option].length}
                  </Typography>
                </MenuItem>
              ))}
            </Select>
            <Button size="small" variant="outlined" color="secondary" onClick={handleStartPreset} sx={{ height: 32 }}>
              Run
            </Button>
            {buildEnabled ? (
              <Tooltip title="Each start runs the build command first. Turn off in View.">
                <Chip size="small" color="warning" variant="outlined" label="Build on" onDelete={() => setBuildEnabled(false)} />
              </Tooltip>
            ) : null}
          </Stack>

          <Box sx={{ flex: "1 1 200px", minWidth: { xs: "100%", sm: 200 }, display: "flex", alignItems: "center", gap: 0.5 }}>
            <Tooltip title={allFilteredSelected ? "Unselect all visible" : "Select all visible"}>
              <Checkbox
                size="small"
                checked={allFilteredSelected}
                indeterminate={someFilteredSelected}
                onChange={(event) => toggleSelectFiltered(event.target.checked)}
                inputProps={{ "aria-label": "Select all visible services" }}
                sx={{ p: 0.5 }}
              />
            </Tooltip>
            <TextField
              fullWidth
              size="small"
              placeholder="Search services"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: "1rem" }} />
                  </InputAdornment>
                ),
                sx: SEARCH_INPUT_SX,
              }}
            />
          </Box>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            startIcon={<FilterListIcon />}
            endIcon={<ExpandMoreIcon sx={{ transform: filtersAnchorEl ? "rotate(180deg)" : "none", transition: "transform 160ms ease" }} />}
            onClick={(event) => setFiltersAnchorEl(event.currentTarget)}
            aria-haspopup="dialog"
            aria-expanded={Boolean(filtersAnchorEl)}
            sx={{ height: 32, borderColor: "divider", textTransform: "none" }}
          >
            Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </Button>
          <Popover
            open={Boolean(filtersAnchorEl)}
            anchorEl={filtersAnchorEl}
            onClose={() => setFiltersAnchorEl(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            PaperProps={{ sx: { mt: 1, width: 280, maxWidth: "calc(100vw - 32px)", p: 1.5, borderRadius: 2 } }}
          >
            <Stack spacing={1.25}>
              <FormControl size="small" sx={{ width: "100%" }}>
                <InputLabel>Status</InputLabel>
                <Select value={statusFilter} label="Status" onChange={(event) => setStatusFilter(event.target.value)}>
                  <MenuItem value="all">All</MenuItem>
                  <ListSubheader sx={{ lineHeight: "28px", fontSize: "0.7rem", fontWeight: 700 }}>LIFECYCLE</ListSubheader>
                  <MenuItem value="running">Running</MenuItem>
                  <MenuItem value="waiting">Waiting</MenuItem>
                  <MenuItem value="stopped">Stopped</MenuItem>
                  <MenuItem value="failed">Failed</MenuItem>
                  <ListSubheader sx={{ lineHeight: "28px", fontSize: "0.7rem", fontWeight: 700 }}>HEALTH</ListSubheader>
                  <MenuItem value="healthy">Healthy</MenuItem>
                  <MenuItem value="needs-attention">Needs attention</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ width: "100%" }}>
                <InputLabel>Group</InputLabel>
                <Select value={groupFilter} label="Group" onChange={(event) => setGroupFilter(event.target.value)}>
                  <MenuItem value="all">All groups</MenuItem>
                  {groups.map((group) => (
                    <MenuItem key={group} value={group}>
                      {group}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ width: "100%" }}>
                <InputLabel>Type</InputLabel>
                <Select value={typeFilter} label="Type" onChange={(event) => setTypeFilter(event.target.value)}>
                  <MenuItem value="all">All types</MenuItem>
                  {[...new Set(normalizedServices.map((service) => service.type).filter(Boolean))].map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button size="small" variant="text" onClick={resetFilters} disabled={!activeFilterCount} sx={{ alignSelf: "flex-start" }}>
                Reset filters
              </Button>
            </Stack>
          </Popover>

          {/* Display options live in one menu instead of a row of switches */}
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            startIcon={<TuneIcon />}
            endIcon={<ExpandMoreIcon sx={{ transform: viewAnchorEl ? "rotate(180deg)" : "none", transition: "transform 160ms ease" }} />}
            onClick={(event) => setViewAnchorEl(event.currentTarget)}
            aria-haspopup="menu"
            aria-expanded={Boolean(viewAnchorEl)}
            sx={{ height: 32, borderColor: "divider", textTransform: "none" }}
          >
            View
          </Button>
          <Menu
            anchorEl={viewAnchorEl}
            open={Boolean(viewAnchorEl)}
            onClose={() => setViewAnchorEl(null)}
            disableEnforceFocus // lets focus move into the Theme / Card style side panels
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            PaperProps={{ sx: { mt: 1, minWidth: 240, borderRadius: 2 } }}
          >
            {[
              {
                key: "grouped",
                label: "Group services",
                checked: groupedView,
                onToggle: (checked) => {
                  setGroupedView(checked);
                  localStorage.setItem("struo_grouped_view", String(checked));
                },
              },
              {
                key: "git",
                label: "Git branches on cards",
                checked: showGitBranches,
                onToggle: (checked) => {
                  setShowGitBranches(checked);
                  localStorage.setItem("struo_show_git_branches", String(checked));
                },
              },
              {
                key: "metrics",
                label: "Live resources (CPU, memory)",
                checked: showLiveMetrics,
                onToggle: (checked) => {
                  setShowLiveMetrics(checked);
                  localStorage.setItem("struo_show_live_metrics", String(checked));
                },
              },
            ].map((option) => (
              <MenuItem key={option.key} onClick={() => option.onToggle(!option.checked)} sx={{ py: 0.5, fontSize: "0.85rem" }}>
                <ListItemText primary={option.label} primaryTypographyProps={{ fontSize: "0.85rem" }} />
                <Switch size="small" checked={option.checked} tabIndex={-1} inputProps={{ "aria-label": option.label }} />
              </MenuItem>
            ))}
            <Divider />
            {/* Compact rows: show the current choice; hover opens the options */}
            <HoverSubmenu label="Look" value={findLook(themeBase, effectiveCardStyle)?.label || "Custom"} width={280}>
              {LOOKS.map((look) => {
                const active = themeBase === look.theme && effectiveCardStyle === look.cardStyle;
                return (
                  <MenuItem
                    key={look.id}
                    selected={active}
                    onClick={() => {
                      setThemeBase(look.theme);
                      choosePersonalCardStyle(look.cardStyle);
                    }}
                  >
                    <ListItemText
                      primary={look.label}
                      secondary={look.hint}
                      primaryTypographyProps={{ fontSize: "0.85rem" }}
                      secondaryTypographyProps={{ fontSize: "0.7rem", sx: { whiteSpace: "normal" } }}
                    />
                    {active ? <CheckIcon fontSize="small" color="primary" sx={{ ml: 1 }} /> : null}
                  </MenuItem>
                );
              })}
            </HoverSubmenu>
            <HoverSubmenu label="Theme" value={THEME_BASES.find((option) => option.id === themeBase)?.label}>
              {THEME_BASES.map((option) => (
                <MenuItem key={option.id} selected={themeBase === option.id} onClick={() => setThemeBase(option.id)}>
                  <ListItemText
                    primary={option.label}
                    secondary={option.hint}
                    primaryTypographyProps={{ fontSize: "0.85rem" }}
                    secondaryTypographyProps={{ fontSize: "0.7rem", sx: { whiteSpace: "normal" } }}
                  />
                  {themeBase === option.id ? <CheckIcon fontSize="small" color="primary" sx={{ ml: 1 }} /> : null}
                </MenuItem>
              ))}
              <Divider />
              <Typography sx={{ px: 2, pt: 0.75, fontSize: "0.7rem", fontWeight: 700, color: "text.secondary" }}>ACCENT</Typography>
              <Box role="radiogroup" aria-label="Accent colour" sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, px: 2, py: 1 }}>
                {ACCENTS.map((option) => (
                  <Tooltip key={option.id} title={option.label}>
                    <Box
                      component="button"
                      type="button"
                      role="radio"
                      aria-checked={accentId === option.id}
                      aria-label={option.label}
                      onClick={() => setAccent(option.id)}
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        border: "2px solid",
                        borderColor: accentId === option.id ? "text.primary" : "transparent",
                        bgcolor: option.main,
                        cursor: "pointer",
                        display: "grid",
                        placeItems: "center",
                        color: "#ffffff",
                      }}
                    >
                      {accentId === option.id ? <CheckIcon sx={{ fontSize: 13 }} /> : null}
                    </Box>
                  </Tooltip>
                ))}
              </Box>
            </HoverSubmenu>
            <HoverSubmenu label="Card style" value={CARD_STYLES.find((style) => style.id === effectiveCardStyle)?.label} width={260}>
              {CARD_STYLES.map((style) => (
                <MenuItem key={style.id} selected={effectiveCardStyle === style.id} onClick={() => choosePersonalCardStyle(style.id)}>
                  <ListItemText
                    primary={style.label}
                    secondary={style.description}
                    primaryTypographyProps={{ fontSize: "0.85rem" }}
                    secondaryTypographyProps={{ fontSize: "0.7rem", sx: { whiteSpace: "normal" } }}
                  />
                  {effectiveCardStyle === style.id ? <CheckIcon fontSize="small" color="primary" sx={{ ml: 1 }} /> : null}
                </MenuItem>
              ))}
            </HoverSubmenu>
            <Divider />
            <MenuItem onClick={() => setBuildEnabled((previous) => !previous)} sx={{ py: 0.5 }}>
              <ListItemText
                primary="Build before start"
                secondary="Runs each service's build command first"
                primaryTypographyProps={{ fontSize: "0.85rem" }}
                secondaryTypographyProps={{ fontSize: "0.72rem" }}
              />
              <Switch size="small" color="warning" checked={buildEnabled} tabIndex={-1} inputProps={{ "aria-label": "Build before start" }} />
            </MenuItem>
          </Menu>
        </Box>

        {/* Selection bar: only while services are selected, so the main toolbar never shifts */}
        {selectedServices.length > 0 ? (
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 1,
              mt: 1.25,
              pt: 1.25,
              borderTop: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 700, mr: 0.5 }}>
              {selectedServices.length} selected
            </Typography>
            <Button size="small" variant="outlined" startIcon={<PlayArrowIcon />} onClick={handleStartSelected}>
              Start selected
            </Button>
            <Button size="small" variant="outlined" color="error" startIcon={<StopIcon />} onClick={handleStopSelected}>
              Stop selected
            </Button>
            <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={handleRestartSelected}>
              Restart selected
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="secondary"
              onClick={() => {
                setNewPresetName("");
                setSavePresetOpen(true);
              }}
            >
              Save as preset
            </Button>
            <Button size="small" variant="text" onClick={() => setSelectedServices([])}>
              Clear selection
            </Button>
          </Box>
        ) : null}
      </Paper>

      <Paper
        elevation={0}
        sx={{
          flexGrow: 1,
          minHeight: 0,
          overflow: "auto",
          p: 1.25,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack spacing={3}>
          {filteredServices.length === 0 ? (
            <Alert
              severity="info"
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    setSearchQuery("");
                    resetFilters();
                  }}
                >
                  Reset filters
                </Button>
              }
            >
              No services match the current search and filters.
            </Alert>
          ) : groupedView ? (
            groupedServices.map(({ group, services: groupServices }) => (
              <Box
                key={group}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDragOverGroup(group);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const serviceName = event.dataTransfer.getData("text/plain") || draggedServiceName;
                  setDragOverGroup("");
                  setDraggedServiceName("");
                  const movedService = normalizedServices.find((entry) => entry.name === serviceName);
                  // Moving changes the saved config, so ask first.
                  if (movedService && movedService.group !== group) {
                    setPendingMove({ serviceName, from: movedService.group, to: group });
                  }
                }}
                sx={{
                  borderRadius: 2,
                  outline: dragOverGroup === group ? "2px dashed" : "2px solid transparent",
                  outlineColor: dragOverGroup === group ? "primary.main" : "transparent",
                  outlineOffset: 2,
                }}
              >
                <ButtonBase
                  onClick={() =>
                    setCollapsedGroups((previous) => ({
                      ...previous,
                      [group]: !previous[group],
                    }))
                  }
                  aria-expanded={!collapsedGroups[group]}
                  sx={{
                    display: "flex",
                    width: "100%",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 1,
                    p: 0.75,
                    borderRadius: 2,
                    background: "linear-gradient(90deg, var(--c-bg-0f172a-004) 0%, var(--c-bg-ffffff-08) 100%)",
                    border: "1px solid var(--c-border-94a3b8-016)",
                    textAlign: "left",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{group}</Typography>
                    <Chip label={groupServices.length} size="small" variant="outlined" />
                    {(() => {
                      const runningCount = groupServices.filter((service) => displayStates[service.name]?.running).length;
                      const failedCount = groupServices.filter(
                        (service) => displayStates[service.name]?.error || displayStates[service.name]?.lifecycleState === "failed"
                      ).length;
                      return (
                        <>
                          {runningCount ? (
                            <Chip label={`${runningCount} running`} size="small" sx={{ bgcolor: "var(--c-bg-ecfdf3)", color: "var(--c-text-027a48)", fontWeight: 600 }} />
                          ) : null}
                          {failedCount ? (
                            <Chip label={`${failedCount} failed`} size="small" sx={{ bgcolor: "var(--c-bg-fef2f2)", color: "var(--c-text-dc2626)", fontWeight: 600 }} />
                          ) : null}
                        </>
                      );
                    })()}
                  </Box>
                  <ExpandMoreIcon
                    sx={{
                      transform: collapsedGroups[group] ? "none" : "rotate(180deg)",
                      transition: "transform 160ms ease",
                    }}
                  />
                </ButtonBase>
                {!collapsedGroups[group] ? (
                  <Box sx={SERVICE_GRID_SX}>
                    {groupServices.map((service) => (
                      <ServiceCardView
                        cardStyle={effectiveCardStyle}
                        key={service.name}
                        service={service}
                        status={displayStates[service.name]}
                        reverseDependencies={reverseDependencies[service.name] || EMPTY_LIST}
                        isMoving={movingServiceName === service.name}
                        isSelected={selectedServices.includes(service.name)}
                        onSelect={getSelectHandler(service.name)}
                        onAction={cardHandlers.onAction}
                        onBranchCheckout={cardHandlers.onBranchCheckout}
                        onGitPull={cardHandlers.onGitPull}
                        onGitPush={cardHandlers.onGitPush}
                        onEditRunConfig={cardHandlers.onEditRunConfig}
                        runConfigCount={countRunConfigValues(runConfig.services?.[service.name])}
                        buildMode={buildEnabled}
                        showGitBranches={showGitBranches}
                        showLiveMetrics={showLiveMetrics}
                        metrics={metrics[service.name] || null}
                        onViewLogs={onViewLogs ? cardHandlers.onViewLogs : undefined}
                        onOpenHelp={onOpenHelp ? cardHandlers.onOpenHelp : undefined}
                        onStartWithDependencies={dependencyCheck ? cardHandlers.onStartWithDependencies : undefined}
                        onCloneService={onCloneService ? cardHandlers.onCloneService : undefined}
                        onEditInAdmin={onEditInAdmin ? cardHandlers.onEditInAdmin : undefined}
                        onDragStart={setDraggedServiceName}
                        onDragEnd={cardHandlers.onDragEnd}
                      />
                    ))}
                  </Box>
                ) : null}
              </Box>
            ))
          ) : (
            <Box sx={SERVICE_GRID_SX}>
              {filteredServices.map((service) => (
                <ServiceCardView
                  cardStyle={effectiveCardStyle}
                  key={service.name}
                  service={service}
                  status={displayStates[service.name]}
                  reverseDependencies={reverseDependencies[service.name] || EMPTY_LIST}
                  isMoving={movingServiceName === service.name}
                  isDraggable={false}
                  showGroup
                  showGitBranches={showGitBranches}
                  showLiveMetrics={showLiveMetrics}
                  metrics={metrics[service.name] || null}
                  isSelected={selectedServices.includes(service.name)}
                  onSelect={getSelectHandler(service.name)}
                  onAction={cardHandlers.onAction}
                  onBranchCheckout={cardHandlers.onBranchCheckout}
                  onGitPull={cardHandlers.onGitPull}
                  onGitPush={cardHandlers.onGitPush}
                  onEditRunConfig={cardHandlers.onEditRunConfig}
                  runConfigCount={countRunConfigValues(runConfig.services?.[service.name])}
                  buildMode={buildEnabled}
                  onViewLogs={onViewLogs ? cardHandlers.onViewLogs : undefined}
                  onOpenHelp={onOpenHelp ? cardHandlers.onOpenHelp : undefined}
                  onStartWithDependencies={dependencyCheck ? cardHandlers.onStartWithDependencies : undefined}
                  onCloneService={onCloneService ? cardHandlers.onCloneService : undefined}
                  onEditInAdmin={onEditInAdmin ? cardHandlers.onEditInAdmin : undefined}
                />
              ))}
            </Box>
          )}
        </Stack>
      </Paper>

      <Dialog open={savePresetOpen} onClose={savingPreset ? undefined : () => setSavePresetOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Save selection as preset</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Autocomplete
            freeSolo
            options={presetNames}
            inputValue={newPresetName}
            onInputChange={(_, value) => setNewPresetName(value)}
            renderInput={(params) => (
              <TextField {...params} autoFocus size="small" label="Preset name" placeholder="e.g. My daily set" sx={{ mt: 1 }} />
            )}
          />
          {presets[newPresetName.trim()] ? (
            <Alert severity="warning" sx={{ mt: 1.5, py: 0 }}>
              Replaces the existing preset "{newPresetName.trim()}" ({presets[newPresetName.trim()].length} services).
            </Alert>
          ) : null}
          <Typography variant="body2" sx={{ mt: 2, mb: 1 }}>
            {selectedServices.length} selected service{selectedServices.length === 1 ? "" : "s"}:
          </Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {selectedServices.map((name) => (
              <Chip key={name} size="small" label={name} />
            ))}
          </Stack>
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 2 }}>
            This updates the configuration file. Edit or delete presets later in Admin › Presets.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setSavePresetOpen(false)} disabled={savingPreset}>Cancel</Button>
          <Button variant="contained" onClick={handleSavePreset} disabled={savingPreset || !newPresetName.trim()}>
            {savingPreset ? "Saving…" : "Confirm and save"}
          </Button>
        </DialogActions>
      </Dialog>

      <RunConfigDialog
        open={Boolean(runConfigTarget)}
        serviceName={runConfigTarget}
        serviceType={normalizedServices.find((entry) => entry.name === runConfigTarget)?.type || ""}
        initialSettings={runConfig.services?.[runConfigTarget] || {}}
        isRunning={Boolean(displayStates[runConfigTarget]?.running)}
        saving={savingRunConfig}
        onClose={() => setRunConfigTarget("")}
        onSave={(draft, restartAfterSave) => handleSaveRunConfig(runConfigTarget, draft, restartAfterSave)}
      />

      <Dialog open={Boolean(pendingMove)} onClose={() => setPendingMove(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Move service?</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2">
            Move <strong>{pendingMove?.serviceName}</strong> from <strong>{pendingMove?.from}</strong> to{" "}
            <strong>{pendingMove?.to}</strong>?
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1 }}>
            This changes the service's group in the configuration file.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setPendingMove(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              const move = pendingMove;
              setPendingMove(null);
              if (move) moveServiceToGroup(move.serviceName, move.to);
            }}
          >
            Move and save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(bulkConfirm)} onClose={() => setBulkConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          {bulkConfirm?.action === "stop" ? "Stop all services?" : "Start all services?"}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2">
            {bulkConfirm?.action === "stop"
              ? `This stops ${bulkConfirm?.count} running services.`
              : `This starts ${bulkConfirm?.count} services, in dependency order.`}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setBulkConfirm(null)}>Cancel</Button>
          <Button
            variant="contained"
            color={bulkConfirm?.action === "stop" ? "error" : "primary"}
            onClick={() => {
              const action = bulkConfirm?.action;
              setBulkConfirm(null);
              if (action === "stop") handleBulkStopAll();
              else handleBulkStartAll();
            }}
          >
            {bulkConfirm?.action === "stop" ? `Stop ${bulkConfirm?.count}` : `Start ${bulkConfirm?.count}`}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={toast.severity === "error" ? null : 5000}
        onClose={() => setToast((previous) => ({ ...previous, open: false }))}
      >
        <Alert
          onClose={() => setToast((previous) => ({ ...previous, open: false }))}
          severity={toast.severity}
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
});

export default Dashboard;
