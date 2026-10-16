import { Box } from "@mui/material";
import { STATUS_COLORS } from "../theme/tokens";

// Running = solid green dot, stopped = hollow grey ring. Same everywhere a service state is shown.
export default function StatusDot({ running, size = 7, color, sx = {} }) {
  return (
    <Box
      component="span"
      role="img"
      aria-label={running ? "Running" : "Stopped"}
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        boxSizing: "border-box",
        ...(running
          ? { backgroundColor: color || STATUS_COLORS.running }
          : { border: `1.5px solid ${color || STATUS_COLORS.stopped}` }),
        ...sx,
      }}
    />
  );
}
