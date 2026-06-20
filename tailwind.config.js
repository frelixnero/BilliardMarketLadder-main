/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "background": "#0b1326",
        "secondary-fixed-dim": "#ffb95f",
        "on-primary-fixed-variant": "#5516be",
        "on-secondary-fixed-variant": "#653e00",
        "primary-fixed": "#e9ddff",
        "primary-container": "#a078ff",
        "on-tertiary-fixed": "#002113",
        "surface-container-high": "#222a3d",
        "on-surface": "#dae2fd",
        "on-error": "#690005",
        "on-tertiary-fixed-variant": "#005236",
        "on-primary-container": "#340080",
        "surface-container-lowest": "#060e20",
        "outline-variant": "#494454",
        "on-surface-variant": "#cbc3d7",
        "on-background": "#dae2fd",
        "surface-container-low": "#131b2e",
        "primary": "#d0bcff",
        "on-error-container": "#ffdad6",
        "tertiary-fixed": "#6ffbbe",
        "tertiary-container": "#00a572",
        "surface": "#0b1326",
        "inverse-surface": "#dae2fd",
        "outline": "#958ea0",
        "error-container": "#93000a",
        "surface-dim": "#0b1326",
        "secondary-fixed": "#ffddb8",
        "on-tertiary-container": "#00311f",
        "tertiary": "#4edea3",
        "primary-fixed-dim": "#d0bcff",
        "inverse-primary": "#6d3bd7",
        "secondary-container": "#ee9800",
        "on-secondary-container": "#5b3800",
        "error": "#ffb4ab",
        "on-primary-fixed": "#23005c",
        "inverse-on-surface": "#283044",
        "on-primary": "#3c0091",
        "on-secondary-fixed": "#2a1700",
        "tertiary-fixed-dim": "#4edea3",
        "on-tertiary": "#003824",
        "on-secondary": "#472a00",
        "surface-tint": "#d0bcff",
        "secondary": "#ffb95f",
        "surface-bright": "#31394d",
        "surface-variant": "#2d3449",
        "surface-container-highest": "#2d3449",
        "surface-container": "#171f33"
      },
      borderRadius: {
        "DEFAULT": "0.125rem",
        "lg": "0.25rem",
        "xl": "0.5rem",
        "full": "0.75rem"
      },
      spacing: {
        "sm": "8px",
        "gutter": "16px",
        "margin-mobile": "16px",
        "xs": "4px",
        "margin-desktop": "32px",
        "base": "4px",
        "md": "16px",
        "lg": "24px",
        "xl": "40px"
      },
      fontFamily: {
        "title-md": ["Inter"],
        "headline-lg-mobile": ["Inter"],
        "label-sm": ["Inter"],
        "display-lg": ["Inter"],
        "headline-lg": ["Inter"],
        "body-md": ["Inter"]
      },
      fontSize: {
        "title-md": ["20px", { "lineHeight": "28px", "fontWeight": "600" }],
        "headline-lg-mobile": ["24px", { "lineHeight": "32px", "fontWeight": "600" }],
        "label-sm": ["12px", { "lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "500" }],
        "display-lg": ["48px", { "lineHeight": "56px", "letterSpacing": "-0.02em", "fontWeight": "700" }],
        "headline-lg": ["32px", { "lineHeight": "40px", "letterSpacing": "-0.01em", "fontWeight": "600" }],
        "body-md": ["16px", { "lineHeight": "24px", "fontWeight": "400" }]
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries')
  ],
}
