import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import BetterSqlite3 from 'better-sqlite3';
import { mkdir } from 'fs/promises';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const schemaPath = path.join(rootDir, 'src', 'shared', 'schema.sql');

const databasePath = process.env.DATABASE_PATH || path.join(rootDir, 'data', 'polymarket.db');
const databaseDir = path.dirname(databasePath);

await mkdir(databaseDir, { recursive: true });

const schemaSql = fs.readFileSync(schemaPath, 'utf8');
const db = new BetterSqlite3(databasePath);

try {
  db.exec(schemaSql);
  console.log(`Database initialized at ${databasePath}`);
} finally {
  db.close();
}
