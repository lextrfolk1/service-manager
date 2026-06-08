import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
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
        <Stack spacing={1.25}>
          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
            <Box>
              <Typography variant="overline" color="text.secondary">
                Local Stack Overview
              </Typography>
              <Typography variant="h6">Manage your local stack without losing screen space</Typography>
            </Box>
          </Box>

          <Divider />

          <Stack direction={{ xs: "column", xl: "row" }} spacing={1} justifyContent="space-between">
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button size="small" variant="contained" startIcon={<PlayArrowIcon />} onClick={handleBulkStartAll}>
                Start all
              </Button>
              <Button size="small" variant="outlined" color="error" startIcon={<StopIcon />} onClick={handleBulkStopAll}>
                Stop all
              </Button>
              <Button size="small" variant="outlined" startIcon={<PlayArrowIcon />} onClick={handleStartSelected} disabled={!selectedServices.length}>
                Start selected
              </Button>
              <Button size="small" variant="outlined" color="error" startIcon={<StopIcon />} onClick={handleStopSelected} disabled={!selectedServices.length}>
                Stop selected
              </Button>
              <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={handleRestartSelected} disabled={!selectedServices.length}>
                Restart
              </Button>
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
          </Stack>

          <Stack direction={{ xs: "column", lg: "row" }} spacing={1} alignItems={{ xs: "stretch", lg: "center" }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
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
            <FormControl size="small" sx={{ minWidth: 150 }}>
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
            <FormControl size="small" sx={{ minWidth: 150 }}>
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
            <FormControl size="small" sx={{ minWidth: 150 }}>
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

          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
            <Checkbox
              checked={allFilteredSelected}
              indeterminate={someFilteredSelected}
              onChange={(event) => toggleSelectFiltered(event.target.checked)}
            />
            <Typography variant="body2" color="text.secondary">
              Select all filtered services
            </Typography>
            {selectedServices.length > 0 ? (
              <Button size="small" variant="text" onClick={() => setSelectedServices([])}>
                Clear selection
              </Button>
            ) : null}
          </Box>
        </Stack>
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
          {groupedServices.length === 0 ? (
            <Alert severity="info">No services match the current filters.</Alert>
          ) : (
            groupedServices.map(({ group, services: groupServices }) => (
              <Box key={group}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 1.5,
                    p: 1.5,
                    borderRadius: 3,
                    background: "linear-gradient(90deg, rgba(15,23,42,0.04) 0%, rgba(255,255,255,0.8) 100%)",
                    border: "1px solid rgba(148, 163, 184, 0.16)",
                  }}
                >
                  <Box>
                    <Typography variant="h6">{group}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {groupServices.length} services in this operating zone
                    </Typography>
                  </Box>
                  <Chip label={`${groupServices.length} services`} variant="outlined" />
                </Box>
                <Stack spacing={1}>
                  {groupServices.map((service) => (
                    <ServiceCard
                      key={service.name}
                      service={service}
                      status={displayStates[service.name]}
                      reverseDependencies={reverseDependencies[service.name] || []}
                      isSelected={selectedServices.includes(service.name)}
                      onSelect={(checked) => toggleSelection(service.name, checked)}
                      onAction={executeSingleAction}
                      onViewLogs={onViewLogs}
                    />
                  ))}
                </Stack>
              </Box>
            ))
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
