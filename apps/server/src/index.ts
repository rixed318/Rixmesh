import path from 'node:path';
import { createDevOsServer } from './server.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4100;
const DB_PATH = process.env.DEVOS_DB_PATH || path.resolve(process.cwd(), '.devos', 'devos.sqlite');
const ROLES_DIR = process.env.DEVOS_ROLES_DIR || path.resolve(process.cwd(), 'roles');
const BASE_DATA_DIR = process.env.DEVOS_DATA_DIR || path.resolve(process.cwd(), '.devos');

const { app } = createDevOsServer({
  dbPath: DB_PATH,
  rolesDir: ROLES_DIR,
  baseDataDir: BASE_DATA_DIR,
});

app.listen(PORT, () => {
  console.log(`\n=========================================================`);
  console.log(`  🚀 Rixed DevOS Control Plane running on http://localhost:${PORT}`);
  console.log(`  🧠 Primary AI Agent: Gemini 3.8 Flash (High)`);
  console.log(`  📂 Database: ${DB_PATH}`);
  console.log(`  👥 Roles Directory: ${ROLES_DIR}`);
  console.log(`=========================================================\n`);
});
