#!/usr/bin/env node
// Deploys to Hostinger via hostinger-api-mcp stdio protocol
const { spawn } = require('child_process');

const DOMAIN = 'app.rbjewelry.net';
const ARCHIVE = '/tmp/rbjewelry-deploy.tar.gz';
const POLL_INTERVAL = 20000;
const MAX_POLLS = 30;

const mcp = spawn('hostinger-api-mcp', [], {
  env: { ...process.env },
  stdio: ['pipe', 'pipe', 'inherit'],
});

let buffer = '';
const pending = new Map();
let msgId = 0;

mcp.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch {}
  }
});

mcp.on('error', (err) => { console.error('MCP error:', err); process.exit(1); });
mcp.on('close', (code) => { if (code !== 0 && pending.size > 0) { console.error('MCP exited with code', code); process.exit(1); } });

const SEND_TIMEOUT_MS = 90000;

const send = (method, params) => new Promise((resolve, reject) => {
  msgId++;
  const id = msgId;
  const timer = setTimeout(() => {
    pending.delete(id);
    reject(new Error(`Timed out after ${SEND_TIMEOUT_MS / 1000}s waiting for response to "${method}"`));
  }, SEND_TIMEOUT_MS);
  pending.set(id, (msg) => {
    clearTimeout(timer);
    resolve(msg);
  });
  mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  await send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'github-actions', version: '1.0' },
  });

  console.log(`Uploading and deploying to ${DOMAIN}...`);

  // Retry up to 5 times with backoff — Hostinger API occasionally returns 500
  let deployResult;
  for (let attempt = 1; attempt <= 5; attempt++) {
    if (attempt > 1) {
      const wait = attempt * 15000;
      console.log(`Retry ${attempt}/5 in ${wait / 1000}s...`);
      await sleep(wait);
    }
    deployResult = await send('tools/call', {
      name: 'hosting_deployJsApplication',
      arguments: { domain: DOMAIN, archivePath: ARCHIVE, removeArchive: attempt === 1 },
    });
    const c = deployResult?.result?.content?.[0]?.text;
    if (c) break;
    console.warn(`Attempt ${attempt} failed:`, JSON.stringify(deployResult?.error ?? deployResult));
  }

  const content = deployResult?.result?.content?.[0]?.text;
  if (!content) {
    console.error('All deploy attempts failed:', JSON.stringify(deployResult));
    process.exit(1);
  }

  const parsed = JSON.parse(content);
  if (parsed?.build?.status !== 'success') {
    console.error('Build trigger failed:', JSON.stringify(parsed, null, 2));
    process.exit(1);
  }

  const buildUuid = parsed.build.data.uuid;
  let state = parsed.build.data.state;
  console.log(`Build ${buildUuid} — state: ${state}`);

  for (let i = 0; i < MAX_POLLS && (state === 'pending' || state === 'running'); i++) {
    await sleep(POLL_INTERVAL);
    const poll = await send('tools/call', {
      name: 'hosting_listJsDeployments',
      arguments: { domain: DOMAIN, states: ['pending', 'running', 'completed', 'failed'] },
    });
    const pollContent = poll?.result?.content?.[0]?.text;
    const pollData = pollContent ? JSON.parse(pollContent) : {};
    const deps = pollData?.deployments?.data ?? [];
    state = deps.find((d) => d.uuid === buildUuid)?.state ?? state;
    console.log(`[${i + 1}/${MAX_POLLS}] state: ${state}`);
  }

  mcp.stdin.end();

  if (state !== 'completed') {
    console.error(`Deploy failed. Final state: ${state}`);
    process.exit(1);
  }

  console.log(`✅ Deployed to https://${DOMAIN}`);
}

run().catch((err) => { console.error(err); process.exit(1); });
