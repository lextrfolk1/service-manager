import React from "react";
import { Link, useLocation } from "react-router-dom";
import { AppBar, Toolbar, Typography, Button, Box } from "@mui/material";
import {
  Dashboard as DashboardIcon,
  Article as LogsIcon,
  Settings as AdminIcon,
} from "@mui/icons-material";

const Header = () => {
  const location = useLocation();

  const navItems = [
    { path: "/", label: "Dashboard", icon: <DashboardIcon /> },
    { path: "/logs", label: "Logs", icon: <LogsIcon /> },
    { path: "/admin", label: "Admin", icon: <AdminIcon /> },
  ];

  return (
    <AppBar position="fixed" elevation={4}>
      <Toolbar>
        <Typography
          variant="h6"
          component="div"
          sx={{ flexGrow: 1, fontWeight: 700 }}
        >
          Service Manager
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          {navItems.map((item) => (
            <Button
              key={item.path}
              component={Link}
              to={item.path}
              startIcon={item.icon}
              color="inherit"
              variant={location.pathname === item.path ? "outlined" : "text"}
              sx={{
                color: location.pathname === item.path ? "#fff" : "#d1d5db",
                borderColor:
                  location.pathname === item.path ? "#3b82f6" : "transparent",
                "&:hover": {
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                },
              }}
            >
              {item.label}
            </Button>
          ))}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
