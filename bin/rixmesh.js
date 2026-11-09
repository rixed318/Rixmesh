#!/usr/bin/env node

/**
 * RixMesh CLI & Desktop Launcher
 * 
 * Open-source multi-agent development workspace & control plane.
 * Copyright (c) 2026 rixed318. Licensed under MIT.
 */

import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const command = args[0] || 'start';

function printBanner() {
  console.log(`
\x1b[35m  ██████╗ ██╗██╗  ██╗███╗   ███╗███████╗███████╗██╗  ██╗\x1b[0m
\x1b[35m  ██╔══██╗██║╚██╗██╔╝████╗ ████║██╔════╝██╔════╝██║  ██║\x1b[0m
\x1b[36m  ██████╔╝██║ ╚███╔╝ ██╔████╔██║█████╗  ███████╗███████║\x1b[0m
\x1b[36m  ██╔══██╗██║ ██╔██╗ ██║╚██╔╝██║██╔══╝  ╚════██║██╔══██║\x1b[0m
\x1b[34m  ██║  ██║██║██╔╝ ██╗██║ ╚═╝ ██║███████╗███████║██║  ██║\x1b[0m
\x1b[34m  ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝\x1b[0m
\x1b[90m  Multi-Agent Development Workspace & Control Plane v0.1.0-alpha.1\x1b[0m
`);
}

function openBrowser(url) {
  const platform = os.platform();
  try {
    if (platform === 'linux') {
      // Attempt to launch in application mode (app-like standalone window)
      const chromeBrowsers = ['google-chrome', 'chromium-browser', 'chromium', 'google-chrome-stable'];
      let launched = false;
      for (const b of chromeBrowsers) {
        try {
          execSync(`which ${b}`, { stdio: 'ignore' });
          spawn(b, [`--app=${url}`], { detached: true, stdio: 'ignore' }).unref();
          launched = true;
          break;
        } catch {}
      }
      if (!launched) {
        spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
      }
    } else if (platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else if (platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch (err) {
    console.warn('Notice: Could not automatically open browser:', err.message);
  }
}

async function runStart() {
  printBanner();

  const webDist = path.join(ROOT_DIR, 'apps', 'web', 'dist');
  if (!fs.existsSync(webDist)) {
    console.log('\x1b[33m⚡ Web assets not found. Compiling workspace...\x1b[0m');
    execSync('pnpm build', { cwd: ROOT_DIR, stdio: 'inherit' });
  }

  const serverScript = path.join(ROOT_DIR, 'apps', 'server', 'src', 'index.ts');
  const port = process.env.PORT || 4100;
  const host = process.env.DEVOS_HOST || '127.0.0.1';
  const url = `http://${host}:${port}`;

  console.log(`\x1b[32m✔ Starting RixMesh Unified Server on ${url}...\x1b[0m`);

  const child = spawn('npx', ['tsx', serverScript], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    env: { ...process.env, PORT: String(port), DEVOS_HOST: host },
  });

  // Give the server 1.2 seconds to bind, then open the browser window
  setTimeout(() => {
    console.log(`\x1b[36m🚀 Opening RixMesh Studio at ${url}...\x1b[0m`);
    openBrowser(url);
  }, 1200);

  const cleanup = () => {
    console.log('\n\x1b[90mShutting down RixMesh...\x1b[0m');
    child.kill('SIGINT');
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

async function runDesktop() {
  printBanner();
  console.log('\x1b[32m✔ Launching RixMesh Studio Native Desktop Application...\x1b[0m\n');

  const webDist = path.join(ROOT_DIR, 'apps', 'web', 'dist');
  if (!fs.existsSync(webDist)) {
    console.log('\x1b[33m⚡ Web assets not found. Compiling workspace...\x1b[0m');
    execSync('pnpm build', { cwd: ROOT_DIR, stdio: 'inherit' });
  }

  const child = spawn('pnpm', ['--filter', '@rixmesh/desktop', 'start'], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  });

  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
}

async function runDev() {
  printBanner();
  console.log('\x1b[32m✔ Launching RixMesh in Development Mode (Vite Hot-Reload + Server Watch)...\x1b[0m\n');
  const child = spawn('pnpm', ['dev'], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  });

  setTimeout(() => {
    console.log(`\x1b[36m🚀 Opening Live Vite Dev UI at http://localhost:3100...\x1b[0m`);
    openBrowser('http://localhost:3100');
  }, 1500);

  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
}

async function runStatus() {
  printBanner();
  console.log('\x1b[34m📊 Checking RixMesh Runtime & Providers Status...\x1b[0m\n');

  try {
    const output = execSync(
      `npx tsx -e "
import('./packages/providers/src/registry.ts').then(async ({ ProviderRegistry }) => {
  const probes = await ProviderRegistry.getInstance().probeAll();
  console.log(JSON.stringify(probes));
});
"`,
      { cwd: ROOT_DIR, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    const probes = JSON.parse(output.trim());
    console.log('Model Providers:');
    for (const [id, probe] of Object.entries(probes)) {
      const color = probe.available ? '\x1b[32m✔' : '\x1b[31m✖';
      console.log(`  ${color} [${id.padEnd(8)}]\x1b[0m - Status: ${(probe.status || 'unknown').padEnd(12)} | Reason: ${probe.reason || 'OK'}`);
    }
  } catch (err) {
    console.log('Provider check notice:', err.message);
  }

  const dbPath = path.join(ROOT_DIR, '.devos', 'devos.sqlite');
  console.log(`\nDatabase: ${fs.existsSync(dbPath) ? '\x1b[32m✔ Connected\x1b[0m (' + dbPath + ')' : '\x1b[33mNot yet initialized\x1b[0m'}`);
}

async function runTests() {
  printBanner();
  console.log('\x1b[34m🧪 Running Vitest Acceptance & Unit Suites...\x1b[0m\n');
  execSync('pnpm test', { cwd: ROOT_DIR, stdio: 'inherit' });
}

async function runE2E() {
  printBanner();
  console.log('\x1b[34m🧪 Running Live Multi-Agent E2E Workflow...\x1b[0m\n');
  execSync('pnpm test:e2e', { cwd: ROOT_DIR, stdio: 'inherit' });
}

function printHelp() {
  printBanner();
  console.log(`Usage: rixmesh [command]

Commands:
  start          Start unified server and open RixMesh Studio in application mode (Default)
  desktop        Launch RixMesh Studio as a native Electron desktop application
  dev            Start development mode with Vite hot-reloading (port 3100) and server watch (port 4100)
  status         Inspect configured LLM providers, database connection, and runtime health
  test           Run all 33 unit and acceptance tests (AT-01 to AT-18)
  e2e            Run end-to-end multi-agent workflow verification with Gemini 3.8 Flash High
  help           Display this help message

Options:
  PORT           Set port for unified server (Default: 4100)
  DEVOS_HOST     Set host interface (Default: 127.0.0.1)

Examples:
  $ rixmesh start
  $ rixmesh dev
  $ rixmesh status
`);
}

switch (command) {
  case 'start':
    runStart();
    break;
  case 'desktop':
    runDesktop();
    break;
  case 'dev':
    runDev();
    break;
  case 'status':
    runStatus();
    break;
  case 'test':
    runTests();
    break;
  case 'e2e':
    runE2E();
    break;
  case 'help':
  case '--help':
  case '-h':
    printHelp();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
}
