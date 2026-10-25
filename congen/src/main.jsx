import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  FlaskConical,
  FolderOpen,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import Costs from "./Costs.jsx";
import Clients from "./Clients.jsx";
import { Materials, Settings } from "./Library.jsx";
import {
  Alert,
  Badge,
  Button,
  Empty,
  Field,
  IconButton,
  Loading,
  Metric,
  Modal,
} from "./components.jsx";
import { base, request } from "./api.js";
import { dayLabel, isoDay, money, progress, stages } from "./model.js";
import { calculateMolecularCosts } from "./cost-engine.js";
import "./style.css";

const nav = [
  ["", "Overview", LayoutDashboard],
  ["costs", "Cost analysis", FlaskConical],
  ["clients", "Client onboarding", Users],
  ["materials", "Materials", FolderOpen],
];
const route = () =>
  location.pathname.replace(base, "").replace(/^\/+|\/+$/g, "");
function AccessForm({ onSuccess, expired = false }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const value = Object.fromEntries(new FormData(e.currentTarget));
          const result = await request("session", {
            method: "POST",
            body: JSON.stringify(value),
          });
          onSuccess(result);
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && <Alert>{error}</Alert>}
      <Field label="Your name">
        <input
          name="name"
          required
          maxLength={80}
          autoComplete="name"
          placeholder="First and last name"
        />
      </Field>
      <Field label="Team access key">
        <input
          name="key"
          type="password"
          required
          maxLength={256}
          autoComplete="current-password"
          placeholder="Enter your team key"
        />
      </Field>
      <button className="button primary access-submit" disabled={busy}>
        {busy
          ? "Verifying access..."
          : expired
            ? "Continue session"
            : "Enter workspace"}
        <ArrowRight size={17} />
      </button>
    </form>
  );
}
function Overview({ data, navigate, actor }) {
  const clients = data.clients.filter((c) => !c.archived),
    live = clients.filter((c) => progress(c).active),
    waiting = clients.filter((c) => !progress(c).active);
  const attention = clients.filter(
    (c) => c.hold || (c.dueDate && c.dueDate < isoDay() && !progress(c).active),
  );
  const baseline = calculateMolecularCosts(
    data.scenarios[0].analysis,
    data.rates,
  );
  const events = clients
    .flatMap((c) => c.events.map((e) => ({ ...e, client: c })))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 5);
  return (
    <div className="overview">
      <div className="page-heading">
        <div>
          <span className="eyebrow">{data.settings.teamName.toUpperCase()} / OPERATIONS</span>
          <h1>Operations overview</h1>
          <p>Welcome back, {actor.split(" ")[0]}. Your team, in sync.</p>
        </div>
        <Badge tone="green">
          <i className="live-dot" />
          Team workspace
        </Badge>
      </div>
      <div className="metrics">
        <Metric
          label="Onboarding pipeline"
          value={waiting.length}
          detail="Laboratories & clinics"
        />
        <Metric
          label="Live accounts"
          value={live.length}
          detail="Fully onboarded"
          accent="green"
        />
        <Metric
          label="Needs attention"
          value={attention.length}
          detail="On hold or past target"
          accent="amber"
        />
        <Metric
          label="Cost scenarios"
          value={data.scenarios.length}
          detail={`${data.rates.panels.length} configured test panels`}
        />
      </div>
      <div className="module-grid">
        <button
          className="module cost-module"
          onClick={() => navigate("costs")}
        >
          <div className="module-top">
            <span className="module-icon">
              <FlaskConical size={23} />
            </span>
            <span className="eyebrow">01 / TEST ECONOMICS</span>
            <ArrowUpRight size={21} />
          </div>
          <h2>Test cost analysis</h2>
          <div className="module-benchmarks">
            {baseline.panels.slice(0, 4).map((p, i) => (
              <div key={p.id}>
                <span>
                  <i className={`panel-dot color-${i}`} />
                  {p.name}
                </span>
                <b>{money(p.perReportCents)}</b>
              </div>
            ))}
          </div>
          <footer>
            <span>
              Known cost / report at {data.scenarios[0].analysis.batchSize}{" "}
              samples
            </span>
            <ArrowRight size={18} />
          </footer>
        </button>
        <button
          className="module client-module"
          onClick={() => navigate("clients")}
        >
          <div className="module-top">
            <span className="module-icon">
              <Users size={23} />
            </span>
            <span className="eyebrow">02 / CLIENT ONBOARDING</span>
            <ArrowUpRight size={21} />
          </div>
          <h2>Client onboarding</h2>
          <div className="module-timeline">
            {["Introduction", "Vetting", "Readiness", "Go live"].map((s, i) => (
              <div key={s}>
                <span>
                  {i === 3 ? (
                    <Check size={14} />
                  ) : (
                    String(i + 1).padStart(2, "0")
                  )}
                </span>
                <small>{s}</small>
              </div>
            ))}
          </div>
          <footer>
            <span>
              {clients.filter((c) => c.type === "lab").length} referring labs{" "}
              <span className="separator">/</span>{" "}
              {clients.filter((c) => c.type === "clinic").length} clinics
            </span>
            <ArrowRight size={18} />
          </footer>
        </button>
      </div>
      <div className="overview-bottom">
        <section>
          <div className="section-heading">
            <h2>On your radar</h2>
            <button className="text-link" onClick={() => navigate("clients")}>
              All clients
              <ArrowUpRight size={15} />
            </button>
          </div>
          {waiting.length ? (
            <div className="radar-list">
              {[...waiting]
                .sort((a, b) =>
                  (a.dueDate || "9999").localeCompare(b.dueDate || "9999"),
                )
                .slice(0, 4)
                .map((c) => (
                  <button
                    onClick={() => navigate(`clients/${c.id}`)}
                    key={c.id}
                  >
                    <span className="avatar">
                      {c.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span>
                      <b>{c.name}</b>
                      <small>
                        {c.nextAction || stages[progress(c).index].name}
                      </small>
                    </span>
                    <Badge tone={c.hold ? "amber" : "blue"}>
                      {c.hold ? "On hold" : stages[progress(c).index].short}
                    </Badge>
                    <ChevronRight size={16} />
                  </button>
                ))}
            </div>
          ) : (
            <Empty
              icon={Users}
              title="No pending introductions"
              action={
                <Button icon={Plus} onClick={() => navigate("clients")}>
                  Introduce a client
                </Button>
              }
            />
          )}
        </section>
        <section>
          <div className="section-heading">
            <h2>Recent activity</h2>
            <Activity size={17} />
          </div>
          {events.length ? (
            <div className="activity-list">
              {events.map((e) => (
                <article key={e.id}>
                  <i />
                  <div>
                    <p>{e.message}</p>
                    <button
                      className="text-link"
                      onClick={() => navigate(`clients/${e.client.id}`)}
                    >
                      {e.client.name}
                    </button>
                    <span>
                      {e.actor} / {dayLabel(e.at)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty icon={Activity} title="A fresh start">
              Team updates will appear here.
            </Empty>
          )}
        </section>
      </div>
    </div>
  );
}
function App() {
  const [session, setSession] = useState(null),
    [loading, setLoading] = useState(true),
    [data, setData] = useState(null),
    [path, setPath] = useState(route),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [menu, setMenu] = useState(false),
    [reauth, setReauth] = useState(false),
    [dirty, setDirty] = useState(false),
    [refreshVersion, setRefreshVersion] = useState(0);
  const locked = useRef(false),
    timer = useRef(null),
    dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const onData = (response) =>
    setData({ ...response.data, revision: response.revision });
  const notify = (message) => {
    setToast(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 5500);
  };
  const report = (err) => {
    setError(err.message);
    window.dispatchEvent(
      new CustomEvent("congen-error", { detail: err.message }),
    );
    if (err.status === 401) setReauth(true);
  };
  async function load() {
    setError("");
    try {
      const response = await request("workspace");
      onData(response);
      return true;
    } catch (err) {
      report(err);
      return false;
    }
  }
  useEffect(() => {
    (async () => {
      try {
        const value = await request("session");
        setSession(value);
        if (value.authenticated) await load();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
    return () => clearTimeout(timer.current);
  }, []);
  useEffect(() => {
    const pop = () => {
      if (
        dirtyRef.current &&
        !window.confirm("Discard unsaved scenario edits?")
      ) {
        history.pushState({}, "", `${base}/${path}`);
        return;
      }
      setDirty(false);
      setPath(route());
    };
    const leave = (e) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("popstate", pop);
    window.addEventListener("beforeunload", leave);
    return () => {
      window.removeEventListener("popstate", pop);
      window.removeEventListener("beforeunload", leave);
    };
  }, [path]);
  function navigate(next) {
    if (next === path) {
      setMenu(false);
      return;
    }
    if (dirty && !window.confirm("Discard unsaved scenario edits?")) return;
    setDirty(false);
    setMenu(false);
    history.pushState({}, "", `${base}${next ? `/${next}` : ""}`);
    setPath(next);
    setError("");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function save(action) {
    if (locked.current) return null;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await request("workspace", {
        method: "POST",
        body: JSON.stringify({ revision: data.revision, action }),
      });
      onData(response);
      return response.data;
    } catch (err) {
      report(err);
      return null;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function refresh() {
    if (dirty && !window.confirm("Refresh and discard unsaved scenario edits?"))
      return;
    setBusy(true);
    const loaded = await load();
    setBusy(false);
    if (loaded) {
      setDirty(false);
      setRefreshVersion((value) => value + 1);
      notify("Workspace refreshed");
    }
  }
  async function logout() {
    if (
      dirty &&
      !window.confirm("Discard unsaved scenario edits and sign out?")
    )
      return;
    try {
      await request("session", { method: "DELETE" });
      setSession({ authenticated: false });
      setData(null);
      setDirty(false);
    } catch (err) {
      report(err);
    }
  }
  if (loading) return <Loading />;
  if (!session?.authenticated)
    return (
      <div className="access-page">
        <header>
          <a href="/">
            Alomari Associates
            <ArrowUpRight size={15} />
          </a>
          <span>
            <LockKeyhole size={14} />
            Internal workspace
          </span>
        </header>
        <main>
          <img src={`${base}/logo.png`} alt="Consultative Genomics PLLC" />
          <span className="eyebrow">CONSULTATIVE GENOMICS</span>
          <h1>
            Good decisions.
            <br />
            Connected operations.
          </h1>
          <p className="access-intro">Team access</p>
          {error && <Alert>{error}</Alert>}
          <AccessForm
            onSuccess={async (s) => {
              setSession(s);
              await load();
            }}
          />
          <div className="access-foot">
            <ShieldCheck size={16} />
            <span>Authorized team members only</span>
          </div>
        </main>
        <footer>
          Consultative Genomics <span>/</span> Alomari Associates
        </footer>
      </div>
    );
  const current = path.split("/")[0];
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <button className="brand" onClick={() => navigate("")}>
          <span className="brand-mark">
            CG
            <span />
          </span>
          <span>
            Consultative
            <br />
            <b>Genomics</b>
          </span>
        </button>
        <span className="sidebar-caption">OPERATIONS WORKSPACE</span>
        <nav>
          {nav.map(([p, label, Icon]) => (
            <button
              key={p}
              className={current === p ? "active" : ""}
              onClick={() => navigate(p)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {p === "clients" &&
                data?.clients.filter((c) => !c.archived && !progress(c).active)
                  .length > 0 && (
                  <small>
                    {
                      data.clients.filter(
                        (c) => !c.archived && !progress(c).active,
                      ).length
                    }
                  </small>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className={current === "settings" ? "active" : ""}
            onClick={() => navigate("settings")}
          >
            <Settings2 size={18} />
            Workspace settings
          </button>
          <a href="/" target="_blank" rel="noopener noreferrer">
            Alomari Associates
            <ArrowUpRight size={15} />
          </a>
          <div className="team-identity">
            <span className="avatar">
              {session.name?.slice(0, 2).toUpperCase()}
            </span>
            <span>
              <b>{session.name}</b>
              <small>Team member</small>
            </span>
            <IconButton icon={LogOut} label="Sign out" onClick={logout} />
          </div>
        </div>
      </aside>
      {menu && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <IconButton
            icon={menu ? X : Menu}
            label="Toggle navigation"
            className="icon-button mobile-menu"
            onClick={() => setMenu(!menu)}
          />
          <div className="breadcrumbs">
            <span>Workspace</span>
            <ChevronRight size={13} />
            <b>
              {[...nav, ["settings", "Settings"]].find(
                ([p]) => p === current,
              )?.[1] || "Overview"}
            </b>
          </div>
          <div className="topbar-right">
            <span className="sync-status">
              <i className={busy ? "pending" : ""} />
              {busy ? "Saving..." : "Shared workspace"}
            </span>
            <IconButton
              icon={RefreshCw}
              label="Refresh shared workspace"
              disabled={busy}
              onClick={refresh}
            />
            <span className="topbar-date">
              {new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </header>
        <main className="main-content">
          {error && (
            <div className="error-strip">
              <Alert>{error}</Alert>
              <Button icon={RefreshCw} onClick={refresh} disabled={busy}>
                Refresh
              </Button>
            </div>
          )}
          {!data ? (
            <div>
              <Loading />
              <Button onClick={load}>Retry connection</Button>
            </div>
          ) : current === "costs" ? (
            <Costs
              key={refreshVersion}
              data={data}
              save={save}
              busy={busy}
              notify={notify}
              onDirty={setDirty}
            />
          ) : current === "clients" ? (
            <Clients
              data={data}
              save={save}
              busy={busy}
              actor={session.name}
              notify={notify}
              clientId={path.split("/")[1]}
              navigate={navigate}
              onData={onData}
            />
          ) : current === "materials" ? (
            <Materials
              data={data}
              save={save}
              busy={busy}
              onData={onData}
              notify={notify}
            />
          ) : current === "settings" ? (
            <Settings data={data} save={save} busy={busy} notify={notify} />
          ) : (
            <Overview data={data} navigate={navigate} actor={session.name} />
          )}
        </main>
        <footer className="workspace-footer">
          <span>Consultative Genomics</span>
          <span>
            Internal operations <i /> No patient data
          </span>
        </footer>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
          <IconButton
            icon={X}
            label="Dismiss notification"
            onClick={() => setToast("")}
          />
        </div>
      )}
      {reauth && (
        <Modal
          title="Continue your session"
          subtitle="Your unsaved draft remains open."
          close={() => setReauth(false)}
        >
          <AccessForm
            expired
            onSuccess={(s) => {
              setSession(s);
              setReauth(false);
              setError("");
              notify("Session renewed. You can retry your save.");
            }}
          />
        </Modal>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
