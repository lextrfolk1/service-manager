import React, { useState, useRef, useCallback, useEffect } from "react";
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

const HEADER_HEIGHT = 64;
// The selected page lives in the URL hash so refresh, Back and links keep it.
const TAB_HASHES = ["dashboard", "logs", "admin", "help"];

function tabFromHash() {
  const index = TAB_HASHES.indexOf(window.location.hash.replace(/^#\/?/, ""));
  return index === -1 ? 0 : index;
}

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
      style={{
        height: `calc(100vh - ${HEADER_HEIGHT}px)`,
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
  const [currentTab, setCurrentTabState] = useState(tabFromHash);
  const setCurrentTab = useCallback((index) => {
    setCurrentTabState(index);
    const hash = `#${TAB_HASHES[index]}`;
    if (window.location.hash !== hash) window.history.pushState(null, "", hash);
  }, []);

  useEffect(() => {
    const onPopState = () => setCurrentTabState(tabFromHash());
    window.addEventListener("popstate", onPopState);
    window.addEventListener("hashchange", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("hashchange", onPopState);
    };
  }, []);
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
  const [helpTarget, setHelpTarget] = useState(null);

  // Open the Help tab on a specific tab/section, e.g. { tab: "troubleshooting", section: "port" }.
  const handleOpenHelp = useCallback((target) => {
    setHelpTarget({ ...target, id: Date.now() });
    setCurrentTab(3);
  }, [setCurrentTab]);

  const handleCloneService = (service) => {
    setAdminTarget({ action: "clone", service, id: Date.now() });
    setCurrentTab(2);
  };

  const handleEditInAdmin = (service) => {
    setAdminTarget({ action: "edit", service, id: Date.now() });
    setCurrentTab(2);
  };

  const handleAddLogService = (serviceName) => {
    if (!openLogServices.includes(serviceName)) {
      const newOpenServices = [...openLogServices, serviceName];
      setOpenLogServices(newOpenServices);
      setActiveLogServiceTab(newOpenServices.length - 1);
    }
  };

  const handleConfigReload = useCallback(() => {
    // Refresh dashboard data when config is reloaded
    if (dashboardRef.current) {
      dashboardRef.current.refreshServices();
    }
  }, []);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "var(--sm-app-bg)",  // per theme (ThemeController)
        display: "flex",
        flexDirection: "column",
      }}
    >
      <AppBar 
        position="fixed" 
        elevation={0}
        sx={{
          background: "var(--sm-header-bg)",
          backdropFilter: "blur(22px)",
          borderBottom: "1px solid var(--c-border-94a3b8-016)",
          color: "text.primary",
        }}
      >
        <Toolbar sx={{ justifyContent: "space-between", py: 0.5, minHeight: HEADER_HEIGHT }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 3,
                background: "linear-gradient(135deg, var(--sm-accent) 0%, var(--c-bg-7c3aed) 100%)",
                boxShadow: "0 14px 28px color-mix(in srgb, var(--sm-accent) 22%, transparent)",
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
                  background: "linear-gradient(90deg, var(--c-bg-38bdf8) 0%, var(--c-bg-7c3aed) 100%)",
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
          </Box>
          
          <Tabs
            value={currentTab}
            onChange={handleTabChange}
            sx={{
              "& .MuiTab-root": {
                color: "var(--c-text-0f172a-072)",
                fontWeight: 600,
                fontSize: "0.92rem",
                minWidth: 110,
                minHeight: 44,
                textTransform: "none",
                "&.Mui-selected": {
                  color: "var(--c-text-0f172a)",
                  backgroundColor: "var(--c-bg-ffffff-086)",
                  boxShadow: "0 10px 24px var(--c-shadow-0f172a-008)",
                  borderRadius: 999,
                },
                "&:hover": {
                  backgroundColor: "var(--c-bg-ffffff-062)",
                  borderRadius: 999,
                }
              },
              "& .MuiTabs-indicator": {
                display: "none",
              },
            }}
          >
            <Tab icon={<DashboardIcon fontSize="small" />} iconPosition="start" label="Dashboard" />
            <Tab icon={<LogsIcon fontSize="small" />} iconPosition="start" label="Logs" />
            <Tab icon={<AdminIcon fontSize="small" />} iconPosition="start" label="Admin" />
            <Tab icon={<HelpIcon fontSize="small" />} iconPosition="start" label="Help" />
          </Tabs>
        </Toolbar>
      </AppBar>

      {/* Content Area */}
      <Box 
        sx={{ 
          flexGrow: 1, 
          mt: `${HEADER_HEIGHT}px`,
          height: `calc(100vh - ${HEADER_HEIGHT}px)`,
          minHeight: 0,
          overflow: "hidden"
        }}
      >
        <TabPanel value={currentTab} index={0}>
          <Dashboard
            ref={dashboardRef}
            onViewLogs={handleViewLogs}
            onOpenHelp={handleOpenHelp}
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
            isActive={currentTab === 1}
          />
        </TabPanel>
        <TabPanel value={currentTab} index={2}>
          <Admin
            onConfigReload={handleConfigReload}
            adminTarget={adminTarget}
            onClearAdminTarget={() => setAdminTarget(null)}
            isActive={currentTab === 2}
          />
        </TabPanel>
        <TabPanel value={currentTab} index={3}>
          <Help target={helpTarget} />
        </TabPanel>
      </Box>
    </Box>
  );
}

export default App;
