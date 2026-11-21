import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Declare your Neon services here
  preview: {
    realtime: {
      allowedOrigins: ["http://localhost:3000"],
    },
  },
  auth: true,
  aiGateway: true,
  functions: {
    hello: {
      name: "Sankofa School Pulse",
      source: "./hello.ts",
      env: {
        AUTH_SECRET: { value: process.env.AUTH_SECRET, required: true },
      },
    },
  },
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      // New non-default branches: auto-expire
      // Run `neon checkout <name>` to create a new branch with these settings
      return { ttl: "7d" };
    }
    // Existing branch: no changes
    return {};
  },
});
