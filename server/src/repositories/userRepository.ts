import type { DB } from '../db/connection.js';
import type { User } from '../types.js';

export function createUserRepository(db: DB) {
  const byEmail = db.prepare('SELECT id, name, email, password_hash AS passwordHash FROM users WHERE email = ?');
  const byId = db.prepare('SELECT id, name, email, password_hash AS passwordHash FROM users WHERE id = ?');
  const insert = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)');
  return {
    findByEmail: (email: string) => byEmail.get(email.toLowerCase()) as User | undefined,
    findById: (id: number) => byId.get(id) as User | undefined,
    create: (name: string, email: string, passwordHash: string): User => {
      const id = Number(insert.run(name, email.toLowerCase(), passwordHash).lastInsertRowid);
      return { id, name, email: email.toLowerCase(), passwordHash };
    },
  };
}
export type UserRepository = ReturnType<typeof createUserRepository>;
