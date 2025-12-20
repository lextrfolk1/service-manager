import React, { useState, useEffect } from "react";
import {
  Grid,
  Typography,
  TextField,
  Paper,
  Box,
  CircularProgress,
  Alert,
  InputAdornment,
  Container,
} from "@mui/material";
import { Search as SearchIcon } from "@mui/icons-material";
import ServiceCard from "../components/ServiceCard";
import api from "../services/api";

const Dashboard = ({ onViewLogs }) => {
  const [services, setServices] = useState([]);
  const [filteredServices, setFilteredServices] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [output, setOutput] = useState("(no actions yet)");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadServices();
  }, []);

  useEffect(() => {
    filterServices();
  }, [services, searchQuery]);

  const loadServices = async () => {
    try {
      setLoading(true);
      const data = await api.get("/services");
      setServices(data.services || []);
      setError(null);
    } catch (err) {
      setError(`Failed to load services: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filterServices = () => {
    if (!searchQuery.trim()) {
      setFilteredServices(services);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = services.filter(
      (service) =>
        service.name.toLowerCase().includes(query) ||
        (service.description || "").toLowerCase().includes(query) ||
        (service.type || "").toLowerCase().includes(query)
    );

    setFilteredServices(filtered);
  };

  const handleActionOutput = (newOutput) => {
    setOutput(newOutput);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="60vh">
        <CircularProgress size={60} sx={{ color: "white" }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Container maxWidth="xl" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Grid container spacing={2} sx={{ flexGrow: 1 }}>
          {/* Services Column */}
          <Grid item xs={12} lg={8} sx={{ display: 'flex', flexDirection: 'column' }}>
            <Paper
              elevation={6}
              sx={{
                p: 3,
                borderRadius: 3,
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(10px)",
                flexGrow: 1,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Typography
                variant="h4"
                component="h1"
                gutterBottom
                sx={{
                  fontWeight: 700,
                  background: "linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  mb: 2,
                }}
              >
                Services Dashboard
              </Typography>

              <TextField
                fullWidth
                variant="outlined"
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{
                  mb: 3,
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 3,
                    background: "rgba(255, 255, 255, 0.8)",
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />

              <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                <Grid container spacing={2}>
                  {filteredServices.length === 0 ? (
                    <Grid item xs={12}>
                      <Paper
                        sx={{
                          p: 3,
                          textAlign: "center",
                          borderRadius: 2,
                          background: "rgba(255, 255, 255, 0.7)",
                        }}
                      >
                        <Typography variant="body1" color="text.secondary">
                          No matching services found.
                        </Typography>
                      </Paper>
                    </Grid>
                  ) : (
                    filteredServices.map((service) => (
                      <Grid item xs={12} sm={6} xl={4} key={service.name}>
                        <ServiceCard
                          service={service}
                          onActionOutput={handleActionOutput}
                          onViewLogs={onViewLogs}
                        />
                      </Grid>
                    ))
                  )}
                </Grid>
              </Box>
            </Paper>
          </Grid>

          {/* Action Output Column */}
          <Grid item xs={12} lg={4} sx={{ display: 'flex' }}>
            <Paper
              elevation={6}
              sx={{
                p: 3,
                borderRadius: 3,
                background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
                color: "#e5e7eb",
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Typography
                variant="h6"
                gutterBottom
                sx={{
                  color: "#fff",
                  fontWeight: 600,
                  background: "linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  mb: 2,
                }}
              >
                Last Action Output
              </Typography>
              <Box
                component="pre"
                sx={{
                  backgroundColor: "#0d1117",
                  border: "1px solid #333",
                  borderRadius: 2,
                  p: 2,
                  fontSize: "0.8rem",
                  lineHeight: 1.4,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  overflow: "auto",
                  fontFamily: "monospace",
                  flexGrow: 1,
                  minHeight: '300px',
                }}
              >
                {output}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default Dashboard;
