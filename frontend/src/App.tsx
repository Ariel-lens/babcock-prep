import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  BrainCircuit,
  Calculator,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  ExternalLink,
  Flag,
  GraduationCap,
  LayoutDashboard,
  LibraryBig,
  LogIn,
  LogOut,
  Menu,
  PlayCircle,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  X
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');

type PortalRole = 'Student' | 'Teacher' | 'Parent' | 'Admin';

interface ClassInfo {
  id: string;
  name: string;
  sections: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
}

interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: 'STUDENT' | 'TEACHER' | 'PARENT' | 'ADMIN';
  studentId?: string | null;
  bpCoins?: number;
  streakDays?: number;
  class?: { id: string; name: string } | null;
  section?: { id: string; name: string } | null;
}

interface ExamItem {
  id: string;
  title: string;
  instructions?: string | null;
  mode: 'PRACTICE' | 'TIMED';
  status?: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  durationMinutes: number;
  class?: { id: string; name: string };
  subject: { id?: string; name: string };
  _count: { questions: number };
}

interface ActiveQuestion {
  id: string;
  prompt: string;
  options: Record<'A' | 'B' | 'C' | 'D', string>;
  marks: number;
  order: number;
  type: 'CBT' | 'THEORY';
}

interface ActiveExamSession {
  submissionId: string;
  exam: {
    id: string;
    title: string;
    instructions?: string | null;
    subject: string;
    mode: 'PRACTICE' | 'TIMED';
    durationMinutes: number;
    questions: ActiveQuestion[];
  };
}

interface GradedReview {
  submission: { id: string; score: number; totalMarks: number; tabLeaves: number };
  percentage: number;
  coinsEarned: number;
  review: {
    questionId: string;
    prompt: string;
    selected: string | null;
    correctAnswer: string | null;
    explanation: string | null;
    isCorrect: boolean;
  }[];
}

const fallbackSubjects = [
  { id: '1', name: 'Mathematics', detail: '12 topics · Core curriculum', icon: '∑', color: 'blue', progress: 72 },
  { id: '2', name: 'English Language', detail: '9 topics · Grammar & Essay', icon: 'Aa', color: 'violet', progress: 58 },
  { id: '3', name: 'Basic Science', detail: '8 topics · Lab & Theory', icon: '⚛', color: 'cyan', progress: 84 },
  { id: '4', name: 'Social Studies', detail: '7 topics · Civic & Society', icon: '◎', color: 'purple', progress: 46 }
];

const navItems = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Learning World', icon: BookOpen },
  { label: 'CBT Exam Hall', icon: ClipboardList },
  { label: 'My Results', icon: Activity },
  { label: 'E-Library', icon: LibraryBig }
];

const colors = ['blue', 'violet', 'cyan', 'purple'];
const icons = ['∑', 'Aa', '⚛', '◎', '◈', '✦'];

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('bp_token'));
  const [user, setUser] = useState<UserProfile | null>(null);
  const [classes, setClasses] = useState<ClassInfo[]>([]);

  const [role, setRole] = useState<PortalRole>('Student');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [page, setPage] = useState('Overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showMelody, setShowMelody] = useState(false);

  // Auth form fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedClass, setSelectedClass] = useState('JSS1');
  const [selectedSection, setSelectedSection] = useState('A');
  const [childStudentId, setChildStudentId] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');

  // App data
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [dashStats, setDashStats] = useState<any>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [children, setChildren] = useState<any[]>([]);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('ALL');

  // CBT Engine State
  const [activeSession, setActiveSession] = useState<ActiveExamSession | null>(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [tabLeaves, setTabLeaves] = useState(0);
  const [showCalc, setShowCalc] = useState(false);
  const [calcExpr, setCalcExpr] = useState('');
  const [gradedResult, setGradedResult] = useState<GradedReview | null>(null);
  const [submittingExam, setSubmittingExam] = useState(false);

  // Teacher / Admin Builder State
  const [newMatTitle, setNewMatTitle] = useState('');
  const [newMatTopic, setNewMatTopic] = useState('');
  const [newMatType, setNewMatType] = useState<'NOTE' | 'VIDEO' | 'AUDIO' | 'LINK'>('NOTE');
  const [newMatUrl, setNewMatUrl] = useState('');
  const [newMatDesc, setNewMatDesc] = useState('');
  const [builderClassId, setBuilderClassId] = useState('');
  const [builderSubjectId, setBuilderSubjectId] = useState('');

  const [newExamTitle, setNewExamTitle] = useState('');
  const [newExamMode, setNewExamMode] = useState<'PRACTICE' | 'TIMED'>('PRACTICE');
  const [newExamDuration, setNewExamDuration] = useState(20);
  const [targetExamId, setTargetExamId] = useState('');
  const [qPrompt, setQPrompt] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [qCorrect, setQCorrect] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [qExplanation, setQExplanation] = useState('');

  // Parent Link State
  const [linkChildInput, setLinkChildInput] = useState('');

  const submitLockRef = useRef(false);

  async function apiFetch(path: string, init: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined)
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  // Load classes catalog for signup & builders
  useEffect(() => {
    fetch(`${API_BASE}/auth/classes`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.classes)) {
          setClasses(d.classes);
          if (d.classes[0]) {
            setBuilderClassId(d.classes[0].id);
            if (d.classes[0].subjects?.[0]) {
              setBuilderSubjectId(d.classes[0].subjects[0].id);
            }
          }
        }
      })
      .catch(() => {});
  }, []);

  // Load authenticated user + live workspace data
  async function loadWorkspace() {
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const meData = await apiFetch('/auth/me');
      setUser(meData.user);
      const [dash, mats, exs, resData] = await Promise.all([
        apiFetch('/dashboard'),
        apiFetch('/materials'),
        apiFetch('/exams'),
        apiFetch('/results')
      ]);
      setDashStats(dash.stats);
      setSubjects(dash.subjects || []);
      setMaterials(mats.materials || []);
      setExams(exs.exams || []);
      setResults(resData.results || []);
      if (resData.children) setChildren(resData.children);
      if (exs.exams?.[0] && !targetExamId) setTargetExamId(exs.exams[0].id);
    } catch (err) {
      localStorage.removeItem('bp_token');
      setToken(null);
      setUser(null);
      setNotice(err instanceof Error ? err.message : 'Session expired. Please sign in again.');
    }
  }

  useEffect(() => {
    loadWorkspace();
  }, [token]);

  // CBT Countdown Timer
  useEffect(() => {
    if (!activeSession) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitExam(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activeSession]);

  // CBT Anti-Cheat: Warn on first tab leave, auto-submit on 2nd leave (per blueprint)
  useEffect(() => {
    if (!activeSession) return;
    const onVisibilityChange = () => {
      if (document.hidden) {
        setTabLeaves((prev) => {
          const next = prev + 1;
          if (next >= 2) {
            setNotice('Anti-Cheat Alert: You left the exam screen twice. Exam auto-submitted.');
            handleSubmitExam(true);
          } else {
            setNotice('Warning (1/2): Leaving the exam tab is monitored. One more exit will auto-submit your test!');
          }
          return next;
        });
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [activeSession, answers]);

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthBusy(true);
    setAuthError('');
    try {
      if (authMode === 'login') {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, role: role.toUpperCase() })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Sign-in failed.');
        localStorage.setItem('bp_token', data.token);
        setToken(data.token);
        setShowLogin(false);
        setNotice(`Signed in as ${data.user.fullName} (${data.user.role}).`);
      } else {
        const res = await fetch(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName,
            email,
            phone: phone || undefined,
            password,
            role: role.toUpperCase(),
            className: role === 'Student' ? selectedClass : undefined,
            sectionName: role === 'Student' ? selectedSection : undefined,
            childStudentId: role === 'Parent' && childStudentId ? childStudentId : undefined
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed.');
        localStorage.setItem('bp_token', data.token);
        setToken(data.token);
        setShowLogin(false);
        setNotice(
          data.user.studentId
            ? `Account created! Your Student ID is ${data.user.studentId}`
            : `Account created! Welcome to BABCOCK PREP.`
        );
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Server unreachable. Check backend connection.');
    } finally {
      setAuthBusy(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('bp_token');
    setToken(null);
    setUser(null);
    setActiveSession(null);
    setGradedResult(null);
    setPage('Overview');
    setNotice('Signed out securely.');
  }

  async function startExam(examId: string) {
    if (!token) {
      setShowLogin(true);
      setNotice('Sign in as a Student to enter the CBT Exam Hall.');
      return;
    }
    try {
      const data: ActiveExamSession = await apiFetch(`/exams/${examId}/start`, { method: 'POST' });
      submitLockRef.current = false;
      setGradedResult(null);
      setAnswers({});
      setFlagged({});
      setTabLeaves(0);
      setCurrentQIndex(0);
      setSecondsLeft(data.exam.durationMinutes * 60);
      setActiveSession(data);
      setPage('CBT Exam Hall');
      setNotice('');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not start exam.');
    }
  }

  async function handleSubmitExam(auto = false) {
    if (!activeSession || submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmittingExam(true);
    try {
      const formatted = activeSession.exam.questions.map((q) => ({
        questionId: q.id,
        response: answers[q.id] ?? null
      }));
      const result: GradedReview = await apiFetch(`/submissions/${activeSession.submissionId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers: formatted, tabLeaves })
      });
      setGradedResult(result);
      setActiveSession(null);
      if (!auto) {
        setNotice(`CBT Submitted! You scored ${result.percentage}% (+${result.coinsEarned} BP Coins).`);
      }
      await loadWorkspace();
    } catch (err) {
      submitLockRef.current = false;
      setNotice(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setSubmittingExam(false);
    }
  }

  async function handleCreateMaterial(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiFetch('/materials', {
        method: 'POST',
        body: JSON.stringify({
          title: newMatTitle,
          topic: newMatTopic || undefined,
          type: newMatType,
          url: newMatUrl,
          description: newMatDesc || undefined,
          classId: builderClassId,
          subjectId: builderSubjectId
        })
      });
      setNewMatTitle('');
      setNewMatTopic('');
      setNewMatUrl('');
      setNewMatDesc('');
      setNotice('Learning material published to class!');
      await loadWorkspace();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Failed to publish material.');
    }
  }

  async function handleCreateExam(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await apiFetch('/exams', {
        method: 'POST',
        body: JSON.stringify({
          title: newExamTitle,
          mode: newExamMode,
          durationMinutes: Number(newExamDuration),
          classId: builderClassId,
          subjectId: builderSubjectId
        })
      });
      setNewExamTitle('');
      setTargetExamId(res.exam.id);
      setNotice(`Draft exam "${res.exam.title}" created! Add questions below then click Publish.`);
      await loadWorkspace();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Failed to create exam.');
    }
  }

  async function handleAddQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!targetExamId) return setNotice('Select or create a draft exam first.');
    try {
      await apiFetch(`/exams/${targetExamId}/questions`, {
        method: 'POST',
        body: JSON.stringify({
          prompt: qPrompt,
          options: { A: optA, B: optB, C: optC, D: optD },
          correctAnswer: qCorrect,
          explanation: qExplanation || undefined,
          marks: 5,
          type: 'CBT'
        })
      });
      setQPrompt('');
      setOptA('');
      setOptB('');
      setOptC('');
      setOptD('');
      setQExplanation('');
      setNotice('Question added to draft exam!');
      await loadWorkspace();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Failed to add question.');
    }
  }

  async function handlePublishExam(examId: string) {
    try {
      await apiFetch(`/exams/${examId}/publish`, { method: 'POST' });
      setNotice('Exam is now PUBLISHED and live for students in that class!');
      await loadWorkspace();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not publish exam.');
    }
  }

  async function handleLinkChild(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await apiFetch('/parent/link-child', {
        method: 'POST',
        body: JSON.stringify({ studentId: linkChildInput })
      });
      setLinkChildInput('');
      setNotice(res.message);
      await loadWorkspace();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Failed to link child.');
    }
  }

  function fillDemoAccount(demoRole: PortalRole) {
    setRole(demoRole);
    setAuthMode('login');
    const creds: Record<PortalRole, [string, string]> = {
      Student: ['student@babcockprep.edu.ng', 'StudentPass123!'],
      Teacher: ['teacher@babcockprep.edu.ng', 'TeacherPass123!'],
      Parent: ['parent@babcockprep.edu.ng', 'ParentPass123!'],
      Admin: ['admin@babcockprep.edu.ng', 'AdminPass123!']
    };
    setEmail(creds[demoRole][0]);
    setPassword(creds[demoRole][1]);
  }

  const displayName = user ? user.fullName.split(' ')[0] : 'David';
  const displaySubjects = useMemo(() => {
    const base =
      subjects.length > 0
        ? subjects.map((s: any, idx: number) => ({
            id: s.id,
            name: s.name,
            detail: `${s._count?.materials ?? 0} notes · ${s._count?.exams ?? 0} CBTs`,
            icon: icons[idx % icons.length],
            color: colors[idx % colors.length],
            progress: Math.min(100, 40 + ((idx * 17) % 55))
          }))
        : fallbackSubjects;
    return base.filter((s: any) => s.name.toLowerCase().includes(query.toLowerCase()));
  }, [subjects, query]);

  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const matchesSubject = selectedSubjectFilter === 'ALL' || m.subject?.name === selectedSubjectFilter;
      const matchesQuery =
        m.title.toLowerCase().includes(query.toLowerCase()) ||
        (m.topic || '').toLowerCase().includes(query.toLowerCase());
      return matchesSubject && matchesQuery;
    });
  }, [materials, selectedSubjectFilter, query]);

  const builderClassObj = classes.find((c) => c.id === builderClassId);
  const activeQuestion = activeSession?.exam.questions[currentQIndex];

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  function evaluateCalc() {
    try {
      if (!/^[0-9+\-*/().\s]+$/.test(calcExpr)) return setCalcExpr('Error');
      // eslint-disable-next-line no-new-func
      const val = Function(`"use strict"; return (${calcExpr})`)();
      setCalcExpr(String(Number.isFinite(val) ? Number(val.toFixed(6)) : 'Error'));
    } catch {
      setCalcExpr('Error');
    }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <BookOpen size={25} />
            <span>BP</span>
          </div>
          <div>
            <b>
              BABCOCK <em>PREP</em>
            </b>
            <small>LEARN. TEST. PASS. REPEAT.</small>
          </div>
          <button className="mobile-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <X />
          </button>
        </div>

        <div className="school-pill">
          <span className="live-dot" />
          {user ? `${user.role} PORTAL` : 'DEMO PREVIEW'}
          <ChevronRight size={14} />
        </div>

        <div className="nav-caption">WORKSPACE</div>
        <nav>
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`nav-item ${page === item.label ? 'active' : ''}`}
              onClick={() => {
                setPage(item.label);
                setMenuOpen(false);
              }}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.label === 'CBT Exam Hall' && exams.length > 0 && (
                <span className="nav-count">{exams.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="nav-caption spaced">YOUR SCHOOL</div>
        <button
          className="nav-item"
          onClick={() => setNotice('Safe Section Chat unlocks in Phase 2 after teacher moderation setup.')}
        >
          <Users size={18} />
          <span>Class Community</span>
        </button>
        <button
          className="nav-item"
          onClick={() => setNotice('Academic Calendar syncs with your school term dates.')}
        >
          <CalendarDays size={18} />
          <span>School Calendar</span>
        </button>

        <div className="sidebar-bottom">
          <div className="help-card">
         <div className="help-icon">
           <BrainCircuit size={20} />
         </div>
         <b>Need a study boost?</b>
         <p>Ask Melody AI to break down any topic in simple steps.</p>
         <button
           type="button"
           onClick={() => setShowMelody(true)}
         >
           Ask Melody AI <ArrowRight size={14} />
         </button>
       </div>

          <button className="nav-item" onClick={() => setShowLogin(true)}>
            <Settings size={18} />
            <span>{user ? 'Switch Portal' : 'Sign In / Register'}</span>
          </button>

          <div className="user-mini">
            <div className="avatar">{displayName.slice(0, 1).toUpperCase()}</div>
            <div>
              <b>{user ? user.fullName : 'David Mensah (Demo)'}</b>
              <small>
                {user?.role === 'STUDENT'
                  ? `${user.class?.name ?? 'JSS1'} · Sec ${user.section?.name ?? 'A'}`
                  : user
                    ? user.role
                    : 'Sign in to sync live data'}
              </small>
            </div>
            {user ? (
              <button title="Sign out" onClick={handleLogout}>
                <LogOut size={17} />
              </button>
            ) : (
              <button title="Sign in" onClick={() => setShowLogin(true)}>
                <LogIn size={17} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {menuOpen && <button className="scrim" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}

      <main className="main-content">
        <header className="topbar">
          <button className="menu-toggle icon-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Menu />
          </button>
          <div className="breadcrumb">
            {user?.studentId ? (
              <>
                ID: <b>{user.studentId}</b> <ChevronRight size={14} />
              </>
            ) : (
              <>
                Workspace <ChevronRight size={14} />
              </>
            )}
            <b>{page}</b>
          </div>
          <div className="top-actions">
            <div className="search-box">
              <Search size={16} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search subjects or topics..."
                aria-label="Search subjects"
              />
            </div>
            <button
              className="icon-btn notification"
              onClick={() =>
                setNotice(
                  user
                    ? `Logged in as ${user.fullName} (${user.email}).`
                    : 'Click "Account access" to sign in or create your Student ID.'
                )
              }
              aria-label="Notifications"
            >
              <Bell size={18} />
              <i />
            </button>
            <div className="top-avatar">{displayName.slice(0, 1).toUpperCase()}</div>
          </div>
        </header>

        <div className="page-wrap">
          <div className="welcome-row">
            <div>
              <div className="eyebrow">
                <Sparkles size={14} />
                {user?.class
                  ? `${user.class.name} WORLD · SECTION ${user.section?.name ?? ''}`
                  : 'YOUR PERSONAL LEARNING SPACE'}
              </div>
              <h1>
                {page === 'Overview' ? (
                  <>
                    Welcome back, <span>{displayName}</span>
                    <span className="wave">✦</span>
                  </>
                ) : (
                  page
                )}
              </h1>
              <p className="subhead">
                {page === 'Overview'
                  ? 'Small steps today. Extraordinary results tomorrow.'
                  : 'Your learning journey, organised in one place.'}
              </p>
            </div>
            <button className="outline-btn" onClick={() => setShowLogin(true)}>
              <ShieldCheck size={16} /> {user ? `${user.role} Access` : 'Account access'}
            </button>
          </div>

          {notice && (
            <div className="notice">
              <CheckCircle2 size={17} />
              <span>{notice}</span>
              <button onClick={() => setNotice('')} aria-label="Dismiss">
                <X size={16} />
              </button>
            </div>
          )}

          {/* ===================== OVERVIEW TAB ===================== */}
          {page === 'Overview' && (
            <>
              <section className="hero-banner">
                <div className="hero-orb orb-one" />
                <div className="hero-orb orb-two" />
                <div className="hero-copy">
                  <div className="hero-tag">
                    <span /> YOUR NEXT LEVEL STARTS HERE
                  </div>
                  <h2>
                    Knowledge is your
                    <br />
                    <span>superpower.</span>
                  </h2>
                  <p>
                    {user?.role === 'TEACHER' || user?.role === 'ADMIN'
                      ? 'Publish lesson notes, build timed CBT exams, and monitor student performance across JSS1–SS3.'
                      : user?.role === 'PARENT'
                        ? 'Track your child’s CBT scores, study streak, and academic progress in real time.'
                        : 'Keep your momentum going. Your next breakthrough is one lesson away.'}
                  </p>
                  <div className="hero-actions">
                    <button className="primary-btn" onClick={() => setPage('Learning World')}>
                      {user?.role === 'TEACHER' || user?.role === 'ADMIN'
                        ? 'Manage Lessons'
                        : 'Continue learning'}{' '}
                      <ArrowRight size={16} />
                    </button>
                    <button className="glass-btn" onClick={() => setPage('CBT Exam Hall')}>
                      <PlayCircle size={16} /> {user?.role === 'TEACHER' ? 'Build a CBT' : 'Start a CBT'}
                    </button>
                  </div>
                </div>
                <div className="hero-book">
                  <div className="book-glow" />
                  <BookOpen size={104} strokeWidth={1.15} />
                  <div className="book-star star-a">✦</div>
                  <div className="book-star star-b">✧</div>
                  <span>BP</span>
                </div>
                <div className="hero-foot">
                  <span>
                    <ShieldCheck size={14} /> YOUR FUTURE, YOUR PACE
                  </span>
                  <span>
                    01 <i /> 04
                  </span>
                </div>
              </section>

              <section className="stats-grid">
                <Stat
                  icon={<Trophy />}
                  label={user?.role === 'STUDENT' || !user ? 'Study streak' : 'Total students'}
                  value={
                    user?.role === 'STUDENT'
                      ? `${dashStats?.streakDays ?? user.streakDays ?? 1} days`
                      : user
                        ? String(dashStats?.totalStudents ?? 0)
                        : '7 days'
                  }
                  note="You're on fire!"
                  color="gold"
                />
                <Stat
                  icon={<ClipboardList />}
                  label={user?.role === 'STUDENT' || !user ? 'CBT average' : 'Published exams'}
                  value={
                    user?.role === 'STUDENT'
                      ? `${dashStats?.cbtAverage ?? 0}%`
                      : user
                        ? String(dashStats?.totalExams ?? exams.length)
                        : '85%'
                  }
                  note="Live tracked"
                  color="blue"
                />
                <Stat
                  icon={<BookOpen />}
                  label={user?.role === 'STUDENT' || !user ? 'Class materials' : 'Lesson notes'}
                  value={
                    user
                      ? String(dashStats?.materialsCount ?? dashStats?.totalMaterials ?? materials.length)
                      : '24'
                  }
                  note="Ready to study"
                  color="purple"
                />
                <Stat
                  icon={<Sparkles />}
                  label={user?.role === 'STUDENT' || !user ? 'BP coins' : 'Portal status'}
                  value={
                    user?.role === 'STUDENT'
                      ? `${dashStats?.bpCoins ?? user.bpCoins ?? 50}`
                      : user
                        ? 'ACTIVE'
                        : '250'
                  }
                  note="Earn on every CBT"
                  color="cyan"
                />
              </section>

              <section className="content-grid">
                <div className="panel subjects-panel">
                  <div className="panel-heading">
                    <div>
                      <div className="eyebrow">KEEP THE MOMENTUM</div>
                      <h3>{user?.class ? `${user.class.name} Subjects` : 'Your subjects'}</h3>
                    </div>
                    <button className="text-link" onClick={() => setPage('Learning World')}>
                      View all <ArrowRight size={14} />
                    </button>
                  </div>
                  <div className="subject-grid">
                    {displaySubjects.slice(0, 6).map((subject: any) => (
                      <button
                        className="subject-card"
                        key={subject.id || subject.name}
                        onClick={() => {
                          setSelectedSubjectFilter(subject.name);
                          setPage('Learning World');
                        }}
                      >
                        <div className={`subject-icon ${subject.color}`}>{subject.icon}</div>
                        <div className="subject-title">
                          {subject.name}
                          <ChevronRight size={15} />
                        </div>
                        <p>{subject.detail}</p>
                        <div className="progress-line">
                          <span style={{ width: `${subject.progress}%` }} />
                        </div>
                        <div className="progress-caption">
                          <span>Curriculum</span>
                          <b>{subject.progress}%</b>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="right-column">
                  <div className="panel exam-panel">
                    <div className="panel-heading">
                      <div>
                        <div className="eyebrow">READY WHEN YOU ARE</div>
                        <h3>Available CBTs</h3>
                      </div>
                      <span className="count-pill">{String(exams.length || 2).padStart(2, '0')}</span>
                    </div>

                    {exams.length > 0 ? (
                      exams.slice(0, 3).map((ex) => (
                        <div className="exam-item" key={ex.id}>
                          <div className="exam-icon">
                            <ClipboardList size={19} />
                          </div>
                          <div className="exam-info">
                            <b>{ex.title}</b>
                            <small>
                              <Clock3 size={12} /> {ex._count.questions} questions · {ex.durationMinutes} mins
                            </small>
                            <span className="status-pill">{ex.mode}</span>
                          </div>
                          <button className="round-arrow" onClick={() => startExam(ex.id)}>
                            <ArrowRight size={16} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="exam-item">
                        <div className="exam-icon">
                          <ClipboardList size={19} />
                        </div>
                        <div className="exam-info">
                          <b>JSS1 Mathematics Diagnostic CBT</b>
                          <small>
                            <Clock3 size={12} /> Sign in to load live exams
                          </small>
                          <span className="status-pill">DEMO</span>
                        </div>
                        <button className="round-arrow" onClick={() => setShowLogin(true)}>
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    )}

                    <button className="full-link" onClick={() => setPage('CBT Exam Hall')}>
                      Open exam hall <ArrowRight size={15} />
                    </button>
                  </div>

                  <div className="quote-card">
                    <div className="quote-mark">“</div>
                    <p>Success is the sum of small efforts, repeated day in and day out.</p>
                    <small>YOUR DAILY REMINDER</small>
                    <div className="quote-spark">✦</div>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* ===================== LEARNING WORLD TAB ===================== */}
          {page === 'Learning World' && (
            <div style={{ display: 'grid', gap: '16px' }}>
              {(user?.role === 'TEACHER' || user?.role === 'ADMIN') && (
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <div className="eyebrow">TEACHER / ADMIN STUDIO</div>
                      <h3>Publish New Lesson Note or Video</h3>
                    </div>
                  </div>
                  <form onSubmit={handleCreateMaterial} className="builder-grid">
                    <select
                      value={builderClassId}
                      onChange={(e) => {
                        setBuilderClassId(e.target.value);
                        const cls = classes.find((c) => c.id === e.target.value);
                        if (cls?.subjects?.[0]) setBuilderSubjectId(cls.subjects[0].id);
                      }}
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <select value={builderSubjectId} onChange={(e) => setBuilderSubjectId(e.target.value)}>
                      {(builderClassObj?.subjects || []).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <select value={newMatType} onChange={(e) => setNewMatType(e.target.value as any)}>
                      <option value="NOTE">PDF / Study Note</option>
                      <option value="VIDEO">Video Lesson</option>
                      <option value="AUDIO">Audio Lesson</option>
                      <option value="LINK">External Resource</option>
                    </select>
                    <input
                      required
                      placeholder="Lesson Title (e.g. Algebra Week 2)"
                      value={newMatTitle}
                      onChange={(e) => setNewMatTitle(e.target.value)}
                    />
                    <input
                      placeholder="Topic (e.g. Linear Equations)"
                      value={newMatTopic}
                      onChange={(e) => setNewMatTopic(e.target.value)}
                    />
                    <input
                      required
                      type="url"
                      placeholder="Resource URL (https://...)"
                      value={newMatUrl}
                      onChange={(e) => setNewMatUrl(e.target.value)}
                    />
                    <input
                      placeholder="Short summary for students..."
                      value={newMatDesc}
                      onChange={(e) => setNewMatDesc(e.target.value)}
                      style={{ gridColumn: '1 / -1' }}
                    />
                    <button type="submit" className="primary-btn">
                      <Plus size={16} /> Publish Lesson
                    </button>
                  </form>
                </section>
              )}

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <div className="eyebrow">THE CLASSROOM</div>
                    <h3>Approved Lesson Notes, Videos & Audio</h3>
                  </div>
                  <select
                    className="filter-select"
                    value={selectedSubjectFilter}
                    onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                  >
                    <option value="ALL">All Subjects</option>
                    {Array.from(new Set(materials.map((m) => m.subject?.name).filter(Boolean))).map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                {!token ? (
                  <p className="muted-copy">Sign in to access your class-locked notes, videos, and study guides.</p>
                ) : filteredMaterials.length === 0 ? (
                  <p className="muted-copy">No published learning materials match this filter yet.</p>
                ) : (
                  <div className="subject-grid">
                    {filteredMaterials.map((m) => (
                      <div className="subject-card" key={m.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span className="status-pill">{m.type}</span>
                          <small style={{ color: '#68c9ff', fontSize: 10 }}>
                            {m.class?.name} · {m.subject?.name}
                          </small>
                        </div>
                        <div className="subject-title">{m.title}</div>
                        <p style={{ whiteSpace: 'normal', margin: '8px 0 12px' }}>
                          {m.description || m.topic || 'Core curriculum material.'}
                        </p>
                        <a
                          href={m.url}
                          target="_blank"
                          rel="noreferrer"
                          className="primary-btn"
                          style={{ textDecoration: 'none', padding: '8px 12px' }}
                        >
                          Open Resource <ExternalLink size={14} />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* ===================== CBT EXAM HALL TAB ===================== */}
          {page === 'CBT Exam Hall' && (
            <div style={{ display: 'grid', gap: '16px' }}>
              {/* Active CBT Runner */}
              {activeSession && activeQuestion ? (
                <section className="panel cbt-runner">
                  <div className="cbt-topbar">
                    <div>
                      <div className="eyebrow">{activeSession.exam.subject} · {activeSession.exam.mode}</div>
                      <h3>{activeSession.exam.title}</h3>
                    </div>
                    <div className="cbt-controls">
                      <span className={`timer-badge ${secondsLeft < 60 ? 'danger' : ''}`}>
                        <Clock3 size={15} /> {formatTimer(secondsLeft)}
                      </span>
                      <button
                        type="button"
                        className="outline-btn"
                        onClick={() => setShowCalc((v) => !v)}
                      >
                        <Calculator size={15} /> Calc
                      </button>
                      <button
                        type="button"
                        className="outline-btn"
                        onClick={() =>
                          setFlagged((f) => ({ ...f, [activeQuestion.id]: !f[activeQuestion.id] }))
                        }
                      >
                        <Flag size={15} color={flagged[activeQuestion.id] ? '#ffd36b' : undefined} />
                        {flagged[activeQuestion.id] ? 'Flagged' : 'Flag'}
                      </button>
                    </div>
                  </div>

                  {tabLeaves > 0 && (
                    <div className="auth-error" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <AlertTriangle size={16} /> Anti-Cheat Warning: {tabLeaves}/2 tab exits recorded.
                    </div>
                  )}

                  {showCalc && (
                    <div className="calc-box">
                      <input
                        value={calcExpr}
                        onChange={(e) => setCalcExpr(e.target.value)}
                        placeholder="e.g. (12 * 18) / 6"
                      />
                      <button type="button" className="primary-btn" onClick={evaluateCalc}>
                        =
                      </button>
                      <button type="button" className="outline-btn" onClick={() => setCalcExpr('')}>
                        C
                      </button>
                    </div>
                  )}

                  <div className="q-pills">
                    {activeSession.exam.questions.map((q, idx) => (
                      <button
                        key={q.id}
                        type="button"
                        className={`q-pill ${idx === currentQIndex ? 'current' : ''} ${
                          answers[q.id] ? 'answered' : ''
                        } ${flagged[q.id] ? 'flagged' : ''}`}
                        onClick={() => setCurrentQIndex(idx)}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>

                  <div className="question-card">
                    <div className="eyebrow">
                      QUESTION {currentQIndex + 1} OF {activeSession.exam.questions.length} · {activeQuestion.marks} MARKS
                    </div>
                    <p className="q-prompt">{activeQuestion.prompt}</p>
                    <div className="options-list">
                      {(['A', 'B', 'C', 'D'] as const).map((optKey) => (
                        <button
                          key={optKey}
                          type="button"
                          className={`option-btn ${answers[activeQuestion.id] === optKey ? 'picked' : ''}`}
                          onClick={() => setAnswers((a) => ({ ...a, [activeQuestion.id]: optKey }))}
                        >
                          <span className="opt-letter">{optKey}</span>
                          <span>{activeQuestion.options[optKey]}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="cbt-footer">
                    <button
                      type="button"
                      className="outline-btn"
                      disabled={currentQIndex === 0}
                      onClick={() => setCurrentQIndex((i) => Math.max(0, i - 1))}
                    >
                      <ArrowLeft size={15} /> Previous
                    </button>

                    {currentQIndex < activeSession.exam.questions.length - 1 ? (
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() => setCurrentQIndex((i) => i + 1)}
                      >
                        Next Question <ArrowRight size={15} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="primary-btn"
                        disabled={submittingExam}
                        onClick={() => handleSubmitExam(false)}
                      >
                        <Send size={15} /> {submittingExam ? 'Submitting...' : 'Submit Exam'}
                      </button>
                    )}
                  </div>
                </section>
              ) : gradedResult ? (
                /* Instant Graded Breakdown */
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <div className="eyebrow">INSTANT RESULT & CORRECTIONS</div>
                      <h3>
                        Score: {gradedResult.submission.score}/{gradedResult.submission.totalMarks} (
                        {gradedResult.percentage}%) · +{gradedResult.coinsEarned} BP Coins
                      </h3>
                    </div>
                    <button className="primary-btn" onClick={() => setGradedResult(null)}>
                      Back to Exams
                    </button>
                  </div>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {gradedResult.review.map((r, idx) => (
                      <div
                        key={r.questionId}
                        className="subject-card"
                        style={{ borderColor: r.isCorrect ? '#1d6b52' : '#71364b' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <b>
                            Q{idx + 1}. {r.prompt}
                          </b>
                          <span className={`status-pill ${r.isCorrect ? '' : 'muted'}`}>
                            {r.isCorrect ? 'CORRECT' : `WRONG (Ans: ${r.correctAnswer})`}
                          </span>
                        </div>
                        <small style={{ color: '#9cb0ce', display: 'block' }}>
                          Your choice: <b>{r.selected || 'Unanswered'}</b> · Correct:{' '}
                          <b>{r.correctAnswer}</b>
                        </small>
                        {r.explanation && (
                          <p style={{ whiteSpace: 'normal', color: '#75cfff', marginTop: 8 }}>
                            Explanation: {r.explanation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ) : (
                <>
                  {/* Teacher/Admin Exam Builder */}
                  {(user?.role === 'TEACHER' || user?.role === 'ADMIN') && (
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <div className="eyebrow">TEACHER / ADMIN CBT BUILDER</div>
                          <h3>Create Exam & Add Questions</h3>
                        </div>
                      </div>
                      <form onSubmit={handleCreateExam} className="builder-grid" style={{ marginBottom: 18 }}>
                        <select
                          value={builderClassId}
                          onChange={(e) => {
                            setBuilderClassId(e.target.value);
                            const cls = classes.find((c) => c.id === e.target.value);
                            if (cls?.subjects?.[0]) setBuilderSubjectId(cls.subjects[0].id);
                          }}
                        >
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <select value={builderSubjectId} onChange={(e) => setBuilderSubjectId(e.target.value)}>
                          {(builderClassObj?.subjects || []).map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <select value={newExamMode} onChange={(e) => setNewExamMode(e.target.value as any)}>
                          <option value="PRACTICE">PRACTICE CBT</option>
                          <option value="TIMED">TIMED REAL EXAM</option>
                        </select>
                        <input
                          required
                          placeholder="Exam Title (e.g. JSS1 English Test 1)"
                          value={newExamTitle}
                          onChange={(e) => setNewExamTitle(e.target.value)}
                        />
                        <input
                          type="number"
                          min={1}
                          max={240}
                          value={newExamDuration}
                          onChange={(e) => setNewExamDuration(Number(e.target.value))}
                          placeholder="Minutes"
                        />
                        <button type="submit" className="primary-btn">
                          <Plus size={15} /> Create Draft Exam
                        </button>
                      </form>

                      <form onSubmit={handleAddQuestion} className="builder-grid">
                        <select
                          value={targetExamId}
                          onChange={(e) => setTargetExamId(e.target.value)}
                          style={{ gridColumn: '1 / -1' }}
                        >
                          <option value="">-- Select Draft Exam to Add Question --</option>
                          {exams
                            .filter((ex) => ex.status === 'DRAFT')
                            .map((ex) => (
                              <option key={ex.id} value={ex.id}>
                                {ex.title} ({ex.class?.name} · {ex._count.questions} Qs)
                              </option>
                            ))}
                        </select>
                        <input
                          required
                          placeholder="Question prompt..."
                          value={qPrompt}
                          onChange={(e) => setQPrompt(e.target.value)}
                          style={{ gridColumn: '1 / -1' }}
                        />
                        <input required placeholder="Option A" value={optA} onChange={(e) => setOptA(e.target.value)} />
                        <input required placeholder="Option B" value={optB} onChange={(e) => setOptB(e.target.value)} />
                        <input required placeholder="Option C" value={optC} onChange={(e) => setOptC(e.target.value)} />
                        <input required placeholder="Option D" value={optD} onChange={(e) => setOptD(e.target.value)} />
                        <select value={qCorrect} onChange={(e) => setQCorrect(e.target.value as any)}>
                          <option value="A">Correct: A</option>
                          <option value="B">Correct: B</option>
                          <option value="C">Correct: C</option>
                          <option value="D">Correct: D</option>
                        </select>
                        <input
                          placeholder="Answer explanation (shown after submit)"
                          value={qExplanation}
                          onChange={(e) => setQExplanation(e.target.value)}
                        />
                        <button type="submit" className="primary-btn">
                          <Plus size={15} /> Add Question
                        </button>
                      </form>
                    </section>
                  )}

                  {/* Exams List */}
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <div className="eyebrow">THE EXAM HALL</div>
                        <h3>{user?.class ? `${user.class.name} Published CBTs` : 'All School CBTs'}</h3>
                      </div>
                    </div>

                    {!token ? (
                      <div>
                        <p className="muted-copy">
                          Sign in with your Student ID or demo account (`student@babcockprep.edu.ng` / `StudentPass123!`) to take live timed CBTs.
                        </p>
                        <button className="primary-btn" onClick={() => setShowLogin(true)}>
                          Sign in to Start CBT <ArrowRight size={16} />
                        </button>
                      </div>
                    ) : exams.length === 0 ? (
                      <p className="muted-copy">No published exams available for this class yet.</p>
                    ) : (
                      <div className="subject-grid">
                        {exams.map((ex) => (
                          <div className="subject-card" key={ex.id}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                              <span className="status-pill">{ex.mode}</span>
                              <span className={`status-pill ${ex.status === 'DRAFT' ? 'muted' : ''}`}>
                                {ex.status || 'PUBLISHED'}
                              </span>
                            </div>
                            <div className="subject-title">{ex.title}</div>
                            <p>
                              {ex.class?.name ? `${ex.class.name} · ` : ''}
                              {ex.subject.name} · {ex._count.questions} Qs · {ex.durationMinutes} mins
                            </p>
                            {user?.role === 'STUDENT' ? (
                              <button className="primary-btn" onClick={() => startExam(ex.id)}>
                                <PlayCircle size={15} /> Start CBT
                              </button>
                            ) : ex.status === 'DRAFT' ? (
                              <button className="primary-btn" onClick={() => handlePublishExam(ex.id)}>
                                Publish Exam Live
                              </button>
                            ) : (
                              <span style={{ fontSize: 11, color: '#53d7b2' }}>Live for students</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          )}

          {/* ===================== MY RESULTS TAB ===================== */}
          {page === 'My Results' && (
            <div style={{ display: 'grid', gap: '16px' }}>
              {user?.role === 'PARENT' && (
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <div className="eyebrow">PARENT MONITORING GATE</div>
                      <h3>Link Your Child’s Student ID</h3>
                    </div>
                  </div>
                  <form onSubmit={handleLinkChild} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <input
                      className="inline-input"
                      placeholder="Enter Student ID (e.g. BP/JSS1A/000001)"
                      value={linkChildInput}
                      onChange={(e) => setLinkChildInput(e.target.value)}
                      required
                    />
                    <button type="submit" className="primary-btn">
                      <UserPlus size={15} /> Link Child
                    </button>
                  </form>
                  {children.length > 0 && (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
                      {children.map((ch) => (
                        <div key={ch.id} className="school-pill">
                          {ch.fullName} ({ch.studentId}) · {ch.class?.name}
                          {ch.section?.name} · Streak: {ch.streakDays}d
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <div className="eyebrow">REPORT CARD & ANALYTICS</div>
                    <h3>CBT Performance History</h3>
                  </div>
                </div>
                {!token ? (
                  <p className="muted-copy">Sign in to view verified CBT scores and performance history.</p>
                ) : results.length === 0 ? (
                  <p className="muted-copy">No submitted CBT results recorded yet.</p>
                ) : (
                  results.map((r) => {
                    const pct = r.totalMarks ? Math.round(((r.score ?? 0) / r.totalMarks) * 100) : 0;
                    return (
                      <div className="activity-row" key={r.id}>
                        <div className="activity-icon green">
                          <CheckCircle2 />
                        </div>
                        <div className="activity-main">
                          <b>
                            {r.exam?.title} ({r.exam?.subject?.name})
                          </b>
                          <small>
                            {r.user ? `${r.user.fullName} (${r.user.studentId}) · ` : ''}
                            {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : 'Submitted'}
                          </small>
                        </div>
                        <div className="activity-score">
                          <b>{pct}%</b>
                          <small>
                            {r.score}/{r.totalMarks}
                          </small>
                        </div>
                        <div className="score-bar">
                          <span style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </section>
            </div>
          )}

          {/* ===================== E-LIBRARY TAB ===================== */}
          {page === 'E-Library' && (
            <section className="panel secondary-page">
              <div className="secondary-icon">
                <LibraryBig size={30} />
              </div>
              <h2>Babcock Prep E-Library & Past Questions Bank</h2>
              <p className="muted-copy">
                WAEC, NECO, BECE, and JAMB past questions (2010–2026) and digital textbooks are organized inside Learning World and CBT Exam Hall by class level (JSS1–SS3).
              </p>
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button className="primary-btn" onClick={() => setPage('Learning World')}>
                  Browse Study Notes <ArrowRight size={16} />
                </button>
                <button className="outline-btn" onClick={() => setPage('CBT Exam Hall')}>
                  Practice Past Questions
                </button>
              </div>
            </section>
          )}

          <footer className="footer">
            <div className="footer-brand">
              <BookOpen size={16} /> BABCOCK <b>PREP</b>
            </div>
            <span>Learn. Test. Pass. Repeat.</span>
            <span>
              Built for your next breakthrough <span className="blue-dot">●</span>
            </span>
          </footer>
        </div>
      </main>

      {/* ===================== AUTH MODAL (LOGIN + SIGNUP) ===================== */}
      {showLogin && (
        <div className="modal-backdrop" onClick={() => setShowLogin(false)}>
          <div className="login-modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '92vh', overflowY: 'auto' }}>
            <button className="modal-close" onClick={() => setShowLogin(false)} aria-label="Close">
              <X />
            </button>
            <div className="modal-logo">
              <BookOpen size={27} />
              <span>BP</span>
            </div>
            <div className="eyebrow">3-GATE ACCESS CONTROL</div>
            <h2>
              {authMode === 'login' ? 'Sign in to ' : 'Join '}
              <span>BABCOCK PREP</span>
            </h2>

            <div className="role-options" style={{ marginTop: 14 }}>
              {(['Student', 'Teacher', 'Parent', 'Admin'] as PortalRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  className={role === r ? 'selected' : ''}
                  onClick={() => {
                    setRole(r);
                    if (r === 'Admin') setAuthMode('login');
                  }}
                >
                  {r}
                </button>
              ))}
            </div>

            {role !== 'Admin' && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button
                  type="button"
                  className={authMode === 'login' ? 'primary-btn' : 'outline-btn'}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setAuthMode('login')}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className={authMode === 'register' ? 'primary-btn' : 'outline-btn'}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setAuthMode('register')}
                >
                  Create Account
                </button>
              </div>
            )}

            <form onSubmit={handleAuthSubmit}>
              {authMode === 'register' && (
                <>
                  <label>
                    Full Name
                    <input
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. David Mensah"
                    />
                  </label>
                  <label>
                    Phone Number
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+234 800 000 0000"
                    />
                  </label>
                </>
              )}

              <label>
                Email address
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@babcockprep.edu.ng"
                  autoComplete="username"
                />
              </label>

              <label>
                Password
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  autoComplete="current-password"
                />
              </label>

              {authMode === 'register' && role === 'Student' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label>
                    Class
                    <select
                      className="modal-select"
                      value={selectedClass}
                      onChange={(e) => setSelectedClass(e.target.value)}
                    >
                      {['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3'].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Section / Arm
                    <select
                      className="modal-select"
                      value={selectedSection}
                      onChange={(e) => setSelectedSection(e.target.value)}
                    >
                      {['A', 'B', 'C', 'D', 'Gold', 'Diamond'].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {authMode === 'register' && role === 'Parent' && (
                <label>
                  Child Student ID (Optional)
                  <input
                    value={childStudentId}
                    onChange={(e) => setChildStudentId(e.target.value)}
                    placeholder="BP/JSS1A/000001"
                  />
                </label>
              )}

              {authError && <p className="auth-error">{authError}</p>}

              <button type="submit" className="primary-btn modal-submit" disabled={authBusy}>
                {authBusy
                  ? 'Please wait…'
                  : authMode === 'login'
                    ? 'Continue securely'
                    : 'Generate ID & Join'}{' '}
                <ArrowRight size={16} />
              </button>
            </form>

            <div style={{ marginTop: 14, borderTop: '1px solid #172744', paddingTop: 10 }}>
              <small style={{ color: '#6e84a3', fontSize: 9, display: 'block', marginBottom: 6 }}>
                QUICK-FILL SEEDED DEMO ACCOUNTS:
              </small>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(['Student', 'Teacher', 'Parent', 'Admin'] as PortalRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="status-pill"
                    style={{ border: '1px solid #204c78', cursor: 'pointer' }}
                    onClick={() => fillDemoAccount(r)}
                  >
                    {r} Demo
                  </button>
                ))}
              </div>
            </div>

            <small className="modal-note">
              <ShieldCheck size={13} /> Class-isolated portal security enabled.
            </small>
            <small className="modal-note">
  <ShieldCheck size={13} /> Class-isolated portal security enabled
</small>
<div
  style={{
    marginTop: '10px',
    textAlign: 'center',
    fontSize: '12px',
    letterSpacing: '0.08em',
    color: 'rgba(148, 163, 184, 0.85)',
  }}
>
  Built by <strong style={{ color: '#e2e8f0' }}>DTS GUILD TECHNOLOGIES</strong>
</div>
          </div>
        </div>
      )}

{showMelody && (
     <div
       style={{
         position: 'fixed',
         inset: 0,
         background: 'rgba(2, 6, 23, 0.8)',
         backdropFilter: 'blur(6px)',
         zIndex: 9999,
         display: 'flex',
         alignItems: 'center',
         justifyContent: 'center',
         padding: '20px',
       }}
       onClick={() => setShowMelody(false)}
     >
       <div
         style={{
           width: '100%',
           maxWidth: '960px',
           height: '85vh',
           background: '#0f172a',
           border: '1px solid rgba(148, 163, 184, 0.2)',
           borderRadius: '16px',
           overflow: 'hidden',
           display: 'flex',
           flexDirection: 'column',
         }}
         onClick={(e) => e.stopPropagation()}
       >
         <div
           style={{
             display: 'flex',
             alignItems: 'center',
             justifyContent: 'space-between',
             padding: '12px 18px',
             borderBottom: '1px solid rgba(148, 163, 184, 0.15)',
             color: '#f8fafc',
           }}
         >
           <span style={{ fontWeight: 600 }}>Melody AI Tutor</span>
           <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
             <a
               href="https://melody-ai-kzwc.onrender.com/"
               target="_blank"
               rel="noopener noreferrer"
               style={{ fontSize: '13px', color: '#38bdf8' }}
             >
               Open full screen ↗
             </a>
             <button
               type="button"
               onClick={() => setShowMelody(false)}
               style={{
                 background: 'rgba(255,255,255,0.1)',
                 border: 'none',
                 color: '#fff',
                 borderRadius: '8px',
                 padding: '4px 10px',
                 cursor: 'pointer',
               }}
             >
               ✕
             </button>
           </div>
         </div>
         <iframe
           src="https://melody-ai-kzwc.onrender.com/"
           title="Melody AI Tutor"
           style={{ width: '100%', height: '100%', border: 'none', flex: 1 }}
           allow="clipboard-write; microphone"
         />
       </div>
     </div>
   )}    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  note,
  color
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
  color: string;
}) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-note">{note}</div>
      <div className="stat-decoration" />
     
    </div>
  );
}
