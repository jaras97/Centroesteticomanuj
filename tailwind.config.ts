import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
        display: ["var(--font-display)", "serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        // primary/secondary quedaban en hex fijo, sin pasar por el sistema de
        // theming (hsl(var(--brand-*))) — cualquier botón "default"/
        // "secondary" (incluidos los del admin) se quedaba con el teal/sand
        // original aunque Manu cambiara los colores de marca. Se conectan acá
        // para que todo el sitio, admin incluido, responda al theming.
        primary: {
          DEFAULT: "hsl(var(--brand-teal))",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "hsl(var(--brand-sand))",
          foreground: "hsl(var(--brand-ink))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Colores de marca — hsl(var(...)) en vez de hex fijo para que
        // /admin/contenido (pestaña Sitio) pueda re-themear en runtime sin
        // rebuild. Defaults en app/globals.css :root; override inyectado
        // como <style> inline en app/layout.tsx cuando site_settings trae
        // theme_ink/theme_sand/theme_teal. Ver lib/theme/colors.ts.
        brand: {
          ink: "hsl(var(--brand-ink))",
          sand: "hsl(var(--brand-sand))",
          "sand-light": "hsl(var(--brand-sand-light))",
          "sand-dark": "hsl(var(--brand-sand-dark))",
          teal: "hsl(var(--brand-teal))",
          "teal-light": "hsl(var(--brand-teal-light))",
          "teal-dark": "hsl(var(--brand-teal-dark))",
          white: "#FFFFFF",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
