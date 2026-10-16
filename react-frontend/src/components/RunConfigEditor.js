import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Add as AddIcon, Delete as DeleteIcon } from "@mui/icons-material";

// Shared by Admin (service editor) and Dashboard (quick edit from a service card).

// Which run configuration fields apply to each service type (keep in sync with backend/src/runConfig.js).
// Types not listed (redis, neo4j, database, docker, …) only take environment variables.
const RUN_FIELDS_BY_TYPE = {
  java: ["jvmArgs", "args", "env"],
  python: ["args", "env"],
  listener: ["args", "env"],
  npm: ["args", "env"],
  "": ["args", "env"],
};

const RUN_ARGS_COPY = {
  java: { label: "Program arguments", placeholder: "e.g. --server.port=9090 --debug", help: "Passed to the Spring Boot application." },
  python: { label: "Command-line arguments", placeholder: "e.g. --reload --workers 2", help: "Added to the end of the start command." },
  listener: { label: "Command-line arguments", placeholder: "e.g. --batch-size 100", help: "Added to the end of the start command." },
  npm: { label: "Script arguments", placeholder: "e.g. --port 5174 --open", help: "Passed to the npm script after --." },
  "": { label: "Command-line arguments", placeholder: "e.g. --verbose", help: "Added to the end of the start command." },
};

const RUN_ENV_HELP = {
  java: "e.g. SPRING_PROFILES_ACTIVE or credentials the app reads from the environment.",
  python: "e.g. PYTHONPATH, OPENAI_API_KEY. Use these for API keys instead of putting them in the start command.",
  listener: "e.g. PYTHONPATH or connection strings the worker reads from the environment.",
  npm: "e.g. VITE_API_URL or NODE_OPTIONS.",
  "": "Variables the service reads from its environment.",
};
const RUN_ENV_HELP_CONTAINER = "Passwords and settings for the container. Reference them in the start command as -e NAME (without a value) so Docker takes them from here.";

const RUN_FIELD_LABELS = { jvmArgs: "JVM arguments", args: "Arguments" };

export function getRunFields(type) {
  return RUN_FIELDS_BY_TYPE[type || ""] || ["env"];
}

// Run configuration editor: extra parameters for this machine (stored outside services.json, never committed).
// Fields shown depend on the service type.
export function RunConfigSection({ settings = {}, serviceType = "", onChange }) {
  const [revealed, setRevealed] = useState({});
  const envEntries = Object.entries(settings.env || {});
  const update = (patch) => onChange({ ...settings, ...patch });
  const fields = getRunFields(serviceType);
  const argsCopy = RUN_ARGS_COPY[serviceType || ""] || RUN_ARGS_COPY[""];
  const envHelp = RUN_ENV_HELP[serviceType || ""] || RUN_ENV_HELP_CONTAINER;
  // Values saved earlier for fields this type doesn't use (e.g. after changing the type) are ignored when starting.
  const unusedFields = ["jvmArgs", "args"].filter((field) => !fields.includes(field) && String(settings[field] || "").trim());
  const setEnvEntries = (entries) => update({ env: Object.fromEntries(entries) });
  const monoSx = { fontFamily: "monospace", fontSize: "0.82rem" };

  return (
    <>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>
        Extra parameters this service needs to run on this machine. They are stored separately from the shared
        configuration and are never committed.
      </Typography>
      {fields.includes("jvmArgs") || fields.includes("args") ? (
        <Grid container spacing={1.5}>
          {fields.includes("jvmArgs") ? (
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="JVM arguments"
                value={settings.jvmArgs || ""}
                onChange={(event) => update({ jvmArgs: event.target.value })}
                placeholder="e.g. -Xmx1g spring.profiles.active=local"
                InputProps={{ sx: monoSx }}
                helperText="Heap size, system properties, debug agent. -D is optional for properties: name=value works too."
              />
            </Grid>
          ) : null}
          {fields.includes("args") ? (
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label={argsCopy.label}
                value={settings.args || ""}
                onChange={(event) => update({ args: event.target.value })}
                placeholder={argsCopy.placeholder}
                InputProps={{ sx: monoSx }}
                helperText={argsCopy.help}
              />
            </Grid>
          ) : null}
        </Grid>
      ) : null}
      {unusedFields.length ? (
        <Alert
          severity="warning"
          sx={{ mt: 1.5, py: 0 }}
          action={
            <Button
              size="small"
              color="inherit"
              onClick={() => update(Object.fromEntries(unusedFields.map((field) => [field, ""])))}
            >
              Clear
            </Button>
          }
        >
          {unusedFields.map((field) => RUN_FIELD_LABELS[field]).join(" and ")} {unusedFields.length > 1 ? "are" : "is"} set but not used for {serviceType || "this"} services.
        </Alert>
      ) : null}

      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 2, mb: 1 }}>
        <Typography sx={{ fontSize: "0.8rem", fontWeight: 700 }}>Environment variables</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={() => setEnvEntries([...envEntries, ["", ""]])}>
          Add variable
        </Button>
      </Stack>
      {envEntries.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          None yet. {envHelp}
        </Typography>
      ) : (
        <Stack spacing={1}>
          {envEntries.map(([key, value], index) => (
            <Stack key={index} direction="row" spacing={1} alignItems="center">
              <TextField
                size="small"
                placeholder="NAME"
                value={key}
                onChange={(event) => {
                  const next = [...envEntries];
                  next[index] = [event.target.value.replace(/\s+/g, "_"), value];
                  setEnvEntries(next);
                }}
                InputProps={{ sx: monoSx }}
                sx={{ width: "40%" }}
              />
              <TextField
                size="small"
                fullWidth
                placeholder="value (empty = not set)"
                type={revealed[index] ? "text" : "password"}
                value={value}
                onChange={(event) => {
                  const next = [...envEntries];
                  next[index] = [key, event.target.value];
                  setEnvEntries(next);
                }}
                InputProps={{
                  sx: monoSx,
                  endAdornment: (
                    <InputAdornment position="end">
                      <Button
                        size="small"
                        onClick={() => setRevealed((previous) => ({ ...previous, [index]: !previous[index] }))}
                        sx={{ minWidth: 0, fontSize: "0.7rem" }}
                      >
                        {revealed[index] ? "Hide" : "Show"}
                      </Button>
                    </InputAdornment>
                  ),
                }}
              />
              <Tooltip title="Remove variable">
                <IconButton size="small" color="error" onClick={() => setEnvEntries(envEntries.filter((_, i) => i !== index))}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          ))}
        </Stack>
      )}
    </>
  );
}

// Drops empty values so unchanged/blank fields don't count as edits and aren't written.
export function cleanRunConfig(runConfig) {
  const services = {};
  Object.entries(runConfig?.services || {}).forEach(([name, entry]) => {
    const cleaned = {};
    if (String(entry?.jvmArgs || "").trim()) cleaned.jvmArgs = String(entry.jvmArgs).trim();
    if (String(entry?.args || "").trim()) cleaned.args = String(entry.args).trim();
    const env = Object.fromEntries(
      Object.entries(entry?.env || {})
        .filter(([key]) => key.trim())
        .map(([key, value]) => [key.trim(), String(value ?? "")])
    );
    if (Object.keys(env).length) cleaned.env = env;
    if (Object.keys(cleaned).length) services[name] = cleaned;
  });
  return { services };
}

// Run configuration changes for the save confirmation. Values are never shown (they may be secrets).
export function summarizeRunConfigChanges(saved, current) {
  const before = cleanRunConfig(saved).services;
  const after = cleanRunConfig(current).services;
  const changes = [];
  new Set([...Object.keys(before), ...Object.keys(after)]).forEach((name) => {
    const a = before[name] || {};
    const b = after[name] || {};
    const fields = [];
    if ((a.jvmArgs || "") !== (b.jvmArgs || "")) fields.push("JVM arguments");
    if ((a.args || "") !== (b.args || "")) fields.push("program arguments");
    const envA = a.env || {};
    const envB = b.env || {};
    new Set([...Object.keys(envA), ...Object.keys(envB)]).forEach((key) => {
      if (!(key in envA)) fields.push(`${key} added`);
      else if (!(key in envB)) fields.push(`${key} removed`);
      else if (envA[key] !== envB[key]) fields.push(`${key} changed`);
    });
    if (fields.length) changes.push({ kind: "changed", text: `Run configuration · "${name}": ${fields.join(", ")}` });
  });
  return changes;
}

// Number of run configuration values set for a service (non-empty JVM args, args and env vars).
export function countRunConfigValues(entry) {
  const cleaned = cleanRunConfig({ services: { _: entry || {} } }).services._ || {};
  const envCount = Object.values(cleaned.env || {}).filter((value) => value !== "").length;
  return (cleaned.jvmArgs ? 1 : 0) + (cleaned.args ? 1 : 0) + envCount;
}

// Quick edit from a Dashboard card. Two steps, like every other config change: edit, then confirm.
export function RunConfigDialog({ open, serviceName, serviceType, initialSettings, isRunning, saving, onClose, onSave }) {
  const [draft, setDraft] = useState({});
  const [step, setStep] = useState("edit");
  const [restartAfterSave, setRestartAfterSave] = useState(true);

  useEffect(() => {
    if (!open) return;
    setDraft(JSON.parse(JSON.stringify(initialSettings || {})));
    setStep("edit");
    setRestartAfterSave(true);
    // Reset only when the dialog opens for a service, not when background refreshes change initialSettings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, serviceName]);

  const changes = summarizeRunConfigChanges(
    { services: { [serviceName]: initialSettings || {} } },
    { services: { [serviceName]: draft } }
  ).map((change) => change.text.replace(/^Run configuration · "[^"]*": /, ""));

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      {step === "edit" ? (
        <>
          <DialogTitle sx={{ fontWeight: 800 }}>Run configuration · {serviceName}</DialogTitle>
          <DialogContent sx={{ pt: 1 }}>
            <RunConfigSection settings={draft} serviceType={serviceType || ""} onChange={setDraft} />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="contained" onClick={() => setStep("confirm")} disabled={changes.length === 0}>
              Save
            </Button>
          </DialogActions>
        </>
      ) : (
        <>
          <DialogTitle sx={{ fontWeight: 800 }}>Save run configuration?</DialogTitle>
          <DialogContent sx={{ pt: 1 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Changes for <strong>{serviceName}</strong>:
            </Typography>
            <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 2.5 }}>
              {changes[0]
                ? changes[0].split(", ").map((item) => (
                    <Typography component="li" variant="body2" key={item}>
                      {item}
                    </Typography>
                  ))
                : null}
            </Stack>
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1.5 }}>
              Saved on this machine only and never committed. Values are not shown here. Changes apply the next time
              the service starts.
            </Typography>
            {isRunning ? (
              <FormControlLabel
                sx={{ mt: 1 }}
                control={
                  <Checkbox size="small" checked={restartAfterSave} onChange={(event) => setRestartAfterSave(event.target.checked)} />
                }
                label={<Typography variant="body2">Restart {serviceName} now so the changes take effect</Typography>}
              />
            ) : null}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => setStep("edit")} disabled={saving}>Back</Button>
            <Button variant="contained" onClick={() => onSave(draft, isRunning && restartAfterSave)} disabled={saving}>
              {saving ? "Saving…" : "Confirm and save"}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
