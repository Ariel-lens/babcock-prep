import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from './db.js';
import type { Role } from '@prisma/client';

export type AuthRequest = Request & {
  user?: {
    id: string;
    role: Role;
    classId: string | null;
    sectionId: string | null;
  };
};

export function signToken(user: { id: string; role: Role }) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters.');
  }
  return jwt.sign({ sub: user.id, role: user.role }, secret, {
    expiresIn: '12h',
    issuer: 'babcock-prep'
  });
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const header = req.header('authorization');
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Sign in required.' });
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ error: 'Server authentication is not configured.' });
    }
    const payload = jwt.verify(header.slice(7), secret, { issuer: 'babcock-prep' }) as jwt.JwtPayload;
    if (typeof payload.sub !== 'string') {
      return res.status(401).json({ error: 'Invalid session.' });
    }
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, classId: true, sectionId: true }
    });
    if (!user) {
      return res.status(401).json({ error: 'Account not found.' });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired or invalid.' });
  }
}

export function allowRoles(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission for this action.' });
    }
    next();
  };
}
