import { useState } from "react";
import {
  Typography,
  Paper,
  Box,
  Tabs,
  Tab,
  Card,
  CardContent,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
} from "@mui/material";
import {
  Dashboard as DashboardIcon,
  Article as LogsIcon,
  Settings as AdminIcon,
  Help as HelpIcon,
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Refresh as RestartIcon,
  Visibility as LogsViewIcon,
  Build as BuildIcon,
  Code as CodeIcon,
  Storage as StorageIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Terminal as TerminalIcon,
  Description as ExamplesIcon,
  QuestionAnswer as FaqIcon,
} from "@mui/icons-material";

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`help-tabpanel-${index}`}
      aria-labelledby={`help-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

const Help = () => {
  const [currentTab, setCurrentTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  const ServiceTypeChip = ({ type, color }) => (
    <Chip
      label={type}
      size="small"
      sx={{
        backgroundColor: color,
        color: 'white',
        fontWeight: 600,
        fontSize: '0.7rem',
        mr: 1,
        mb: 1
      }}
    />
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper
        elevation={2}
        sx={{
          p: 2,
          mb: 2,
          borderRadius: 2,
          background: "linear-gradient(135deg, #1565C0 0%, #283593 100%)",
          color: "white",
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}
      >
        <HelpIcon sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            Help & Documentation
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            Complete guide for Struo Service Manager
          </Typography>
        </Box>
      </Paper>

      {/* Tabs */}
      <Paper elevation={1} sx={{ mb: 2 }}>
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.85rem',
              minHeight: 48,
              py: 1,
            }
          }}
        >
          <Tab icon={<InfoIcon fontSize="small" />} label="Overview" />
          <Tab icon={<DashboardIcon fontSize="small" />} label="Dashboard" />
          <Tab icon={<LogsIcon fontSize="small" />} label="Logs" />
          <Tab icon={<AdminIcon fontSize="small" />} label="Admin" />
          <Tab icon={<TerminalIcon fontSize="small" />} label="Commands" />
          <Tab icon={<ExamplesIcon fontSize="small" />} label="Examples" />
          <Tab icon={<FaqIcon fontSize="small" />} label="FAQ" />
        </Tabs>
      </Paper>

      {/* Content */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        
        {/* Overview Tab */}
        <TabPanel value={currentTab} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
                <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
                  Welcome to Struo Service Manager
                </Typography>
                <Typography variant="body2">
                  A comprehensive platform for managing microservices with real-time monitoring, 
                  log streaming, and centralized configuration.
                </Typography>
              </Alert>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    What is Struo?
                  </Typography>
                  <Typography variant="body2" paragraph>
                    Struo is a unified service management platform designed for developers working with microservices. 
                    It provides centralized control, monitoring, and debugging capabilities.
                  </Typography>
                  <Typography variant="subtitle2" gutterBottom>
                    Key Features:
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon><CheckIcon color="success" fontSize="small" /></ListItemIcon>
                      <ListItemText primary="Centralized service management" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckIcon color="success" fontSize="small" /></ListItemIcon>
                      <ListItemText primary="Real-time status monitoring" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckIcon color="success" fontSize="small" /></ListItemIcon>
                      <ListItemText primary="Live log streaming" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckIcon color="success" fontSize="small" /></ListItemIcon>
                      <ListItemText primary="Cross-platform support" />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    Supported Service Types
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <ServiceTypeChip type="Java" color="#2E7D32" />
                    <ServiceTypeChip type="Python" color="#1565C0" />
                    <ServiceTypeChip type="NPM" color="#2E7D32" />
                    <ServiceTypeChip type="Redis" color="#C62828" />
                    <ServiceTypeChip type="Neo4j" color="#00695C" />
                    <ServiceTypeChip type="Listener" color="#6A1B9A" />
                  </Box>
                  <Typography variant="body2" paragraph>
                    Each service type has specialized handling for optimal management and monitoring.
                  </Typography>
                  <Typography variant="subtitle2" gutterBottom>
                    Platform Support:
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon><CheckIcon color="success" fontSize="small" /></ListItemIcon>
                      <ListItemText primary="macOS & Linux (Bash)" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckIcon color="success" fontSize="small" /></ListItemIcon>
                      <ListItemText primary="Windows (Batch)" />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Dashboard Tab */}
        <TabPanel value={currentTab} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h5" gutterBottom>
                Dashboard - Service Management
              </Typography>
              <Typography variant="body1" paragraph>
                The Dashboard is your main control center for managing all services. Monitor status, 
                control services, and access logs from a unified interface.
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Service Cards
                  </Typography>
                  <Typography variant="body2" paragraph>
                    Each service displays:
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText 
                        primary="Service Name & Status" 
                        secondary="Real-time running/stopped indicator"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Service Type & Port" 
                        secondary="Technology stack and port number"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Description" 
                        secondary="Brief description of service purpose"
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Action Buttons
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    <Chip icon={<StartIcon />} label="Start" color="success" size="small" />
                    <Chip icon={<StopIcon />} label="Stop" color="error" size="small" />
                    <Chip icon={<RestartIcon />} label="Restart" color="warning" size="small" />
                    <Chip icon={<LogsViewIcon />} label="Logs" color="default" size="small" />
                  </Box>
                  <List dense>
                    <ListItem>
                      <ListItemText 
                        primary="Start" 
                        secondary="Launch the service"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Stop" 
                        secondary="Terminate the service"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Restart" 
                        secondary="Stop and start the service"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Logs" 
                        secondary="View real-time service logs"
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Build Mode (Java & NPM Services)
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Chip 
                      icon={<BuildIcon />} 
                      label="Build Mode" 
                      variant="outlined" 
                      size="small" 
                    />
                    <Typography variant="body2">
                      Toggle to enable building before starting
                    </Typography>
                  </Box>
                  <Typography variant="body2" paragraph>
                    When enabled, the Start button will execute the build command first, then start the service.
                    Useful when you've made code changes that need compilation.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Logs Tab */}
        <TabPanel value={currentTab} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h5" gutterBottom>
                Logs - Real-time Monitoring
              </Typography>
              <Typography variant="body1" paragraph>
                Monitor service logs in real-time with streaming updates and advanced viewing options.
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Opening Logs
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText 
                        primary="From Dashboard" 
                        secondary="Click 'Logs' button on service cards"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="From Logs Tab" 
                        secondary="Use 'Add Service' to select services"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Multiple Services" 
                        secondary="View logs for multiple services simultaneously"
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Log Controls
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    <Chip label="Live" color="success" size="small" />
                    <Chip label="Refresh" color="primary" size="small" />
                    <Chip label="Clear" color="warning" size="small" />
                    <Chip label="Maximize" color="default" size="small" />
                  </Box>
                  <List dense>
                    <ListItem>
                      <ListItemText 
                        primary="Live Status" 
                        secondary="Real-time connection indicator"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Maximize (F11)" 
                        secondary="Full-screen log viewing"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Clear Logs" 
                        secondary="Clear current log file content"
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Admin Tab */}
        <TabPanel value={currentTab} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h5" gutterBottom>
                Admin - Configuration Management
              </Typography>
              <Typography variant="body1" paragraph>
                Configure base paths, manage services, and edit raw JSON configuration.
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <StorageIcon color="primary" />
                    <Typography variant="h6">
                      Base Paths Configuration
                    </Typography>
                  </Box>
                  <Typography variant="body2" paragraph>
                    Define directory locations using template variables in service configurations.
                  </Typography>
                  
                  <Typography variant="subtitle2" gutterBottom>
                    Common Base Path Keys:
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    {['java', 'python', 'npm', 'listener', 'redis', 'neo4j'].map((key) => (
                      <Chip key={key} label={key} size="small" sx={{ mr: 1, mb: 1 }} />
                    ))}
                  </Box>

                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      <strong>Template Usage:</strong> Use <code>{'${basePaths.java}'}</code> in service paths 
                      to reference base paths. Example: <code>{'${basePaths.java}'}/my-service</code>
                    </Typography>
                  </Alert>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Commands Tab */}
        <TabPanel value={currentTab} index={4}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h5" gutterBottom>
                Commands Reference
              </Typography>
              <Typography variant="body1" paragraph>
                Detailed explanation of all service configuration commands and their usage.
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Service Configuration Commands
                  </Typography>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>Command</strong></TableCell>
                          <TableCell><strong>Description</strong></TableCell>
                          <TableCell><strong>Example</strong></TableCell>
                          <TableCell><strong>Required</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        <TableRow>
                          <TableCell><code>command</code></TableCell>
                          <TableCell>Main command to start the service</TableCell>
                          <TableCell><code>mvn spring-boot:run</code></TableCell>
                          <TableCell>Yes</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><code>stopCommand</code></TableCell>
                          <TableCell>Custom command to stop the service</TableCell>
                          <TableCell><code>redis-cli shutdown</code></TableCell>
                          <TableCell>No</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><code>build</code></TableCell>
                          <TableCell>Command to build/compile the service</TableCell>
                          <TableCell><code>mvn clean install -DskipTests</code></TableCell>
                          <TableCell>No</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><code>healthCommand</code></TableCell>
                          <TableCell>Custom health check command</TableCell>
                          <TableCell><code>pgrep -f worker.py</code></TableCell>
                          <TableCell>No</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Java Service Commands
                  </Typography>
                  <Typography variant="body2" paragraph>
                    Common commands for Java/Maven services:
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText 
                        primary="Start Command" 
                        secondary="mvn spring-boot:run"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Build Command" 
                        secondary="mvn clean install -DskipTests"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Alternative Start" 
                        secondary="java -jar target/app.jar"
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Python Service Commands
                  </Typography>
                  <Typography variant="body2" paragraph>
                    Common commands for Python services:
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText 
                        primary="FastAPI/Uvicorn" 
                        secondary="python -m uvicorn app:app --host 0.0.0.0 --port 5000"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Flask" 
                        secondary="python app.py"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Django" 
                        secondary="python manage.py runserver 0.0.0.0:8000"
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    NPM Service Commands
                  </Typography>
                  <Typography variant="body2" paragraph>
                    Common commands for Node.js/NPM services:
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText 
                        primary="Start Command" 
                        secondary="npm start"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Development" 
                        secondary="npm run dev"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Build Command" 
                        secondary="npm run build"
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Database Commands
                  </Typography>
                  <Typography variant="body2" paragraph>
                    Commands for database services:
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText 
                        primary="Redis Start" 
                        secondary="redis-server"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Redis Stop" 
                        secondary="redis-cli shutdown"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Neo4j Start" 
                        secondary="neo4j start"
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Alert severity="warning">
                <Typography variant="body2">
                  <strong>Platform Considerations:</strong> Commands may vary between Windows and Unix-like systems. 
                  Use appropriate path separators and executable extensions for your platform.
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Examples Tab */}
        <TabPanel value={currentTab} index={5}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h5" gutterBottom>
                Configuration Examples
              </Typography>
              <Typography variant="body1" paragraph>
                Complete service configuration examples for different service types.
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Java Service Example
                  </Typography>
                  <Paper sx={{ p: 2, backgroundColor: '#f5f5f5', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    <pre>{`{
  "auth-service": {
    "type": "java",
    "port": 8057,
    "path": "\${basePaths.java}/auth-service",
    "command": "mvn spring-boot:run",
    "build": "mvn clean install -DskipTests",
    "description": "Authentication service"
  }
}`}</pre>
                  </Paper>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Python Service Example
                  </Typography>
                  <Paper sx={{ p: 2, backgroundColor: '#f5f5f5', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    <pre>{`{
  "data-service": {
    "type": "python",
    "port": 5005,
    "path": "\${basePaths.python}/data-service",
    "command": "python -m uvicorn app:app --host 0.0.0.0 --port 5005",
    "description": "Data processing service"
  }
}`}</pre>
                  </Paper>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    NPM Service Example
                  </Typography>
                  <Paper sx={{ p: 2, backgroundColor: '#f5f5f5', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    <pre>{`{
  "frontend-service": {
    "type": "npm",
    "port": 3000,
    "path": "\${basePaths.npm}/frontend",
    "command": "npm start",
    "build": "npm run build",
    "description": "React frontend application"
  }
}`}</pre>
                  </Paper>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Redis Service Example
                  </Typography>
                  <Paper sx={{ p: 2, backgroundColor: '#f5f5f5', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    <pre>{`{
  "redis": {
    "type": "redis",
    "port": 6379,
    "command": "redis-server",
    "stopCommand": "redis-cli shutdown",
    "description": "Redis cache server"
  }
}`}</pre>
                  </Paper>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Listener Service Example
                  </Typography>
                  <Paper sx={{ p: 2, backgroundColor: '#f5f5f5', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    <pre>{`{
  "worker-listener": {
    "type": "listener",
    "path": "\${basePaths.python}/worker",
    "command": "python worker.py",
    "stopCommand": "pkill -f worker.py",
    "healthCommand": "pgrep -f worker.py",
    "description": "Background worker process"
  }
}`}</pre>
                  </Paper>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Neo4j Service Example
                  </Typography>
                  <Paper sx={{ p: 2, backgroundColor: '#f5f5f5', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    <pre>{`{
  "neo4j": {
    "type": "neo4j",
    "port": 7474,
    "command": "neo4j start",
    "stopCommand": "neo4j stop",
    "description": "Neo4j graph database"
  }
}`}</pre>
                  </Paper>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Complete Base Paths Configuration
                  </Typography>
                  <Paper sx={{ p: 2, backgroundColor: '#f5f5f5', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    <pre>{`{
  "basePaths": {
    "java": "/Users/developer/projects/java-services",
    "python": "/Users/developer/projects/python-services",
    "npm": "/Users/developer/projects/frontend",
    "listener": "/Users/developer/projects/workers",
    "redis": "/usr/local/bin",
    "neo4j": "/usr/local/bin"
  },
  "services": {
    // ... service configurations
  }
}`}</pre>
                  </Paper>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* FAQ Tab */}
        <TabPanel value={currentTab} index={6}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h5" gutterBottom>
                Frequently Asked Questions
              </Typography>
              <Typography variant="body1" paragraph>
                Common issues and solutions for using Struo Service Manager.
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom color="error">
                    Service Won't Start
                  </Typography>
                  <Typography variant="body2" paragraph>
                    <strong>Possible causes and solutions:</strong>
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon><WarningIcon color="warning" fontSize="small" /></ListItemIcon>
                      <ListItemText 
                        primary="Port already in use" 
                        secondary="Check if another service is using the same port"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><WarningIcon color="warning" fontSize="small" /></ListItemIcon>
                      <ListItemText 
                        primary="Invalid path" 
                        secondary="Verify the service path exists and is correct"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><WarningIcon color="warning" fontSize="small" /></ListItemIcon>
                      <ListItemText 
                        primary="Missing dependencies" 
                        secondary="Ensure required tools (Java, Python, etc.) are installed"
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom color="warning">
                    Status Shows 'Unavailable'
                  </Typography>
                  <Typography variant="body2" paragraph>
                    <strong>This usually means:</strong>
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon><InfoIcon color="info" fontSize="small" /></ListItemIcon>
                      <ListItemText 
                        primary="No port configured" 
                        secondary="Add a port number for automatic status checking"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><InfoIcon color="info" fontSize="small" /></ListItemIcon>
                      <ListItemText 
                        primary="No health check" 
                        secondary="Define a custom healthCommand for the service"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><InfoIcon color="info" fontSize="small" /></ListItemIcon>
                      <ListItemText 
                        primary="Listener services" 
                        secondary="Use process-based health checks (pgrep, tasklist)"
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom color="info">
                    Logs Not Streaming
                  </Typography>
                  <Typography variant="body2" paragraph>
                    <strong>Troubleshooting steps:</strong>
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon><CheckIcon color="success" fontSize="small" /></ListItemIcon>
                      <ListItemText 
                        primary="Check connection status" 
                        secondary="Look for 'Connected' indicator in log viewer"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckIcon color="success" fontSize="small" /></ListItemIcon>
                      <ListItemText 
                        primary="Refresh manually" 
                        secondary="Use the Refresh button to reload logs"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckIcon color="success" fontSize="small" /></ListItemIcon>
                      <ListItemText 
                        primary="Verify log file" 
                        secondary="Service must be running and generating logs"
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom color="success">
                    Configuration Not Saving
                  </Typography>
                  <Typography variant="body2" paragraph>
                    <strong>Common solutions:</strong>
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon><CheckIcon color="success" fontSize="small" /></ListItemIcon>
                      <ListItemText 
                        primary="Click Save button" 
                        secondary="Changes are not auto-saved"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckIcon color="success" fontSize="small" /></ListItemIcon>
                      <ListItemText 
                        primary="Check JSON syntax" 
                        secondary="Invalid JSON will prevent saving"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckIcon color="success" fontSize="small" /></ListItemIcon>
                      <ListItemText 
                        primary="File permissions" 
                        secondary="Ensure write access to config files"
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Keyboard Shortcuts
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>
                        Log Viewer Shortcuts:
                      </Typography>
                      <List dense>
                        <ListItem>
                          <ListItemText 
                            primary="F11" 
                            secondary="Toggle fullscreen mode"
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Escape" 
                            secondary="Exit fullscreen mode"
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Ctrl + Arrow Keys" 
                            secondary="Switch between service tabs (in fullscreen)"
                          />
                        </ListItem>
                      </List>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>
                        Pro Tips:
                      </Typography>
                      <List dense>
                        <ListItem>
                          <ListItemIcon><CheckIcon color="success" fontSize="small" /></ListItemIcon>
                          <ListItemText 
                            primary="Use filters to find services quickly"
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemIcon><CheckIcon color="success" fontSize="small" /></ListItemIcon>
                          <ListItemText 
                            primary="Monitor multiple logs simultaneously"
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemIcon><CheckIcon color="success" fontSize="small" /></ListItemIcon>
                          <ListItemText 
                            primary="Use template variables for maintainable paths"
                          />
                        </ListItem>
                      </List>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>Still having issues?</strong> Check the browser console (F12) for error messages, 
                  and review the backend logs for additional debugging information.
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        </TabPanel>

      </Box>
    </Box>
  );
};

export default Help;