// The 14 color-combination themes. c1 is used for the sidebar background
// and primary actions (always paired with white text); c2 is a soft
// highlight tint for active/selected states (always paired with c1 as the
// text/icon color on top of it, since c2 is often pale).
export const THEMES = [
  { id: "velvet-ash", name: "Velvet Ash", c1: "#2a2a2e", c2: "#cda99b", label1: "Deep Charcoal Black", label2: "Dusty Rose Beige" },
  { id: "ember-frost", name: "Ember Frost", c1: "#c1552c", c2: "#afc8d6", label1: "Burnt Orange", label2: "Misty Ice Blue" },
  { id: "tidal-ivory", name: "Tidal Ivory", c1: "#0e3d3d", c2: "#f3e7d3", label1: "Deep Teal", label2: "Warm Cream" },
  { id: "silver-meadow", name: "Silver Meadow", c1: "#4c6b8a", c2: "#bfcdae", label1: "Steel Blue", label2: "Pale Sage Green" },
  { id: "moonlit-slate", name: "Moonlit Slate", c1: "#3b3b3e", c2: "#c9c4d4", label1: "Charcoal Gray", label2: "Soft Lavender Gray" },
  { id: "blush-silk", name: "Blush Silk", c1: "#c98f82", c2: "#f2e6d6", label1: "Dusty Rose", label2: "Soft Cream Beige" },
  { id: "violet-grove", name: "Violet Grove", c1: "#4a1f43", c2: "#9db08a", label1: "Deep Plum", label2: "Sage Green" },
  { id: "golden-moss", name: "Golden Moss", c1: "#2b2a1c", c2: "#e9c468", label1: "Deep Olive Black", label2: "Soft Golden Yellow" },
  { id: "desert-merlot", name: "Desert Merlot", c1: "#6b1e2b", c2: "#dac49e", label1: "Burgundy", label2: "Sand" },
  { id: "teal-porcelain", name: "Teal Porcelain", c1: "#0d3b3b", c2: "#f6f1e4", label1: "Deep Teal", label2: "Ivory" },
  { id: "cinder-coral", name: "Cinder Coral", c1: "#2b2b2b", c2: "#ff6f59", label1: "Charcoal", label2: "Coral" },
  { id: "clay-linen", name: "Clay & Linen", c1: "#c15f3c", c2: "#f5ecd9", label1: "Terracotta", label2: "Cream" },
  { id: "rosewood-garden", name: "Rosewood Garden", c1: "#1f4934", c2: "#e7b4b9", label1: "Forest Green", label2: "Blush" },
  { id: "midnight-gild", name: "Midnight Gild", c1: "#10203f", c2: "#d1a62e", label1: "Navy", label2: "Gold" },
];

export const DEFAULT_THEME_ID = "teal-porcelain";

export function getTheme(themeId) {
  return THEMES.find((t) => t.id === themeId) || THEMES.find((t) => t.id === DEFAULT_THEME_ID);
}
