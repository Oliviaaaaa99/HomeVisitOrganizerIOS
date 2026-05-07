// Shared visual tokens — light purple × light pink palette.
// Hex codes are referenced by hue family so future tweaks stay consistent.

export const colors = {
  // Backgrounds
  bg: "#FFF5FA",            // very soft cream-pink
  bgAlt: "#FAF5FF",         // very soft cream-purple
  surface: "#FFFFFF",
  border: "#F1DDEB",        // soft pink-gray for hairlines
  borderSoft: "#EDE4F5",    // soft purple-gray

  // Brand primaries
  primary: "#A78BFA",       // medium-light purple (lavender)
  primarySoft: "#EDE9FE",   // pale purple background
  primaryDeep: "#7C3AED",   // pressed / accent text

  pink: "#F9A8D4",          // medium-light pink
  pinkSoft: "#FCE7F3",      // pale pink background
  pinkDeep: "#DB2777",      // pressed / accent text

  // Text
  textPrimary: "#3D2A5A",   // deep purple-tinted near-black
  textSecondary: "#7B6E8E",
  textMuted: "#A89AB8",
  textInverse: "#FFFFFF",

  // Pills (status / kind)
  pill: {
    rental: { bg: "#EDE9FE", fg: "#5B21B6" },
    for_sale: { bg: "#FCE7F3", fg: "#9D174D" },
    toured: { bg: "#F3F0F8", fg: "#6B5B7B" },
    shortlisted: { bg: "#DCFCE7", fg: "#166534" },
    rejected: { bg: "#FEE2E2", fg: "#B91C1C" },
    archived: { bg: "#F1F5F9", fg: "#64748B" },
  } as Record<string, { bg: string; fg: string }>,

  // Gradients (used with expo-linear-gradient)
  gradientHeader: ["#FBCFE8", "#E9D5FF"] as [string, string],   // pink → purple
  gradientButton: ["#C4B5FD", "#F9A8D4"] as [string, string],    // purple → pink
};

export const radii = {
  card: 16,
  input: 12,
  button: 14,
  pill: 999,
};

export const shadow = {
  card: {
    shadowColor: "#A78BFA",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
};
