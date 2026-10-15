import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck, BarChart3,
  Bell, BookMarked, BookOpen, BookOpenCheck, Calendar, CalendarCheck2,
  CalendarClock, Check, CheckCheck, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, ClipboardCheck, Clock3, CreditCard, Download,
  FileText, Filter, GraduationCap, Headphones, Heart, House, Inbox,
  Library, LockKeyhole, Menu, MessageCircle, MoreHorizontal, NotebookPen,
  Pencil, Plus, Search, Send, Settings2, ShieldCheck, Sparkles, Star,
  Target, TrendingUp, UserRound, Users, Video, X,
} from 'lucide-react';

const STUDENTS = [
  {
    id: 'aarav', name: 'Aarav Shah', firstName: 'Aarav', grade: 'Grade 7', country: 'India',
    school: 'Oakridge International School', curriculum: 'Cambridge International', initials: 'AS',
    weeklyGoal: 5, lessons: 4, homework: 92, score: 86, attendance: 96,
    academicLevel: 'On track · developing confident independent learning',
    goals: 'Build accuracy in multi-step problem solving and write with more structure.',
    focus: ['Fractions & ratios', 'Grammar: subject–verb agreement'],
  },
  {
    id: 'anaya', name: 'Anaya Shah', firstName: 'Anaya', grade: 'Grade 4', country: 'India',
    school: 'Oakridge International School', curriculum: 'CBSE', initials: 'AS',
    weeklyGoal: 4, lessons: 3, homework: 88, score: 82, attendance: 98,
    academicLevel: 'Building confidence · strong verbal participation',
    goals: 'Strengthen multiplication fluency and share ideas in complete sentences.',
    focus: ['Multiplication facts', 'Sentence punctuation'],
  },
];

const NAVIGATION = {
  Parent: [
    { group: 'Overview', items: [
      { id: 'dashboard', label: 'Child dashboard', icon: House },
      { id: 'updates', label: 'Daily updates', icon: Activity },
      { id: 'attendance', label: 'Attendance', icon: CalendarCheck2 },
    ] },
    { group: 'Learning', items: [
      { id: 'homework', label: 'Homework', icon: NotebookPen, badge: '2' },
      { id: 'test-results', label: 'Test results', icon: ClipboardCheck },
      { id: 'progress', label: 'Progress reports', icon: BarChart3 },
      { id: 'improvement', label: 'Improvement plan', icon: Target },
      { id: 'classes', label: 'Upcoming classes', icon: CalendarClock },
    ] },
    { group: 'Stay connected', items: [
      { id: 'messages', label: 'Messages', icon: MessageCircle, badge: '1' },
      { id: 'fees', label: 'Fees & payments', icon: CreditCard },
      { id: 'profile', label: 'Student profile', icon: UserRound },
    ] },
  ],
  Student: [
    { group: 'My learning', items: [
      { id: 'dashboard', label: 'My dashboard', icon: House },
      { id: 'classes', label: 'My classes', icon: CalendarClock },
      { id: 'homework', label: 'Homework', icon: NotebookPen, badge: '2' },
      { id: 'tests', label: 'Tests', icon: ClipboardCheck },
      { id: 'materials', label: 'Learning materials', icon: Library },
      { id: 'progress', label: 'My progress', icon: BarChart3 },
      { id: 'improvement', label: 'Practice plan', icon: Target },
      { id: 'feedback', label: 'Teacher feedback', icon: Heart },
    ] },
    { group: 'My account', items: [
      { id: 'messages', label: 'Messages', icon: MessageCircle, badge: '1' },
      { id: 'profile', label: 'My profile', icon: UserRound },
    ] },
  ],
  'Teacher / Admin': [
    { group: 'Workspace', items: [
      { id: 'dashboard', label: 'Dashboard', icon: House },
      { id: 'students', label: 'Students', icon: Users },
      { id: 'enquiries', label: 'Enquiries', icon: Inbox, badge: '3' },
    ] },
    { group: 'Teaching', items: [
      { id: 'classes', label: 'Classes', icon: CalendarClock },
      { id: 'homework', label: 'Homework', icon: NotebookPen },
      { id: 'tests', label: 'Tests', icon: ClipboardCheck },
      { id: 'attendance', label: 'Attendance', icon: CalendarCheck2 },
      { id: 'tracking', label: 'Progress tracking', icon: TrendingUp },
    ] },
    { group: 'Administration', items: [
      { id: 'communication', label: 'Parent communication', icon: MessageCircle },
      { id: 'payments', label: 'Payments', icon: CreditCard },
      { id: 'reports', label: 'Reports', icon: FileText },
    ] },
  ],
};

const TASK_SEED = [
  { id: 1, subject: 'Mathematics', subjectKey: 'math', title: 'Equivalent fractions · practice set', meta: '12 questions · Unit 5', due: 'Today, 6:00 PM', state: 'To do' },
  { id: 2, subject: 'English', subjectKey: 'english', title: 'Reading response: The Secret Garden', meta: 'Write 1 short paragraph · Chapter 4', due: 'Tomorrow', state: 'To do' },
  { id: 3, subject: 'Science', subjectKey: 'science', title: 'States of matter · recap quiz', meta: '8 questions · Unit 2', due: 'Submitted', state: 'Completed' },
];

const SUBJECTS = [
  { name: 'Mathematics', key: 'math', score: 78, change: '+6%', note: 'Building confidence', icon: '＋' },
  { name: 'Science', key: 'science', score: 91, change: '+8%', note: 'A real strength', icon: '◉' },
  { name: 'English', key: 'english', score: 84, change: '+3%', note: 'Steady progress', icon: 'Aa' },
];

function currentDate() {
  return new Intl.DateTimeFormat('en', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState('Parent');
  const [studentId, setStudentId] = useState('aarav');
  const [tasks, setTasks] = useState(TASK_SEED);
  const [toast, setToast] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [studentOpen, setStudentOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  useEffect(() => {
    if (mobileSearchOpen) document.getElementById('learning-search')?.focus();
  }, [mobileSearchOpen]);

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.getElementById('learning-search')?.focus();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const student = STUDENTS.find((item) => item.id === studentId) || STUDENTS[0];
  const pageId = location.pathname.split('/').filter(Boolean)[0] || 'dashboard';
  const navGroups = NAVIGATION[role];
  const navItems = navGroups.flatMap((group) => group.items);
  const activeNav = navItems.find((item) => item.id === pageId) || navItems[0];

  const notify = (message, kind = 'success') => {
    const key = Date.now();
    setToast({ message, kind, key });
    window.setTimeout(() => setToast((old) => old?.key === key ? null : old), 3200);
  };

  const goTo = (id) => {
    navigate(id === 'dashboard' ? '/' : `/${id}`);
    setMobileOpen(false);
    setSearchOpen(false);
    setMobileSearchOpen(false);
    setSearch('');
  };

  const changeRole = (nextRole) => {
    setRole(nextRole);
    setRoleOpen(false);
    setMobileOpen(false);
    navigate('/');
  };

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const query = search.toLowerCase();
    return navItems.filter((item) => item.label.toLowerCase().includes(query)).slice(0, 4);
  }, [search, navItems]);

  const toggleTask = (taskId) => {
    setTasks((all) => all.map((task) => task.id === taskId
      ? { ...task, state: task.state === 'Completed' ? 'To do' : 'Completed' }
      : task));
    const task = tasks.find((item) => item.id === taskId);
    notify(task?.state === 'Completed' ? 'Homework moved back to your to-do list.' : 'Homework marked as complete. Nice work!');
  };

  return (
    <div className="app-shell">
      {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><BookOpenCheck size={22} strokeWidth={2.1} /></div>
          <div className="brand-name">SriSah<span>Schooling</span></div>
          <button className="sidebar-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={18} /></button>
        </div>
        <div className="portal-picker-wrap">
          <button className={`portal-picker ${roleOpen ? 'portal-picker-open' : ''}`} onClick={() => setRoleOpen((open) => !open)} aria-expanded={roleOpen}>
            <span className="portal-avatar"><GraduationCap size={17} /></span>
            <span className="portal-copy"><small>SWITCH PORTAL</small><strong>{role}</strong></span>
            <ChevronDown className="portal-chevron" size={16} />
          </button>
          {roleOpen && (
            <div className="portal-menu">
              {['Parent', 'Student', 'Teacher / Admin'].map((option) => (
                <button key={option} onClick={() => changeRole(option)} className={role === option ? 'portal-option selected' : 'portal-option'}>
                  <span className="portal-option-icon">{option === 'Parent' ? <Heart size={16} /> : option === 'Student' ? <BookOpen size={16} /> : <Users size={16} />}</span>
                  <span><strong>{option}</strong><small>{option === 'Parent' ? 'Follow your child’s progress' : option === 'Student' ? 'Your learning space' : 'Manage teaching & operations'}</small></span>
                  {role === option && <Check size={15} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="nav-scroller">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.group}>
              <div className="nav-group-label">{group.group}</div>
              {group.items.map(({ id, label, icon: Icon, badge }) => (
                <button key={id} onClick={() => goTo(id)} className={`nav-item ${pageId === id ? 'nav-item-active' : ''}`}>
                  <Icon size={18} strokeWidth={1.9} />
                  <span>{label}</span>
                  {badge && <span className="nav-badge">{badge}</span>}
                  {pageId === id && <span className="nav-active-dot" />}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="sidebar-bottom">
          <div className="support-card">
            <div className="support-icon"><Headphones size={17} /></div>
            <div><strong>Here to help</strong><span>Talk to our learning team</span></div>
            <button aria-label="Contact support" onClick={() => notify('Our learning team will be happy to help.')}><ArrowUpRight size={15} /></button>
          </div>
          <div className="sidebar-profile">
            <div className="parent-avatar">PS</div>
            <div className="sidebar-profile-copy"><strong>{role === 'Student' ? student.name : role === 'Parent' ? 'Priya Shah' : 'Meera Sharma'}</strong><span>{role === 'Parent' ? 'Parent account' : role === 'Student' ? `${student.grade} student` : 'Academic coordinator'}</span></div>
            <button title="Settings" onClick={() => goTo('profile')}><Settings2 size={17} /></button>
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu-button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={21} /></button>
            <div className="breadcrumb"><span>{role === 'Parent' ? 'Family portal' : role === 'Student' ? 'Student space' : 'Teaching workspace'}</span><ChevronRight size={14} /><strong>{activeNav.label}</strong></div>
          </div>
          <div className="topbar-actions">
            <div className={`top-search-wrap ${mobileSearchOpen ? 'mobile-search-expanded' : ''}`} onClick={() => { if (window.matchMedia('(max-width: 700px)').matches && !mobileSearchOpen) setMobileSearchOpen(true); }}>
              <Search size={16} />
              <input id="learning-search" value={search} placeholder="Search your learning" aria-label="Search your learning" onChange={(event) => { setSearch(event.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} onKeyDown={(event) => { if (event.key === 'Enter' && searchResults[0]) goTo(searchResults[0].id); if (event.key === 'Escape') { setSearchOpen(false); setMobileSearchOpen(false); } }} />
              <kbd>⌘ K</kbd>
              {searchOpen && searchResults.length > 0 && (
                <div className="search-results">
                  {searchResults.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => goTo(id)}><Icon size={16} /><span>{label}</span><ArrowRight size={14} /></button>)}
                </div>
              )}
              {searchOpen && search && searchResults.length === 0 && <div className="search-results search-empty">No matching sections</div>}
            </div>
            {role === 'Parent' && (
              <div className="child-select-wrap">
                <button className="child-select" onClick={() => setStudentOpen((open) => !open)} aria-expanded={studentOpen}>
                  <span className="student-avatar-small">{student.initials}</span><span className="child-select-name">{student.firstName}<small>{student.grade}</small></span><ChevronDown size={15} />
                </button>
                {studentOpen && <div className="child-menu">{STUDENTS.map((child) => <button key={child.id} className={child.id === student.id ? 'child-option selected' : 'child-option'} onClick={() => { setStudentId(child.id); setStudentOpen(false); }}><span className="student-avatar-small">{child.initials}</span><span>{child.name}<small>{child.grade} · {child.curriculum}</small></span>{child.id === student.id && <Check size={15} />}</button>)}</div>}
              </div>
            )}
            <button className="notification-button" title="Notifications" onClick={() => goTo('messages')}><Bell size={18} /><span /></button>
          </div>
        </header>

        <main className="page-content" onClick={() => { if (searchOpen && !search) setSearchOpen(false); }}>
          {pageId === 'dashboard'
            ? role === 'Teacher / Admin'
              ? <TeacherDashboard notify={notify} goTo={goTo} />
              : <ParentDashboard role={role} student={student} tasks={tasks} onTaskToggle={toggleTask} goTo={goTo} notify={notify} />
            : <SectionPage pageId={pageId} role={role} student={student} tasks={tasks} onTaskToggle={toggleTask} goTo={goTo} notify={notify} />}
          <footer className="page-footer"><span>© 2026 SriSah Schooling</span><span>Learn. Improve. Achieve.</span><a href="#help" onClick={(event) => { event.preventDefault(); notify('Our support team is here for you.'); }}>Help & support <ArrowUpRight size={13} /></a></footer>
        </main>
      </div>

      <nav className="mobile-tabs" aria-label="Quick navigation">
        {navItems.slice(0, 5).map(({ id, label, icon: Icon }) => <button key={id} className={pageId === id ? 'mobile-tab mobile-tab-active' : 'mobile-tab'} onClick={() => goTo(id)}><Icon size={18} /><span>{label.split(' ')[0]}</span></button>)}
      </nav>

      {toast && <div className={`toast toast-${toast.kind}`} role="status"><span className="toast-check"><Check size={16} /></span><span>{toast.message}</span><button aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={15} /></button></div>}
    </div>
  );
}

function ParentDashboard({ role, student, tasks, onTaskToggle, goTo, notify }) {
  const isStudent = role === 'Student';
  return (
    <div className="dashboard-page animate-in">
      <div className="page-intro dashboard-intro">
        <div>
          <div className="overline">{currentDate()} <span className="overline-dot" /> {student.grade} · {student.curriculum}</div>
          <h1>{isStudent ? `Hello, ${student.firstName}` : 'Good morning, Priya'} <span className="wave">✦</span></h1>
          <p>{isStudent ? 'You’re making great progress. Here’s what’s on your learning path.' : `Here’s ${student.firstName}’s learning at a glance. A little progress each day adds up.`}</p>
        </div>
        <button className="button button-outline report-button" onClick={() => goTo(isStudent ? 'progress' : 'progress')}><FileText size={16} /> Weekly report <ArrowRight size={15} /></button>
      </div>

      <WelcomeBanner student={student} isStudent={isStudent} goTo={goTo} />

      <div className="metric-grid">
        <MetricCard label="Learning sessions" value={`${student.lessons} / ${student.weeklyGoal}`} icon={<BookOpen size={18} />} tone="green" foot="this week" trend="On track" />
        <MetricCard label="Homework completed" value={`${student.homework}%`} icon={<CheckCheck size={18} />} tone="lavender" foot="across all subjects" trend="+8% this month" />
        <MetricCard label="Average test score" value={`${student.score}%`} icon={<TrendingUp size={18} />} tone="peach" foot="last 30 days" trend="+5% this month" />
        <MetricCard label="Attendance" value={`${student.attendance}%`} icon={<CalendarCheck2 size={18} />} tone="blue" foot="since joining" trend="Excellent" />
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-main-column">
          <LearningJourney goTo={goTo} />
          <TodayLearning student={student} />
          <HomeworkWidget tasks={tasks} onTaskToggle={onTaskToggle} goTo={goTo} />
        </div>
        <div className="dashboard-side-column">
          <UpcomingClass notify={notify} />
          <FocusCard student={student} goTo={goTo} />
          <SubjectProgress student={student} />
        </div>
      </div>
    </div>
  );
}

function WelcomeBanner({ student, isStudent, goTo }) {
  const progress = Math.round((student.lessons / student.weeklyGoal) * 100);
  return (
    <section className="welcome-banner">
      <div className="banner-orbit banner-orbit-one" /><div className="banner-orbit banner-orbit-two" />
      <div className="banner-copy">
        <span className="banner-label"><Sparkles size={14} /> A WEEK OF GROWING</span>
        <h2>{isStudent ? 'Every small step makes you stronger.' : 'Learning with purpose. Growing with confidence.'}</h2>
        <p>{student.firstName} has completed <strong>{student.lessons} of {student.weeklyGoal} learning sessions</strong> this week. Keep the lovely momentum going.</p>
        <button className="button button-dark" onClick={() => goTo('improvement')}>Explore learning journey <ArrowRight size={16} /></button>
      </div>
      <div className="banner-visual" aria-label={`${progress}% of weekly learning goal complete`}>
        <div className="banner-decoration"><span /><span /><span /><span /><span /><span /></div>
        <div className="goal-ring" style={{ '--ring-progress': `${progress * 3.6}deg` }}>
          <div className="goal-ring-inner"><strong>{progress}%</strong><span>weekly goal</span></div>
        </div>
        <div className="banner-note note-top"><span className="note-check"><Check size={12} /></span><span><strong>4 sessions</strong><small>great consistency</small></span></div>
        <div className="banner-note note-bottom"><span className="note-star"><Star size={14} fill="currentColor" /></span><span><strong>Curious learner</strong><small>teacher’s shout-out</small></span></div>
      </div>
      <div className="banner-watermark">S</div>
    </section>
  );
}

function MetricCard({ label, value, icon, tone, foot, trend }) {
  return (
    <section className="metric-card">
      <div className={`metric-icon metric-${tone}`}>{icon}</div>
      <div className="metric-main"><span>{label}</span><strong>{value}</strong></div>
      <div className="metric-bottom"><span>{foot}</span><span className="metric-trend"><ArrowUpRight size={13} />{trend}</span></div>
    </section>
  );
}

const JOURNEY = [
  { title: 'Learn', status: 'done', detail: 'Concepts taught' },
  { title: 'Practice', status: 'done', detail: 'Guided questions' },
  { title: 'Submit', status: 'done', detail: 'Work shared' },
  { title: 'Feedback', status: 'done', detail: 'Teacher notes' },
  { title: 'Test', status: 'done', detail: 'Topic check' },
  { title: 'Analyse', status: 'done', detail: 'Skills reviewed' },
  { title: 'Improve', status: 'active', detail: 'Focused practice' },
  { title: 'Master', status: 'upcoming', detail: 'Goal unlocked' },
];

function LearningJourney({ goTo }) {
  return (
    <section className="panel journey-panel">
      <div className="panel-heading">
        <div><span className="section-kicker">THE LEARNING CYCLE</span><h2>Learning journey</h2><p>Clear steps, steady progress, lasting understanding.</p></div>
        <button className="icon-link" onClick={() => goTo('improvement')} aria-label="View learning journey"><ArrowRight size={19} /></button>
      </div>
      <div className="journey-track">
        {JOURNEY.map((step, index) => <div key={step.title} className={`journey-step journey-${step.status}`}>
          <div className="journey-marker">{step.status === 'done' ? <Check size={14} strokeWidth={2.8} /> : step.status === 'active' ? <span /> : <span className="journey-upcoming-dot" />}</div>
          {index < JOURNEY.length - 1 && <div className={`journey-line ${index < 6 ? 'journey-line-done' : ''}`} />}
          <strong>{step.title}</strong><small>{step.detail}</small>
        </div>)}
      </div>
      <div className="journey-focus">
        <div className="focus-symbol"><Target size={17} /></div>
        <div><span>IN FOCUS RIGHT NOW</span><strong>Improve · Fractions & ratios</strong></div>
        <button onClick={() => goTo('improvement')}>See the plan <ArrowRight size={14} /></button>
      </div>
    </section>
  );
}

function UpcomingClass({ notify }) {
  return (
    <section className="panel upcoming-panel">
      <div className="panel-heading compact-heading"><div><span className="section-kicker">UP NEXT</span><h2>Today’s class</h2></div><button className="icon-link" aria-label="View all classes" onClick={() => notify('Opening the full class schedule.')}><ArrowRight size={18} /></button></div>
      <div className="class-subject-row"><span className="subject-icon subject-math"><span>∑</span></span><div><span className="class-subject">Mathematics</span><strong>Fractions & equivalents</strong></div><span className="class-live-dot" /></div>
      <div className="class-time"><div className="time-icon"><Clock3 size={16} /></div><div><strong>4:30 – 5:15 PM</strong><span>Today · in 35 minutes</span></div></div>
      <div className="teacher-mini"><div className="teacher-avatar">MK</div><div><strong>Ms. Neha Kapoor</strong><span>Maths teacher</span></div><button title="Message teacher" onClick={() => notify('A message to Ms. Neha is ready to start.')}><MessageCircle size={16} /></button></div>
      <button className="button button-primary class-join" onClick={() => notify('Your classroom link will be available shortly before class.')}><Video size={16} /> Join class <ArrowRight size={15} /></button>
    </section>
  );
}

function TodayLearning({ student }) {
  return (
    <section className="panel today-panel">
      <div className="panel-heading">
        <div><span className="section-kicker">TODAY’S LEARNING</span><h2>What {student.firstName} learned</h2></div>
        <span className="date-tag">Today · 10:15 AM</span>
      </div>
      <div className="today-content">
        <div className="today-subject-art science-art"><span className="atom-orbit orbit-a" /><span className="atom-orbit orbit-b" /><span className="atom-core">●</span><span className="art-label">SCIENCE</span></div>
        <div className="today-copy"><div className="topic-line"><span className="small-subject-dot dot-science" /> Science <span>·</span> States of matter</div><h3>How tiny particles shape the world</h3><p>Explored how solids, liquids and gases behave, and what changes when heat is added.</p><div className="learning-result"><span className="result-check"><Check size={13} /></span><span><strong>8 / 10</strong> concept check</span><span className="result-divider" /><span>Confident understanding</span></div></div>
      </div>
      <div className="teacher-observation"><div className="teacher-avatar teacher-avatar-soft">MS</div><div><span>TEACHER OBSERVATION <b>· Ms. Meera Sharma</b></span><p>“{student.firstName} explained the change of state beautifully and used a great real-world example.”</p></div><BadgeCheck className="observation-badge" size={17} /></div>
    </section>
  );
}

function HomeworkWidget({ tasks, onTaskToggle, goTo }) {
  const openCount = tasks.filter((task) => task.state !== 'Completed').length;
  return (
    <section className="panel homework-widget">
      <div className="panel-heading">
        <div><span className="section-kicker">READY FOR A LITTLE PRACTICE?</span><h2>Homework <span className="heading-count">{openCount} to do</span></h2></div>
        <button className="text-action" onClick={() => goTo('homework')}>View all <ArrowRight size={14} /></button>
      </div>
      <div className="homework-list compact-homework-list">
        {tasks.slice(0, 3).map((task) => <HomeworkRow key={task.id} task={task} onToggle={onTaskToggle} compact />)}
      </div>
    </section>
  );
}

function HomeworkRow({ task, onToggle, compact = false }) {
  return (
    <div className={`homework-row ${task.state === 'Completed' ? 'homework-done' : ''} ${compact ? 'homework-row-compact' : ''}`}>
      <button className={`task-check ${task.state === 'Completed' ? 'task-check-done' : ''}`} aria-label={task.state === 'Completed' ? 'Mark as incomplete' : 'Mark as complete'} onClick={() => onToggle(task.id)}>{task.state === 'Completed' && <Check size={14} />}</button>
      <span className={`subject-square square-${task.subjectKey}`}>{task.subjectKey === 'math' ? '∑' : task.subjectKey === 'science' ? '◉' : 'Aa'}</span>
      <div className="homework-copy"><div className="homework-title-line"><strong>{task.title}</strong><span className={`homework-state ${task.state === 'Completed' ? 'state-complete' : ''}`}>{task.state}</span></div><span>{task.subject} <i>·</i> {task.meta}</span></div>
      <div className="homework-due"><span>{task.state === 'Completed' ? 'Submitted' : 'Due'}</span><strong>{task.due}</strong></div>
    </div>
  );
}

function FocusCard({ student, goTo }) {
  return (
    <section className="panel focus-panel">
      <div className="panel-heading compact-heading"><div><span className="section-kicker">A LITTLE EXTRA PRACTICE</span><h2>Focus areas</h2></div><span className="focus-count">2</span></div>
      {student.focus.map((item, index) => <div className="focus-item" key={item}><span className={`focus-item-icon ${index === 0 ? 'focus-warm' : 'focus-cool'}`}>{index === 0 ? <Target size={16} /> : <BookMarked size={16} />}</span><div><strong>{item}</strong><span>{index === 0 ? 'Let’s build confidence' : 'A few more examples will help'}</span></div><ChevronRight size={15} /></div>)}
      <div className="focus-plan-note"><Sparkles size={15} /><span>Practice plan updated by <strong>Ms. Meera</strong></span></div>
      <button className="button button-outline full-button" onClick={() => goTo('improvement')}>Open improvement plan <ArrowRight size={15} /></button>
    </section>
  );
}

function SubjectProgress({ student }) {
  const subjects = SUBJECTS.map((item) => ({ ...item, score: item.name === 'Mathematics' ? student.id === 'anaya' ? 82 : item.score : item.name === 'Science' ? student.id === 'anaya' ? 85 : item.score : student.id === 'anaya' ? 79 : item.score }));
  return (
    <section className="panel subject-panel">
      <div className="panel-heading compact-heading"><div><span className="section-kicker">THIS MONTH</span><h2>Progress by subject</h2></div><button className="icon-link" aria-label="View progress report"><ArrowRight size={18} /></button></div>
      <div className="subject-progress-list">{subjects.map((subject) => <div className="subject-progress-row" key={subject.key}><div className={`subject-square square-${subject.key}`}>{subject.icon}</div><div className="subject-progress-main"><div className="subject-progress-label"><strong>{subject.name}</strong><span>{subject.score}%</span></div><div className="progress-track"><span className={`progress-fill fill-${subject.key}`} style={{ width: `${subject.score}%` }} /></div></div><span className="subject-change"><ArrowUpRight size={12} />{subject.change}</span></div>)}</div>
      <div className="subject-footnote"><span><Sparkles size={14} /> Learning is moving in the right direction</span><span>{student.curriculum}</span></div>
    </section>
  );
}

function TeacherDashboard({ notify, goTo }) {
  const stats = [
    { label: 'Active students', value: '48', note: '+4 this term', icon: <Users size={18} />, tone: 'green' },
    { label: 'Classes today', value: '12', note: '3 starting soon', icon: <CalendarClock size={18} />, tone: 'lavender' },
    { label: 'Homework to review', value: '17', note: 'Across 6 classes', icon: <NotebookPen size={18} />, tone: 'peach' },
    { label: 'Parent enquiries', value: '3', note: 'Need a reply', icon: <MessageCircle size={18} />, tone: 'blue' },
  ];
  return <div className="dashboard-page animate-in">
    <div className="page-intro dashboard-intro"><div><div className="overline">{currentDate()} <span className="overline-dot" /> TEACHING WORKSPACE</div><h1>Good morning, Meera <span className="wave">✦</span></h1><p>Your teaching day, student progress and next steps — all in one place.</p></div><button className="button button-primary" onClick={() => notify('A new class is ready to be scheduled.')}><Plus size={16} /> Create a class</button></div>
    <section className="teacher-welcome"><div className="teacher-welcome-icon"><Sparkles size={21} /></div><div><span>YOUR CLASSROOM, AT A GLANCE</span><h2>Thoughtful teaching. Visible progress.</h2><p>Here are the students and learning moments that need your attention today.</p></div><div className="teacher-welcome-art"><div className="teacher-art-book"><BookOpen size={31} /></div><span className="teacher-art-spark">✳</span></div></section>
    <div className="metric-grid teacher-metrics">{stats.map((stat) => <MetricCard key={stat.label} {...stat} foot={stat.note} trend="View details" />)}</div>
    <div className="dashboard-grid teacher-dashboard-grid"><div className="dashboard-main-column">
      <section className="panel"><div className="panel-heading"><div><span className="section-kicker">YOUR SCHEDULE</span><h2>Coming up today</h2><p>3 classes remaining · your afternoon schedule</p></div><button className="text-action" onClick={() => goTo('classes')}>Full schedule <ArrowRight size={14} /></button></div>{['Mathematics · Grade 7', 'Science · Grade 5', 'English · Grade 8'].map((item, index) => <div className="schedule-row" key={item}><div className={`schedule-time ${index === 0 ? 'schedule-time-now' : ''}`}>{['4:30','5:30','6:30'][index]}<small>PM</small></div><div className="schedule-line" /><div className="schedule-class"><strong>{item}</strong><span>{['Fractions & ratios · 6 students','States of matter · 8 students','Writing with evidence · 5 students'][index]}</span></div><button className="icon-link" onClick={() => notify('Class details opened.')}><ArrowRight size={17} /></button></div>)}</section>
      <section className="panel"><div className="panel-heading"><div><span className="section-kicker">STUDENT PROGRESS</span><h2>Needs your attention</h2></div><button className="text-action" onClick={() => goTo('tracking')}>View all students <ArrowRight size={14} /></button></div><div className="student-attention-row"><div className="student-avatar-small">AS</div><div className="student-info-main"><strong>Aarav Shah <span>Grade 7</span></strong><p>Fractions & ratios · next practice due today</p></div><span className="attention-pill">Support needed</span><button className="button button-outline small-button" onClick={() => notify('Aarav’s learning plan opened.')}>Review</button></div><div className="student-attention-row"><div className="student-avatar-small avatar-yellow">RM</div><div className="student-info-main"><strong>Riya Mehta <span>Grade 5</span></strong><p>English reading · feedback is ready to share</p></div><span className="attention-pill attention-green">On track</span><button className="button button-outline small-button" onClick={() => goTo('communication')}>Review</button></div></section>
    </div><div className="dashboard-side-column"><section className="panel enquiry-panel"><div className="panel-heading compact-heading"><div><span className="section-kicker">INBOX</span><h2>New enquiries</h2></div><span className="focus-count">3</span></div><div className="enquiry-preview"><div className="enquiry-avatar">SK</div><div><strong>Sana Khan</strong><span>Looking for Grade 6 Maths</span><small>12 minutes ago</small></div><button onClick={() => goTo('enquiries')}><ArrowRight size={15} /></button></div><div className="enquiry-preview"><div className="enquiry-avatar enquiry-avatar-peach">RV</div><div><strong>Rohan Verma</strong><span>Science tutoring · Grade 9</span><small>1 hour ago</small></div><button onClick={() => goTo('enquiries')}><ArrowRight size={15} /></button></div><button className="button button-outline full-button" onClick={() => goTo('enquiries')}>View all enquiries <ArrowRight size={15} /></button></section><section className="panel teacher-tip"><div className="tip-icon"><Sparkles size={17} /></div><span className="section-kicker">A GOOD THING TO KNOW</span><h3>Learning grows through reflection.</h3><p>Adding one observation after class helps families understand what clicked today.</p><button className="text-action" onClick={() => goTo('communication')}>Share a class update <ArrowRight size={14} /></button></section></div></div>
  </div>;
}

function SectionPage({ pageId, role, student, tasks, onTaskToggle, goTo, notify }) {
  const titleMap = Object.fromEntries(NAVIGATION[role].flatMap((group) => group.items.map((item) => [item.id, item.label])));
  const title = titleMap[pageId] || 'Learning';
  const subtitle = getSectionSubtitle(pageId, role, student);
  const [activeFilter, setActiveFilter] = useState('All');
  const [completedPlan, setCompletedPlan] = useState({ 1: true, 2: false, 3: false });
  const [reply, setReply] = useState('');
  const [sentMessages, setSentMessages] = useState([]);
  const [profileEditing, setProfileEditing] = useState(false);
  const [profile, setProfile] = useState({ ...student });

  useEffect(() => {
    setProfile({ ...student });
    setProfileEditing(false);
  }, [student.id]);

  const visibleTasks = tasks.filter((task) => activeFilter === 'All' || (activeFilter === 'To do' ? task.state !== 'Completed' : task.state === 'Completed'));

  const pageHeader = <div className="page-intro section-page-intro"><div><div className="overline">{role === 'Parent' ? 'FAMILY PORTAL' : role === 'Student' ? 'MY LEARNING' : 'TEACHING WORKSPACE'} <span className="overline-dot" /> {student.grade}</div><h1>{title}</h1><p>{subtitle}</p></div><div className="page-heading-actions">{pageId === 'homework' || pageId === 'tests' ? <button className="button button-outline" onClick={() => notify('Filters are up to date.')}><Filter size={15} /> Filter</button> : null}{(pageId === 'progress' || pageId === 'reports' || pageId === 'tracking' || pageId === 'test-results') && <button className="button button-outline" onClick={() => notify('Your report is being prepared for download.')}><Download size={15} /> Download report</button>}</div></div>;

  let content;
  if (pageId === 'homework') content = <HomeworkPage tasks={visibleTasks} allTasks={tasks} activeFilter={activeFilter} setActiveFilter={setActiveFilter} onTaskToggle={onTaskToggle} notify={notify} />;
  else if (pageId === 'classes') content = <ClassesPage role={role} notify={notify} />;
  else if (pageId === 'attendance') content = <AttendancePage student={student} />;
  else if (pageId === 'test-results' || pageId === 'tests') content = <TestsPage student={student} notify={notify} />;
  else if (pageId === 'progress' || pageId === 'tracking' || pageId === 'reports') content = <ProgressPage student={student} goTo={goTo} notify={notify} role={role} />;
  else if (pageId === 'improvement') content = <ImprovementPage student={student} completedPlan={completedPlan} setCompletedPlan={setCompletedPlan} notify={notify} />;
  else if (pageId === 'updates' || pageId === 'feedback') content = <UpdatesPage role={role} student={student} notify={notify} />;
  else if (pageId === 'messages' || pageId === 'communication') content = <MessagesPage role={role} student={student} reply={reply} setReply={setReply} sentMessages={sentMessages} setSentMessages={setSentMessages} notify={notify} />;
  else if (pageId === 'profile') content = <ProfilePage student={student} profile={profile} setProfile={setProfile} editing={profileEditing} setEditing={setProfileEditing} notify={notify} />;
  else if (pageId === 'fees' || pageId === 'payments') content = <PaymentsPage notify={notify} role={role} />;
  else if (pageId === 'materials') content = <MaterialsPage notify={notify} />;
  else if (pageId === 'students') content = <StudentsPage goTo={goTo} />;
  else if (pageId === 'enquiries') content = <EnquiriesPage notify={notify} />;
  else content = <ProgressPage student={student} goTo={goTo} notify={notify} role={role} />;

  return <div className="section-page animate-in">{pageHeader}{content}</div>;
}

function getSectionSubtitle(pageId, role, student) {
  const subject = role === 'Student' ? 'your' : `${student.firstName}’s`;
  const map = {
    homework: `A clear view of ${subject} practice, due dates and completed work.`,
    classes: 'Keep every class, teacher and topic in view.',
    attendance: 'A consistent routine is one of the best foundations for learning.',
    'test-results': 'Understand what has clicked — and what to practise next.', tests: 'See every result as a guide for the next learning step.',
    progress: 'Progress is more than a score. See the whole story.', tracking: 'Spot strengths early and give every learner the right next step.', reports: 'A thoughtful summary of learning, growth and goals.',
    improvement: 'Small, focused actions help turn tricky topics into strengths.',
    updates: 'The little moments from class that add up to meaningful progress.', feedback: 'Thoughtful guidance from the teachers who know your learning.',
    messages: 'Stay close to the people supporting your learning.', communication: 'A shared understanding makes every learning plan stronger.',
    profile: 'A learning profile that reflects the whole student.', fees: 'A clear, up-to-date view of your tuition and payments.', payments: 'Manage tuition payments and keep account records in one place.',
    materials: 'A hand-picked library for learning, practice and revision.', students: 'Every learner’s profile, progress and next step in one place.', enquiries: 'Welcome new families with the right support and guidance.',
  };
  return map[pageId] || 'Stay connected to learning, progress and what comes next.';
}

function HomeworkPage({ tasks, allTasks, activeFilter, setActiveFilter, onTaskToggle, notify }) {
  const counts = { 'All': allTasks.length, 'To do': allTasks.filter((task) => task.state !== 'Completed').length, 'Completed': allTasks.filter((task) => task.state === 'Completed').length };
  return <div className="section-layout homework-page-layout"><div className="panel homework-page-panel"><div className="list-toolbar"><div className="segmented-tabs">{Object.keys(counts).map((filter) => <button key={filter} className={activeFilter === filter ? 'segment-active' : ''} onClick={() => setActiveFilter(filter)}>{filter}<span>{counts[filter]}</span></button>)}</div><span className="toolbar-note"><Calendar size={15} /> 2 due this week</span></div>{tasks.length ? <div className="homework-list page-homework-list">{tasks.map((task) => <HomeworkRow key={task.id} task={task} onToggle={onTaskToggle} />)}</div> : <div className="empty-state"><span><CheckCheck size={24} /></span><strong>All caught up</strong><p>There’s nothing in this list right now. Your next task will show up here.</p></div>}<div className="homework-reassurance"><ShieldCheck size={17} /><span>Every assignment is designed to build on what was learned in class.</span></div></div><aside className="panel homework-side-panel"><span className="section-kicker">THIS WEEK</span><h2>Good learning habits</h2><div className="habit-score"><div className="habit-ring"><strong>4</strong><span>days</span></div><div><strong>Practice streak</strong><p>Four learning days in a row. Keep it going.</p></div></div><div className="habit-divider" /><div className="mini-stat-line"><span>Assignments completed</span><strong>{allTasks.filter((task) => task.state === 'Completed').length} / {allTasks.length}</strong></div><div className="mini-stat-line"><span>Next due</span><strong>Today, 6:00 PM</strong></div><button className="button button-primary full-button" onClick={() => notify('Opening the next assignment now.')}>Start next assignment <ArrowRight size={15} /></button></aside></div>;
}

function ClassesPage({ role, notify }) {
  const classes = [
    { day: 'TODAY', date: '03', month: 'OCT', time: '4:30 PM', subject: 'Mathematics', topic: 'Fractions & equivalents', teacher: 'Ms. Neha Kapoor', color: 'math' },
    { day: 'MON', date: '05', month: 'OCT', time: '5:00 PM', subject: 'English', topic: 'Writing with detail', teacher: 'Mr. Rahul Menon', color: 'english' },
    { day: 'TUE', date: '06', month: 'OCT', time: '4:00 PM', subject: 'Science', topic: 'Forces in everyday life', teacher: 'Ms. Meera Sharma', color: 'science' },
  ];
  return <div className="section-layout classes-layout"><div className="classes-list">{classes.map((item, index) => <section className={`panel class-card ${index === 0 ? 'class-card-next' : ''}`} key={item.subject}><div className={`class-date-block ${item.color}`}><span>{item.day}</span><strong>{item.date}</strong><small>{item.month}</small></div><div className="class-card-body"><div className="class-card-top"><span className={`subject-chip chip-${item.color}`}>{item.subject}</span>{index === 0 && <span className="next-class-pill"><span /> Next class</span>}</div><h2>{item.topic}</h2><p><UserRound size={14} /> {item.teacher} <span>·</span> 45 minutes <span>·</span> Online</p><div className="class-card-actions"><span className="class-time-note"><Clock3 size={14} /> {item.time} · {index === 0 ? 'Today' : item.day.charAt(0) + item.day.slice(1).toLowerCase()}</span><button className={index === 0 ? 'button button-primary' : 'button button-outline'} onClick={() => notify(index === 0 ? 'Your class link will open shortly before the session.' : 'Class details opened.')}>{index === 0 ? <><Video size={15} /> Join classroom</> : <>View class <ArrowRight size={14} /></>}</button></div></div></section>)}</div><aside className="panel schedule-side"><span className="section-kicker">YOUR ROUTINE</span><h2>A little rhythm goes a long way.</h2><p>Regular classes make it easier to build confidence, ask questions and see progress.</p><div className="routine-list"><span><i className="routine-dot routine-math" /> Mathematics <strong>Thu · Sat</strong></span><span><i className="routine-dot routine-english" /> English <strong>Mon · Wed</strong></span><span><i className="routine-dot routine-science" /> Science <strong>Tue · Sat</strong></span></div><div className="timezone-note"><Clock3 size={14} /> Times shown in your local timezone</div><button className="button button-outline full-button" onClick={() => notify(`A new ${role === 'Teacher / Admin' ? 'class' : 'class enquiry'} can be requested from your learning team.`)}>{role === 'Teacher / Admin' ? 'Schedule a class' : 'Request a class'} <ArrowRight size={15} /></button></aside></div>;
}

function AttendancePage({ student }) {
  const days = ['M','T','W','T','F','S','S'];
  const attendance = [true, true, true, false, true, true, true, true, true, true, false, true, true, true, true, true, true, true, true, true, false, true, true, true, true, true, true, true];
  const attendedCount = student.id === 'anaya' ? 49 : 24;
  const scheduledCount = student.id === 'anaya' ? 50 : 25;
  return <div className="section-layout attendance-layout"><section className="panel attendance-main"><div className="attendance-header"><div><span className="section-kicker">OCTOBER 2026</span><h2>Consistency is growing</h2><p>{student.firstName} has attended {attendedCount} of {scheduledCount} scheduled classes this term.</p></div><div className="attendance-percent">{student.attendance}<small>%</small></div></div><div className="calendar-head">{days.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="attendance-calendar">{Array.from({ length: 35 }, (_, index) => { const date = index - 2; const inMonth = date >= 1 && date <= 31; const attended = attendance[(Math.max(0, date - 1)) % attendance.length]; return <div key={index} className={`calendar-day ${!inMonth ? 'calendar-outside' : ''} ${inMonth && attended ? 'attended' : ''} ${inMonth && !attended ? 'missed' : ''}`}><span>{inMonth ? date : date < 1 ? 30 + date : date - 31}</span>{inMonth && <i>{attended ? <Check size={11} /> : '–'}</i>}</div>; })}</div><div className="calendar-legend"><span><i className="legend-attended" /> Attended</span><span><i className="legend-missed" /> Missed</span><span><i className="legend-future" /> Upcoming</span></div></section><aside className="attendance-side"><div className="panel attendance-summary"><span className="section-kicker">TERM SUMMARY</span><h2>Showing up matters.</h2><p>Each class gives {student.firstName} another chance to ask, practise and grow.</p><div className="attendance-summary-row"><span>Classes attended</span><strong>{attendedCount} <small>/ {scheduledCount}</small></strong></div><div className="attendance-summary-row"><span>On-time arrival</span><strong>{student.attendance}%</strong></div><div className="attendance-summary-row"><span>Last attended</span><strong>Yesterday</strong></div><div className="attendance-note"><CheckCircle2 size={16} /> Great consistency this term</div></div><div className="panel attendance-next"><CalendarClock size={19} /><div><strong>Next class</strong><span>Mathematics · Today, 4:30 PM</span></div></div></aside></div>;
}

function TestsPage({ student, notify }) {
  const rows = [
    { subject: 'Science', topic: 'States of matter', date: 'Oct 1, 2026', score: student.id === 'anaya' ? 88 : 94, note: 'Excellent understanding' },
    { subject: 'English', topic: 'Reading comprehension', date: 'Sep 28, 2026', score: student.id === 'anaya' ? 86 : 88, note: 'Strong evidence choices' },
    { subject: 'Mathematics', topic: 'Fractions · topic check', date: 'Sep 25, 2026', score: student.id === 'anaya' ? 72 : 76, note: 'Practice with equivalent values' },
  ];
  return <div className="tests-page"><div className="test-summary-grid"><div className="panel test-highlight"><div className="test-highlight-icon"><ClipboardCheck size={19} /></div><div><span className="section-kicker">RECENT AVERAGE</span><strong>{student.score}%</strong><p>Across the last 3 topic checks</p></div><div className="test-highlight-trend"><ArrowUpRight size={14} /> 5% this month</div></div><div className="panel score-insight"><div className="insight-icon"><Sparkles size={18} /></div><div><span className="section-kicker">A USEFUL INSIGHT</span><h3>Understanding is taking root.</h3><p>Science is a clear strength. The next practice focus is equivalent fractions.</p></div></div></div><section className="panel results-panel"><div className="panel-heading"><div><span className="section-kicker">ASSESSMENT HISTORY</span><h2>Recent test results</h2><p>Every result helps shape the next step.</p></div><button className="button button-outline" onClick={() => notify('All test results are shown.')}>All assessments <ChevronDown size={15} /></button></div><div className="results-table"><div className="results-table-head"><span>SUBJECT & TOPIC</span><span>DATE</span><span>RESULT</span><span>TEACHER NOTE</span><span /></div>{rows.map((row) => <div className="results-row" key={row.topic}><div className="result-subject"><span className={`subject-square square-${row.subject.toLowerCase()}`}>{row.subject === 'Mathematics' ? '∑' : row.subject === 'Science' ? '◉' : 'Aa'}</span><span><strong>{row.subject}</strong><small>{row.topic}</small></span></div><span className="result-date">{row.date}</span><div className="result-score-wrap"><strong className={row.score < 70 ? 'score-needs-focus' : ''}>{row.score}%</strong><span className="mini-score-track"><i style={{ width: `${row.score}%` }} /></span></div><span className="result-note">{row.note}</span><button className="row-chevron" aria-label={`View ${row.topic} feedback`} onClick={() => notify(`${row.note}. Keep going, ${student.firstName}!`)}><ChevronRight size={17} /></button></div>)}</div></section></div>;
}

function ProgressPage({ student, goTo, notify, role }) {
  const scores = SUBJECTS.map((item) => ({ ...item, score: item.name === 'Mathematics' ? student.id === 'anaya' ? 82 : 78 : item.name === 'Science' ? student.id === 'anaya' ? 85 : 91 : student.id === 'anaya' ? 79 : 84 }));
  return <div className="progress-page"><div className="progress-overview-grid"><section className="panel progress-score-card"><div className="progress-score-top"><div><span className="section-kicker">OVERALL LEARNING PROGRESS</span><h2>{student.firstName} is moving forward.</h2><p>Across all three subjects, confidence is building month by month.</p></div><div className="large-progress-ring" style={{ '--ring-progress': `${student.score * 3.6}deg` }}><div><strong>{student.score}%</strong><span>overall</span></div></div></div><div className="progress-chart"><div className="chart-grid-lines"><span>100</span><span>75</span><span>50</span><span>25</span></div><div className="chart-bars">{[{label:'JUL',value:59},{label:'AUG',value:68},{label:'SEP',value:75},{label:'OCT',value:student.score}].map((month) => <div className="chart-column" key={month.label}><div className="chart-bar-outer"><span style={{ height: `${month.value}%` }} /></div><label>{month.label}</label></div>)}</div></div><div className="chart-footnote"><span><i /> Current month</span><span>Steady upward progress over the last 4 months</span></div></section><aside className="panel progress-insight-card"><span className="section-kicker">TEACHER’S INSIGHT</span><div className="insight-quote-mark">“</div><blockquote>“{student.firstName} is asking thoughtful questions and making stronger connections between ideas.”</blockquote><div className="insight-author"><div className="teacher-avatar teacher-avatar-soft">MS</div><span><strong>Ms. Meera Sharma</strong><small>Learning mentor · Oct 2</small></span></div><button className="text-action" onClick={() => goTo('feedback')}>Read all feedback <ArrowRight size={14} /></button></aside></div><div className="progress-detail-grid"><section className="panel subject-detail-panel"><div className="panel-heading"><div><span className="section-kicker">SUBJECT BREAKDOWN</span><h2>Progress by subject</h2></div><span className="period-chip">Last 30 days <ChevronDown size={13} /></span></div>{scores.map((subject) => <div className="subject-detail-row" key={subject.key}><div className={`subject-square square-${subject.key}`}>{subject.icon}</div><div className="subject-detail-main"><div className="subject-detail-title"><strong>{subject.name}</strong><span>{subject.score}%</span></div><div className="progress-track"><span className={`progress-fill fill-${subject.key}`} style={{ width: `${subject.score}%` }} /></div><small>{subject.name === 'Science' ? 'A clear strength · keep exploring' : subject.name === 'Mathematics' ? 'Focused practice is helping' : 'Steady progress · growing confidence'}</small></div><span className="subject-change"><ArrowUpRight size={13} />{subject.change}</span></div>)}</section><section className="panel strengths-panel"><div className="panel-heading"><div><span className="section-kicker">NEXT STEPS</span><h2>Where to focus</h2></div><Target size={18} className="muted-icon" /></div><div className="strength-item"><span className="strength-dot strength-green"><Check size={14} /></span><div><strong>Strength</strong><p>Explains science ideas clearly and makes real-world connections.</p></div></div><div className="strength-item"><span className="strength-dot strength-amber"><Target size={14} /></span><div><strong>Opportunity</strong><p>Practise comparing and simplifying equivalent fractions.</p></div></div><button className="button button-primary full-button" onClick={() => goTo('improvement')}>View improvement plan <ArrowRight size={15} /></button></section></div><section className="journey-mini-panel panel"><div><span className="section-kicker">PROGRESS IS A JOURNEY</span><h2>From learning to mastery, every step counts.</h2></div><div className="journey-mini-steps">{JOURNEY.map((item) => <span className={`journey-mini-step journey-mini-${item.status}`} key={item.title}>{item.status === 'done' ? <Check size={11} /> : null}{item.title}</span>)}</div><button className="icon-link" onClick={() => goTo('improvement')} aria-label="Open learning journey"><ArrowRight size={18} /></button></section></div>;
}

function ImprovementPage({ student, completedPlan, setCompletedPlan, notify }) {
  const planItems = [
    { id: 1, subject: 'Mathematics', title: 'Build fluency with equivalent fractions', description: 'Use visual fraction bars to compare, simplify and explain equivalent values.', rhythm: '10 minutes · 3 times this week', color: 'math', status: 'In progress' },
    { id: 2, subject: 'English', title: 'Make subject–verb agreement stick', description: 'Review singular and plural subjects, then practise with short writing prompts.', rhythm: '8 minutes · twice this week', color: 'english', status: 'Next up' },
    { id: 3, subject: 'Science', title: 'Keep curiosity growing', description: 'Try a quick observation activity to connect changes of state to everyday life.', rhythm: 'One optional activity', color: 'science', status: 'Stretch goal' },
  ];
  return <div className="improvement-layout"><section className="panel improvement-intro-panel"><div className="improve-illustration"><div className="improve-sun"><Sparkles size={23} /></div><div className="improve-leaf leaf-one" /><div className="improve-leaf leaf-two" /><div className="improve-ground" /></div><div><span className="section-kicker">PERSONALISED IMPROVEMENT PLAN</span><h2>A plan that meets {student.firstName} where they are.</h2><p>Short, intentional practice turns a tricky topic into a confident skill. This plan is shaped by recent classwork and teacher feedback.</p><div className="plan-owner"><div className="teacher-avatar teacher-avatar-soft">MS</div><span>Prepared by <strong>Ms. Meera Sharma</strong> <i>·</i> Updated Oct 2</span></div></div></section><div className="plan-progress-line"><span><strong>1 of 3</strong> focus steps underway</span><div><i style={{ width: '38%' }} /></div><span>Next review: Oct 9</span></div><div className="plan-items">{planItems.map((item, index) => <section className={`panel plan-item ${completedPlan[item.id] ? 'plan-item-complete' : ''}`} key={item.id}><div className={`plan-step-number step-${item.color}`}>{completedPlan[item.id] ? <Check size={17} /> : `0${index + 1}`}</div><div className="plan-item-content"><div className="plan-item-top"><span className={`subject-chip chip-${item.color}`}>{item.subject}</span><span className={`plan-status ${completedPlan[item.id] ? 'plan-status-done' : ''}`}>{completedPlan[item.id] ? 'Completed' : item.status}</span></div><h3>{item.title}</h3><p>{item.description}</p><div className="plan-rhythm"><Clock3 size={14} /> {item.rhythm}</div></div><button className={`button ${completedPlan[item.id] ? 'button-complete' : 'button-outline'}`} onClick={() => { setCompletedPlan((state) => ({ ...state, [item.id]: !state[item.id] })); notify(completedPlan[item.id] ? 'Practice step reopened.' : 'Practice step marked complete. Brilliant progress!'); }}>{completedPlan[item.id] ? <><Check size={15} /> Done</> : 'Mark as done'}</button></section>)}</div><div className="supporting-note"><ShieldCheck size={17} /><span>This plan is supportive, not extra pressure. The teacher will adjust it as {student.firstName} grows.</span></div></div>;
}

function UpdatesPage({ role, student, notify }) {
  return <div className="updates-layout"><div className="updates-feed"><div className="feed-date-label">TODAY · SATURDAY, OCTOBER 3</div><section className="panel update-card"><div className="update-card-heading"><span className="update-subject-icon update-science"><span>◉</span></span><div><span className="subject-chip chip-science">Science</span><h2>States of matter</h2><small>Class update · 10:15 AM</small></div><MoreHorizontal size={19} /></div><p className="update-summary">{student.firstName} explored how solids, liquids and gases behave, and what changes when heat is added. The class used everyday examples to connect the ideas to real life.</p><div className="update-score-strip"><span><CheckCircle2 size={16} /><strong>8 / 10</strong> concept check</span><span className="update-strength"><Sparkles size={15} /> Confident understanding</span></div><div className="update-observation"><div className="teacher-avatar teacher-avatar-soft">MS</div><div><span>OBSERVATION FROM MS. MEERA SHARMA</span><p>“{student.firstName} explained the change of state beautifully and used a great real-world example. Next, we’ll practise describing particle movement.”</p></div></div><div className="update-card-footer"><span><Heart size={14} /> Shared with family</span><button onClick={() => notify('You appreciated this class update.')}><Heart size={15} /> Appreciate</button></div></section><div className="feed-date-label">THURSDAY · OCTOBER 1</div><section className="panel update-card compact-update"><div className="update-card-heading"><span className="update-subject-icon update-math">∑</span><div><span className="subject-chip chip-math">Mathematics</span><h2>Equivalent fractions</h2><small>Practice session · 4:30 PM</small></div><CheckCircle2 className="update-done-icon" size={19} /></div><p className="update-summary">Reviewed equivalent fractions with visual fraction bars and applied the idea to simple word problems.</p><div className="update-card-footer"><span><BadgeCheck size={14} /> Practice complete</span><button onClick={() => notify('Class details opened.')}><FileText size={14} /> View notes</button></div></section><section className="panel update-card compact-update"><div className="update-card-heading"><span className="update-subject-icon update-english">Aa</span><div><span className="subject-chip chip-english">English</span><h2>Reading for meaning</h2><small>Class update · Sep 29, 5:00 PM</small></div><CheckCircle2 className="update-done-icon" size={19} /></div><p className="update-summary">Practised finding evidence in a short text and explaining what a character might be feeling.</p><div className="update-card-footer"><span><BadgeCheck size={14} /> Class complete</span><button onClick={() => notify('Class notes opened.')}><FileText size={14} /> View notes</button></div></section></div><aside className="panel update-sidebar"><span className="section-kicker">A NOTE FOR FAMILIES</span><div className="update-sidebar-icon"><Heart size={19} /></div><h2>It’s the little things.</h2><p>A good question, one more try, or a new connection can be a big step in learning.</p><div className="note-divider" /><span className="section-kicker">{role === 'Student' ? 'YOUR LEARNING' : `${student.firstName.toUpperCase()}’S LEARNING`}</span><div className="note-strength"><CheckCircle2 size={16} /><span><strong>Strength today</strong>Explaining ideas in their own words</span></div><div className="note-strength"><Target size={16} /><span><strong>Practise next</strong>Comparing equivalent fractions</span></div><button className="button button-outline full-button" onClick={() => notify('All learning updates are up to date.')}>See all updates <ArrowRight size={14} /></button></aside></div>;
}

function MessagesPage({ role, student, reply, setReply, sentMessages, setSentMessages, notify }) {
  const contact = role === 'Student' ? 'Ms. Meera Sharma' : role === 'Teacher / Admin' ? `${student.name}’s family · Priya Shah` : 'Ms. Meera Sharma · Learning mentor';
  const send = (event) => { event.preventDefault(); if (!reply.trim()) return; setSentMessages((messages) => [...messages, { text: reply.trim(), time: 'Just now' }]); setReply(''); notify('Your message has been sent.'); };
  return <div className="messages-layout"><aside className="panel message-contacts"><div className="message-contact-heading"><h2>Conversations</h2><button className="icon-link" aria-label="New message" onClick={() => notify('Choose a teacher to start a new message.')}><Plus size={18} /></button></div><button className="message-contact active-contact"><div className="teacher-avatar teacher-avatar-soft">MS</div><span><strong>Ms. Meera Sharma</strong><small>Learning mentor</small></span><i /></button><button className="message-contact"><div className="teacher-avatar contact-blue">NK</div><span><strong>Ms. Neha Kapoor</strong><small>Mathematics teacher</small></span></button><div className="contact-help"><LockKeyhole size={15} /><span>Private conversations between your family and learning team.</span></div></aside><section className="panel conversation-panel"><div className="conversation-header"><div className="teacher-avatar teacher-avatar-soft">MS</div><div><strong>{contact}</strong><span><i /> Usually replies within one school day</span></div><button className="icon-link" onClick={() => notify('Conversation details opened.')}><MoreHorizontal size={18} /></button></div><div className="conversation-date">TODAY · OCTOBER 3</div><div className="message-bubble-wrap"><div className="teacher-avatar teacher-avatar-soft">MS</div><div className="message-bubble"><p>Hi Priya! {student.firstName} did a lovely job connecting our states of matter lesson to real life today. {student.firstName} is especially confident explaining what happens when a liquid is heated.</p><span>Ms. Meera · 10:42 AM</span></div></div><div className="message-bubble-wrap message-mine"><div className="message-bubble"><p>That’s wonderful to hear. We’ll revisit fractions together this evening. Thanks for sharing such a helpful update!</p><span>You · 11:08 AM <CheckCheck size={13} /></span></div><div className="parent-avatar parent-avatar-chat">PS</div></div>{sentMessages.map((message, index) => <div className="message-bubble-wrap message-mine" key={`${message.time}-${index}`}><div className="message-bubble"><p>{message.text}</p><span>You · {message.time} <CheckCheck size={13} /></span></div><div className="parent-avatar parent-avatar-chat">PS</div></div>)}<div className="conversation-help"><CircleHelp size={15} /> For urgent matters, please contact the school office directly.</div><form className="message-composer" onSubmit={send}><input value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write a message…" aria-label="Write a message" /><button type="button" title="Add attachment" onClick={() => notify('Attachments can be added from your device.')}><Plus size={18} /></button><button type="submit" className="send-button" disabled={!reply.trim()}><Send size={16} /> Send</button></form></section></div>;
}

function ProfilePage({ student, profile, setProfile, editing, setEditing, notify }) {
  const fields = [
    { key: 'grade', label: 'Grade / Year level', icon: <GraduationCap size={17} /> },
    { key: 'country', label: 'Country', icon: <UserRound size={17} /> },
    { key: 'school', label: 'School', icon: <BookOpen size={17} /> },
    { key: 'curriculum', label: 'Curriculum', icon: <Library size={17} /> },
  ];
  const save = (event) => { event.preventDefault(); setEditing(false); notify('Student profile updated successfully.'); };
  return <div className="profile-layout"><section className="panel profile-card"><div className="profile-card-top"><div className="profile-student-avatar">{student.initials}</div><div><span className="section-kicker">STUDENT PROFILE</span><h2>{student.name}</h2><p>{student.grade} <span>·</span> Learning since January 2025</p></div><button className="button button-outline edit-profile-button" onClick={() => setEditing((value) => !value)}><Pencil size={15} /> {editing ? 'Cancel edit' : 'Edit profile'}</button></div><div className="profile-field-grid">{fields.map((field) => <label className="profile-field" key={field.key}><span>{field.icon}{field.label}</span>{editing ? <input className="profile-input" value={profile[field.key] || ''} onChange={(event) => setProfile((value) => ({ ...value, [field.key]: event.target.value }))} /> : <strong>{profile[field.key] || student[field.key]}</strong>}</label>)}</div><div className="profile-section"><span className="section-kicker">SUBJECTS</span><div className="profile-subjects"><span className="subject-chip chip-math">Mathematics</span><span className="subject-chip chip-science">Science</span><span className="subject-chip chip-english">English</span></div></div><div className="profile-section profile-academic"><span className="section-kicker">CURRENT ACADEMIC LEVEL</span>{editing ? <textarea className="profile-input profile-textarea" value={profile.academicLevel || ''} onChange={(event) => setProfile((value) => ({ ...value, academicLevel: event.target.value }))} /> : <p>{profile.academicLevel || student.academicLevel}</p>}</div><div className="profile-two-columns"><div className="profile-section"><span className="section-kicker">LEARNING GOALS</span>{editing ? <textarea className="profile-input profile-textarea" value={profile.goals || ''} onChange={(event) => setProfile((value) => ({ ...value, goals: event.target.value }))} /> : <p>{profile.goals || student.goals}</p>}</div><div className="profile-section"><span className="section-kicker">AREAS TO IMPROVE</span>{editing ? <input className="profile-input" value={(profile.focus || student.focus).join(', ')} onChange={(event) => setProfile((value) => ({ ...value, focus: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) }))} /> : <div className="focus-chips">{(profile.focus || student.focus).filter(Boolean).map((item) => <span key={item}><Target size={13} />{item}</span>)}</div>}</div></div>{editing && <div className="profile-save-row"><span>Profile details help personalise the learning plan.</span><button className="button button-primary" onClick={save}><Check size={15} /> Save changes</button></div>}</section><aside className="profile-side"><section className="panel profile-mentor"><div className="teacher-avatar teacher-avatar-soft">MS</div><span className="section-kicker">LEARNING MENTOR</span><h3>Ms. Meera Sharma</h3><p>Works with {student.firstName} on weekly goals, learning habits and confidence.</p><button className="button button-outline full-button" onClick={() => notify('Message composer opened for Ms. Meera Sharma.')}><MessageCircle size={15} /> Message mentor</button></section><section className="profile-secure"><ShieldCheck size={17} /><span><strong>Profile kept private</strong><small>Only your family and learning team can view these details.</small></span></section></aside></div>;
}

function PaymentsPage({ notify, role }) {
  const isTeacher = role === 'Teacher / Admin';
  return <div className="payments-layout"><section className="panel payment-balance"><div className="balance-copy"><span className="section-kicker">{isTeacher ? 'PAYMENT OVERVIEW' : 'ACCOUNT OVERVIEW'}</span><h2>{isTeacher ? 'Payments at a glance' : 'Everything clear and in one place.'}</h2><p>{isTeacher ? 'Review tuition payments and outstanding invoices.' : 'A simple summary of tuition and recent payments.'}</p><span className="payment-status"><CheckCircle2 size={14} /> {isTeacher ? 'All accounts up to date' : 'Account up to date'}</span></div><div className="balance-illustration"><div className="balance-circle"><CreditCard size={25} /></div><span className="balance-spark spark-one">✦</span><span className="balance-spark spark-two">✧</span></div></section><section className="panel invoices-panel"><div className="panel-heading"><div><span className="section-kicker">PAYMENT HISTORY</span><h2>Recent invoices</h2><p>All amounts shown in Indian rupees (INR).</p></div><button className="button button-outline" onClick={() => notify('Invoice history downloaded.')}><Download size={15} /> Export</button></div><div className="invoice-row"><span className="invoice-icon"><FileText size={17} /></span><div><strong>October tuition · 3 subjects</strong><span>Invoice SS-2026-1004 · Oct 1, 2026</span></div><span className="invoice-amount">₹8,400</span><span className="invoice-paid">Paid <Check size={13} /></span><button className="row-chevron" onClick={() => notify('October invoice opened.')}><ArrowDownRight size={16} /></button></div><div className="invoice-row"><span className="invoice-icon"><FileText size={17} /></span><div><strong>September tuition · 3 subjects</strong><span>Invoice SS-2026-0932 · Sep 1, 2026</span></div><span className="invoice-amount">₹8,400</span><span className="invoice-paid">Paid <Check size={13} /></span><button className="row-chevron" onClick={() => notify('September invoice opened.')}><ArrowDownRight size={16} /></button></div><div className="invoice-row"><span className="invoice-icon"><FileText size={17} /></span><div><strong>August tuition · 3 subjects</strong><span>Invoice SS-2026-0821 · Aug 1, 2026</span></div><span className="invoice-amount">₹8,400</span><span className="invoice-paid">Paid <Check size={13} /></span><button className="row-chevron" onClick={() => notify('August invoice opened.')}><ArrowDownRight size={16} /></button></div></section><div className="billing-help"><Headphones size={17} /><span>Questions about your fees or plan?</span><button onClick={() => notify('Your message to the accounts team is ready.')}>Contact the accounts team <ArrowRight size={14} /></button></div></div>;
}

function MaterialsPage({ notify }) {
  const materials = [
    { subject: 'Mathematics', title: 'Fractions made visual', type: 'Interactive lesson', time: '12 min', color: 'math', icon: <div className="fraction-visual"><span>½</span><i /><span>¼</span></div> },
    { subject: 'Science', title: 'States of matter', type: 'Quick revision guide', time: '8 min', color: 'science', icon: <div className="molecule-visual"><span /><span /><span /><span /></div> },
    { subject: 'English', title: 'Build a brilliant paragraph', type: 'Writing practice', time: '15 min', color: 'english', icon: <div className="writing-visual"><span /><span /><span /><span /></div> },
    { subject: 'Mathematics', title: 'Ratio in real life', type: 'Practice set', time: '10 questions', color: 'math', icon: <div className="ratio-visual"><span>3</span><i>:</i><span>4</span></div> },
  ];
  return <div className="materials-layout"><div className="material-filter-row"><div className="segmented-tabs"><button className="segment-active">All subjects <span>8</span></button><button onClick={() => notify('Showing Mathematics resources.')}>Mathematics</button><button onClick={() => notify('Showing Science resources.')}>Science</button><button onClick={() => notify('Showing English resources.')}>English</button></div><span className="toolbar-note"><Library size={15} /> Curated for Grade 7</span></div><div className="materials-grid">{materials.map((item) => <article className="panel material-card" key={item.title}><div className={`material-art material-${item.color}`}>{item.icon}<span className={`subject-chip chip-${item.color}`}>{item.subject}</span></div><div className="material-card-copy"><span className="section-kicker">{item.type.toUpperCase()} · {item.time.toUpperCase()}</span><h2>{item.title}</h2><p>Made to help concepts click — and stay with you.</p><button className="text-action" onClick={() => notify(`Opening “${item.title}”.`)}>Open resource <ArrowRight size={14} /></button></div></article>)}</div></div>;
}

function StudentsPage({ goTo }) {
  const students = [
    { initials: 'AS', name: 'Aarav Shah', grade: 'Grade 7', curriculum: 'Cambridge International', focus: 'Fractions & ratios', attendance: '96%', score: '86%', color: 'student-green' },
    { initials: 'RM', name: 'Riya Mehta', grade: 'Grade 5', curriculum: 'CBSE', focus: 'Reading comprehension', attendance: '98%', score: '91%', color: 'student-peach' },
    { initials: 'SK', name: 'Sana Khan', grade: 'Grade 6', curriculum: 'British Curriculum', focus: 'Algebra foundations', attendance: '92%', score: '78%', color: 'student-blue' },
    { initials: 'DV', name: 'Dev Verma', grade: 'Grade 9', curriculum: 'IB MYP', focus: 'Scientific writing', attendance: '94%', score: '84%', color: 'student-violet' },
  ];
  return <section className="panel students-panel"><div className="list-toolbar"><div className="student-list-summary"><strong>48</strong><span>active students across 4 curricula</span></div><div className="student-table-actions"><button className="button button-outline"><Filter size={15} /> Filter</button><button className="button button-primary"><Plus size={15} /> Add student</button></div></div><div className="student-directory"><div className="directory-head"><span>STUDENT</span><span>CURRICULUM</span><span>FOCUS AREA</span><span>ATTENDANCE</span><span>AVG. SCORE</span><span /></div>{students.map((item) => <div className="directory-row" key={item.name}><div className="directory-student"><div className={`directory-avatar ${item.color}`}>{item.initials}</div><span><strong>{item.name}</strong><small>{item.grade}</small></span></div><span className="directory-curriculum">{item.curriculum}</span><span className="directory-focus">{item.focus}</span><span className="directory-attendance">{item.attendance}</span><span className="directory-score">{item.score}</span><button className="row-chevron" aria-label={`View ${item.name}`} onClick={() => goTo('tracking')}><ChevronRight size={17} /></button></div>)}</div><div className="directory-footer">Showing 4 of 48 students <button onClick={() => goTo('tracking')}>View all students <ArrowRight size={14} /></button></div></section>;
}

function EnquiriesPage({ notify }) {
  const [handled, setHandled] = useState([]);
  const enquiries = [
    { id: 1, initials: 'SK', name: 'Sana Khan', grade: 'Grade 6', subject: 'Mathematics', curriculum: 'Cambridge International', time: '12 min ago', color: 'student-green', message: 'Looking for structured help with fractions and early algebra.' },
    { id: 2, initials: 'RV', name: 'Rohan Verma', grade: 'Grade 9', subject: 'Science', curriculum: 'CBSE', time: '1 hour ago', color: 'student-peach', message: 'Interested in concept-focused revision for term exams.' },
    { id: 3, initials: 'AM', name: 'Ayesha Malik', grade: 'Grade 4', subject: 'English', curriculum: 'British Curriculum', time: 'Yesterday', color: 'student-blue', message: 'Would like support with reading comprehension and writing.' },
  ];
  return <div className="enquiries-layout">{enquiries.map((item) => <section className={`panel enquiry-card ${handled.includes(item.id) ? 'enquiry-card-handled' : ''}`} key={item.id}><div className={`directory-avatar ${item.color}`}>{item.initials}</div><div className="enquiry-card-main"><div className="enquiry-card-top"><div><h2>{item.name} <span>{item.grade}</span></h2><small>{item.time} <i>·</i> New family enquiry</small></div><span className={`enquiry-state ${handled.includes(item.id) ? 'enquiry-state-done' : ''}`}>{handled.includes(item.id) ? 'Contacted' : 'New'}</span></div><p>{item.message}</p><div className="enquiry-meta"><span><BookOpen size={14} /> {item.subject}</span><span><GraduationCap size={14} /> {item.curriculum}</span></div><div className="enquiry-card-actions"><button className="button button-outline" onClick={() => notify(`Opening ${item.name}’s enquiry details.`)}><FileText size={15} /> View details</button><button className="button button-primary" onClick={() => { setHandled((current) => current.includes(item.id) ? current : [...current, item.id]); notify(`Your reply to ${item.name} is ready to send.`); }}><MessageCircle size={15} /> {handled.includes(item.id) ? 'Follow up' : 'Respond'}</button></div></div></section>)}</div>;
}
