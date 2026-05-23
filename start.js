// Hostinger Node.js entry point — runs the Next.js standalone server
const { createServer } = require("http");
const { parse } = require("url");
const next = require("./.next/standalone/node_modules/next");

const app = next({ dir: __dirname, dev: false });
const handle = app.getRequestHandler();
const PORT = process.env.PORT || 3000;

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(PORT, () => {
    console.log(`> RB Jewelry running on port ${PORT}`);
  });
});
