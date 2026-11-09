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

app.listen(PORT, HOST, () => {
  console.log(`\n=========================================================`);
  console.log(`  🚀 RixMesh Control Plane running on http://${HOST}:${PORT}`);
  console.log(`  🧠 Default Model Engine: Gemini 3.8 Flash (High)`);
  console.log(`  🔒 Security: Bound to ${HOST} (Localhost only)`);
  console.log(`  📂 Database: ${DB_PATH}`);
  console.log(`  👥 Roles Directory: ${ROLES_DIR}`);
  console.log(`=========================================================\n`);
});
