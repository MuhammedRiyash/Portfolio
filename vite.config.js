import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";


// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: env.VITE_REPO_NAME ? `/${env.VITE_REPO_NAME}/` : "/",
    plugins: [react()],
    server: {
      open: true,
      host: false, // Allow access from network devices
      proxy: {
        "/api": {
          target: "http://localhost:5000",
          changeOrigin: true,
          secure: true,
        },
      },
    },
  };
});
