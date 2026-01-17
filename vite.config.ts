import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 1.0.0: YUIChat 项目配置
// 使用不同的端口避免与 ai-food advise (5178) 冲突
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5179, // 使用 5179 端口，避免与 ai-food advise (5178) 冲突
  },
  build: {
    sourcemap: true,
  },
});

