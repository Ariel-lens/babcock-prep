import { Router } from 'express';
import { prisma } from '../db.js';
import { z } from 'zod';
import { allowRoles, requireAuth, type AuthRequest } from '../auth.js';

const router = Router();
router.use(requireAuth);

// Overview metrics & class structure
router.get('/dashboard', async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        class: true,
        section: true
      }
    });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (user.role === 'STUDENT' && user.classId) {
      const [subjects, materialsCount, exams, submissions] = await Promise.all([
        prisma.subject.findMany({
          where: { classId: user.classId },
          orderBy: { name: 'asc' },
          include: {
            _count: { select: { materials: true, exams: true } }
          }
        }),
        prisma.learningMaterial.count({ where: { classId: user.classId, published: true } }),
        prisma.exam.findMany({
          where: { classId: user.classId, status: 'PUBLISHED' },
          orderBy: { createdAt: 'desc' },
          include: {
            subject: { select: { name: true } },
            _count: { select: { questions: true } }
          }
        }),
        prisma.submission.findMany({
          where: { userId: user.id, status: { in: ['SUBMITTED', 'GRADED'] } },
          orderBy: { submittedAt: 'desc' },
          include: {
            exam: { select: { title: true, subject: { select: { name: true } } } }
          }
        })
      ]);

      const avgScore = submissions.length
        ? Math.round(
            submissions.reduce(
              (acc, s) => acc + (s.totalMarks ? ((s.score ?? 0) / s.totalMarks) * 100 : 0),
              0
            ) / submissions.length
          )
        : 0;

      return res.json({
        stats: {
          streakDays: user.streakDays,
          bpCoins: user.bpCoins,
          cbtAverage: avgScore,
          materialsCount,
          examsCompleted: submissions.length
        },
        subjects,
        upcomingExams: exams,
        recentSubmissions: submissions.slice(0, 5)
      });
    }

    // Teacher / Admin / Parent overview
    const [totalStudents, totalExams, totalMaterials, recentSubmissions] = await Promise.all([
      prisma.user.count({ where: { role: 'STUDENT' } }),
      prisma.exam.count(),
      prisma.learningMaterial.count(),
      prisma.submission.findMany({
        where: { status: { in: ['SUBMITTED', 'GRADED'] } },
        orderBy: { submittedAt: 'desc' },
        take: 10,
        include: {
          user: { select: { fullName: true, studentId: true, class: { select: { name: true } } } },
          exam: { select: { title: true, subject: { select: { name: true } } } }
        }
      })
    ]);

    return res.json({
      stats: { totalStudents, totalExams, totalMaterials },
      recentSubmissions
    });
  } catch (error) {
    next(error);
  }
});

// Class-scoped subjects
router.get('/subjects', async (req: AuthRequest, res, next) => {
  try {
    const classId =
      req.user!.role === 'STUDENT'
        ? req.user!.classId
        : typeof req.query.classId === 'string'
          ? req.query.classId
          : undefined;
    if (!classId) return res.status(400).json({ error: 'Choose a class to view subjects.' });
    const subjects = await prisma.subject.findMany({
      where: { classId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        class: { select: { name: true } },
        _count: { select: { materials: true, exams: true } }
      }
    });
    res.json({ subjects });
  } catch (error) {
    next(error);
  }
});

// Learning materials
router.get('/materials', async (req: AuthRequest, res, next) => {
  try {
    const classId =
      req.user!.role === 'STUDENT'
        ? req.user!.classId
        : typeof req.query.classId === 'string'
          ? req.query.classId
          : undefined;
    const where = classId ? { classId, published: true } : { published: true };
    const materials = await prisma.learningMaterial.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        url: true,
        topic: true,
        createdAt: true,
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } }
      }
    });
    res.json({ materials });
  } catch (error) {
    next(error);
  }
});

router.post('/materials', allowRoles('TEACHER', 'ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      title: z.string().trim().min(3).max(160),
      description: z.string().trim().max(1000).optional(),
      type: z.enum(['NOTE', 'VIDEO', 'AUDIO', 'LINK']).default('NOTE'),
      url: z.string().trim().url(),
      topic: z.string().trim().max(120).optional(),
      classId: z.string().min(1),
      subjectId: z.string().min(1)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Provide a valid title, URL, class, and subject.' });
    }
    const material = await prisma.learningMaterial.create({
      data: {
        ...parsed.data,
        createdById: req.user!.id,
        published: true
      },
      include: {
        class: { select: { name: true } },
        subject: { select: { name: true } }
      }
    });
    res.status(201).json({ material });
  } catch (error) {
    next(error);
  }
});

// Exams list
router.get('/exams', async (req: AuthRequest, res, next) => {
  try {
    const classId =
      req.user!.role === 'STUDENT'
        ? req.user!.classId
        : typeof req.query.classId === 'string'
          ? req.query.classId
          : undefined;

    const where =
      req.user!.role === 'STUDENT'
        ? { classId: classId!, status: 'PUBLISHED' as const }
        : classId
          ? { classId }
          : {};

    const exams = await prisma.exam.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        instructions: true,
        mode: true,
        status: true,
        durationMinutes: true,
        startsAt: true,
        endsAt: true,
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        _count: { select: { questions: true } }
      }
    });
    res.json({ exams });
  } catch (error) {
    next(error);
  }
});

// Teacher/Admin create exam
router.post('/exams', allowRoles('TEACHER', 'ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const { title, instructions, mode = 'PRACTICE', durationMinutes = 30, classId, subjectId } = req.body ?? {};
    if (
      typeof title !== 'string' ||
      title.trim().length < 3 ||
      typeof classId !== 'string' ||
      typeof subjectId !== 'string' ||
      !['PRACTICE', 'TIMED'].includes(mode) ||
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 1 ||
      durationMinutes > 240
    ) {
      return res.status(400).json({
        error: 'Provide a title, valid class/subject, mode and duration (1–240 minutes).'
      });
    }
    const subject = await prisma.subject.findFirst({ where: { id: subjectId, classId } });
    if (!subject) {
      return res.status(400).json({ error: 'That subject does not belong to the selected class.' });
    }
    const exam = await prisma.exam.create({
      data: {
        title: title.trim(),
        instructions: typeof instructions === 'string' ? instructions.slice(0, 2000) : null,
        mode,
        durationMinutes,
        classId,
        subjectId,
        createdById: req.user!.id
      },
      select: { id: true, title: true, mode: true, status: true, durationMinutes: true }
    });
    res.status(201).json({ exam });
  } catch (error) {
    next(error);
  }
});

// Publish exam
router.post('/exams/:id/publish', allowRoles('TEACHER', 'ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const exam = await prisma.exam.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { questions: true } } }
    });
    if (!exam) return res.status(404).json({ error: 'Exam not found.' });
    if (req.user!.role === 'TEACHER' && exam.createdById !== req.user!.id) {
      return res.status(403).json({ error: 'Teachers can only publish their own exams.' });
    }
    if (exam._count.questions < 1) {
      return res.status(400).json({ error: 'Add at least one question before publishing.' });
    }
    const published = await prisma.exam.update({
      where: { id: exam.id },
      data: { status: 'PUBLISHED' },
      select: { id: true, title: true, status: true }
    });
    res.json({ exam: published });
  } catch (error) {
    next(error);
  }
});

// Add question to exam
router.post('/exams/:id/questions', allowRoles('TEACHER', 'ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const exam = await prisma.exam.findUnique({ where: { id: req.params.id } });
    if (!exam) return res.status(404).json({ error: 'Exam not found.' });
    if (req.user!.role === 'TEACHER' && exam.createdById !== req.user!.id) {
      return res.status(403).json({ error: 'Teachers can only edit their own exams.' });
    }
    if (exam.status !== 'DRAFT') {
      return res.status(409).json({ error: 'Published exams cannot be edited.' });
    }
    const { prompt, options, correctAnswer, explanation, marks = 5, order = 0, type = 'CBT' } = req.body ?? {};
    if (
      typeof prompt !== 'string' ||
      prompt.trim().length < 3 ||
      !['CBT', 'THEORY'].includes(type) ||
      !Number.isFinite(marks) ||
      marks <= 0
    ) {
      return res.status(400).json({ error: 'Invalid question details.' });
    }
    if (
      type === 'CBT' &&
      (!options ||
        typeof options !== 'object' ||
        Array.isArray(options) ||
        !['A', 'B', 'C', 'D'].every((k) => typeof options[k] === 'string' && options[k].trim().length > 0) ||
        !['A', 'B', 'C', 'D'].includes(correctAnswer))
    ) {
      return res.status(400).json({
        error: 'CBT questions need options A–D and a correctAnswer of A, B, C or D.'
      });
    }
    const question = await prisma.question.create({
      data: {
        examId: exam.id,
        prompt: prompt.trim(),
        options: type === 'CBT' ? options : undefined,
        correctAnswer: type === 'CBT' ? correctAnswer : null,
        explanation: typeof explanation === 'string' ? explanation.slice(0, 2000) : null,
        marks,
        order,
        type
      },
      select: { id: true, prompt: true, type: true, marks: true, order: true }
    });
    res.status(201).json({ question });
  } catch (error) {
    next(error);
  }
});

// Student start CBT exam (with question shuffle per blueprint)
router.post('/exams/:id/start', allowRoles('STUDENT'), async (req: AuthRequest, res, next) => {
  try {
    const exam = await prisma.exam.findFirst({
      where: { id: req.params.id, classId: req.user!.classId!, status: 'PUBLISHED' },
      include: {
        subject: { select: { name: true } },
        questions: {
          orderBy: { order: 'asc' },
          select: { id: true, prompt: true, options: true, marks: true, order: true, type: true }
        }
      }
    });
    if (!exam) return res.status(404).json({ error: 'Published exam not found for your class.' });
    if (exam.mode === 'TIMED' && exam.endsAt && exam.endsAt < new Date()) {
      return res.status(403).json({ error: 'This exam has closed.' });
    }

    const existing = await prisma.submission.findFirst({
      where: { userId: req.user!.id, examId: exam.id, status: 'IN_PROGRESS' }
    });
    const submission =
      existing ??
      (await prisma.submission.create({
        data: {
          userId: req.user!.id,
          examId: exam.id,
          totalMarks: exam.questions.reduce((sum, q) => sum + q.marks, 0)
        }
      }));

    // Shuffle questions for anti-cheat per blueprint
    const shuffled = [...exam.questions].sort(() => Math.random() - 0.5);

    res.json({
      submissionId: submission.id,
      startedAt: submission.startedAt,
      exam: {
        id: exam.id,
        title: exam.title,
        instructions: exam.instructions,
        subject: exam.subject.name,
        mode: exam.mode,
        durationMinutes: exam.durationMinutes,
        questions: shuffled
      }
    });
  } catch (error) {
    next(error);
  }
});

// Submit CBT exam & return instant graded breakdown + explanations
router.post('/submissions/:id/submit', allowRoles('STUDENT'), async (req: AuthRequest, res, next) => {
  try {
    const answersSchema = z
      .array(z.object({ questionId: z.string().min(1), response: z.enum(['A', 'B', 'C', 'D']).nullable() }))
      .max(500);
    const parsed = answersSchema.safeParse(req.body?.answers);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Answers must be a list of question IDs and selected options A–D.' });
    }
    const tabLeaves = typeof req.body?.tabLeaves === 'number' ? Math.max(0, Math.floor(req.body.tabLeaves)) : 0;

    const submission = await prisma.submission.findFirst({
      where: { id: req.params.id, userId: req.user!.id, status: 'IN_PROGRESS' },
      include: { exam: { include: { questions: { orderBy: { order: 'asc' } } } } }
    });
    if (!submission) return res.status(404).json({ error: 'Active submission not found.' });
    if (submission.exam.classId !== req.user!.classId) {
      return res.status(403).json({ error: 'This exam is not assigned to your class.' });
    }

    const answerMap = new Map(parsed.data.map((a) => [a.questionId, a.response]));
    let score = 0;
    let totalMarks = 0;
    const review: Array<{
      questionId: string;
      prompt: string;
      selected: string | null;
      correctAnswer: string | null;
      explanation: string | null;
      isCorrect: boolean;
    }> = [];

    const writes = submission.exam.questions.map((q) => {
      const response = answerMap.get(q.id) ?? null;
      const isCorrect = q.type === 'CBT' && response === q.correctAnswer;
      const awarded = isCorrect ? q.marks : 0;
      totalMarks += q.marks;
      score += awarded;
      review.push({
        questionId: q.id,
        prompt: q.prompt,
        selected: response,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        isCorrect
      });
      return prisma.answer.upsert({
        where: { submissionId_questionId: { submissionId: submission.id, questionId: q.id } },
        create: { submissionId: submission.id, questionId: q.id, response, awardedMarks: awarded },
        update: { response, awardedMarks: awarded }
      });
    });

    await prisma.$transaction(writes);
    const coinsEarned = Math.max(10, Math.round((score / (totalMarks || 1)) * 50));
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { bpCoins: { increment: coinsEarned } }
    });

    const saved = await prisma.submission.update({
      where: { id: submission.id },
      data: { status: 'SUBMITTED', submittedAt: new Date(), score, totalMarks, tabLeaves },
      select: { id: true, status: true, score: true, totalMarks: true, submittedAt: true, tabLeaves: true }
    });

    res.json({
      submission: saved,
      percentage: totalMarks ? Math.round((score / totalMarks) * 100) : 0,
      coinsEarned,
      review
    });
  } catch (error) {
    next(error);
  }
});

// Results endpoint (Student, Teacher/Admin, and Parent via verified ParentChild link)
router.get('/results', async (req: AuthRequest, res, next) => {
  try {
    if (req.user!.role === 'PARENT') {
      const links = await prisma.parentChild.findMany({
        where: { parentId: req.user!.id },
        include: {
          child: {
            select: {
              id: true,
              fullName: true,
              studentId: true,
              streakDays: true,
              bpCoins: true,
              class: { select: { name: true } },
              section: { select: { name: true } }
            }
          }
        }
      });
      const childIds = links.map((l) => l.childId);
      const results = childIds.length
        ? await prisma.submission.findMany({
            where: { userId: { in: childIds }, status: { in: ['SUBMITTED', 'GRADED'] } },
            orderBy: { submittedAt: 'desc' },
            include: {
              user: { select: { fullName: true, studentId: true } },
              exam: { select: { title: true, subject: { select: { name: true } } } }
            }
          })
        : [];
      return res.json({ children: links.map((l) => l.child), results });
    }

    const where =
      req.user!.role === 'STUDENT'
        ? { userId: req.user!.id, status: { in: ['SUBMITTED', 'GRADED'] as ('SUBMITTED' | 'GRADED')[] } }
        : { status: { in: ['SUBMITTED', 'GRADED'] as ('SUBMITTED' | 'GRADED')[] } };

    const results = await prisma.submission.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        score: true,
        totalMarks: true,
        submittedAt: true,
        status: true,
        tabLeaves: true,
        exam: { select: { title: true, subject: { select: { name: true } } } },
        ...(req.user!.role === 'STUDENT'
          ? {}
          : {
              user: {
                select: {
                  fullName: true,
                  studentId: true,
                  class: { select: { name: true } },
                  section: { select: { name: true } }
                }
              }
            })
      } as any
    });
    res.json({ results });
  } catch (error) {
    next(error);
  }
});

// Parent link child by Student ID
router.post('/parent/link-child', allowRoles('PARENT'), async (req: AuthRequest, res, next) => {
  try {
    const studentId = typeof req.body?.studentId === 'string' ? req.body.studentId.trim().toUpperCase() : '';
    if (!studentId) return res.status(400).json({ error: 'Enter a valid Student ID (e.g. BP/JSS1A/000001).' });
    const child = await prisma.user.findUnique({ where: { studentId } });
    if (!child || child.role !== 'STUDENT') {
      return res.status(404).json({ error: 'No student found with that Student ID.' });
    }
    await prisma.parentChild.upsert({
      where: { parentId_childId: { parentId: req.user!.id, childId: child.id } },
      update: { verifiedAt: new Date() },
      create: { parentId: req.user!.id, childId: child.id, verifiedAt: new Date() }
    });
    res.json({
      message: `Linked to ${child.fullName} (${child.studentId}).`,
      child: { id: child.id, fullName: child.fullName, studentId: child.studentId }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
