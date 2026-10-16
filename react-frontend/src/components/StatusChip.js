import Chip from "@mui/material/Chip";

const STATUS_STYLES = {
  idle: { label: "Idle", bg: "var(--c-bg-e5e7eb)", color: "var(--c-text-374151)" },
  queued: { label: "Queued", bg: "var(--c-bg-dbeafe)", color: "var(--c-text-1d4ed8)" },
  waiting: { label: "Waiting", bg: "var(--c-bg-dbeafe)", color: "var(--c-text-1d4ed8)" },
  starting: { label: "Starting", bg: "var(--c-bg-fef3c7)", color: "var(--c-text-b45309)" },
  running: { label: "Running", bg: "var(--c-bg-dcfce7)", color: "var(--c-text-166534)" },
  healthy: { label: "Healthy", bg: "var(--c-bg-dcfce7)", color: "var(--c-text-166534)" },
  unhealthy: { label: "Unhealthy", bg: "var(--c-bg-fee2e2)", color: "var(--c-text-b91c1c)" },
  "port-open": { label: "Port Open", bg: "var(--c-bg-f1f5f9)", color: "var(--c-text-475569)" },
  stopping: { label: "Stopping", bg: "var(--c-bg-fef3c7)", color: "var(--c-text-b45309)" },
  stopped: { label: "Stopped", bg: "var(--c-bg-f3f4f6)", color: "var(--c-text-4b5563)" },
  failed: { label: "Failed", bg: "var(--c-bg-fee2e2)", color: "var(--c-text-b91c1c)" },
  blocked: { label: "Port Blocked", bg: "var(--c-bg-fef2f2)", color: "var(--c-text-dc2626)" },
  unknown: { label: "Unknown", bg: "var(--c-bg-f3f4f6)", color: "var(--c-text-4b5563)" },
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
