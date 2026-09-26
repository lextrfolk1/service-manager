import React, { useState, useRef } from "react";
import { Box, Tabs, Tab, AppBar, Toolbar, Typography, Container } from "@mui/material";
import {
  Dashboard as DashboardIcon,
  Article as LogsIcon,
  Settings as AdminIcon,
  Help as HelpIcon,
} from "@mui/icons-material";
import Dashboard from "./pages/Dashboard";
import Logs from "./pages/Logs";
import Admin from "./pages/Admin";
import Help from "./pages/Help";

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
      style={{
        height: "calc(100vh - 88px)",
        overflow: "hidden",
        display: value === index ? "flex" : "none",
      }}
    >
      <Container
        maxWidth={false}
        sx={{
          height: "100%",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          px: { xs: 1.5, md: 2.5 },
          py: 2.25,
        }}
      >
        {children}
      </Container>
    </div>
  );
}

function App() {
  const [currentTab, setCurrentTab] = useState(0);
  const [openLogServices, setOpenLogServices] = useState([]);
  const [activeLogServiceTab, setActiveLogServiceTab] = useState(0);
  const logsRef = useRef();
  const dashboardRef = useRef();

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

    if (logsRef.current?.addService) {
      logsRef.current.addService(serviceName);
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

  const [adminTarget, setAdminTarget] = useState(null);

  const handleCloneService = (service) => {
    setAdminTarget({ action: "clone", service });
    setCurrentTab(2);
  };

  const handleEditInAdmin = (service) => {
    setAdminTarget({ action: "edit", service });
    setCurrentTab(2);
  };

  const handleAddLogService = (serviceName) => {
    if (!openLogServices.includes(serviceName)) {
      const newOpenServices = [...openLogServices, serviceName];
      setOpenLogServices(newOpenServices);
      setActiveLogServiceTab(newOpenServices.length - 1);
    }
  };

  const handleConfigReload = () => {
    // Refresh dashboard data when config is reloaded
    if (dashboardRef.current) {
      dashboardRef.current.refreshServices();
    }
  };

  const getPageTitle = () => {
    switch (currentTab) {
      case 0: return "Dashboard";
      case 1: return "Logs";
      case 2: return "Configuration";
      case 3: return "Help";
      default: return "";
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(37,99,235,0.16), transparent 24%), radial-gradient(circle at top right, rgba(124,58,237,0.14), transparent 26%), linear-gradient(180deg, #f8fbff 0%, #eef2ff 42%, #f8fafc 100%)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <AppBar 
        position="fixed" 
        elevation={0}
        sx={{
          background: "rgba(255, 255, 255, 0.72)",
          backdropFilter: "blur(22px)",
          borderBottom: "1px solid rgba(148, 163, 184, 0.16)",
          color: "text.primary",
        }}
      >
        <Toolbar sx={{ justifyContent: "space-between", py: 1, minHeight: 88 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 3,
                background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
                boxShadow: "0 14px 28px rgba(37,99,235,0.22)",
              }}
            />
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <Typography 
                variant="h4" 
                sx={{ 
                  fontWeight: 800,
                  color: "text.primary",
                  lineHeight: 1,
                  fontSize: "1.45rem",
                  letterSpacing: "-0.03em"
                }}
              >
                Struo
              </Typography>
              <Box 
                sx={{ 
                  width: 72, 
                  height: "2px", 
                  background: "linear-gradient(90deg, #38BDF8 0%, #7c3aed 100%)",
                  borderRadius: "1px",
                  my: 0.25
                }} 
              />
              <Typography 
                variant="caption" 
                sx={{ 
                  fontWeight: 500,
                  color: "text.secondary",
                  fontSize: "0.72rem",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase"
                }}
              >
                Service Manager
              </Typography>
            </Box>
            
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                backgroundColor: "rgba(255,255,255,0.82)",
                borderRadius: 999,
                px: 1.75,
                py: 0.5,
                border: "1px solid rgba(148,163,184,0.18)",
                ml: 2
              }}
            >
              <Typography 
                variant="body1" 
                sx={{ 
                  fontWeight: 600,
                  color: "text.primary",
                  fontSize: "0.92rem"
                }}
              >
                {getPageTitle()}
              </Typography>
            </Box>
          </Box>
          
          <Tabs
            value={currentTab}
            onChange={handleTabChange}
            sx={{
              "& .MuiTab-root": {
                color: "rgba(15,23,42,0.72)",
                fontWeight: 600,
                fontSize: "0.92rem",
                minWidth: 120,
                textTransform: "none",
                "&.Mui-selected": {
                  color: "#0f172a",
                  backgroundColor: "rgba(255,255,255,0.86)",
                  boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
                  borderRadius: 999,
                },
                "&:hover": {
                  backgroundColor: "rgba(255,255,255,0.62)",
                  borderRadius: 999,
                }
              },
              "& .MuiTabs-indicator": {
                display: "none",
              },
            }}
          >
            <Tab icon={<DashboardIcon />} label="Dashboard" />
            <Tab icon={<LogsIcon />} label="Logs" />
            <Tab icon={<AdminIcon />} label="Admin" />
            <Tab icon={<HelpIcon />} label="Help" />
          </Tabs>
        </Toolbar>
      </AppBar>

      {/* Content Area */}
      <Box 
        sx={{ 
          flexGrow: 1, 
          mt: "88px",
          height: "calc(100vh - 88px)",
          minHeight: 0,
          overflow: "hidden"
        }}
      >
        <TabPanel value={currentTab} index={0}>
          <Dashboard
            ref={dashboardRef}
            onViewLogs={handleViewLogs}
            onCloneService={handleCloneService}
            onEditInAdmin={handleEditInAdmin}
          />
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
          <Admin
            onConfigReload={handleConfigReload}
            adminTarget={adminTarget}
            onClearAdminTarget={() => setAdminTarget(null)}
          />
        </TabPanel>
        <TabPanel value={currentTab} index={3}>
          <Help />
        </TabPanel>
      </Box>
    </Box>
  );
}

export default App;
