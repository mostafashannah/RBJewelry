const { createServer } = require("http");
const { parse } = require("url");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const next = require("next");

// Load .env.local explicitly so env vars are available regardless of how the host starts the app
require("dotenv").config({ path: path.join(__dirname, ".env.local") });

// Prisma engine panic ("timer has gone away") leaves the singleton permanently broken.
// Exit and let Hostinger restart the process so the engine is recreated fresh.
function isPrismaEnginePanic(err) {
  const msg = err && (err.message || String(err));
  return msg && (msg.includes("timer has gone away") || (msg.includes("PANIC") && msg.includes("prisma")));
}

process.on("uncaughtException", (err) => {
  if (isPrismaEnginePanic(err)) {
    console.error("> Prisma engine panic — restarting process:", err.message);
    process.exit(1);
  }
  console.error("> Uncaught exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  if (isPrismaEnginePanic(reason)) {
    console.error("> Prisma engine panic (unhandled rejection) — restarting:", reason && reason.message);
    process.exit(1);
  }
  console.error("> Unhandled rejection:", reason);
});

const port = parseInt(process.env.PORT || "3000", 10);

// CI pre-builds .next and ships it in the archive — only build locally if missing
if (!fs.existsSync(path.join(__dirname, ".next", "BUILD_ID"))) {
  console.log("> No pre-built app found — building now...");
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
} else {
  console.log("> Using pre-built app.");
}

// Sync database schema (safely adds missing tables/columns on every restart)
// Note: prisma db push also runs in CI before deploy, so this is a safety net only.
try {
  console.log("> Syncing database schema...");
  execSync("npx prisma db push --accept-data-loss --skip-generate", {
    stdio: "inherit",
    cwd: __dirname,
    env: { ...process.env },
    timeout: 60000,
  });
  console.log("> Database schema up to date.");
} catch (err) {
  console.error("> DB sync failed:", err.message);
  console.error("> This is non-fatal if CI already applied migrations.");
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
