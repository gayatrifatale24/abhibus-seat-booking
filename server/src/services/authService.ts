import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '../errors.js';
import type { UserRepository } from '../repositories/userRepository.js';

export interface AuthUser { id: number; name: string; email: string }
interface TokenPayload { sub: string; name: string; email: string }

export function createAuthService(users: UserRepository, opts: { secret: string; expiresIn: jwt.SignOptions['expiresIn'] }) {
  const issue = (u: AuthUser) => ({
    token: jwt.sign({ name: u.name, email: u.email }, opts.secret, { subject: String(u.id), expiresIn: opts.expiresIn }),
    user: u,
  });
  return {
    register(name: string, email: string, password: string) {
      if (users.findByEmail(email)) throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
      const u = users.create(name, email, bcrypt.hashSync(password, 10));
      return issue({ id: u.id, name: u.name, email: u.email });
    },
    login(email: string, password: string) {
      const u = users.findByEmail(email);
      // Same error for unknown email and wrong password to avoid account enumeration.
      if (!u || !bcrypt.compareSync(password, u.passwordHash)) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
      return issue({ id: u.id, name: u.name, email: u.email });
    },
    verify(token: string): AuthUser {
      try {
        const p = jwt.verify(token, opts.secret) as unknown as TokenPayload;
        return { id: Number(p.sub), name: p.name, email: p.email };
      } catch {
        throw new AppError(401, 'INVALID_TOKEN', 'Session expired or invalid, please log in again');
      }
    },
  };
}
export type AuthService = ReturnType<typeof createAuthService>;
