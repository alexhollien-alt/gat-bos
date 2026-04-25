import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Dummy env vars so transitively-loaded modules (supabase admin client,
    // resend client, etc.) don't crash at import time. These never connect
    // -- pure helpers under test do not exercise the clients.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      RESEND_API_KEY: "test-resend-key",
      OWNER_USER_ID: "00000000-0000-0000-0000-000000000000",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.d.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
