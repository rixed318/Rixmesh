import path from 'node:path';
import fs from 'node:fs';
import { createDevOsServer } from './server.js';

function findRolesDir(): string {
  if (process.env.DEVOS_ROLES_DIR) return process.env.DEVOS_ROLES_DIR;
  const candidates = [
    path.resolve(process.cwd(), 'roles'),
    path.resolve(process.cwd(), '../../roles'),
    path.resolve(process.cwd(), '../roles'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return path.resolve(process.cwd(), 'roles');
}

function findBaseDataDir(): string {
  if (process.env.DEVOS_DATA_DIR) return process.env.DEVOS_DATA_DIR;
  if (fs.existsSync(path.resolve(process.cwd(), '../../package.json'))) {
    return path.resolve(process.cwd(), '../../.devos');
  }
  return path.resolve(process.cwd(), '.devos');
}

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4100;
const HOST = process.env.DEVOS_HOST || '127.0.0.1'; // Localhost only by default for safety
const BASE_DATA_DIR = findBaseDataDir();
const DB_PATH = process.env.DEVOS_DB_PATH || path.resolve(BASE_DATA_DIR, 'devos.sqlite');
const ROLES_DIR = findRolesDir();

const { app } = createDevOsServer({
  dbPath: DB_PATH,
  rolesDir: ROLES_DIR,
  baseDataDir: BASE_DATA_DIR,
});

const server = app.listen(PORT, HOST, () => {
  console.log(`\n=========================================================`);
  console.log(`  🚀 RixMesh Studio & Control Plane Active`);
  console.log(`  🌐 Web UI (Unified App): http://${HOST}:${PORT}`);
  console.log(`  ⚡ Live Vite Dev UI:    http://localhost:3100`);
  console.log(`  🧠 Default Model Engine: Gemini 3.8 Flash (High) via agy CLI`);
  console.log(`  🔒 Security: Bound to ${HOST} (Localhost only)`);
  console.log(`  📂 Database: ${DB_PATH}`);
  console.log(`  👥 Roles Directory: ${ROLES_DIR}`);
  console.log(`=========================================================\n`);
});

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n\x1b[33m⚠️  Port ${PORT} is already in use.\x1b[0m`);
    console.error(`   Another instance of RixMesh is already running at http://${HOST}:${PORT}`);
    console.error(`   To restart, terminate the running process first (e.g. kill $(lsof -t -i:${PORT})).\n`);
    process.exit(1);
  } else {
    console.error('Server listen error:', err);
    process.exit(1);
  }
});
