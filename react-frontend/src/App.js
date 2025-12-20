import React, { useState, useRef } from "react";
import { Box, Tabs, Tab, Paper, AppBar, Toolbar, Typography } from "@mui/material";
import {
  Dashboard as DashboardIcon,
  Article as LogsIcon,
  Settings as AdminIcon,
} from "@mui/icons-material";
import Dashboard from "./pages/Dashboard";
import Logs from "./pages/Logs";
import Admin from "./pages/Admin";

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
      style={{ height: value === index ? 'calc(100vh - 120px)' : 'auto', overflow: 'auto' }}
    >
      {value === index && <Box sx={{ height: '100%', p: 2 }}>{children}</Box>}
    </div>
  );
}

function App() {
  const [currentTab, setCurrentTab] = useState(0);
  const [openLogServices, setOpenLogServices] = useState([]);
  const [activeLogServiceTab, setActiveLogServiceTab] = useState(0);
  const logsRef = useRef();

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  const handleViewLogs = (serviceName) => {
    // Add service to logs if not already open
    if (!openLogServices.includes(serviceName)) {
      const newOpenServices = [...openLogServices, serviceName];
      setOpenLogServices(newOpenServices);
      setActiveLogServiceTab(newOpenServices.length - 1);
    } else {
      // Switch to existing service tab
      const index = openLogServices.indexOf(serviceName);
      setActiveLogServiceTab(index);
    }
    
    // Switch to logs tab
    setCurrentTab(1);
  };

  const handleCloseLogService = (serviceName) => {
    const index = openLogServices.indexOf(serviceName);
    const newOpenServices = openLogServices.filter(s => s !== serviceName);
    setOpenLogServices(newOpenServices);
    
    if (activeLogServiceTab >= newOpenServices.length) {
      setActiveLogServiceTab(Math.max(0, newOpenServices.length - 1));
    } else if (activeLogServiceTab > index) {
      setActiveLogServiceTab(activeLogServiceTab - 1);
    }
  };

  const handleLogServiceTabChange = (newValue) => {
    setActiveLogServiceTab(newValue);
  };

  const handleAddLogService = (serviceName) => {
    if (!openLogServices.includes(serviceName)) {
      const newOpenServices = [...openLogServices, serviceName];
      setOpenLogServices(newOpenServices);
      setActiveLogServiceTab(newOpenServices.length - 1);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Fixed Header */}
      <AppBar 
        position="fixed" 
        elevation={0}
        sx={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', py: 1 }}>
          <Typography 
            variant="h5" 
            sx={{ 
              fontWeight: 700,
              color: 'white',
              textShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }}
          >
            Service Manager
          </Typography>
          
          <Tabs
            value={currentTab}
            onChange={handleTabChange}
            sx={{
              "& .MuiTab-root": {
                color: "rgba(255,255,255,0.8)",
                fontWeight: 600,
                fontSize: "0.95rem",
                minWidth: 120,
                textTransform: 'none',
                "&.Mui-selected": {
                  color: "#fff",
                  backgroundColor: "rgba(255,255,255,0.15)",
                  borderRadius: 2,
                },
                "&:hover": {
                  backgroundColor: "rgba(255,255,255,0.1)",
                  borderRadius: 2,
                }
              },
              "& .MuiTabs-indicator": {
                display: 'none', // Hide default indicator since we're using background
              },
            }}
          >
            <Tab icon={<DashboardIcon />} label="Dashboard" />
            <Tab icon={<LogsIcon />} label="Logs" />
            <Tab icon={<AdminIcon />} label="Admin" />
          </Tabs>
        </Toolbar>
      </AppBar>

      {/* Content Area */}
      <Box 
        sx={{ 
          flexGrow: 1, 
          mt: '80px', // Account for fixed header
          height: 'calc(100vh - 80px)',
          overflow: 'hidden'
        }}
      >
        <TabPanel value={currentTab} index={0}>
          <Dashboard onViewLogs={handleViewLogs} />
        </TabPanel>
        <TabPanel value={currentTab} index={1}>
          <Logs 
            ref={logsRef}
            openServices={openLogServices}
            activeServiceTab={activeLogServiceTab}
            onCloseService={handleCloseLogService}
            onServiceTabChange={handleLogServiceTabChange}
            onAddService={handleAddLogService}
          />
        </TabPanel>
        <TabPanel value={currentTab} index={2}>
          <Admin />
        </TabPanel>
      </Box>
    </Box>
  );
}

export default App;
