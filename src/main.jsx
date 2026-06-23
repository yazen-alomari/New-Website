import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight,
  BadgeDollarSign,
  Building2,
  CalendarCheck2,
  Check,
  ChevronRight,
  ClipboardCheck,
  DatabaseZap,
  FlaskConical,
  GraduationCap,
  Handshake,
  HeartPulse,
  Mail,
  MapPin,
  Menu,
  Microscope,
  Phone,
  ShieldCheck,
  Sparkles,
  TestTubeDiagonal,
  Truck,
  X,
} from 'lucide-react';
import './styles.css';

const heroImage =
  'https://images.squarespace-cdn.com/content/v1/69fcc9bdd26b67103703d88d/1754316499.465408-CMDTPUZQNJPLEQYIDKHH/imgg-od3-3tqi1aqt.png?format=2500w';
const labTexture =
  'https://images.squarespace-cdn.com/content/v1/69fcc9bdd26b67103703d88d/80e4e9c2-498a-44bf-8abb-36e4d5f940c4/unsplash-image-9xHsWmh3m_4.jpg?format=2500w';
const teamImage =
  'https://images.squarespace-cdn.com/content/v1/69fcc9bdd26b67103703d88d/1778175819563-IUU789NY0EXYDOA3XRU1/unsplash-image-Lks7vei-eAg.jpg?format=2500w';
const logoImage =
  'https://images.squarespace-cdn.com/content/v1/69fcc9bdd26b67103703d88d/9403b52c-19f0-46f4-8fbc-5fd134b9e9de/Transperant+Logo.png?format=500w';

const services = [
  {
    icon: Building2,
    title: 'Lab Buildout',
    text: 'Facility planning, layout, equipment flow, validation, and turnkey implementation for physician-owned labs.',
  },
  {
    icon: ShieldCheck,
    title: 'Compliance Readiness',
    text: 'CLIA, COLA, CAP, CMS, SOPs, quality systems, inspection preparation, and documentation discipline.',
  },
  {
    icon: BadgeDollarSign,
    title: 'Revenue Cycle',
    text: 'Billing operations, payer guidance, denial management, appeals, and leakage reduction across lab services.',
  },
  {
    icon: DatabaseZap,
    title: 'LIMS + EMR Integration',
    text: 'LIMS selection, instrument connectivity, reporting pipelines, and EMR/EHR workflows that preserve clinic rhythm.',
  },
  {
    icon: TestTubeDiagonal,
    title: 'Test Validation',
    text: 'Molecular, serology, microbiology, verification protocols, quality controls, and launch-ready test menus.',
  },
  {
    icon: GraduationCap,
    title: 'Staff Training',
    text: 'Competency programs, role-specific training, SOP adoption, and post-launch support for reliable throughput.',
  },
  {
    icon: Truck,
    title: 'Supply Chain',
    text: 'Vendor negotiation, inventory controls, procurement planning, and continuity across reagents and equipment.',
  },
  {
    icon: ClipboardCheck,
    title: 'Project Management',
    text: 'Clear milestones from concept through operational handoff, with budget, timeline, and risk managed tightly.',
  },
];

const process = [
  ['01', 'Assess', 'Map current outsourced testing, volume, payer mix, space, and clinical priorities.'],
  ['02', 'Design', 'Shape the facility, workflow, staffing model, equipment stack, and test launch plan.'],
  ['03', 'Comply', 'Build the documentation, quality systems, SOPs, validations, and inspection posture.'],
  ['04', 'Install', 'Coordinate vendors, instruments, LIMS connectivity, inventory, and physical implementation.'],
  ['05', 'Train', 'Prepare teams for specimen handling, reporting, billing handoffs, and daily lab operations.'],
  ['06', 'Optimize', 'Measure throughput, denials, utilization, and margin to keep the lab improving after launch.'],
];

const locations = ['Los Angeles County', 'Orange County', 'Houston', 'New Jersey'];
const compliance = ['CLIA', 'COLA', 'CAP', 'CMS', 'ISO 15189'];

function useReveal() {
  useEffect(() => {
    const items = document.querySelectorAll('[data-reveal]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: '0px 0px -8% 0px' },
    );

    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);
}

function Header() {
  const [open, setOpen] = useState(false);
  const navItems = [
    ['Services', '#services'],
    ['Model', '#model'],
    ['Process', '#process'],
    ['Contact', '#contact'],
  ];

  useEffect(() => {
    document.body.classList.toggle('menu-open', open);
    return () => document.body.classList.remove('menu-open');
  }, [open]);

  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="Alomari Associates home">
        <span className="brand-mark">
          <img src={logoImage} alt="" />
        </span>
        <span>
          <strong>Alomari</strong>
          <small>Associates</small>
        </span>
      </a>

      <nav className="desktop-nav" aria-label="Primary navigation">
        {navItems.map(([label, href]) => (
          <a key={label} href={href}>
            {label}
          </a>
        ))}
      </nav>

      <a className="header-cta" href="https://calendly.com/yazen-alomariassociates/30min">
        <CalendarCheck2 size={18} aria-hidden="true" />
        Schedule
      </a>

      <button
        className="menu-button"
        type="button"
        aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
      </button>

      <div className="mobile-panel" aria-hidden={!open}>
        {navItems.map(([label, href]) => (
          <a key={label} href={href} onClick={() => setOpen(false)}>
            {label}
            <ChevronRight size={17} aria-hidden="true" />
          </a>
        ))}
        <a className="mobile-panel-cta" href="https://calendly.com/yazen-alomariassociates/30min">
          Schedule a call
        </a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="hero" style={{ '--hero-image': `url("${heroImage}")` }}>
      <div className="hero-scrim" />
      <div className="hero-grid">
        <div className="hero-copy" data-reveal>
          <div className="eyebrow">
            <Sparkles size={17} aria-hidden="true" />
            Clinical laboratory strategy, buildout, and launch
          </div>
          <h1>Alomari Associates</h1>
          <p className="hero-lede">
            Physician-owned labs designed to capture revenue, accelerate results, and preserve the
            workflow your care team already trusts.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="https://calendly.com/yazen-alomariassociates/30min">
              Schedule a call
              <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a className="button secondary" href="#services">
              Explore services
            </a>
          </div>
          <div className="hero-proof" aria-label="Alomari Associates capabilities">
            <span>CLIA</span>
            <span>COLA</span>
            <span>CAP</span>
            <span>RCM</span>
            <span>LIMS</span>
          </div>
        </div>

        <div className="lab-console" data-reveal>
          <div className="console-header">
            <span className="status-dot" />
            <span>Launch Readiness</span>
          </div>
          <div className="console-ring" aria-hidden="true">
            <Microscope className="ring-icon" size={38} />
            <span />
            <span />
            <span />
          </div>
          <div className="console-metrics">
            {[
              ['Workflow fit', '92%'],
              ['Compliance path', '88%'],
              ['Revenue capture', '76%'],
            ].map(([label, value], index) => (
              <div className="metric-row" key={label}>
                <div>
                  <strong>{label}</strong>
                  <span>{value}</span>
                </div>
                <i style={{ '--bar': value, '--delay': `${index * 0.14}s` }} />
              </div>
            ))}
          </div>
          <div className="console-footer">
            <span>Concept</span>
            <ChevronRight size={16} aria-hidden="true" />
            <span>Accredited</span>
            <ChevronRight size={16} aria-hidden="true" />
            <span>Operational</span>
          </div>
        </div>
      </div>

      <div className="hero-bottom">
        {[
          ['End-to-end', 'buildout and operational handoff'],
          ['Fast path', 'from concept to billable services'],
          ['Payer aware', 'billing strategy baked into launch'],
        ].map(([title, text]) => (
          <article key={title}>
            <strong>{title}</strong>
            <span>{text}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function Intro() {
  return (
    <section className="section intro-section">
      <div className="intro-grid">
        <div className="section-kicker" data-reveal>
          <HeartPulse size={18} aria-hidden="true" />
          Healthcare engineered for results
        </div>
        <div data-reveal>
          <h2>Build the lab your practice should already own.</h2>
          <p>
            We design and build high-performance physician laboratories with precision, speed, and a
            deep understanding of clinical workflows. Our team brings lab architecture, regulatory
            compliance, staffing, instrumentation, workflow optimization, and revenue cycle expertise
            into one practical launch plan.
          </p>
        </div>
      </div>
    </section>
  );
}

function Services() {
  return (
    <section id="services" className="section services-section">
      <div className="section-heading" data-reveal>
        <span className="section-kicker">
          <FlaskConical size={18} aria-hidden="true" />
          What we bring
        </span>
        <h2>Everything required to turn lab capability into clinical and financial momentum.</h2>
      </div>

      <div className="service-grid">
        {services.map((service, index) => {
          const Icon = service.icon;
          return (
            <article className="service-card" data-reveal key={service.title} style={{ '--delay': `${index * 0.04}s` }}>
              <Icon size={23} aria-hidden="true" />
              <h3>{service.title}</h3>
              <p>{service.text}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ModelComparison() {
  return (
    <section id="model" className="section model-section">
      <div className="model-bg" style={{ '--texture': `url("${labTexture}")` }} aria-hidden="true" />
      <div className="section-heading light" data-reveal>
        <span className="section-kicker">
          <Handshake size={18} aria-hidden="true" />
          Physician-owned lab model
        </span>
        <h2>Keep more control over testing, decisions, and margins.</h2>
      </div>

      <div className="model-flow" data-reveal>
        <div className="flow-panel muted">
          <span className="panel-label">Traditional</span>
          <h3>External lab dependency</h3>
          <ul>
            <li>Samples leave the practice</li>
            <li>Results arrive later</li>
            <li>Revenue exits with every test</li>
          </ul>
        </div>

        <div className="flow-core" aria-hidden="true">
          <span className="pulse-node">
            <FlaskConical size={30} />
          </span>
          <i />
          <i />
          <i />
        </div>

        <div className="flow-panel">
          <span className="panel-label">Alomari model</span>
          <h3>Point-of-care lab capability</h3>
          <ul>
            <li>Testing moves in-house</li>
            <li>Care teams act sooner</li>
            <li>Revenue stays with the practice</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function Process() {
  return (
    <section id="process" className="section process-section">
      <div className="section-heading" data-reveal>
        <span className="section-kicker">
          <ClipboardCheck size={18} aria-hidden="true" />
          How the launch moves
        </span>
        <h2>A disciplined path from opportunity to operational lab.</h2>
      </div>

      <div className="timeline">
        {process.map(([number, title, text], index) => (
          <article className="timeline-step" data-reveal key={title} style={{ '--delay': `${index * 0.05}s` }}>
            <span>{number}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Proof() {
  return (
    <section className="section proof-section">
      <div className="proof-media" data-reveal>
        <img src={teamImage} alt="Clinical operations team collaborating around a table" />
        <div className="media-badge">
          <strong>Built with operators</strong>
          <span>Not just consultants</span>
        </div>
      </div>

      <div className="proof-copy" data-reveal>
        <span className="section-kicker">
          <MapPin size={18} aria-hidden="true" />
          Field-tested execution
        </span>
        <h2>From regulatory posture to daily throughput, every detail has to work in the room.</h2>
        <p>
          Capacity fills fast. Bringing lab services in-house helps reclaim tests, referrals, and
          margins while giving patients faster access to critical answers.
        </p>

        <div className="tag-group" aria-label="Locations where Alomari Associates has built labs">
          {locations.map((location) => (
            <span key={location}>{location}</span>
          ))}
        </div>

        <div className="compliance-strip">
          {compliance.map((item) => (
            <span key={item}>
              <Check size={15} aria-hidden="true" />
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Contact() {
  const [form, setForm] = useState({ first: '', last: '', email: '', message: '' });

  const mailto = useMemo(() => {
    const subject = encodeURIComponent('Alomari Associates project inquiry');
    const body = encodeURIComponent(
      `Name: ${form.first} ${form.last}\nEmail: ${form.email}\n\nProject details:\n${form.message}`,
    );
    return `mailto:Yazen@alomariassociates.com?subject=${subject}&body=${body}`;
  }, [form]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    window.location.href = mailto;
  }

  return (
    <section id="contact" className="section contact-section">
      <div className="contact-panel" data-reveal>
        <div className="contact-copy">
          <span className="section-kicker">
            <CalendarCheck2 size={18} aria-hidden="true" />
            Start the conversation
          </span>
          <h2>Ready to see what your lab revenue could become?</h2>
          <p>
            Send the project context or book a short call. We will help you identify the strongest
            path for lab buildout, compliance, staffing, billing, and launch.
          </p>

          <div className="contact-links">
            <a href="mailto:Yazen@alomariassociates.com">
              <Mail size={18} aria-hidden="true" />
              Yazen@alomariassociates.com
            </a>
            <a href="tel:+19493918215">
              <Phone size={18} aria-hidden="true" />
              (949) 391-8215
            </a>
          </div>
        </div>

        <form className="contact-form" onSubmit={handleSubmit}>
          <label>
            <span>First name</span>
            <input name="first" value={form.first} onChange={updateField} required />
          </label>
          <label>
            <span>Last name</span>
            <input name="last" value={form.last} onChange={updateField} required />
          </label>
          <label className="full">
            <span>Email</span>
            <input name="email" type="email" value={form.email} onChange={updateField} required />
          </label>
          <label className="full">
            <span>Message</span>
            <textarea name="message" rows="5" value={form.message} onChange={updateField} required />
          </label>
          <button className="button primary full submit-button" type="submit">
            Send project brief
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          <a className="button ghost full" href="https://calendly.com/yazen-alomariassociates/30min">
            Book directly on Calendly
          </a>
        </form>
      </div>
    </section>
  );
}

function App() {
  useReveal();

  return (
    <>
      <Header />
      <main>
        <Hero />
        <Intro />
        <Services />
        <ModelComparison />
        <Process />
        <Proof />
        <Contact />
      </main>
      <footer className="footer">
        <a className="brand" href="#top" aria-label="Alomari Associates home">
          <span className="brand-mark">
            <img src={logoImage} alt="" />
          </span>
          <span>
            <strong>Alomari</strong>
            <small>Associates</small>
          </span>
        </a>
        <p>Clinical laboratory consulting, buildout, compliance, and revenue operations.</p>
      </footer>
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
