import Database from 'better-sqlite3';
import { migrate } from './schema.js';

export type DB = Database.Database;

export function openDb(file: string): DB {
  const db = new Database(file);
  migrate(db);
  return db;
}
