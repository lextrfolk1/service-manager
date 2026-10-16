import { Box, Stack, Tooltip, Typography } from "@mui/material";
import { Check as CheckIcon } from "@mui/icons-material";
import { ACCENTS, THEME_BASES, useThemeSettings } from "../theme/ThemeController";

// Theme + accent picker (Admin › Appearance). Personal: applies at once and is remembered in this browser.
export default function ThemePicker() {
  const { base, accent, setBase, setAccent } = useThemeSettings();
  return (
    <Box>
      <Box role="radiogroup" aria-label="Theme" sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {THEME_BASES.map((option) => {
          const active = base === option.id;
          return (
            <Box
              key={option.id}
              component="button"
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setBase(option.id)}
              sx={{
                textAlign: "left",
                font: "inherit",
                cursor: "pointer",
                minWidth: 150,
                px: 1.5,
                py: 1,
                borderRadius: 2,
                border: "2px solid",
                borderColor: active ? "primary.main" : "divider",
                bgcolor: "background.paper",
                color: "text.primary",
                "&:hover": { borderColor: active ? "primary.main" : "text.secondary" },
              }}
            >
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <Typography sx={{ fontWeight: 700, fontSize: "0.85rem", flex: 1 }}>{option.label}</Typography>
                {active ? <CheckIcon fontSize="small" color="primary" /> : null}
              </Stack>
              {option.hint ? <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>{option.hint}</Typography> : null}
            </Box>
          );
        })}
      </Box>
      <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: "text.secondary", mt: 2, mb: 0.75 }}>Accent colour</Typography>
      <Box role="radiogroup" aria-label="Accent colour" sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {ACCENTS.map((option) => {
          const active = accent === option.id;
          return (
            <Tooltip key={option.id} title={option.label}>
              <Box
                component="button"
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={option.label}
                onClick={() => setAccent(option.id)}
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  border: "2px solid",
                  borderColor: active ? "text.primary" : "transparent",
                  outline: "2px solid",
                  outlineColor: "background.paper",
                  outlineOffset: -4,
                  bgcolor: option.main,
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  color: "#ffffff",
                }}
              >
                {active ? <CheckIcon sx={{ fontSize: 15 }} /> : null}
              </Box>
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
}
