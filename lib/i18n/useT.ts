"use client";

// Re-export uit TaalProvider zodat bestaande imports blijven werken.
// De provider levert taal + setTaal + t aan op basis van context (geen cookie-flash meer).
export { useTaal as useT } from "./TaalProvider";
