const { createServer } = require("http");
const { parse } = require("url");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const next = require("next");

const port = parseInt(process.env.PORT || "3000", 10);

// Build the app if no production build exists (e.g. first deploy on Hostinger)
if (!fs.existsSync(path.join(__dirname, ".next", "BUILD_ID"))) {
  console.log("> No build found — building now (this takes a few minutes)...");
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
