import React, { useState, useEffect } from "react";
import {
  Container,
  Grid,
  Typography,
  TextField,
  Paper,
  Box,
  CircularProgress,
  Alert,
  InputAdornment,
} from "@mui/material";
import { Search as SearchIcon } from "@mui/icons-material";
import ServiceCard from "../components/ServiceCard";
import api from "../services/api";

const Dashboard = () => {
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
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="50vh"
        >
          <CircularProgress size={60} />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={3}>
        {/* Services Column */}
        <Grid item xs={12} lg={8}>
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            sx={{ fontWeight: 600 }}
          >
            Services
          </Typography>

          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ mb: 3 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />

          <Grid container spacing={2}>
            {filteredServices.length === 0 ? (
              <Grid item xs={12}>
                <Paper sx={{ p: 3, textAlign: "center" }}>
                  <Typography variant="body1" color="text.secondary">
                    No matching services found.
                  </Typography>
                </Paper>
              </Grid>
            ) : (
              filteredServices.map((service) => (
                <Grid item xs={12} sm={6} md={4} key={service.name}>
                  <ServiceCard
                    service={service}
                    onActionOutput={handleActionOutput}
                  />
                </Grid>
              ))
            )}
          </Grid>
        </Grid>

        {/* Action Output Column */}
        <Grid item xs={12} lg={4}>
          <Box sx={{ position: "sticky", top: 100 }}>
            <Paper
              elevation={3}
              sx={{
                p: 2,
                backgroundColor: "#1a1a1a",
                color: "#e5e7eb",
                maxHeight: "80vh",
                overflow: "auto",
              }}
            >
              <Typography variant="h6" gutterBottom sx={{ color: "#fff" }}>
                Last Action Output
              </Typography>
              <Box
                component="pre"
                sx={{
                  backgroundColor: "#0d1117",
                  border: "1px solid #333",
                  borderRadius: 1,
                  p: 1.5,
                  fontSize: "0.8rem",
                  lineHeight: 1.4,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: "65vh",
                  overflow: "auto",
                  fontFamily: "monospace",
                }}
              >
                {output}
              </Box>
            </Paper>
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;
