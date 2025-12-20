import React, { useState, useEffect } from "react";
import {
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

// ServiceListItem Component
const ServiceListItem = ({ serviceName, service, isSelected, onSelect, onDelete }) => {
  return (
    <Box
      sx={{
        p: 2,
        borderBottom: '1px solid #eee',
        cursor: 'pointer',
        backgroundColor: isSelected ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
        borderLeft: isSelected ? '4px solid #667eea' : '4px solid transparent',
        transition: 'all 0.2s ease',
        '&:hover': {
          backgroundColor: isSelected ? 'rgba(102, 126, 234, 0.15)' : 'rgba(0, 0, 0, 0.04)',
        }
      }}
      onClick={onSelect}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography 
            variant="subtitle1" 
            sx={{ 
              fontWeight: isSelected ? 600 : 500,
              color: isSelected ? '#667eea' : '#333',
              mb: 0.5,
              wordBreak: 'break-word'
            }}
          >
            {serviceName}
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Chip 
              label={service.type || 'Unknown'} 
              size="small"
              sx={{
                height: 20,
                fontSize: '0.7rem',
                backgroundColor: isSelected ? '#667eea' : 'rgba(102, 126, 234, 0.1)',
                color: isSelected ? 'white' : '#667eea',
                fontWeight: 600
              }}
            />
            {service.port && (
              <Chip 
                label={`Port ${service.port}`} 
                size="small"
                variant="outlined"
                sx={{
                  height: 20,
                  fontSize: '0.7rem',
                  borderColor: isSelected ? '#667eea' : '#ccc',
                  color: isSelected ? '#667eea' : '#666'
                }}
              />
            )}
          </Box>
          
          {service.description && (
            <Typography 
              variant="caption" 
              sx={{ 
                color: 'text.secondary',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: 1.3
              }}
            >
              {service.description}
            </Typography>
          )}
        </Box>
        
        <Tooltip title="Delete Service">
          <IconButton
            size="small"
            color="error"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            sx={{
              ml: 1,
              opacity: isSelected ? 1 : 0.6,
              '&:hover': { opacity: 1 }
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

// ServiceEditor Component
const ServiceEditor = ({ serviceName, service, onServiceChange }) => {
  return (
    <>
      <Box sx={{ 
        p: 3, 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Editing: {serviceName}
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
          Configure the service settings below
        </Typography>
      </Box>
      
      <Box sx={{ p: 3, flexGrow: 1, overflow: 'auto' }}>
        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom sx={{ color: '#333', fontWeight: 600, mb: 2 }}>
              Basic Information
            </Typography>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Service Type</InputLabel>
              <Select
                value={service.type || ''}
                onChange={(e) => onServiceChange(serviceName, 'type', e.target.value)}
                label="Service Type"
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
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Port Number"
              type="number"
              value={service.port || ''}
              onChange={(e) => onServiceChange(serviceName, 'port', e.target.value)}
              placeholder="8080"
              helperText="Leave empty for services without ports"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Service Path"
              value={service.path || ''}
              onChange={(e) => onServiceChange(serviceName, 'path', e.target.value)}
              placeholder="${basePaths.java}/my-service"
              helperText="Use template variables like ${basePaths.java} for dynamic paths"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              value={service.description || ''}
              onChange={(e) => onServiceChange(serviceName, 'description', e.target.value)}
              placeholder="Brief description of what this service does"
              multiline
              rows={2}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Grid>

          {/* Commands */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom sx={{ color: '#333', fontWeight: 600, mb: 2, mt: 2 }}>
              Commands
            </Typography>
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Start Command"
              value={service.command || ''}
              onChange={(e) => onServiceChange(serviceName, 'command', e.target.value)}
              placeholder="npm start"
              helperText="Command to start the service"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Stop Command (Optional)"
              value={service.stopCommand || ''}
              onChange={(e) => onServiceChange(serviceName, 'stopCommand', e.target.value)}
              placeholder="redis-cli shutdown"
              helperText="Custom command to stop the service"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Health Check Command (Optional)"
              value={service.healthCommand || ''}
              onChange={(e) => onServiceChange(serviceName, 'healthCommand', e.target.value)}
              placeholder="pgrep -f worker.py > /dev/null"
              helperText="Command to check if service is running"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Build Command (Optional)"
              value={service.build || ''}
              onChange={(e) => onServiceChange(serviceName, 'build', e.target.value)}
              placeholder="mvn clean install -DskipTests"
              helperText="Command to build the service (runs when build mode is enabled)"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Grid>
        </Grid>
      </Box>
    </>
  );
};

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

  // Form state for services
  const [services, setServices] = useState({});
  const [selectedService, setSelectedService] = useState(null);

  // Dialog states
  const [addPathDialog, setAddPathDialog] = useState(false);
  const [addServiceDialog, setAddServiceDialog] = useState(false);
  const [newPathKey, setNewPathKey] = useState("");
  const [newPathValue, setNewPathValue] = useState("");
  const [newServiceName, setNewServiceName] = useState("");

  useEffect(() => {
    loadConfig();
  }, []);

  // Auto-select first service when services are loaded
  useEffect(() => {
    if (Object.keys(services).length > 0 && !selectedService) {
      setSelectedService(Object.keys(services)[0]);
    }
  }, [services, selectedService]);

  const loadConfig = async () => {
    setLoading(true);

    try {
      const data = await api.get("/config");
      setConfig(data);
      
      // Populate form states
      setBasePaths(data.config.basePaths || {});
      setServices(data.services || {});
      setRawConfig(JSON.stringify(data, null, 2));
      
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
          healthCommand: "",
          build: "",
          description: "",
        },
      }));
      setSelectedService(newServiceName); // Auto-select the new service
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
    
    // If we're deleting the selected service, clear the selection
    if (selectedService === serviceName) {
      setSelectedService(null);
    }
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
      <Box sx={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Fixed Tabs - No header */}
      <Box sx={{ p: 2, flexShrink: 0 }}>
        <Paper 
          elevation={3} 
          sx={{ 
            borderRadius: 2,
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            flexShrink: 0
          }}
        >
          <Tabs
            value={currentTab}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{ 
              minHeight: 48,
              '& .MuiTab-root': {
                color: 'white',
                fontWeight: 600,
                minHeight: 48,
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
      </Box>

      {/* Scrollable Content Area */}
      <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', p: 2, pt: 0, minHeight: 0 }}>
        {/* Base Paths Tab */}
        {currentTab === 0 && (
          <Paper 
            elevation={3} 
            sx={{ 
              borderRadius: 2, 
              flexGrow: 1, 
              display: 'flex', 
              flexDirection: 'column',
              overflow: 'hidden',
              minHeight: 0
            }}
          >
            {/* Fixed Header */}
            <Box sx={{ p: 4, pb: 2, flexShrink: 0 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
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
              
              <Typography variant="body2" color="text.secondary">
                Configure the base directory paths for different service types. Services use these paths with <code>${basePaths.type}</code> templates.
              </Typography>
            </Box>

            {/* Scrollable Content */}
            <Box sx={{ flexGrow: 1, overflow: 'auto', px: 4, pb: 4 }}>
              <Grid container spacing={3}>
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

                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 2 }}>
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
                </Grid>
              </Grid>
            </Box>
          </Paper>
        )}

        {/* Services Tab */}
        {currentTab === 1 && (
          <Paper 
            elevation={3} 
            sx={{ 
              borderRadius: 2, 
              flexGrow: 1, 
              display: 'flex', 
              flexDirection: 'column',
              overflow: 'hidden',
              minHeight: 0
            }}
          >
            {/* Fixed Header */}
            <Box sx={{ p: 4, pb: 2, flexShrink: 0 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 600, color: '#333' }}>
                  Services Configuration
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={saveServices}
                    disabled={saving}
                    sx={{
                      background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                      boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
                    }}
                  >
                    Save Services
                  </Button>
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
              </Box>
              
              <Typography variant="body2" color="text.secondary">
                Select a service from the list to edit its configuration. Use template variables like <code>${basePaths.java}/service-name</code> for paths.
              </Typography>
            </Box>

            {/* Two-Column Layout */}
            <Box sx={{ flexGrow: 1, display: 'flex', px: 4, pb: 4, gap: 3, minHeight: 0 }}>
              {/* Left Side - Service List */}
              <Paper 
                elevation={2} 
                sx={{ 
                  width: '300px', 
                  flexShrink: 0, 
                  borderRadius: 2, 
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <Box sx={{ 
                  p: 2, 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white'
                }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Services ({Object.keys(services).length})
                  </Typography>
                </Box>
                
                <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                  {Object.keys(services).length === 0 ? (
                    <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                      <Typography variant="body2">
                        No services configured.
                        <br />
                        Click "Add Service" to get started.
                      </Typography>
                    </Box>
                  ) : (
                    Object.entries(services).map(([serviceName, service]) => (
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

              {/* Right Side - Service Editor */}
              <Paper 
                elevation={2} 
                sx={{ 
                  flexGrow: 1, 
                  borderRadius: 2, 
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {selectedService ? (
                  <ServiceEditor
                    serviceName={selectedService}
                    service={services[selectedService]}
                    onServiceChange={handleServiceChange}
                  />
                ) : (
                  <Box sx={{ 
                    flexGrow: 1, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    p: 4
                  }}>
                    <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
                      <SettingsIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
                      <Typography variant="h6" gutterBottom>
                        Select a Service to Edit
                      </Typography>
                      <Typography variant="body2">
                        Choose a service from the list on the left to view and edit its configuration.
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Paper>
            </Box>
          </Paper>
        )}

        {/* Raw JSON Tab */}
        {currentTab === 2 && (
          <Paper 
            elevation={3} 
            sx={{ 
              borderRadius: 2, 
              flexGrow: 1, 
              display: 'flex', 
              flexDirection: 'column',
              overflow: 'hidden',
              minHeight: 0
            }}
          >
            {/* Fixed Header */}
            <Box sx={{ p: 4, pb: 2, flexShrink: 0 }}>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: '#333' }}>
                Raw JSON Editor
              </Typography>
              <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
                Edit the complete configuration as JSON. Be careful: invalid JSON will break the backend.
              </Alert>

              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
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
            </Box>

            {/* Scrollable JSON Editor */}
            <Box sx={{ flexGrow: 1, px: 4, pb: 4, minHeight: 0 }}>
              <TextField
                fullWidth
                multiline
                value={rawConfig}
                onChange={(e) => setRawConfig(e.target.value)}
                variant="outlined"
                sx={{
                  height: '100%',
                  "& .MuiInputBase-input": {
                    fontFamily: '"Monaco", "Menlo", "Ubuntu Mono", monospace',
                    fontSize: "0.875rem",
                    lineHeight: 1.5,
                  },
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                    height: '100%',
                    '& textarea': {
                      height: '100% !important',
                      overflow: 'auto !important',
                    }
                  }
                }}
                disabled={saving}
              />
            </Box>
          </Paper>
        )}
      </Box>

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
    </Box>
  );
};

export default Admin;
