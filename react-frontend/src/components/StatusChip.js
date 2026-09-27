import Chip from "@mui/material/Chip";

const STATUS_STYLES = {
  idle: { label: "Idle", bg: "#E5E7EB", color: "#374151" },
  queued: { label: "Queued", bg: "#DBEAFE", color: "#1D4ED8" },
  waiting: { label: "Waiting", bg: "#FEF3C7", color: "#B45309" },
  starting: { label: "Starting", bg: "#E0F2FE", color: "#0369A1" },
  running: { label: "Running", bg: "#DCFCE7", color: "#166534" },
  healthy: { label: "Healthy", bg: "#DCFCE7", color: "#166534" },
  unhealthy: { label: "Unhealthy", bg: "#FEE2E2", color: "#B91C1C" },
  "port-open": { label: "Port Open", bg: "#E0F2FE", color: "#0369A1" },
  stopping: { label: "Stopping", bg: "#FEE2E2", color: "#B91C1C" },
  stopped: { label: "Stopped", bg: "#F3F4F6", color: "#4B5563" },
  failed: { label: "Failed", bg: "#FEE2E2", color: "#B91C1C" },
  blocked: { label: "Port Blocked", bg: "#FEF2F2", color: "#DC2626" },
  unknown: { label: "Unknown", bg: "#F3F4F6", color: "#4B5563" },
};

function StatusChip({ state, label, size = "small", sx = {} }) {
  const style = STATUS_STYLES[state] || STATUS_STYLES.unknown;

  return (
    <Chip
      label={label || style.label}
      size={size}
      sx={{
        backgroundColor: style.bg,
        color: style.color,
        fontWeight: 700,
        borderRadius: "999px",
        ...sx,
      }}
    />
  );
}

export default StatusChip;
