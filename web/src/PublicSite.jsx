import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowRight, ArrowUpRight, BookOpen, BookOpenCheck, Check,
  Compass, GraduationCap, HeartHandshake, Leaf, Menu, MoveUpRight,
  ShieldCheck, Sparkles, X,
} from 'lucide-react';
import { api, prettyDate } from './api.js';
import './public-site.css';

const HeroScene = lazy(() => import('./HeroScene.jsx'));
const CATEGORIES = ['all', 'meditation', 'healing', 'awareness', 'homeschooling', 'learning'];
const INTERESTS = [
  ['group_meditation', 'Meditation & wellbeing'],
  ['homeschooling', 'Homeschooling guidance'],
  ['learning_portal', 'Learning portal'],
  ['general', 'Something else'],
];
const SOCIALS = [
  { label: 'Telegram', href: 'https://t.me/+LMeBJBZBDBcxODY1', mark: 'TG' },
  { label: 'Instagram', href: 'https://www.instagram.com/thethroneofwisdom/', mark: 'IG' },
  { label: 'YouTube', href: 'https://youtube.com/@the.throneofwisdom', mark: 'YT' },
  { label: 'Community chat', href: 'https://ig.me/j/AbaHJBaUQDgFH-KK/', mark: '↗' },
];
const INITIAL_FORM = { name: '', email: '', phone: '', interest: '', message: '' };

export default function PublicSite() {
  const articleRoute = window.location.pathname.replace(/\/+$/, '') === '/articles';
  const [menuOpen, setMenuOpen] = useState(false);
  const [config, setConfig] = useState(null);
  const [configState, setConfigState] = useState('loading');
  const [articles, setArticles] = useState([]);
  const [articleState, setArticleState] = useState('loading');
  const [category, setCategory] = useState('all');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const dialogRef = useRef(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [formState, setFormState] = useState({ status: 'idle', message: '' });

  useEffect(() => {
    document.title = articleRoute
      ? 'Insights & Articles | The Throne of Wisdom'
      : 'The Throne of Wisdom | Learning & Wellbeing';
    const controller = new AbortController();
    api('/site/config', { signal: controller.signal })
      .then((result) => {
        setConfig(result);
        setConfigState('ready');
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setConfigState('error');
        setArticleState('error');
      });
    return () => controller.abort();
  }, [articleRoute]);

  useEffect(() => {
    if (!config?.organizationSlug) return undefined;
    let current = true;
    const query = new URLSearchParams({ organizationSlug: config.organizationSlug });
    api(`/articles?${query}`)
      .then((result) => {
        if (!current) return;
        setArticles(Array.isArray(result.articles) ? result.articles : []);
        setArticleState('ready');
      })
      .catch(() => {
        if (current) setArticleState('error');
      });
    return () => { current = false; };
  }, [config?.organizationSlug]);

  useEffect(() => {
    if (!selectedArticle) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedArticle(null);
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [selectedArticle]);

  const visibleArticles = useMemo(() => {
    const filtered = category === 'all' ? articles : articles.filter((item) => item.category === category);
    return articleRoute ? filtered : filtered.slice(0, 3);
  }, [articleRoute, articles, category]);

  const submitContact = async (event) => {
    event.preventDefault();
    if (!config?.organizationSlug) {
      setFormState({ status: 'error', message: 'The contact service is not configured yet. Please use one of the community links instead.' });
      return;
    }
    setFormState({ status: 'sending', message: '' });
    try {
      await api('/enquiries', {
        method: 'POST',
        body: {
          organizationSlug: config.organizationSlug,
          enquiryType: 'contact',
          name: form.name,
          email: form.email,
          phone: form.phone,
          interest: form.interest,
          message: form.message,
        },
      });
      setForm(INITIAL_FORM);
      setFormState({ status: 'success', message: 'Thank you — your message has been saved to the organization inbox. For a time-sensitive request, please use one of the community links.' });
    } catch (error) {
      setFormState({ status: 'error', message: error.message || 'We could not send your message. Please try again or use a community link.' });
    }
  };

  const setField = (name) => (event) => {
    setForm((previous) => ({ ...previous, [name]: event.target.value }));
    if (formState.status !== 'idle') setFormState({ status: 'idle', message: '' });
  };

  return (
    <div className="site-shell">
      <a className="site-skip-link" href="#site-main">Skip to content</a>
      <SiteHeader menuOpen={menuOpen} setMenuOpen={setMenuOpen} articleRoute={articleRoute} />
      {articleRoute ? (
        <main id="site-main" className="site-main site-articles-page">
          <section className="site-page-hero">
            <div className="site-page-hero-inner">
              <span className="site-eyebrow"><Sparkles size={14} /> THE JOURNAL</span>
              <h1>Ideas for a more <em>intentional life.</em></h1>
              <p>Reflections on awareness, learning, and the small practices that help us grow.</p>
              <a href="/#contact" className="site-text-link">Have a question? Talk with us <ArrowRight size={15} /></a>
            </div>
            <div className="site-page-orbit" aria-hidden="true"><span /><span /><span /></div>
          </section>
          <section className="site-section site-article-library" aria-labelledby="articles-title">
            <div className="site-section-heading site-section-heading-row">
              <div><span className="site-eyebrow">THOUGHTS TO RETURN TO</span><h2 id="articles-title">The journal</h2></div>
              <a href="/portal" className="site-text-link">Editor sign-in <ArrowUpRight size={15} /></a>
            </div>
            <CategoryFilter category={category} setCategory={setCategory} />
            <ArticleGrid state={articleState} articles={visibleArticles} onOpen={setSelectedArticle} fullPage />
          </section>
        </main>
      ) : (
        <main id="site-main" className="site-main">
          <Hero />
          <TrustStrip />
          <About />
          <Offerings />
          <PortalFeature />
          <Homeschooling />
          <JournalPreview articles={articles} state={articleState} onOpen={setSelectedArticle} />
          <Approach />
          <Contact
            configState={configState}
            form={form}
            setField={setField}
            onSubmit={submitContact}
            formState={formState}
          />
        </main>
      )}
      <SiteFooter />
      {selectedArticle && <ArticleDialog article={selectedArticle} onClose={() => setSelectedArticle(null)} dialogRef={dialogRef} />}
    </div>
  );
}

function SiteHeader({ menuOpen, setMenuOpen, articleRoute }) {
  const links = [
    ['/#about', 'Our story'],
    ['/#services', 'What we offer'],
    ['/#learning', 'Learning'],
    ['/articles', 'Journal'],
  ];
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a className="site-brand" href="/" aria-label="The Throne of Wisdom home">
          <span className="site-brand-mark"><Sparkles size={19} strokeWidth={1.8} /></span>
          <span className="site-brand-copy"><strong>The Throne <i>of Wisdom</i></strong><small>LEARNING · WELLBEING · GROWTH</small></span>
        </a>
        <button
          className="site-menu-toggle"
          type="button"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          aria-controls="site-navigation"
          onClick={() => setMenuOpen((value) => !value)}
        >{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
        <nav id="site-navigation" className={`site-navigation ${menuOpen ? 'site-navigation-open' : ''}`} aria-label="Main navigation">
          {links.map(([href, label]) => <a key={label} href={href} onClick={() => setMenuOpen(false)} aria-current={articleRoute && href === '/articles' ? 'page' : undefined}>{label}</a>)}
          <a className="site-nav-portal" href="/portal" onClick={() => setMenuOpen(false)}>Family portal <ArrowUpRight size={14} /></a>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="site-hero" aria-labelledby="hero-title">
      <div className="site-hero-grain" aria-hidden="true" />
      <div className="site-hero-inner">
        <div className="site-hero-copy">
          <span className="site-eyebrow site-eyebrow-light"><span className="site-live-dot" /> A THOUGHTFUL SPACE TO GROW</span>
          <h1 id="hero-title">A calmer mind.<br /><em>A more confident learner.</em></h1>
          <p>Mindful wellbeing and learner-centred guidance for families choosing a more intentional path.</p>
          <div className="site-hero-actions">
            <a className="site-button site-button-gold" href="#services">Explore our approach <ArrowRight size={16} /></a>
            <a className="site-button site-button-ghost" href="/portal"><BookOpenCheck size={16} /> Open the family portal</a>
          </div>
          <div className="site-hero-note"><ShieldCheck size={15} /><span>Thoughtful guidance, grounded in your family’s goals.</span></div>
        </div>
        <div className="site-hero-art" role="img" aria-label="Decorative interactive sculpture representing awareness, learning, and growth">
          <Suspense fallback={<HeroFallback />}><HeroScene /></Suspense>
          <div className="site-orbit-label site-orbit-label-one"><span>01</span> Awareness</div>
          <div className="site-orbit-label site-orbit-label-two"><span>02</span> Learning</div>
          <div className="site-orbit-label site-orbit-label-three"><span>03</span> Growth</div>
        </div>
        <a className="site-scroll-cue" href="#about" aria-label="Scroll to our story"><span>SCROLL TO EXPLORE</span><ArrowDown size={14} /></a>
      </div>
    </section>
  );
}

function HeroFallback() {
  return (
    <div className="site-scene-fallback" aria-hidden="true">
      <div className="site-fallback-orbit site-fallback-orbit-a" />
      <div className="site-fallback-orbit site-fallback-orbit-b" />
      <div className="site-fallback-core"><BookOpenCheck size={43} strokeWidth={1.15} /></div>
      <span className="site-fallback-star site-fallback-star-a" />
      <span className="site-fallback-star site-fallback-star-b" />
      <span className="site-fallback-star site-fallback-star-c" />
    </div>
  );
}

function TrustStrip() {
  return (
    <div className="site-trust-strip" aria-label="Who we support">
      <span>For families</span><i /> <span>For learners</span><i /> <span>For educators</span><i />
      <span className="site-trust-note"><ShieldCheck size={14} /> Privacy-minded by design</span>
    </div>
  );
}

function About() {
  return (
    <section className="site-section site-about" id="about" aria-labelledby="about-title">
      <div className="site-about-media">
        <div className="site-founder-frame"><img src="/images/Founder.jpeg" alt="Founder of The Throne of Wisdom" loading="lazy" /></div>
        <div className="site-image-caption"><span className="site-caption-mark">✦</span><div><strong>Space to pause.</strong><small>Room to grow.</small></div></div>
        <span className="site-about-ornament" aria-hidden="true">◌</span>
      </div>
      <div className="site-about-copy">
        <span className="site-eyebrow">OUR STORY</span>
        <h2 id="about-title">Wisdom begins with <em>being present.</em></h2>
        <p className="site-lead">The Throne of Wisdom brings together mindfulness, compassionate guidance, and a whole-child view of learning.</p>
        <p>We support families who want a calmer relationship with learning and wellbeing. Our work starts with listening: to the child, the family, and the path they are shaping together.</p>
        <p>Whether you are exploring mindful practices or looking for a thoughtful approach to home-based learning, we make room for curiosity, reflection, and steady progress.</p>
        <a href="#contact" className="site-text-link">Start a conversation <ArrowRight size={15} /></a>
      </div>
    </section>
  );
}

function Offerings() {
  const cards = [
    { icon: HeartHandshake, number: '01', title: 'Mindful wellbeing', text: 'Gentle group meditation and awareness practices that invite stillness, reflection, and a kinder relationship with everyday life.', href: 'https://t.me/+LMeBJBZBDBcxODY1', link: 'Join the community', external: true },
    { icon: Compass, number: '02', title: 'Homeschooling guidance', text: 'Support for families considering home-based education, curriculum choices, learning rhythms, and wellbeing along the way.', href: '#homeschooling', link: 'Explore guidance' },
    { icon: BookOpenCheck, number: '03', title: 'A connected learning space', text: 'A private portal for families, learners, and educators to keep learning plans, classwork, feedback, and next steps in view.', href: '/portal', link: 'Visit the family portal' },
  ];
  return (
    <section className="site-section site-offerings" id="services" aria-labelledby="services-title">
      <div className="site-section-heading">
        <span className="site-eyebrow">WAYS WE CAN WALK WITH YOU</span>
        <h2 id="services-title">Support for the <em>whole journey.</em></h2>
        <p>Three connected ways to nurture a little more clarity, confidence, and connection.</p>
      </div>
      <div className="site-offering-grid">
        {cards.map(({ icon: Icon, number, title, text, href, link, external }) => (
          <article className="site-offering-card" key={number}>
            <div className="site-offering-top"><span className="site-offering-icon"><Icon size={20} strokeWidth={1.65} /></span><span>{number}</span></div>
            <h3>{title}</h3><p>{text}</p>
            <a href={href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>{link} <ArrowRight size={14} /></a>
          </article>
        ))}
      </div>
    </section>
  );
}

function PortalFeature() {
  const features = [
    ['A shared picture', 'Families and educators can see the next learning step.'],
    ['Feedback that travels', 'Assignments, submissions, and feedback stay connected.'],
    ['Private by role', 'Each account sees only the learners and records it is allowed to access.'],
  ];
  return (
    <section className="site-portal-feature" id="learning" aria-labelledby="portal-feature-title">
      <div className="site-portal-grid">
        <div className="site-portal-copy">
          <span className="site-eyebrow site-eyebrow-light">SCHOOLING, WITH CONTEXT</span>
          <h2 id="portal-feature-title">A learning journey you can <em>see and support.</em></h2>
          <p>Give families, learners, and educators one calm place to follow classes, homework, progress, and conversations—without losing sight of the person behind the record.</p>
          <ul className="site-feature-list">
            {features.map(([title, text]) => <li key={title}><span><Check size={13} /></span><div><strong>{title}</strong><small>{text}</small></div></li>)}
          </ul>
          <a className="site-button site-button-gold" href="/portal">Enter SriSah Schooling <ArrowRight size={16} /></a>
        </div>
        <div className="site-portal-preview" aria-label="Illustration of the connected learning portal">
          <div className="site-preview-window">
            <div className="site-preview-top"><span className="site-preview-logo"><BookOpenCheck size={16} /></span><span><b>SriSah</b><small>FAMILY PORTAL</small></span><i /></div>
            <div className="site-preview-greeting"><small>ILLUSTRATIVE PORTAL PREVIEW</small><strong>Every small step counts.</strong><span>See what’s happening, and what comes next.</span></div>
            <div className="site-preview-metrics"><div><span>Homework</span><b>Assignments</b><small>Tasks & feedback</small></div><div><span>Next class</span><b>Class schedule</b><small>Upcoming learning</small></div></div>
            <div className="site-preview-update"><span className="site-preview-icon"><Sparkles size={15} /></span><span><small>TEACHER UPDATE</small><b>Keep feedback connected.</b></span><ArrowRight size={14} /></div>
          </div>
          <div className="site-preview-orb site-preview-orb-one" /><div className="site-preview-orb site-preview-orb-two" />
          <div className="site-preview-stamp"><ShieldCheck size={16} /><span><b>Thoughtful access</b><small>Private to your team</small></span></div>
        </div>
      </div>
    </section>
  );
}

function Homeschooling() {
  const pathways = [
    ['01', 'Start with your child', 'Consider interests, learning needs, wellbeing, and the kind of support your family can sustain.'],
    ['02', 'Explore curriculum options', 'Compare Indian and international pathways, including NIOS, against your learner’s goals.'],
    ['03', 'Confirm the current rules', 'Check eligibility, exam requirements, and university recognition directly with the relevant boards and institutions.'],
  ];
  return (
    <section className="site-section site-homeschool" id="homeschooling" aria-labelledby="homeschool-title">
      <div className="site-homeschool-copy">
        <span className="site-eyebrow">A FLEXIBLE PATH, THOUGHTFULLY PLANNED</span>
        <h2 id="homeschool-title">Home learning is personal. <em>Your plan can be, too.</em></h2>
        <p>Families in India explore a range of learning and assessment pathways. The right choice depends on the learner, the family, and current board and university requirements.</p>
        <div className="site-pathway-list">
          {pathways.map(([number, title, text]) => <div className="site-pathway" key={number}><span>{number}</span><div><strong>{title}</strong><p>{text}</p></div></div>)}
        </div>
        <p className="site-disclaimer">This is general information, not legal or admissions advice. Rules and eligibility can change; confirm details with official education boards and institutions before making decisions.</p>
        <a href="#contact" className="site-text-link">Talk through your family’s questions <ArrowRight size={15} /></a>
      </div>
      <div className="site-homeschool-side">
        <div className="site-learning-card site-learning-card-primary"><span className="site-learning-icon"><GraduationCap size={21} /></span><small>LEARNING THAT FITS</small><strong>More room for curiosity.</strong><p>A considered rhythm can make space for learning, rest, and family life.</p><span className="site-card-line" /></div>
        <div className="site-learning-card site-learning-card-secondary"><span className="site-learning-icon"><Leaf size={19} /></span><small>WELLBEING INCLUDED</small><strong>Care for the learner, not just the lesson.</strong><p>Progress can include confidence, connection, and a sense of belonging.</p></div>
        <div className="site-learning-sun" aria-hidden="true" />
      </div>
    </section>
  );
}

function JournalPreview({ articles, state, onOpen }) {
  return (
    <section className="site-section site-journal-preview" id="journal" aria-labelledby="journal-preview-title">
      <div className="site-section-heading site-section-heading-row">
        <div><span className="site-eyebrow">NOTES FROM THE JOURNEY</span><h2 id="journal-preview-title">A little space to <em>reflect.</em></h2></div>
        <a className="site-text-link" href="/articles">Visit the journal <ArrowRight size={15} /></a>
      </div>
      <ArticleGrid state={state} articles={articles.slice(0, 3)} onOpen={onOpen} />
    </section>
  );
}

function CategoryFilter({ category, setCategory }) {
  return (
    <div className="site-category-filter" role="group" aria-label="Filter articles by category">
      {CATEGORIES.map((item) => <button key={item} type="button" className={category === item ? 'active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)}>{item === 'all' ? 'All reflections' : item}</button>)}
    </div>
  );
}

function ArticleGrid({ state, articles, onOpen, fullPage = false }) {
  if (state === 'loading') return <div className="site-article-status" role="status"><span className="site-loading-dot" /> Gathering the latest reflections…</div>;
  if (state === 'error') return <div className="site-article-status site-article-status-error" role="status">The journal is temporarily unavailable. Please check back soon.</div>;
  if (!articles.length) return <div className="site-article-empty"><span><BookOpen size={19} /></span><strong>A new reflection is on its way.</strong><p>Check back soon, or leave us a note if there’s a topic you’d like us to explore.</p><a href="/#contact">Share an idea <ArrowRight size={14} /></a></div>;
  return (
    <div className={`site-article-grid ${fullPage ? 'site-article-grid-full' : ''}`}>
      {articles.map((article, index) => (
        <article className="site-article-card" key={article.id} style={{ '--article-index': index }}>
          <div className="site-article-meta"><span>{article.category}</span><time dateTime={article.updated_at || article.created_at}>{prettyDate(article.updated_at || article.created_at)}</time></div>
          <h3>{article.title}</h3><p>{article.excerpt}</p>
          <button className="site-article-read" type="button" onClick={() => onOpen(article)} aria-label={`Read ${article.title}`}>Read reflection <ArrowRight size={14} /></button>
        </article>
      ))}
    </div>
  );
}

function ArticleDialog({ article, onClose, dialogRef }) {
  return (
    <div className="site-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <article ref={dialogRef} className="site-article-dialog" role="dialog" aria-modal="true" aria-labelledby="article-dialog-title" tabIndex={-1}>
        <div className="site-dialog-top"><span className="site-eyebrow">{article.category}</span><button type="button" className="site-icon-button" onClick={onClose} aria-label="Close article"><X size={19} /></button></div>
        <time dateTime={article.updated_at || article.created_at}>{prettyDate(article.updated_at || article.created_at)}</time>
        <h2 id="article-dialog-title">{article.title}</h2>
        {article.author_name && <p className="site-article-author">A reflection by {article.author_name}</p>}
        <div className="site-article-body">{article.content}</div>
        <button className="site-button site-button-violet" type="button" onClick={onClose}>Close reflection <Check size={15} /></button>
      </article>
    </div>
  );
}

function Approach() {
  const values = [
    ['Listen first', 'Start with the family’s real questions and the learner’s lived experience.'],
    ['Keep it human', 'Use tools and routines to support connection—not to replace it.'],
    ['Make room to grow', 'Celebrate curiosity, practise steadily, and adapt as needs change.'],
  ];
  return (
    <section className="site-approach" aria-labelledby="approach-title">
      <div className="site-approach-inner">
        <div className="site-approach-intro"><span className="site-eyebrow site-eyebrow-light">OUR GUIDING PRINCIPLES</span><h2 id="approach-title">Care is in the <em>way we work.</em></h2><p>Useful guidance should feel clear, respectful, and grounded in your family’s context.</p></div>
        <div className="site-value-list">{values.map(([title, text], index) => <div className="site-value" key={title}><span>0{index + 1}</span><div><strong>{title}</strong><p>{text}</p></div></div>)}</div>
      </div>
    </section>
  );
}

function Contact({ configState, form, setField, onSubmit, formState }) {
  const busy = formState.status === 'sending';
  return (
    <section className="site-section site-contact" id="contact" aria-labelledby="contact-title">
      <div className="site-contact-copy">
        <span className="site-eyebrow">A CONVERSATION CAN BE A FIRST STEP</span>
        <h2 id="contact-title">Tell us what you’re <em>thinking about.</em></h2>
        <p>Share a little context and we’ll help you find the right next step. You can also connect with the community directly.</p>
        <div className="site-social-list">{SOCIALS.map((social) => <a href={social.href} key={social.label} target="_blank" rel="noreferrer"><span>{social.mark}</span>{social.label}<MoveUpRight size={14} /></a>)}</div>
        <div className="site-contact-privacy"><ShieldCheck size={16} /><span>Your message is saved to the organization inbox and is visible to its administrators. Please don’t include sensitive medical or student details in this form.</span></div>
      </div>
      <form className="site-contact-form" onSubmit={onSubmit}>
        <div className="site-form-heading"><span className="site-eyebrow">GET IN TOUCH</span><h3>Start with a note.</h3><p>Fields marked with * are required.</p></div>
        <div className="site-form-row">
          <label>Name *<input autoComplete="name" maxLength="120" value={form.name} onChange={setField('name')} required /></label>
          <label>Email *<input type="email" autoComplete="email" maxLength="254" value={form.email} onChange={setField('email')} required /></label>
        </div>
        <div className="site-form-row">
          <label>Phone / WhatsApp <span>(optional)</span><input type="tel" autoComplete="tel" maxLength="40" value={form.phone} onChange={setField('phone')} placeholder="+91 …" /></label>
          <label>I’m interested in *<select value={form.interest} onChange={setField('interest')} required><option value="">Choose an area</option>{INTERESTS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        </div>
        <label>Your message <span>(please avoid sensitive details)</span><textarea maxLength="1500" rows="4" value={form.message} onChange={setField('message')} placeholder="What would you like us to know?" /></label>
        <div className="site-form-bottom"><button className="site-button site-button-violet" type="submit" disabled={busy || configState === 'loading'}>{busy ? 'Sending securely…' : 'Send message'} <ArrowRight size={15} /></button><span><ShieldCheck size={13} /> Private and organization-scoped</span></div>
        {formState.message && <p className={`site-form-feedback site-form-feedback-${formState.status}`} role={formState.status === 'error' ? 'alert' : 'status'}>{formState.message}</p>}
        {configState === 'error' && <p className="site-form-feedback site-form-feedback-error" role="status">The contact service could not be reached. You can still use the community links.</p>}
      </form>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-main">
        <a className="site-brand site-brand-footer" href="/">
          <span className="site-brand-mark"><Sparkles size={18} /></span>
          <span className="site-brand-copy"><strong>The Throne <i>of Wisdom</i></strong><small>LEARNING · WELLBEING · GROWTH</small></span>
        </a>
        <p>A thoughtful space for families, learners, and the people who support them.</p>
        <div className="site-footer-links"><a href="/#services">Our work</a><a href="/articles">Journal</a><a href="/portal">Family portal</a><a href="/#contact">Contact</a></div>
        <div className="site-footer-social">{SOCIALS.map((social) => <a href={social.href} aria-label={social.label} title={social.label} key={social.label} target="_blank" rel="noreferrer">{social.mark}</a>)}</div>
      </div>
      <div className="site-footer-bottom"><span>© {new Date().getFullYear()} The Throne of Wisdom</span><span>Learning and wellbeing, held with care.</span></div>
    </footer>
  );
}
