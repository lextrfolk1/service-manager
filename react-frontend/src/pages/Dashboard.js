import { useState, useEffect } from "react";
import {
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
      <Grid container spacing={2} sx={{ flexGrow: 1, p: 2, minHeight: 0 }}>
        {/* Services Column */}
        <Grid item xs={12} lg={8} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Paper
            elevation={6}
            sx={{
              borderRadius: 3,
              background: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(10px)",
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              overflow: 'hidden'
            }}
          >
            {/* Fixed Search Header */}
            <Box sx={{ p: 3, flexShrink: 0 }}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{
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
            </Box>

            {/* Scrollable Services Grid */}
            <Box sx={{ flexGrow: 1, overflow: 'auto', px: 3, pb: 3 }}>
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
        <Grid item xs={12} lg={4} sx={{ display: 'flex', minHeight: 0 }}>
          <Paper
            elevation={6}
            sx={{
              borderRadius: 3,
              background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
              color: "#e5e7eb",
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              overflow: 'hidden'
            }}
          >
            {/* Fixed Header */}
            <Box sx={{ p: 3, pb: 2, flexShrink: 0 }}>
              <Typography
                variant="h6"
                sx={{
                  color: "#fff",
                  fontWeight: 600,
                  background: "linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Action Output
              </Typography>
            </Box>

            {/* Scrollable Output Area */}
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
                mx: 3,
                mb: 3,
                minHeight: 0
              }}
            >
              {output}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
