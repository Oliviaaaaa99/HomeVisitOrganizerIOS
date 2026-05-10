// Shared visual tokens — neutral palette with purple as the only accent.
// The previous lavender-and-pink scheme was distinctive but read "kawaii"
// against every other apartment app's blue/red palette. This swap keeps
// purple as our identity color but only in places that earn it (CTAs,
// shortlisted state, score badges) and lets the actual content (cards,
// text, list rows) be neutral and calm — the Linear / Things / Notion
// playbook.

export const colors = {
  // Backgrounds — neutral, mostly white with a hair of warm gray.
  bg: "#F7F7F8",
  bgAlt: "#FFFFFF",
  surface: "#FFFFFF",
  border: "#E5E5E7", // iOS system gray-5 territory
  borderSoft: "#EFEFF1",

  // Purple is the only chromatic accent. Used on:
  //   - CTA buttons (Save, Add property, AI Rank)
  //   - Shortlisted unit (subtle bg tint + status pill)
  //   - Active filter chip
  //   - Score badge ring on RankedScreen
  primary: "#7C3AED",
  primarySoft: "#F3F0FF",
  primaryDeep: "#5B21B6",

  // Semantic red — destructive only (delete, rejected status). Not a
  // brand color; never used decoratively.
  danger: "#E11D48",
  dangerSoft: "#FEE2E2",
  dangerDeep: "#9F1239",

  // Kept for transitional code that still references pink* tokens.
  // New code should prefer danger* / primary* tokens above. These will be
  // removed once every callsite has migrated.
  pink: "#E11D48",
  pinkSoft: "#FEE2E2",
  pinkDeep: "#9F1239",

  // Card surface — flat white with a thin gray border. No more lavender.
  cardBg: "#FFFFFF",
  cardBorder: "#E5E5E7",
  cardAccent: "#A1A1AA", // a soft gray accent for any remaining rail / divider

  // Text — true neutral, no purple tint anywhere.
  textPrimary: "#0A0A0F",
  textSecondary: "#52525B",
  textMuted: "#A1A1AA",
  textInverse: "#FFFFFF",

  // Status pills — quiet by default; only shortlisted leans on the brand
  // color, rejected uses danger, the rest are gray.
  pill: {
    rental: { bg: "#F4F4F5", fg: "#3F3F46" },
    for_sale: { bg: "#F4F4F5", fg: "#3F3F46" },
    toured: { bg: "#F4F4F5", fg: "#52525B" },
    shortlisted: { bg: "#F3F0FF", fg: "#5B21B6" },
    rejected: { bg: "#FEE2E2", fg: "#9F1239" },
    archived: { bg: "#F1F5F9", fg: "#64748B" },
  } as Record<string, { bg: string; fg: string }>,

  // The only gradient that survives — used on the CTA button in sign-in
  // and on the FAB. Headers across the app are flat now.
  gradientButton: ["#7C3AED", "#5B21B6"] as [string, string],

  // Kept as a flat-white tuple so existing LinearGradient headers compile
  // without a sweep. The visual effect is "no gradient"; per-screen styles
  // add a 1px hairline at the header bottom for separation. New screens
  // should prefer a plain View with backgroundColor: surface.
  gradientHeader: ["#FFFFFF", "#FFFFFF"] as [string, string],
};

export const radii = {
  card: 14,
  input: 10,
  button: 12,
  pill: 999,
};

export const shadow = {
  // Subtle drop shadow for elevated cards. Black-ish base reads cleaner
  // than the previous purple-tinted shadow on a neutral background.
  card: {
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
};
