import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
    // Reported, not enforced: `npm run test:coverage` (CI) shows which rules
    // code is only reached through goldens and replays.
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts", "hooks/**/*.ts", "components/**/*.ts"],
      reporter: ["text-summary", "html", "json-summary"],
    },
  },
});
