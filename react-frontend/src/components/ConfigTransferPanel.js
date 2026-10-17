import React, { useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import {
  ContentCopy as ContentCopyIcon,
  FileDownloadOutlined as DownloadIcon,
  FileUploadOutlined as UploadIcon,
} from "@mui/icons-material";
import { TRANSFER_SECTIONS, buildExport, exportFileName, parseImport, pathsLookForeign, planImport } from "../utils/configTransfer";

const SECTION_BY_ID = Object.fromEntries(TRANSFER_SECTIONS.map((section) => [section.id, section]));
const CHANGE_COLORS = { added: "var(--c-text-047857)", changed: "var(--c-text-b45309)", removed: "var(--c-text-b91c1c)" };

function Panel({ title, description, children }) {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        border: "1px solid var(--c-border-94a3b8-025)",
        backgroundColor: "background.paper",
      }}
    >
      <Typography sx={{ fontWeight: 800, fontSize: "0.95rem" }}>{title}</Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.25 }}>
        {description}
      </Typography>
      {children}
    </Box>
  );
}

function SectionChecks({ ids, selected, onToggle }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "1fr", rowGap: 0.25 }}>
      {ids.map((id) => (
        <FormControlLabel
          key={id}
          control={<Checkbox size="small" checked={selected.includes(id)} onChange={() => onToggle(id)} />}
          label={
            <Box sx={{ lineHeight: 1.2, py: 0.25 }}>
              <Typography sx={{ fontSize: "0.85rem", fontWeight: 600 }}>{SECTION_BY_ID[id].label}</Typography>
              <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>{SECTION_BY_ID[id].hint}</Typography>
            </Box>
          }
          sx={{ alignItems: "flex-start", mr: 0, "& .MuiCheckbox-root": { pt: 0.5 } }}
        />
      ))}
    </Box>
  );
}

const toggleIn = (list, id) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);

// Admin › Import / Export: download or copy the configuration, or load a file into the editor.
// Imports only change the editor; Save (with its confirmation) still writes the files.
// validate(services, basePaths) returns validation issues ({ severity, scope, message }); platform is the backend OS.
export default function ConfigTransferPanel({ getDraftConfig, runConfig, current, onApplyImport, showSnackbar, validate, platform }) {
  const [exportSections, setExportSections] = useState(() =>
    TRANSFER_SECTIONS.filter((section) => section.exportByDefault).map((section) => section.id)
  );
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [imported, setImported] = useState(null); // { fileName, doc, available }
  const [importSections, setImportSections] = useState([]);
  const [importMode, setImportMode] = useState("merge");
  const [importError, setImportError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  const exportText = () =>
    JSON.stringify(buildExport(getDraftConfig(), runConfig, exportSections, { includeSecrets }), null, 2);

  const download = () => {
    const url = URL.createObjectURL(new Blob([`${exportText()}\n`], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = exportFileName();
    link.click();
    URL.revokeObjectURL(url);
    showSnackbar("Configuration downloaded", "success");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportText());
      showSnackbar("Configuration copied to the clipboard", "success");
    } catch {
      showSnackbar("Could not copy to clipboard", "error");
    }
  };

  const readFile = (file) => {
    if (!file) return;
    file
      .text()
      .then((text) => {
        const { doc, available } = parseImport(text);
        // Paths from another OS (e.g. C:/ paths on macOS) would break every service here, so they start unticked.
        const foreignPaths = available.includes("paths") && pathsLookForeign(doc.config?.basePaths, platform);
        setImported({ fileName: file.name, doc, available, foreignPaths });
        setImportSections(foreignPaths ? available.filter((id) => id !== "paths") : available);
        setImportError("");
      })
      .catch((error) => {
        setImported(null);
        setImportError(`${file.name}: ${error.message}`);
      });
  };

  const plan = useMemo(
    () => (imported ? planImport(current, imported.doc, importSections, importMode) : null),
    [imported, importSections, importMode, current]
  );

  // Problems the import would introduce (ones already in the current configuration aren't repeated).
  const newIssues = useMemo(() => {
    if (!plan || !validate || !(plan.next.services || plan.next.paths)) return [];
    const key = (issue) => `${issue.severity}|${issue.scope}|${issue.message}`;
    const existing = new Set(validate(current.services, current.basePaths).map(key));
    return validate(plan.next.services || current.services, plan.next.paths || current.basePaths).filter(
      (issue) => !existing.has(key(issue))
    );
  }, [plan, validate, current]);
  const newErrors = newIssues.filter((issue) => issue.severity === "error");

  const clearImport = () => {
    setImported(null);
    setImportError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const applyImport = () => {
    onApplyImport(plan.next);
    clearImport();
    showSnackbar("Imported into the editor — review and Save to write it", "success");
  };

  return (
    <Stack spacing={1.5}>
      <Panel title="Export" description="Download or copy the configuration, including unsaved edits.">
        <SectionChecks
          ids={TRANSFER_SECTIONS.map((section) => section.id)}
          selected={exportSections}
          onToggle={(id) => setExportSections((list) => toggleIn(list, id))}
        />
        {exportSections.includes("runConfig") ? (
          <Box sx={{ mt: 1 }}>
            <FormControlLabel
              control={<Checkbox size="small" checked={includeSecrets} onChange={(event) => setIncludeSecrets(event.target.checked)} />}
              label={<Typography sx={{ fontSize: "0.85rem" }}>Include secret values (API keys, passwords, tokens)</Typography>}
            />
            <Typography sx={{ fontSize: "0.72rem", color: includeSecrets ? "var(--c-text-b91c1c)" : "text.secondary", pl: 3.75 }}>
              {includeSecrets
                ? "The file will contain secrets in plain text. Don't commit or share it."
                : `Secret values are written as <hidden>; importing keeps the value already on that machine.`}
            </Typography>
          </Box>
        ) : null}
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          <Button size="small" variant="contained" startIcon={<DownloadIcon />} onClick={download} disabled={!exportSections.length}>
            Download
          </Button>
          <Button size="small" startIcon={<ContentCopyIcon />} onClick={copy} disabled={!exportSections.length}>
            Copy
          </Button>
        </Stack>
      </Panel>

      <Panel title="Import" description="Load an exported file or a services.json. Nothing is written until you Save.">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(event) => readFile(event.target.files?.[0])}
        />
        {!imported ? (
          <Box
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              readFile(event.dataTransfer.files?.[0]);
            }}
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 0.5,
              py: 3,
              borderRadius: 2,
              border: "1.5px dashed",
              borderColor: dragging ? "primary.main" : "var(--c-border-94a3b8-06)",
              backgroundColor: dragging ? "var(--c-bg-eff6ff)" : "transparent",
              cursor: "pointer",
              color: "text.secondary",
              "&:hover, &:focus-visible": { borderColor: "primary.main", outline: "none" },
            }}
          >
            <UploadIcon />
            <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, color: "text.primary" }}>Choose a file or drop it here</Typography>
            <Typography sx={{ fontSize: "0.72rem" }}>.json export or services.json</Typography>
          </Box>
        ) : (
          <Stack spacing={1.25}>
            <Typography sx={{ fontSize: "0.85rem" }}>
              <strong>{imported.fileName}</strong> — choose what to import:
            </Typography>
            <SectionChecks
              ids={imported.available}
              selected={importSections}
              onToggle={(id) => setImportSections((list) => toggleIn(list, id))}
            />
            {imported.foreignPaths ? (
              <Alert severity="info" sx={{ py: 0, fontSize: "0.78rem" }}>
                The paths in this file are from another operating system, so Paths is unticked to keep this machine's folders.
              </Alert>
            ) : null}
            <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap>
              <ToggleButtonGroup size="small" exclusive value={importMode} onChange={(_, value) => value && setImportMode(value)}>
                <ToggleButton value="merge" sx={{ textTransform: "none", px: 1.5 }}>
                  Merge
                </ToggleButton>
                <ToggleButton value="replace" sx={{ textTransform: "none", px: 1.5 }}>
                  Replace
                </ToggleButton>
              </ToggleButtonGroup>
              <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", flex: 1, minWidth: 180 }}>
                {importMode === "merge"
                  ? "Adds new items and updates existing ones. Nothing is removed."
                  : "Each chosen section becomes exactly what the file has. Items not in the file are removed."}
              </Typography>
            </Stack>
            <Box
              sx={{
                p: 1.25,
                borderRadius: 1.5,
                backgroundColor: "var(--c-bg-f8fafc)",
                border: "1px solid var(--c-border-94a3b8-016)",
                maxHeight: 160,
                overflow: "auto",
              }}
            >
              {plan.changes.length ? (
                plan.changes.map((change) => (
                  <Typography key={change.text} sx={{ fontSize: "0.8rem", color: CHANGE_COLORS[change.kind], lineHeight: 1.6 }}>
                    {change.text}
                  </Typography>
                ))
              ) : (
                <Typography sx={{ fontSize: "0.8rem", color: "text.secondary" }}>No changes: the editor already matches this file.</Typography>
              )}
            </Box>
            {newIssues.length ? (
              <Alert severity={newErrors.length ? "error" : "warning"} sx={{ fontSize: "0.78rem", "& .MuiAlert-message": { width: "100%" } }}>
                <strong>
                  {newErrors.length
                    ? `${newErrors.length} error${newErrors.length === 1 ? "" : "s"} to fix before Save`
                    : `${newIssues.length} warning${newIssues.length === 1 ? "" : "s"}`}
                </strong>
                {newIssues.slice(0, 5).map((issue) => (
                  <Box key={`${issue.severity}|${issue.scope}|${issue.message}`} sx={{ lineHeight: 1.5 }}>
                    {issue.scope}: {issue.message}
                  </Box>
                ))}
                {newIssues.length > 5 ? <Box sx={{ lineHeight: 1.5 }}>+{newIssues.length - 5} more</Box> : null}
              </Alert>
            ) : null}
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="contained" onClick={applyImport} disabled={!plan.changes.length}>
                Apply to editor
              </Button>
              <Button size="small" onClick={clearImport}>
                Cancel
              </Button>
            </Stack>
          </Stack>
        )}
        {importError ? (
          <Alert severity="error" sx={{ mt: 1.25 }} onClose={() => setImportError("")}>
            {importError}
          </Alert>
        ) : null}
      </Panel>
    </Stack>
  );
}
