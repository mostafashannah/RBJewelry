#!/usr/bin/env node
// Read-only diagnostics against the Hostinger API via hostinger-api-mcp stdio protocol.
// Lists available tools, then fetches app/deployment details for app.rbjewelry.net.
const { spawn } = require('child_process');

const DOMAIN = 'app.rbjewelry.net';

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

const send = (method, params) => new Promise((resolve) => {
  msgId++;
  pending.set(msgId, resolve);
  mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: msgId, method, params }) + '\n');
});

async function tryCall(name, args) {
  console.log(`\n=== tools/call ${name} ${JSON.stringify(args)} ===`);
  const res = await send('tools/call', { name, arguments: args });
  const content = res?.result?.content?.[0]?.text;
  if (content) {
    console.log(content);
  } else {
    console.log('ERROR:', JSON.stringify(res?.error ?? res));
  }
  return res;
}

async function run() {
  await send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'github-actions-diagnose', version: '1.0' },
  });

  const toolsRes = await send('tools/list', {});
  const tools = toolsRes?.result?.tools ?? [];
  console.log(`\n=== ${tools.length} tools available ===`);
  const relevant = tools.filter((t) =>
    /js|app|log|domain|hosting|deploy|restart|status/i.test(t.name)
  );
  for (const t of relevant) {
    console.log(`- ${t.name}: ${t.description ?? ''}`.slice(0, 200));
  }

  // Try likely candidates for app status / logs — harmless if they don't exist (404/error, not destructive)
  const candidates = [
    ['hosting_getJsApplication', { domain: DOMAIN }],
    ['hosting_getJsApplicationDetails', { domain: DOMAIN }],
    ['hosting_getJsApplicationLogs', { domain: DOMAIN }],
    ['hosting_getJsAppLogs', { domain: DOMAIN }],
    ['hosting_listJsApplications', {}],
    ['hosting_listJsDeployments', { domain: DOMAIN, states: ['pending', 'running', 'completed', 'failed'] }],
  ];

  for (const [name, args] of candidates) {
    if (tools.find((t) => t.name === name)) {
      await tryCall(name, args);
    } else {
      console.log(`\n(skip ${name} — not in tool list)`);
    }
  }

  mcp.stdin.end();
}

run().catch((err) => { console.error(err); process.exit(1); });
