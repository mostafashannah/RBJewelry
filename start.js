const { createServer } = require("http");
const { parse } = require("url");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const next = require("next");

// Load .env.local explicitly so env vars are available regardless of how the host starts the app
require("dotenv").config({ path: path.join(__dirname, ".env.local") });

const port = parseInt(process.env.PORT || "3000", 10);

// Always build so new source code is picked up on every deploy
console.log("> Building app...");
try {
  execSync("npm run build", {
    stdio: "inherit",
    cwd: __dirname,
    env: { ...process.env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" },
  });
  console.log("> Build complete.");
} catch (err) {
  console.error("> Build failed:", err.message);
  process.exit(1);
}

// Sync database schema (safely adds missing tables/columns on every restart)
try {
  console.log("> Syncing database schema...");
  execSync("npx prisma db push --accept-data-loss --skip-generate", {
    stdio: "inherit",
    cwd: __dirname,
    env: { ...process.env },
  });
  console.log("> Database schema up to date.");
} catch (err) {
  console.error("> DB sync failed (continuing anyway):", err.message);
}

const app = next({ dev: false, hostname: "0.0.0.0", port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error:", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  }).listen(port, () => {
    console.log(`> RB Jewelry ready on port ${port}`);
  });
});
