// Card styles selectable in Admin › Appearance (default) and Dashboard › View (personal override).
// Classic is the original card; Detailed is the redesign; Accent strip and Elevated are Detailed with a different surface.
export const CARD_STYLES = [
  { id: "classic", label: "Classic", description: "The card from before the redesign, unchanged." },
  { id: "detailed", label: "Detailed", description: "Full card: description, tags, git branch, live resources and actions." },
  { id: "strip", label: "Accent strip", description: "Coloured top edge in the status colour: green, grey, amber or red." },
  { id: "elevated", label: "Elevated", description: "Floating card with a status-ringed avatar of the service initials." },
];

export const DEFAULT_CARD_STYLE = "classic";

export function normalizeCardStyle(value) {
  return CARD_STYLES.some((style) => style.id === value) ? value : DEFAULT_CARD_STYLE;
}
