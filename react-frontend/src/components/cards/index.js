import React from "react";
import ServiceCard from "../ServiceCard";
import ClassicCard from "./ClassicCard";
import { DEFAULT_CARD_STYLE } from "./cardModel";

export { CARD_STYLES, DEFAULT_CARD_STYLE, normalizeCardStyle } from "./cardModel";

// Renders a service in the chosen card style (Classic by default).
export function ServiceCardView({ cardStyle = DEFAULT_CARD_STYLE, ...props }) {
  if (cardStyle === "detailed") return <ServiceCard {...props} />;
  if (cardStyle === "strip" || cardStyle === "elevated") return <ServiceCard skin={cardStyle} {...props} />;
  return <ClassicCard {...props} />;
}
