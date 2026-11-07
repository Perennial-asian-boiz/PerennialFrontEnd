import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages hosts this repository under /PerennialFrontEnd/.
  base: process.env.GITHUB_ACTIONS === "true" ? "/PerennialFrontEnd/" : "/",
  // Supabase's local confirmation redirect uses this exact IPv4 loopback host.
  server: { host: "127.0.0.1" },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
});
