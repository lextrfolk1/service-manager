import React, { useState, useEffect } from "react";
import {
  Container,
  Typography,
  Paper,
  TextField,
  Button,
  Box,
  Alert,
  CircularProgress,
  Snackbar,
} from "@mui/material";
import { Save as SaveIcon, Refresh as RefreshIcon } from "@mui/icons-material";
import api from "../services/api";

const Admin = () => {
  const [config, setConfig] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarSeverity, setSnackbarSeverity] = useState("info");

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setSaveStatus("Loading...");
    setLoading(true);

    try {
      const data = await api.get("/config/services");
      setConfig(JSON.stringify(data, null, 2));
      setSaveStatus("Loaded actual services.json. Edit and Save to apply.");
      setSnackbarSeverity("success");
    } catch (error) {
      setSaveStatus(`Failed to load config: ${error.message}`);
      setSnackbarSeverity("error");
    } finally {
      setLoading(false);
      setSnackbarOpen(true);
    }
  };

  const saveConfig = async () => {
    setSaveStatus("Saving...");
    setSaving(true);

    let parsedConfig;
    try {
      parsedConfig = JSON.parse(config);
    } catch (error) {
      setSaveStatus(`Invalid JSON: ${error.message}`);
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
      setSaving(false);
      return;
    }

    try {
      await api.put("/config/services", parsedConfig);
      setSaveStatus("Saved successfully. Backend reloaded config.");
      setSnackbarSeverity("success");
    } catch (error) {
      setSaveStatus(`Failed to save: ${error.message}`);
      setSnackbarSeverity("error");
    } finally {
      setSaving(false);
      setSnackbarOpen(true);
    }
  };

  const handleConfigChange = (e) => {
    setConfig(e.target.value);
  };

  const formatJson = () => {
    try {
      const parsed = JSON.parse(config);
      setConfig(JSON.stringify(parsed, null, 2));
      setSaveStatus("JSON formatted successfully.");
      setSnackbarSeverity("success");
      setSnackbarOpen(true);
    } catch (error) {
      setSaveStatus(`Invalid JSON: ${error.message}`);
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography
        variant="h4"
        component="h1"
        gutterBottom
        sx={{ fontWeight: 600 }}
      >
        Service Configuration
      </Typography>

      <Alert severity="warning" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>Warning:</strong> Use this page to edit the metadata JSON that
          defines all services. Be careful: invalid JSON will break the backend.
        </Typography>
      </Alert>

      {loading ? (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="50vh"
        >
          <CircularProgress size={60} />
        </Box>
      ) : (
        <Paper elevation={2} sx={{ p: 3 }}>
          <Box
            sx={{
              mb: 2,
              display: "flex",
              gap: 2,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={saveConfig}
              disabled={saving}
              color="primary"
            >
              {saving ? "Saving..." : "Save Configuration"}
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadConfig}
              disabled={loading || saving}
            >
              Reload
            </Button>
            <Button variant="outlined" onClick={formatJson} disabled={saving}>
              Format JSON
            </Button>
          </Box>

          <TextField
            fullWidth
            multiline
            rows={25}
            value={config}
            onChange={handleConfigChange}
            placeholder="Loading configuration..."
            variant="outlined"
            sx={{
              "& .MuiInputBase-input": {
                fontFamily: '"Monaco", "Menlo", "Ubuntu Mono", monospace',
                fontSize: "0.875rem",
                lineHeight: 1.5,
              },
            }}
            disabled={saving}
          />

          {saveStatus && (
            <Box sx={{ mt: 2 }}>
              <Alert
                severity={
                  saveStatus.includes("Failed") ||
                  saveStatus.includes("Invalid")
                    ? "error"
                    : saveStatus.includes("Successfully") ||
                      saveStatus.includes("Loaded")
                    ? "success"
                    : "info"
                }
              >
                {saveStatus}
              </Alert>
            </Box>
          )}
        </Paper>
      )}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbarSeverity}>
          {saveStatus}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Admin;
