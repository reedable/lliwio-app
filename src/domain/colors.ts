/**
 * lliwio-app's own brand palette. Not user data — these are the app's colours, kept
 * apart from the palettes in the store so the two never get confused.
 */

export const BRAND = {
  red: "#C8102E",
  white: "#FFFFFF",
  green: "#00B140",
} as const;

export const SECONDARY = {
  blue: "#012169",
  yellow: "#FFFF00",
  black: "#000000",
} as const;

/*
 * #757575 is the sRGB gray with the best worst-case contrast against both black
 * and white: 4.61 against white, 4.56 against black. One step either way drops
 * below AA (4.5) on one side. Nothing can clear AAA against both — 7:1 needs
 * relative luminance >= 0.30 against black and <= 0.10 against white.
 */
export const TERTIARY = {
  gray: "#757575",
} as const;

export type BrandColor = (typeof BRAND)[keyof typeof BRAND];
export type SecondaryColor = (typeof SECONDARY)[keyof typeof SECONDARY];
export type TertiaryColor = (typeof TERTIARY)[keyof typeof TERTIARY];
