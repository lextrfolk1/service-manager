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
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Tooltip,
} from "@mui/material";
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Code as CodeIcon,
  Storage as StorageIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from "@mui/icons-material";
import api from "../services/api";

const Admin = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [config, setConfig] = useState(null);
  const [rawConfig, setRawConfig] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState("info");

  // Form states for base paths
  const [basePaths, setBasePaths] = useState({});
  const [globalConfig, setGlobalConfig] = useState({
    configServerUrl: "",
  });

  // Form state for services
  const [services, setServices] = useState({});

  // Dialog states
  const [addPathDialog, setAddPathDialog] = useState(false);
  const [addServiceDialog, setAddServiceDialog] = useState(false);
  const [newPathKey, setNewPathKey] = useState("");
  const [newPathValue, setNewPathValue] = useState("");
  const [newServiceName, setNewServiceName] = useState("");

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    showSnackbar("Loading configuration...", "info");

    try {
      const data = await api.get("/config");
      setConfig(data);
      
      // Populate form states
      setBasePaths(data.config.basePaths || {});
      setGlobalConfig({
        configServerUrl: data.config.configServerUrl || "",
      });
      setServices(data.services || {});
      setRawConfig(JSON.stringify(data, null, 2));
      
      showSnackbar("Configuration loaded successfully", "success");
    } catch (error) {
      showSnackbar(`Failed to load config: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const savePaths = async () => {
    setSaving(true);
    showSnackbar("Saving base paths...", "info");

    try {
      const updatedConfig = {
        ...config,
        config: {
          ...config.config,
          configServerUrl: globalConfig.configServerUrl,
          basePaths: basePaths,
        },
      };

      await api.put("/config", updatedConfig);
      setConfig(updatedConfig);
      setRawConfig(JSON.stringify(updatedConfig, null, 2));
      showSnackbar("Base paths saved successfully", "success");
    } catch (error) {
      showSnackbar(`Failed to save: ${error.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const saveServices = async () => {
    setSaving(true);
    showSnackbar("Saving services...", "info");

    try {
      const updatedConfig = {
        ...config,
        services: services,
      };

      await api.put("/config", updatedConfig);
      setConfig(updatedConfig);
      setRawConfig(JSON.stringify(updatedConfig, null, 2));
      showSnackbar("Services saved successfully", "success");
    } catch (error) {
      showSnackbar(`Failed to save: ${error.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const saveRawConfig = async () => {
    setSaving(true);
    showSnackbar("Saving configuration...", "info");

    let parsedConfig;
    try {
      parsedConfig = JSON.parse(rawConfig);
    } catch (error) {
      showSnackbar(`Invalid JSON: ${error.message}`, "error");
      setSaving(false);
      return;
    }

    try {
      await api.put("/config", parsedConfig);
      setConfig(parsedConfig);
      setBasePaths(parsedConfig.config.basePaths || {});
      setGlobalConfig({
        configServerUrl: parsedConfig.config.configServerUrl || "",
      });
      setServices(parsedConfig.services || {});
      showSnackbar("Configuration saved successfully", "success");
    } catch (error) {
      showSnackbar(`Failed to save: ${error.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleServiceChange = (serviceName, field, value) => {
    setServices(prev => ({
      ...prev,
      [serviceName]: {
        ...prev[serviceName],
        [field]: field === 'port' ? parseInt(value) || '' : value,
      },
    }));
  };

  const addNewPath = () => {
    if (newPathKey && newPathValue) {
      setBasePaths(prev => ({
        ...prev,
        [newPathKey]: newPathValue,
      }));
      setNewPathKey("");
      setNewPathValue("");
      setAddPathDialog(false);
    }
  };

  const removePath = (pathKey) => {
    setBasePaths(prev => {
      const newPaths = { ...prev };
      delete newPaths[pathKey];
      return newPaths;
    });
  };

  const addNewService = () => {
    if (newServiceName) {
      setServices(prev => ({
        ...prev,
        [newServiceName]: {
          type: "",
          port: "",
          path: "",
          command: "",
          stopCommand: "",
          build: "",
          description: "",
        },
      }));
      setNewServiceName("");
      setAddServiceDialog(false);
    }
  };

  const removeService = (serviceName) => {
    setServices(prev => {
      const newServices = { ...prev };
      delete newServices[serviceName];
      return newServices;
    });
  };

  const showSnackbar = (message, severity) => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
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

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress size={60} />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography 
        variant="h4" 
        component="h1" 
        gutterBottom 
        sx={{ 
          fontWeight: 700,
          background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          mb: 3
        }}
      >
        Configuration Management
      </Typography>

      <Paper 
        elevation={3} 
        sx={{ 
          mb: 3,
          borderRadius: 2,
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }}
      >
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{ 
            '& .MuiTab-root': {
              color: 'white',
              fontWeight: 600,
              '&.Mui-selected': {
                color: '#fff',
                backgroundColor: 'rgba(255,255,255,0.1)'
              }
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#fff',
              height: 3
            }
          }}
        >
          <Tab icon={<StorageIcon />} label="Base Paths" />
          <Tab icon={<SettingsIcon />} label="Services" />
          <Tab icon={<CodeIcon />} label="Raw JSON" />
        </Tabs>
      </Paper>

      {/* Base Paths Tab */}
      {currentTab === 0 && (
        <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 600, color: '#333' }}>
              Base Paths Configuration
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddPathDialog(true)}
              sx={{
                background: 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)',
                boxShadow: '0 3px 5px 2px rgba(255, 105, 135, .3)',
              }}
            >
              Add Path
            </Button>
          </Box>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            Configure the base directory paths for different service types. Services use these paths with <code>${basePaths.type}</code> templates.
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2, boxShadow: 2 }}>
                <Typography variant="h6" gutterBottom sx={{ color: '#555', fontWeight: 600 }}>
                  Global Settings
                </Typography>
                <TextField
                  fullWidth
                  label="Config Server URL"
                  value={globalConfig.configServerUrl}
                  onChange={(e) => setGlobalConfig(prev => ({ ...prev, configServerUrl: e.target.value }))}
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    }
                  }}
                />
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card variant="outlined" sx={{ p: 3, borderRadius: 2, boxShadow: 2 }}>
                <Typography variant="h6" gutterBottom sx={{ color: '#555', fontWeight: 600 }}>
                  Base Paths
                </Typography>
                <Grid container spacing={2}>
                  {Object.entries(basePaths).map(([key, value]) => (
                    <Grid item xs={12} sm={6} key={key}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TextField
                          fullWidth
                          label={`${key.charAt(0).toUpperCase() + key.slice(1)} Path`}
                          value={value}
                          onChange={(e) => setBasePaths(prev => ({ ...prev, [key]: e.target.value }))}
                          sx={{ 
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2,
                            }
                          }}
                        />
                        <Tooltip title="Remove Path">
                          <IconButton 
                            color="error" 
                            onClick={() => removePath(key)}
                            sx={{ ml: 1 }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Card>
            </Grid>
          </Grid>

          <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={savePaths}
              disabled={saving}
              size="large"
              sx={{
                background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
                px: 4,
                py: 1.5,
              }}
            >
              Save Base Paths
            </Button>
          </Box>
        </Paper>
      )}

      {/* Services Tab */}
      {currentTab === 1 && (
        <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 600, color: '#333' }}>
              Services Configuration
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddServiceDialog(true)}
              sx={{
                background: 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)',
                boxShadow: '0 3px 5px 2px rgba(255, 105, 135, .3)',
              }}
            >
              Add Service
            </Button>
          </Box>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            Manage individual service configurations. Paths use template variables like <code>${basePaths.java}/service-name</code>.
          </Typography>

          <Grid container spacing={3}>
            {Object.entries(services).map(([serviceName, service]) => (
              <Grid item xs={12} key={serviceName}>
                <Card 
                  variant="outlined" 
                  sx={{ 
                    p: 3, 
                    borderRadius: 2, 
                    boxShadow: 2,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      boxShadow: 4,
                      transform: 'translateY(-2px)'
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#333' }}>
                      {serviceName}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Chip 
                        label={service.type || 'Unknown'} 
                        color="primary" 
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                      <Tooltip title="Remove Service">
                        <IconButton 
                          color="error" 
                          size="small"
                          onClick={() => removeService(serviceName)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Type</InputLabel>
                        <Select
                          value={service.type || ''}
                          onChange={(e) => handleServiceChange(serviceName, 'type', e.target.value)}
                          label="Type"
                          sx={{ borderRadius: 2 }}
                        >
                          <MenuItem value="java">Java</MenuItem>
                          <MenuItem value="python">Python</MenuItem>
                          <MenuItem value="npm">NPM</MenuItem>
                          <MenuItem value="redis">Redis</MenuItem>
                          <MenuItem value="neo4j">Neo4j</MenuItem>
                          <MenuItem value="listener">Listener</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Port"
                        type="number"
                        value={service.port || ''}
                        onChange={(e) => handleServiceChange(serviceName, 'port', e.target.value)}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Path"
                        value={service.path || ''}
                        onChange={(e) => handleServiceChange(serviceName, 'path', e.target.value)}
                        placeholder="${basePaths.java}/service-name"
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Command"
                        value={service.command || ''}
                        onChange={(e) => handleServiceChange(serviceName, 'command', e.target.value)}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Stop Command (optional)"
                        value={service.stopCommand || ''}
                        onChange={(e) => handleServiceChange(serviceName, 'stopCommand', e.target.value)}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        placeholder="redis-cli shutdown"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Build Command (optional)"
                        value={service.build || ''}
                        onChange={(e) => handleServiceChange(serviceName, 'build', e.target.value)}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Description"
                        value={service.description || ''}
                        onChange={(e) => handleServiceChange(serviceName, 'description', e.target.value)}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      />
                    </Grid>
                  </Grid>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Box sx={{ mt: 4 }}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={saveServices}
              disabled={saving}
              size="large"
              sx={{
                background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
                px: 4,
                py: 1.5,
              }}
            >
              Save Services
            </Button>
          </Box>
        </Paper>
      )}

      {/* Raw JSON Tab */}
      {currentTab === 2 && (
        <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: '#333' }}>
            Raw JSON Editor
          </Typography>
          <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
            Edit the complete configuration as JSON. Be careful: invalid JSON will break the backend.
          </Alert>

          <Box sx={{ mb: 3, display: "flex", gap: 2, flexWrap: "wrap" }}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={saveRawConfig}
              disabled={saving}
              sx={{
                background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
              }}
            >
              {saving ? "Saving..." : "Save Configuration"}
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadConfig}
              disabled={loading || saving}
              sx={{ borderRadius: 2 }}
            >
              Reload
            </Button>
            <Button 
              variant="outlined" 
              onClick={formatJson} 
              disabled={saving}
              sx={{ borderRadius: 2 }}
            >
              Format JSON
            </Button>
          </Box>

          <TextField
            fullWidth
            multiline
            rows={25}
            value={rawConfig}
            onChange={(e) => setRawConfig(e.target.value)}
            variant="outlined"
            sx={{
              "& .MuiInputBase-input": {
                fontFamily: '"Monaco", "Menlo", "Ubuntu Mono", monospace',
                fontSize: "0.875rem",
                lineHeight: 1.5,
              },
              "& .MuiOutlinedInput-root": {
                borderRadius: 2,
              }
            }}
            disabled={saving}
          />
        </Paper>
      )}

      {/* Add Path Dialog */}
      <Dialog open={addPathDialog} onClose={() => setAddPathDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Base Path</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Path Key"
            fullWidth
            variant="outlined"
            value={newPathKey}
            onChange={(e) => setNewPathKey(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Path Value"
            fullWidth
            variant="outlined"
            value={newPathValue}
            onChange={(e) => setNewPathValue(e.target.value)}
            placeholder="~/path/to/directory"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddPathDialog(false)}>Cancel</Button>
          <Button onClick={addNewPath} variant="contained">Add</Button>
        </DialogActions>
      </Dialog>

      {/* Add Service Dialog */}
      <Dialog open={addServiceDialog} onClose={() => setAddServiceDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Service</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Service Name"
            fullWidth
            variant="outlined"
            value={newServiceName}
            onChange={(e) => setNewServiceName(e.target.value)}
            placeholder="my-new-service"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddServiceDialog(false)}>Cancel</Button>
          <Button onClick={addNewService} variant="contained">Add</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Admin;
