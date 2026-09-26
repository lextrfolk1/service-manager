import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  FilterList as FilterListIcon,
  PlayArrow as PlayArrowIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Stop as StopIcon,
} from "@mui/icons-material";
import ServiceCard from "../components/ServiceCard";
import ProgressPanel from "../components/ProgressPanel";
import api from "../services/api";
import {
  DEFAULT_GROUPS,
  buildDependencyMap,
  buildReverseDependencyMap,
  categorizeFailure,
  getPresetServices,
  normalizeService,
  topoSortServices,
} from "../utils/serviceUtils";

const PRESET_OPTIONS = ["Minimal", "Core", "Backend Only", "Full Stack"];
const SERVICE_GRID_SX = {
  display: "grid",
  gridTemplateColumns: {
    xs: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))",
    sm: "repeat(auto-fill, minmax(max(220px, calc((100% - 32px) / 5)), 1fr))",
    lg: "repeat(auto-fill, minmax(max(220px, calc((100% - 40px) / 5)), 1fr))",
  },
  gap: { xs: 0.75, sm: 1, lg: 1.25 },
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
            ? "Port open"
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

const Dashboard = forwardRef(({ onViewLogs }, ref) => {
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
  const [groupedView, setGroupedView] = useState(true);
  const [draggedServiceName, setDraggedServiceName] = useState("");
  const [dragOverGroup, setDragOverGroup] = useState("");
  const [movingServiceName, setMovingServiceName] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState({ open: false, message: "", severity: "info" });
  const [operationState, setOperationState] = useState(null);

  const normalizedServices = useMemo(
    () => services.map((service) => normalizeService(service)),
    [services]
  );

  const reverseDependencies = useMemo(
    () => buildReverseDependencyMap(normalizedServices),
    [normalizedServices]
  );

  const displayStates = useMemo(() => {
    const next = {};
    normalizedServices.forEach((service) => {
      next[service.name] = mergeDisplayState(
        deriveBaseState(statuses[service.name]),
        uiStates[service.name]
      );
    });
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
        (statusFilter === "stopped" && !state.running) ||
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

  const operationSummary = useMemo(() => {
    if (!operationState?.order?.length) return null;
    const steps = operationState.order.map((name) => ({
      name,
      ...(operationState.items[name] || { state: "queued", message: "Queued" }),
    }));
    const completed = steps.filter((step) => ["healthy", "running", "failed", "stopped"].includes(step.state)).length;
    return {
      label: operationState.label,
      total: steps.length,
      completed,
      waiting: steps.filter((step) => step.state === "waiting").length,
      succeeded: steps.filter((step) => ["healthy", "running", "stopped"].includes(step.state)).length,
      failed: steps.filter((step) => step.state === "failed").length,
      steps,
    };
  }, [operationState]);

  useEffect(() => {
    loadServices();
  }, []);

  useEffect(() => {
    if (!normalizedServices.length) return undefined;
    loadServiceStatuses(normalizedServices);
    const interval = setInterval(() => loadServiceStatuses(normalizedServices), 5000);
    return () => clearInterval(interval);
  }, [normalizedServices]);

  useImperativeHandle(ref, () => ({
    refreshServices: loadServices,
  }));

  async function loadServices() {
    try {
      setLoading(true);
      const data = await api.get("/services");
      setServices(data.services || []);
      setError("");
    } catch (err) {
      setError(`Failed to load services: ${err.message}`);
    } finally {
      setLoading(false);
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
    const results = await Promise.all(
      serviceList.map(async (service) => {
        try {
          const status = await api.get(`/service/${service.name}/status`);
          return [service.name, status];
        } catch (err) {
          return [service.name, null];
        }
      })
    );

    setStatuses((previous) => {
      const next = { ...previous };
      results.forEach(([name, status]) => {
        next[name] = status;
      });
      return next;
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

  function updateOperationItem(name, patch) {
    setOperationState((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        items: {
          ...previous.items,
          [name]: {
            ...(previous.items[name] || {}),
            ...patch,
          },
        },
      };
    });
  }

  function startOperation(label, order) {
    setOperationState({
      label,
      order,
      items: order.reduce((accumulator, name) => {
        accumulator[name] = { state: "queued", message: "Queued for action", error: "" };
        return accumulator;
      }, {}),
    });
  }

  function clearOperationIfFinished() {
    setOperationState((previous) => {
      if (!previous) return previous;
      const items = Object.values(previous.items);
      const allFinished = items.every((item) => ["healthy", "running", "failed", "stopped"].includes(item.state));
      return allFinished ? previous : previous;
    });
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
      setUiState(serviceName, {
        lifecycleState: "failed",
        healthState: "unhealthy",
        message: reason,
        error: err.error || err.message,
      });
      showToast(`${serviceName}: ${reason}`, "error");
    }
  }

  async function handleBranchCheckout(serviceName, targetBranch, restart = false) {
    const service = normalizedServices.find((entry) => entry.name === serviceName);
    if (!service) return;

    if (restart) {
      setUiState(serviceName, {
        lifecycleState: "starting",
        message: `Switching to ${targetBranch} and restarting...`,
        error: "",
      });
    }

    try {
      const result = await api.post(`/service/${serviceName}/git/checkout`, {
        branch: targetBranch,
        restart,
      });

      await sleep(300);
      await refreshSingleStatus(serviceName);
      loadServiceStatuses(normalizedServices);

      showToast(result.message || `Switched ${serviceName} to branch ${targetBranch}`, "success");
      return result;
    } catch (err) {
      const msg = err.details || err.message || err.error || "Branch switch failed";
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

  async function executeStartFlow(initialTargets, label) {
    const targetNames = getExpandedStartTargets(initialTargets);
    const orderedServices = topoSortServices(
      normalizedServices.filter((service) => targetNames.includes(service.name))
    );
    const pending = new Set(orderedServices.map((service) => service.name));
    const completed = new Set();
    const failed = new Set();
    const serviceMap = Object.fromEntries(normalizedServices.map((service) => [service.name, service]));
    const dependencyMap = buildDependencyMap(normalizedServices);

    startOperation(label, orderedServices.map((service) => service.name));

    while (pending.size > 0) {
      const ready = [...pending].filter((name) => {
        const dependencies = dependencyMap[name] || [];
        return dependencies.every((dependency) => {
          if (!pending.has(dependency)) return !failed.has(dependency);
          return completed.has(dependency);
        });
      });

      if (!ready.length) {
        [...pending].forEach((name) => {
          updateOperationItem(name, {
            state: "failed",
            message: "Blocked by dependency failure",
            error: "A required dependency failed to start",
          });
          setUiState(name, {
            lifecycleState: "failed",
            healthState: "unhealthy",
            message: "Blocked by dependency failure",
            error: "A required dependency failed to start",
          });
          failed.add(name);
          pending.delete(name);
        });
        break;
      }

      ready.forEach((name) => {
        updateOperationItem(name, {
          state: "waiting",
          message:
            (serviceMap[name].dependsOn || []).length > 0
              ? `Waiting for ${serviceMap[name].dependsOn.join(", ")}`
              : "Ready to start",
        });
        setUiState(name, {
          lifecycleState: serviceMap[name].dependsOn?.length ? "waiting" : "queued",
          message:
            serviceMap[name].dependsOn?.length
              ? `Waiting for ${serviceMap[name].dependsOn.join(", ")}`
              : "Queued for startup",
          error: "",
        });
      });

      await Promise.all(
        ready.map(async (name) => {
          const currentDisplayState = displayStates[name];
          if (currentDisplayState?.running) {
            updateOperationItem(name, { state: "healthy", message: "Already running" });
            setUiState(name, {
              lifecycleState: "running",
              message: "Already running",
              error: "",
            });
            completed.add(name);
            pending.delete(name);
            return;
          }

          updateOperationItem(name, { state: "starting", message: "Starting now" });
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
            updateOperationItem(name, {
              state: nextState,
              message: nextState === "healthy" ? "Healthy" : "Running",
            });
            setUiState(name, {
              lifecycleState: nextState,
              message: nextState === "healthy" ? "Healthy" : "Running",
              error: "",
            });
            completed.add(name);
          } catch (err) {
            const reason = categorizeFailure(err);
            updateOperationItem(name, {
              state: "failed",
              message: reason,
              error: err.error || err.message,
            });
            setUiState(name, {
              lifecycleState: "failed",
              healthState: "unhealthy",
              message: reason,
              error: err.error || err.message,
            });
            failed.add(name);
          } finally {
            pending.delete(name);
          }
        })
      );
    }

    clearOperationIfFinished();
  }

  async function executeStopFlow(targetNames, label) {
    const order = topoSortServices(normalizedServices.filter((service) => targetNames.includes(service.name)))
      .map((service) => service.name)
      .reverse();

    startOperation(label, order);

    for (const name of order) {
      updateOperationItem(name, { state: "stopping", message: "Stopping service" });
      setUiState(name, {
        lifecycleState: "stopping",
        message: "Stopping service",
        error: "",
      });

      try {
        await api.post(`/service/${name}/stop`);
        await sleep(300);
        await refreshSingleStatus(name);
        updateOperationItem(name, { state: "stopped", message: "Stopped" });
        setUiState(name, {
          lifecycleState: "stopped",
          message: "Stopped",
          error: "",
        });
      } catch (err) {
        const reason = categorizeFailure(err);
        updateOperationItem(name, { state: "failed", message: reason, error: err.error || err.message });
        setUiState(name, {
          lifecycleState: "failed",
          healthState: "unhealthy",
          message: reason,
          error: err.error || err.message,
        });
      }
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
    const presetServices = getPresetServices(normalizedServices, preset);
    try {
      await executeStartFlow(presetServices, `Start preset: ${preset}`);
    } catch (error) {
      showToast(error.message, "error");
    }
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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="60vh">
        <CircularProgress size={56} />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", gap: 2, minHeight: 0 }}>
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          border: "1px solid",
          borderColor: "divider",
          background: "linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(248,250,252,0.96) 100%)",
          boxShadow: "0 14px 34px rgba(15,23,42,0.05)",
        }}
      >
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75, minWidth: 0 }}>
          <Box sx={{ display: "contents" }}>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button size="small" variant="contained" startIcon={<PlayArrowIcon />} onClick={handleBulkStartAll}>
                Start all
              </Button>
              <Button size="small" variant="outlined" color="error" startIcon={<StopIcon />} onClick={handleBulkStopAll}>
                Stop all
              </Button>
              {selectedServices.length > 0 ? (
                <>
                  <Button size="small" variant="outlined" startIcon={<PlayArrowIcon />} onClick={handleStartSelected}>
                    Start selected
                  </Button>
                  <Button size="small" variant="outlined" color="error" startIcon={<StopIcon />} onClick={handleStopSelected}>
                    Stop selected
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={handleRestartSelected}>
                    Restart
                  </Button>
                </>
              ) : null}
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button size="small" variant={buildEnabled ? "contained" : "outlined"} color="warning" onClick={() => setBuildEnabled((previous) => !previous)}>
                {buildEnabled ? "Build on" : "Build off"}
              </Button>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Preset</InputLabel>
                <Select value={preset} label="Preset" onChange={(event) => setPreset(event.target.value)}>
                  {PRESET_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button size="small" variant="contained" color="secondary" onClick={handleStartPreset}>
                Run preset
              </Button>
            </Stack>
          </Box>

          <Box sx={{ display: "contents" }}>
            <Box sx={{ flex: "1 1 220px", minWidth: { xs: "100%", sm: 220 } }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search services"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Box
              component="details"
              sx={{
                position: "relative",
                flex: "0 0 auto",
                alignSelf: { xs: "flex-start", sm: "auto" },
                "&[open] .filter-expand": { transform: "rotate(180deg)" },
              }}
            >
              <Box
                component="summary"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  cursor: "pointer",
                  listStyle: "none",
                  minHeight: 40,
                  px: 1.25,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  "&::-webkit-details-marker": { display: "none" },
                }}
              >
                <FilterListIcon fontSize="small" />
                <Typography variant="body2">
                  Filters{[statusFilter, groupFilter, typeFilter].filter((value) => value !== "all").length
                    ? ` (${[statusFilter, groupFilter, typeFilter].filter((value) => value !== "all").length})`
                    : ""}
                </Typography>
                <ExpandMoreIcon className="filter-expand" fontSize="small" sx={{ transition: "transform 160ms ease" }} />
              </Box>
              <Stack
                spacing={1.25}
                sx={{
                  position: "absolute",
                  zIndex: 1300,
                  top: "calc(100% + 8px)",
                  right: 0,
                  width: 280,
                  maxWidth: "calc(100vw - 32px)",
                  p: 1.5,
                  bgcolor: "background.paper",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  boxShadow: 4,
                }}
              >
            <FormControl size="small" sx={{ width: "100%" }}>
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} label="Status" onChange={(event) => setStatusFilter(event.target.value)}>
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="running">Running</MenuItem>
                <MenuItem value="healthy">Healthy</MenuItem>
                <MenuItem value="waiting">Waiting</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
                <MenuItem value="needs-attention">Needs attention</MenuItem>
                <MenuItem value="stopped">Stopped</MenuItem>
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
            <Button
              size="small"
              variant="text"
              startIcon={<FilterListIcon />}
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setGroupFilter("all");
                setTypeFilter("all");
              }}
            >
              Clear
            </Button>
              </Stack>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: 0, whiteSpace: "nowrap" }}>
              <Checkbox
                size="small"
                checked={allFilteredSelected}
                indeterminate={someFilteredSelected}
                onChange={(event) => toggleSelectFiltered(event.target.checked)}
                inputProps={{ "aria-label": "Select all filtered services" }}
              />
              <Typography variant="body2" color="text.secondary">
                Select filtered
              </Typography>
              {selectedServices.length > 0 ? (
                <Button size="small" variant="text" onClick={() => setSelectedServices([])}>
                  Clear ({selectedServices.length})
                </Button>
              ) : null}
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={groupedView}
                    onChange={(event) => setGroupedView(event.target.checked)}
                    inputProps={{ "aria-label": "Group services" }}
                  />
                }
                label="Group services"
                sx={{ ml: 1, whiteSpace: "nowrap" }}
              />
            </Box>
          </Box>
        </Box>
      </Paper>

      <ProgressPanel summary={operationSummary} steps={operationSummary?.steps} onViewLogs={onViewLogs} />

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
            <Alert severity="info">No services match the current filters.</Alert>
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
                  if (serviceName) moveServiceToGroup(serviceName, group);
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
                      [group]: !(previous[group] ?? true),
                    }))
                  }
                  aria-expanded={collapsedGroups[group] === false}
                  sx={{
                    display: "flex",
                    width: "100%",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 1,
                    p: 0.75,
                    borderRadius: 2,
                    background: "linear-gradient(90deg, rgba(15,23,42,0.04) 0%, rgba(255,255,255,0.8) 100%)",
                    border: "1px solid rgba(148, 163, 184, 0.16)",
                    textAlign: "left",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="h6">{group}</Typography>
                    <Chip label={groupServices.length} size="small" variant="outlined" />
                  </Box>
                  <ExpandMoreIcon
                    sx={{
                      transform: collapsedGroups[group] === false ? "rotate(180deg)" : "none",
                      transition: "transform 160ms ease",
                    }}
                  />
                </ButtonBase>
                {collapsedGroups[group] === false ? (
                  <Box sx={SERVICE_GRID_SX}>
                    {groupServices.map((service) => (
                      <ServiceCard
                        key={service.name}
                        service={service}
                        status={displayStates[service.name]}
                        reverseDependencies={reverseDependencies[service.name] || []}
                        isMoving={movingServiceName === service.name}
                        isSelected={selectedServices.includes(service.name)}
                        onSelect={(checked) => toggleSelection(service.name, checked)}
                        onAction={executeSingleAction}
                        onBranchCheckout={handleBranchCheckout}
                        onViewLogs={onViewLogs}
                        onDragStart={setDraggedServiceName}
                        onDragEnd={() => {
                          setDraggedServiceName("");
                          setDragOverGroup("");
                        }}
                      />
                    ))}
                  </Box>
                ) : null}
              </Box>
            ))
          ) : (
            <Box sx={SERVICE_GRID_SX}>
              {filteredServices.map((service) => (
                <ServiceCard
                  key={service.name}
                  service={service}
                  status={displayStates[service.name]}
                  reverseDependencies={reverseDependencies[service.name] || []}
                  isMoving={movingServiceName === service.name}
                  isDraggable={false}
                  showGroup
                  isSelected={selectedServices.includes(service.name)}
                  onSelect={(checked) => toggleSelection(service.name, checked)}
                  onAction={executeSingleAction}
                  onBranchCheckout={handleBranchCheckout}
                  onViewLogs={onViewLogs}
                />
              ))}
            </Box>
          )}
        </Stack>
      </Paper>

      <Snackbar
        open={toast.open}
        autoHideDuration={5000}
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
