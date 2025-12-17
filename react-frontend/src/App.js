import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Box, Toolbar } from "@mui/material";
import Header from "./components/Header";
import Dashboard from "./pages/Dashboard";
import Logs from "./pages/Logs";
import Admin from "./pages/Admin";

function App() {
  return (
    <Router>
      <Box
        sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
      >
        <Header />
        <Toolbar /> {/* This creates space for the fixed AppBar */}
        <Box component="main" sx={{ flexGrow: 1 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </Box>
      </Box>
    </Router>
  );
}

export default App;
