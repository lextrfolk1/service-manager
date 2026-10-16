import { Box, Typography } from "@mui/material";

// Centred empty / no-results message used by every list and panel.
export default function EmptyState({ icon, title, hint, action, sx = {} }) {
  return (
    <Box sx={{ p: 3, textAlign: "center", ...sx }}>
      {icon ? <Box sx={{ mb: 1.5, opacity: 0.28, "& svg": { fontSize: 44 } }}>{icon}</Box> : null}
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: hint ? 0.75 : 0 }}>
        {title}
      </Typography>
      {hint ? (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {hint}
        </Typography>
      ) : null}
      {action ? <Box sx={{ mt: 1.5 }}>{action}</Box> : null}
    </Box>
  );
}
