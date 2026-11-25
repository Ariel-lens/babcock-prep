import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, signToken, type AuthRequest } from '../auth.js';

const router = Router();

const signupSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform((v) => v.toLowerCase()),
  phone: z.string().trim().max(30).optional(),
  password: z.string().min(8).max(128),
  role: z.enum(['STUDENT', 'TEACHER', 'PARENT']).default('STUDENT'),
  className: z.enum(['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3']).optional(),
  sectionName: z.string().trim().min(1).max(30).optional(),
  childStudentId: z.string().trim().max(40).optional()
});

router.get('/classes', async (_req, res, next) => {
  try {
    const classes = await prisma.schoolClass.findMany({
      orderBy: { name: 'asc' },
      include: {
        sections: { orderBy: { name: 'asc' }, select: { id: true, name: true } },
        subjects: { orderBy: { name: 'asc' }, select: { id: true, name: true } }
      }
    });
    res.json({ classes });
  } catch (error) {
    next(error);
  }
});

router.post('/register', async (req, res, next) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Check your details. Password must be at least 8 characters.',
        details: parsed.error.flatten()
      });
    }
    const data = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    let classId: string | null = null;
    let sectionId: string | null = null;

    if (data.role === 'STUDENT') {
      if (!data.className || !data.sectionName) {
        return res.status(400).json({ error: 'Students must select a class and section.' });
      }
      const schoolClass = await prisma.schoolClass.findUnique({
        where: { name: data.className },
        include: { sections: true }
      });
      if (!schoolClass) {
        return res.status(400).json({ error: 'Selected class is not configured.' });
      }
      const section = schoolClass.sections.find(
        (s) => s.name.toLowerCase() === data.sectionName!.toLowerCase()
      );
      if (!section) {
        return res.status(400).json({ error: 'Selected section is not configured for this class.' });
      }
      classId = schoolClass.id;
      sectionId = section.id;
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const created = await prisma.user.create({
      data: {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        passwordHash,
        role: data.role,
        classId,
        sectionId
      }
    });

    let studentId: string | null = null;
    if (data.role === 'STUDENT' && data.className && data.sectionName) {
      studentId = `BP/${data.className}${data.sectionName.toUpperCase()}/${created.id.slice(-6).toUpperCase()}`;
      await prisma.user.update({
        where: { id: created.id },
        data: { studentId }
      });
    }

    if (data.role === 'PARENT' && data.childStudentId) {
      const child = await prisma.user.findUnique({
        where: { studentId: data.childStudentId.toUpperCase() }
      });
      if (child && child.role === 'STUDENT') {
        await prisma.parentChild.create({
          data: { parentId: created.id, childId: child.id, verifiedAt: new Date() }
        });
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: created.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        studentId: true,
        bpCoins: true,
        streakDays: true,
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } }
      }
    });

    res.status(201).json({ token: signToken(created), user });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const schema = z.object({
      email: z.string().email().transform((v) => v.toLowerCase()),
      password: z.string().min(1),
      role: z.enum(['STUDENT', 'TEACHER', 'PARENT', 'ADMIN']).optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Enter a valid email and password.' });
    }
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      include: {
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } }
      }
    });
    if (
      !user ||
      !(await bcrypt.compare(parsed.data.password, user.passwordHash)) ||
      (parsed.data.role && user.role !== parsed.data.role)
    ) {
      return res.status(401).json({ error: 'Email, password, or portal role is incorrect.' });
    }
    const { passwordHash: _, ...safeUser } = user;
    res.json({ token: signToken(user), user: safeUser });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        studentId: true,
        bpCoins: true,
        streakDays: true,
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } }
      }
    });
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

export default router;
