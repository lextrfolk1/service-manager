import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  LockOutlined as LockIcon,
  Tune as TuneIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from "@mui/icons-material";
import { CODE_FONT } from "../theme/tokens";

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

const TEAL = "#0d9488";
const monoSx = { fontFamily: CODE_FONT, fontSize: "0.82rem" };

function FieldBlock({ label, hint, children }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, mb: 0.25 }}>{label}</Typography>
      {hint ? <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", mb: 0.75 }}>{hint}</Typography> : null}
      {children}
    </Box>
  );
}

// Run configuration editor: extra parameters for this machine (stored outside services.json, never committed).
// Fields shown depend on the service type.
export function RunConfigSection({ settings = {}, serviceType = "", onChange }) {
  const [revealed, setRevealed] = useState({});
  const envEntries = Object.entries(settings.env || {});
  const update = (patch) => onChange({ ...settings, ...patch });
  const setEnvEntries = (entries) => update({ env: Object.fromEntries(entries) });
  const fields = getRunFields(serviceType);
  const argsCopy = RUN_ARGS_COPY[serviceType || ""] || RUN_ARGS_COPY[""];
  const envHelp = RUN_ENV_HELP[serviceType || ""] || RUN_ENV_HELP_CONTAINER;
  // Values saved earlier for fields this type doesn't use (e.g. after changing the type) are ignored when starting.
  const unusedFields = ["jvmArgs", "args"].filter((field) => !fields.includes(field) && String(settings[field] || "").trim());

  return (
    <Box>
      {fields.includes("jvmArgs") ? (
        <FieldBlock label="JVM arguments" hint="Heap size, system properties, debug agent. -D is optional: name=value works too.">
          <TextField
            fullWidth
            size="small"
            multiline
            maxRows={4}
            value={settings.jvmArgs || ""}
            onChange={(event) => update({ jvmArgs: event.target.value })}
            placeholder="-Xmx1g spring.profiles.active=local"
            InputProps={{ sx: monoSx }}
          />
        </FieldBlock>
      ) : null}

      {fields.includes("args") ? (
        <FieldBlock label={argsCopy.label} hint={argsCopy.help}>
          <TextField
            fullWidth
            size="small"
            multiline
            maxRows={4}
            value={settings.args || ""}
            onChange={(event) => update({ args: event.target.value })}
            placeholder={argsCopy.placeholder.replace(/^e\.g\. /, "")}
            InputProps={{ sx: monoSx }}
          />
        </FieldBlock>
      ) : null}

      {unusedFields.length ? (
        <Alert
          severity="warning"
          sx={{ mb: 2, py: 0 }}
          action={
            <Button size="small" color="inherit" onClick={() => update(Object.fromEntries(unusedFields.map((field) => [field, ""])))}>
              Clear
            </Button>
          }
        >
          {unusedFields.map((field) => RUN_FIELD_LABELS[field]).join(" and ")} {unusedFields.length > 1 ? "are" : "is"} set but not used for {serviceType || "this"} services.
        </Alert>
      ) : null}

      <Stack direction="row" alignItems="flex-end" justifyContent="space-between" sx={{ mb: 0.75 }}>
        <Box>
          <Typography sx={{ fontSize: "0.8rem", fontWeight: 700 }}>Environment variables</Typography>
          <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>{envHelp}</Typography>
        </Box>
        {envEntries.length ? (
          <Button size="small" startIcon={<AddIcon />} onClick={() => setEnvEntries([...envEntries, ["", ""]])} sx={{ flexShrink: 0, ml: 1 }}>
            Add
          </Button>
        ) : null}
      </Stack>

      {envEntries.length === 0 ? (
        <Box
          sx={{
            border: "1px dashed var(--c-border-94a3b8-06)",
            borderRadius: 2,
            py: 2,
            textAlign: "center",
            backgroundColor: "var(--c-bg-f8fafc-07)",
          }}
        >
          <Typography sx={{ fontSize: "0.8rem", color: "text.secondary", mb: 1 }}>No environment variables yet</Typography>
          <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setEnvEntries([["", ""]])}>
            Add variable
          </Button>
        </Box>
      ) : (
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr) 72px",
              px: 1.25,
              py: 0.5,
              backgroundColor: "var(--c-bg-f8fafc-09)",
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            {["Name", "Value", ""].map((heading) => (
              <Typography key={heading} sx={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: "text.secondary" }}>
                {heading}
              </Typography>
            ))}
          </Box>
          {envEntries.map(([key, value], index) => (
            <Box
              key={index}
              sx={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr) 72px",
                gap: 1,
                alignItems: "center",
                px: 1.25,
                py: 0.75,
                "&:not(:last-of-type)": { borderBottom: "1px solid var(--c-border-94a3b8-015)" },
              }}
            >
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
              />
              <TextField
                size="small"
                placeholder="value (empty = not set)"
                type={revealed[index] ? "text" : "password"}
                value={value}
                onChange={(event) => {
                  const next = [...envEntries];
                  next[index] = [key, event.target.value];
                  setEnvEntries(next);
                }}
                InputProps={{ sx: monoSx }}
              />
              <Stack direction="row" spacing={0.25} justifyContent="flex-end">
                <Tooltip title={revealed[index] ? "Hide value" : "Show value"}>
                  <IconButton size="small" onClick={() => setRevealed((previous) => ({ ...previous, [index]: !previous[index] }))}>
                    {revealed[index] ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Remove variable">
                  <IconButton size="small" color="error" onClick={() => setEnvEntries(envEntries.filter((_, i) => i !== index))}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>
          ))}
        </Box>
      )}
    </Box>
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
  const changeItems = changes[0] ? changes[0].split(", ") : [];
  // Closing with edits asks first, so a stray Esc / backdrop click doesn't lose them.
  const requestClose = () => (changeItems.length ? setStep("discard") : onClose());

  const header = (title) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 3, pt: 2.5, pb: 2, borderBottom: "1px solid", borderColor: "divider" }}>
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 2,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          color: TEAL,
          backgroundColor: `${TEAL}14`,
          border: `1px solid ${TEAL}33`,
        }}
      >
        <TuneIcon fontSize="small" />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontWeight: 800, fontSize: "1.05rem", lineHeight: 1.25 }}>{title}</Typography>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.25 }}>
          <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, fontFamily: monoSx.fontFamily }} noWrap>
            {serviceName}
          </Typography>
          {serviceType ? <Chip size="small" label={serviceType} sx={{ fontSize: "0.65rem" }} /> : null}
        </Stack>
      </Box>
      <Tooltip title="Stored in run-config.json on this machine. It is git-ignored and never committed.">
        <Chip
          size="small"
          icon={<LockIcon sx={{ fontSize: "12px !important" }} />}
          label="This machine only"
          sx={{ fontSize: "0.68rem", fontWeight: 700, color: TEAL, backgroundColor: `${TEAL}10`, "& .MuiChip-icon": { color: TEAL } }}
        />
      </Tooltip>
    </Box>
  );

  return (
    <Dialog open={open} onClose={saving ? undefined : step === "discard" ? () => setStep("edit") : requestClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      {step === "edit" ? (
        <>
          {header("Run configuration")}
          <DialogContent sx={{ px: 3, pt: "20px !important", pb: 1 }}>
            <RunConfigSection settings={draft} serviceType={serviceType || ""} onChange={setDraft} />
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, borderTop: "1px solid", borderColor: "divider", justifyContent: "space-between" }}>
            <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
              {changeItems.length
                ? `${changeItems.length} change${changeItems.length === 1 ? "" : "s"} · applies the next time the service starts`
                : "Applies the next time the service starts"}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button onClick={requestClose}>Cancel</Button>
              <Button variant="contained" onClick={() => setStep("confirm")} disabled={changeItems.length === 0}>
                Save
              </Button>
            </Stack>
          </DialogActions>
        </>
      ) : step === "discard" ? (
        <>
          {header("Discard changes?")}
          <DialogContent sx={{ px: 3, pt: "20px !important" }}>
            <Typography sx={{ fontSize: "0.85rem" }}>
              You have {changeItems.length} unsaved change{changeItems.length === 1 ? "" : "s"}. Closing now throws them away.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, borderTop: "1px solid", borderColor: "divider" }}>
            <Button onClick={() => setStep("edit")}>Keep editing</Button>
            <Button variant="contained" color="error" onClick={onClose}>
              Discard
            </Button>
          </DialogActions>
        </>
      ) : (
        <>
          {header("Save run configuration?")}
          <DialogContent sx={{ px: 3, pt: "20px !important" }}>
            <Typography sx={{ fontSize: "0.85rem", mb: 1 }}>These changes will be saved:</Typography>
            <Stack spacing={0.75}>
              {changeItems.map((item) => (
                <Stack key={item} direction="row" spacing={1} alignItems="center">
                  <Box sx={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: TEAL, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: "0.85rem" }}>{item}</Typography>
                </Stack>
              ))}
            </Stack>
            <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", mt: 2 }}>
              Values are not shown here because they may be secrets.
            </Typography>
            {isRunning ? (
              <Box sx={{ mt: 2, px: 1.5, py: 0.5, borderRadius: 2, backgroundColor: "color-mix(in srgb, var(--sm-accent) 6%, transparent)", border: "1px solid color-mix(in srgb, var(--sm-accent) 18%, transparent)" }}>
                <FormControlLabel
                  control={<Checkbox size="small" checked={restartAfterSave} onChange={(event) => setRestartAfterSave(event.target.checked)} />}
                  label={<Typography sx={{ fontSize: "0.85rem" }}>Restart {serviceName} now so the changes take effect</Typography>}
                />
              </Box>
            ) : null}
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, borderTop: "1px solid", borderColor: "divider" }}>
            <Button onClick={() => setStep("edit")} disabled={saving}>Back</Button>
            <Button variant="contained" onClick={() => onSave(draft, isRunning && restartAfterSave)} disabled={saving}>
              {saving ? "Saving…" : isRunning && restartAfterSave ? "Save and restart" : "Save"}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
