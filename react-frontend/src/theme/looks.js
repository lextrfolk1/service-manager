// One-click "Looks": recommended theme + card style pairs (Dashboard › View › Look).
export const LOOKS = [
  { id: "everyday", label: "Everyday", theme: "light", cardStyle: "detailed", hint: "Light + Detailed — clearest status" },
  { id: "modern", label: "Modern", theme: "light", cardStyle: "elevated", hint: "Light + Elevated — floating cards" },
  { id: "studio", label: "Studio", theme: "graphite", cardStyle: "strip", hint: "Graphite + Accent strip — best dark pair" },
  { id: "night", label: "Night", theme: "dark", cardStyle: "detailed", hint: "Dark + Detailed — most information" },
  { id: "long-session", label: "Long session", theme: "soft", cardStyle: "classic", hint: "Warm + Classic — easy on the eyes" },
];

export function findLook(theme, cardStyle) {
  return LOOKS.find((look) => look.theme === theme && look.cardStyle === cardStyle) || null;
}
