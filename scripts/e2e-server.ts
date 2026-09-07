import { MongoMemoryServer } from "mongodb-memory-server";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
const main = async () => {
  const db = await MongoMemoryServer.create();
  mkdirSync(".test-services", { recursive: true });
  writeFileSync(
    ".test-services/mongodb.json",
    JSON.stringify({ uri: db.getUri("chess_browser_test") }),
  );
  const child = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-p", "3100"],
    {
      stdio: "inherit",
      windowsHide: true,
      env: {
        ...process.env,
        MONGODB_URI: db.getUri("chess_browser_test"),
        CHESS_AUTH_SECRET: "isolated-browser-test-signing-secret",
        MONGODB_DNS_SERVERS: "",
        NODE_ENV: "production",
      },
    },
  );
  const stop = async () => {
    child.kill();
    await db.stop();
    rmSync(".test-services/mongodb.json", { force: true });
    process.exit();
  };
  process.on("SIGINT", () => void stop());
  process.on("SIGTERM", () => void stop());
  child.on("exit", () => void db.stop().then(() => process.exit()));
};
void main();
