import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const classes = ['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3'];
const sections = ['A', 'B', 'C', 'D', 'Gold', 'Diamond'];

const subjectsByLevel: Record<string, string[]> = {
  JSS1: ['Mathematics', 'English Language', 'Basic Science', 'Basic Technology', 'Social Studies', 'Civic Education', 'Business Studies', 'Computer Studies', 'Agricultural Science', 'Christian Religious Studies', 'Physical and Health Education', 'Home Economics'],
  JSS2: ['Mathematics', 'English Language', 'Basic Science', 'Basic Technology', 'Social Studies', 'Civic Education', 'Business Studies', 'Computer Studies', 'Agricultural Science', 'Christian Religious Studies', 'Physical and Health Education', 'Home Economics'],
  JSS3: ['Mathematics', 'English Language', 'Basic Science', 'Basic Technology', 'Social Studies', 'Civic Education', 'Business Studies', 'Computer Studies', 'Agricultural Science', 'Christian Religious Studies', 'Physical and Health Education', 'Home Economics'],
  SS1: ['Mathematics', 'English Language', 'Biology', 'Chemistry', 'Physics', 'Economics', 'Government', 'Literature in English', 'Commerce', 'Accounting', 'Geography', 'Computer Studies'],
  SS2: ['Mathematics', 'English Language', 'Biology', 'Chemistry', 'Physics', 'Economics', 'Government', 'Literature in English', 'Commerce', 'Accounting', 'Geography', 'Computer Studies'],
  SS3: ['Mathematics', 'English Language', 'Biology', 'Chemistry', 'Physics', 'Economics', 'Government', 'Literature in English', 'Commerce', 'Accounting', 'Geography', 'Computer Studies']
};

async function main() {
  for (const name of classes) {
    const schoolClass = await prisma.schoolClass.upsert({
      where: { name },
      update: {},
      create: { name }
    });
    for (const sectionName of sections) {
      await prisma.section.upsert({
        where: { name_classId: { name: sectionName, classId: schoolClass.id } },
        update: {},
        create: { name: sectionName, classId: schoolClass.id }
      });
    }
    for (const subjectName of subjectsByLevel[name]) {
      await prisma.subject.upsert({
        where: { name_classId: { name: subjectName, classId: schoolClass.id } },
        update: {},
        create: { name: subjectName, classId: schoolClass.id }
      });
    }
  }

  const jss1 = await prisma.schoolClass.findUniqueOrThrow({ where: { name: 'JSS1' } });
  const jss1A = await prisma.section.findUniqueOrThrow({ where: { name_classId: { name: 'A', classId: jss1.id } } });
  const ss3 = await prisma.schoolClass.findUniqueOrThrow({ where: { name: 'SS3' } });

  const adminPass = await bcrypt.hash('AdminPass123!', 12);
  const teacherPass = await bcrypt.hash('TeacherPass123!', 12);
  const studentPass = await bcrypt.hash('StudentPass123!', 12);
  const parentPass = await bcrypt.hash('ParentPass123!', 12);

  await prisma.user.upsert({
    where: { email: 'admin@babcockprep.edu.ng' },
    update: {},
    create: {
      fullName: 'Principal Babcock Admin',
      email: 'admin@babcockprep.edu.ng',
      phone: '+2348000000001',
      passwordHash: adminPass,
      role: 'ADMIN'
    }
  });

  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@babcockprep.edu.ng' },
    update: {},
    create: {
      fullName: 'Mr. Adeyemi Okafor',
      email: 'teacher@babcockprep.edu.ng',
      phone: '+2348000000002',
      passwordHash: teacherPass,
      role: 'TEACHER'
    }
  });

  const student = await prisma.user.upsert({
    where: { email: 'student@babcockprep.edu.ng' },
    update: {},
    create: {
      fullName: 'David Mensah',
      email: 'student@babcockprep.edu.ng',
      phone: '+2348000000003',
      passwordHash: studentPass,
      role: 'STUDENT',
      studentId: 'BP/JSS1A/000001',
      classId: jss1.id,
      sectionId: jss1A.id,
      bpCoins: 250,
      streakDays: 7
    }
  });

  const parent = await prisma.user.upsert({
    where: { email: 'parent@babcockprep.edu.ng' },
    update: {},
    create: {
      fullName: 'Mrs. Grace Mensah',
      email: 'parent@babcockprep.edu.ng',
      phone: '+2348000000004',
      passwordHash: parentPass,
      role: 'PARENT'
    }
  });

  await prisma.parentChild.upsert({
    where: { parentId_childId: { parentId: parent.id, childId: student.id } },
    update: {},
    create: { parentId: parent.id, childId: student.id, verifiedAt: new Date() }
  });

  // Seed starter materials and CBT exams for JSS1 and SS3 (Phase 1 MVP classes)
  const jss1Maths = await prisma.subject.findUniqueOrThrow({ where: { name_classId: { name: 'Mathematics', classId: jss1.id } } });
  const jss1Eng = await prisma.subject.findUniqueOrThrow({ where: { name_classId: { name: 'English Language', classId: jss1.id } } });
  const ss3Eng = await prisma.subject.findUniqueOrThrow({ where: { name_classId: { name: 'English Language', classId: ss3.id } } });

  const existingMaterial = await prisma.learningMaterial.findFirst({ where: { title: 'Number Base & Whole Numbers (Week 1)' } });
  if (!existingMaterial) {
    await prisma.learningMaterial.createMany({
      data: [
        {
          title: 'Number Base & Whole Numbers (Week 1)',
          description: 'Complete JSS1 lesson note covering place value, binary conversions, and worked examples.',
          type: 'NOTE',
          url: 'https://www.khanacademy.org/math/cc-sixth-grade-math',
          topic: 'Number & Numeration',
          classId: jss1.id,
          subjectId: jss1Maths.id,
          createdById: teacher.id,
          published: true
        },
        {
          title: 'Parts of Speech & Sentence Structure',
          description: 'Babcock Prep core grammar guide with examples for JSS1 students.',
          type: 'NOTE',
          url: 'https://owl.purdue.edu/owl/general_writing/grammar/index.html',
          topic: 'Grammar Foundations',
          classId: jss1.id,
          subjectId: jss1Eng.id,
          createdById: teacher.id,
          published: true
        },
        {
          title: 'JAMB & WAEC Lexis and Structure Mastery',
          description: 'High-yield idioms, concord rules, and oral English drills for SS3 candidates.',
          type: 'NOTE',
          url: 'https://owl.purdue.edu/owl/general_writing/grammar/index.html',
          topic: 'SS3 Exam Prep',
          classId: ss3.id,
          subjectId: ss3Eng.id,
          createdById: teacher.id,
          published: true
        }
      ]
    });
  }

  const existingExam = await prisma.exam.findFirst({ where: { title: 'JSS1 Mathematics Diagnostic CBT' } });
  if (!existingExam) {
    await prisma.exam.create({
      data: {
        title: 'JSS1 Mathematics Diagnostic CBT',
        instructions: 'Answer all questions carefully. Switching tabs twice will auto-submit your exam.',
        mode: 'PRACTICE',
        status: 'PUBLISHED',
        durationMinutes: 15,
        classId: jss1.id,
        subjectId: jss1Maths.id,
        createdById: teacher.id,
        questions: {
          create: [
            {
              type: 'CBT',
              prompt: 'Convert the binary number 1011₂ to base 10.',
              options: { A: '9', B: '10', C: '11', D: '13' },
              correctAnswer: 'C',
              explanation: '1×2³ + 0×2² + 1×2¹ + 1×2⁰ = 8 + 0 + 2 + 1 = 11.',
              marks: 5,
              order: 1
            },
            {
              type: 'CBT',
              prompt: 'What is the place value of 7 in 4,782,190?',
              options: { A: '70,000', B: '700,000', C: '7,000', D: '7,000,000' },
              correctAnswer: 'B',
              explanation: '7 is in the hundred-thousands column, so its value is 700,000.',
              marks: 5,
              order: 2
            },
            {
              type: 'CBT',
              prompt: 'Simplify: 3x + 5x - 2x',
              options: { A: '6x', B: '8x', C: '10x', D: '6' },
              correctAnswer: 'A',
              explanation: '(3 + 5 - 2)x = 6x.',
              marks: 5,
              order: 3
            },
            {
              type: 'CBT',
              prompt: 'Find the LCM of 12 and 18.',
              options: { A: '6', B: '24', C: '36', D: '72' },
              correctAnswer: 'C',
              explanation: 'Multiples of 18: 18, 36... 12 divides 36 evenly, so LCM = 36.',
              marks: 5,
              order: 4
            }
          ]
        }
      }
    });
  }

  const existingSs3Exam = await prisma.exam.findFirst({ where: { title: 'SS3 English Language JAMB Mock CBT' } });
  if (!existingSs3Exam) {
    await prisma.exam.create({
      data: {
        title: 'SS3 English Language JAMB Mock CBT',
        instructions: 'Select the option that best completes each sentence.',
        mode: 'TIMED',
        status: 'PUBLISHED',
        durationMinutes: 20,
        classId: ss3.id,
        subjectId: ss3Eng.id,
        createdById: teacher.id,
        questions: {
          create: [
            {
              type: 'CBT',
              prompt: 'Neither the principal nor the teachers _____ aware of the sudden inspection.',
              options: { A: 'was', B: 'were', C: 'is', D: 'has been' },
              correctAnswer: 'B',
              explanation: 'Under the rule of proximity with "neither...nor", the verb agrees with the nearer plural subject "teachers".',
              marks: 5,
              order: 1
            },
            {
              type: 'CBT',
              prompt: 'Choose the word nearest in meaning to "EPHEMERAL":',
              options: { A: 'Eternal', B: 'Short-lived', C: 'Dangerous', D: 'Transparent' },
              correctAnswer: 'B',
              explanation: 'Ephemeral means lasting for a very short time.',
              marks: 5,
              order: 2
            },
            {
              type: 'CBT',
              prompt: 'The committee has submitted _____ report to the board.',
              options: { A: 'their', B: 'its', C: 'it’s', D: 'there' },
              correctAnswer: 'B',
              explanation: 'Acting as a single unit ("has submitted"), collective noun "committee" takes the singular pronoun "its".',
              marks: 5,
              order: 3
            }
          ]
        }
      }
    });
  }

  console.log('Babcock Prep seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
