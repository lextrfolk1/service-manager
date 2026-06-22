import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import App from "./App";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#2563eb",
      dark: "#1d4ed8",
      light: "#60a5fa",
    },
    secondary: {
      main: "#7c3aed",
      dark: "#5b21b6",
    },
    info: { main: "#0891b2" },
    success: { main: "#16a34a" },
    warning: { main: "#d97706" },
    error: { main: "#dc2626" },
    background: {
      default: "#f4f7fb",
      paper: "#ffffff",
    },
    text: {
      primary: "#0f172a",
      secondary: "#475569",
    },
  },
  typography: {
    fontFamily:
      '"IBM Plex Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h3: {
      fontWeight: 800,
      letterSpacing: "-0.04em",
    },
    h4: {
      fontWeight: 800,
      letterSpacing: "-0.03em",
    },
    h5: {
      fontWeight: 800,
      letterSpacing: "-0.03em",
    },
    h6: {
      fontWeight: 700,
    },
    body2: {
      lineHeight: 1.55,
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          borderRadius: 20,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 24,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          textTransform: "none",
          fontWeight: 700,
          paddingInline: 16,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 600,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: "outlined",
      },
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
