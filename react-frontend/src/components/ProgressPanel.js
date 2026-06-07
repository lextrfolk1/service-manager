import {
  Alert,
  Box,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import StatusChip from "./StatusChip";

function ProgressPanel({ summary, steps, onViewLogs }) {
  if (!summary || !steps?.length) return null;

  const percent = summary.total ? Math.round((summary.completed / summary.total) * 100) : 0;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
        backgroundColor: "background.paper",
      }}
    >
      <Stack spacing={2}>
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          <Box>
            <Typography variant="overline" color="text.secondary">
              Operation Progress
            </Typography>
            <Typography variant="h6">
              {summary.label}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {summary.completed} of {summary.total} services completed
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <StatusChip state="healthy" label={`${summary.succeeded} healthy`} />
            <StatusChip state="waiting" label={`${summary.waiting} waiting`} />
            <StatusChip state="failed" label={`${summary.failed} failed`} />
          </Stack>
        </Box>

        <LinearProgress
          variant="determinate"
          value={percent}
          sx={{
            height: 10,
            borderRadius: 999,
            backgroundColor: "#E5E7EB",
          }}
        />

        <Stack spacing={1.25}>
          {steps.map((step) => (
            <Box
              key={step.name}
              sx={{
                display: "flex",
                justifyContent: "space-between",
                gap: 2,
                alignItems: "flex-start",
                p: 1.5,
                borderRadius: 2,
                backgroundColor: "rgba(15, 23, 42, 0.03)",
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2">{step.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {step.message}
                </Typography>
                {step.error && (
                  <Alert
                    severity="error"
                    action={onViewLogs ? (
                      <Typography
                        component="button"
                        onClick={() => onViewLogs(step.name)}
                        style={{
                          border: 0,
                          background: "transparent",
                          color: "#B91C1C",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        View logs
                      </Typography>
                    ) : null}
                    sx={{ mt: 1, borderRadius: 2 }}
                  >
                    {step.error}
                  </Alert>
                )}
              </Box>
              <StatusChip state={step.state} />
            </Box>
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}

export default ProgressPanel;
