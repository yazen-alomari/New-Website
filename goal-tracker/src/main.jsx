import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Archive,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleCheck,
  Clock3,
  Download,
  Flag,
  FolderOpen,
  LayoutList,
  LockKeyhole,
  LogOut,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Table2,
  Target,
  UnlockKeyhole,
  X,
} from "./icons.js";
import { base, request } from "./api.js";
import {
  teams,
  teamById,
  phases,
  today,
  dateLabel,
  timestamp,
  currentProgress,
  completionDate,
  goalStatus,
  statusLabels,
  orderedUpdates,
  etaLabel,
  wavePath,
  dayNumber,
} from "./model.js";
import {
  Alert,
  Button,
  Field,
  IconButton,
  Modal,
  TeamBadge,
  download,
  exportSnapshot,
} from "./ui.jsx";
import { Unlock, GoalForm, UpdateForm } from "./forms.jsx";
import "./style.css";

function Trace({ goal, open }) {
  const progress = currentProgress(goal),
    updates = orderedUpdates(goal),
    latest = updates.at(-1),
    done = progress === 100;
  const points = updates.reduce((all, u) => {
    const key = u.progress ?? 0;
    all.set(key, u);
    return all;
  }, new Map());
  return (
    <div className={`trace ${done ? "achieved" : ""}`}>
      <div className="trace-labels">
        <span>
          {goal.startDate ? dateLabel(goal.startDate) : "Start not recorded"}
        </span>
        <span>
          {done
            ? `Achieved ${completionDate(goal) ? dateLabel(completionDate(goal)) : ""}`
            : goal.targetWeek
              ? etaLabel(goal)
              : goal.dueDate
                ? `Target ${etaLabel(goal)}`
                : goal.eta === "Live"
                  ? "Enhancement target unset"
                  : `Target ${etaLabel(goal)}`}
        </span>
      </div>
      <div className="trace-visual">
        <svg viewBox="0 0 760 86" preserveAspectRatio="none" aria-hidden="true">
          <path d={wavePath(20, 740, 43, 7)} className="trace-future" />
          {progress !== null && progress > 0 && (
            <path
              d={wavePath(20, 20 + (720 * progress) / 100, 43, 7)}
              className="trace-complete"
            />
          )}
        </svg>
        <span className="start-node" />
        {[...points.entries()].map(([p, u]) => (
          <button
            type="button"
            key={u.id}
            className={`update-dot ${u.source ? "import-dot" : ""} ${p === 100 ? "at-end" : ""}`}
            style={{ left: `${((20 + (720 * p) / 100) / 760) * 100}%` }}
            onClick={() => open(goal.id, u.id)}
            title={`${dateLabel(u.date)} · ${teamById(u.editor?.team || u.actor.team)?.name || "Source import"} · ${u.note}`}
            aria-label={`Read update for ${goal.account}: ${u.note}`}
          >
            <span />
          </button>
        ))}
        <span className={`finish-node ${done ? "done" : ""}`}>
          <Flag size={15} fill={done ? "currentColor" : "none"} />
        </span>
        {progress !== null && progress > 0 && progress < 100 && (
          <span
            className="progress-pin"
            style={{ left: `${((20 + (720 * progress) / 100) / 760) * 100}%` }}
          >
            {progress}%
          </span>
        )}
      </div>
      <div className="trace-bottom">
        <span className={done ? "achieved-text" : "muted"}>
          {done ? (
            <>
              <CheckCheck size={14} />
              Goal achieved
            </>
          ) : progress === null ? (
            "Progress not set"
          ) : (
            `${progress}% complete`
          )}
        </span>
        <button
          type="button"
          className="text-button"
          onClick={() => open(goal.id)}
        >
          <MessageSquare size={13} />
          {updates.length} {updates.length === 1 ? "update" : "updates"}
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}
function GoalRow({ goal, data, open, edit, actor }) {
  const latest = orderedUpdates(goal).at(-1),
    lastEdit = data.history.find((e) => e.goalId === goal.id),
    health = goalStatus(goal);
  return (
    <article
      className={`goal-row ${health === "achieved" ? "is-complete" : ""}`}
    >
      <div className="goal-identity">
        <div className="account-line">
          <span className="account-avatar">
            {goal.account.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <button className="account-name" onClick={() => open(goal.id)}>
              {goal.account}
              <ArrowUpRight size={13} />
            </button>
            <span className="scope-label">{goal.scope}</span>
          </div>
        </div>
        <h2>
          <button onClick={() => open(goal.id)}>{goal.title}</button>
        </h2>
        <p className="goal-outcome">{goal.outcome}</p>
        <div className="row-badges">
          <span className={`status-badge phase-${goal.phase}`}>
            <i />
            {phases[goal.phase]}
          </span>
          {["blocked", "overdue", "at-risk"].includes(health) && (
            <span className={`status-badge ${health}`}>
              {statusLabels[health]}
            </span>
          )}
        </div>
      </div>
      <div className="goal-journey">
        <Trace goal={goal} open={open} />
        <div className="row-note">
          <TeamBadge
            id={latest?.editor?.team || latest?.actor.team || goal.team}
            small
          />
          <p>{latest?.note || "No updates yet."}</p>
          <span>{latest ? dateLabel(latest.date) : ""}</span>
        </div>
      </div>
      <div className="goal-row-footer">
        <span>
          <CalendarDays size={13} />
          <b>ETA</b> {etaLabel(goal)}
        </span>
        <span className="owner-label">
          Owner <TeamBadge id={goal.team} small />
        </span>
        <div className="footer-spacer" />
        {lastEdit && (
          <span className="last-edit">
            Edited by <TeamBadge id={lastEdit.actor.team} small />
          </span>
        )}
        {actor && (
          <button className="text-button" onClick={() => edit(goal.id)}>
            <Pencil size={12} />
            Edit
          </button>
        )}
      </div>
    </article>
  );
}
function History({ events }) {
  if (!events.length)
    return (
      <div className="empty-state">
        <Activity size={26} />
        <h3>No edits after import</h3>
      </div>
    );
  return (
    <div className="history-feed">
      {events.map((event) => (
        <article key={event.id}>
          <span className={`event-dot ${event.actor.team}`} />
          <div>
            <div className="event-heading">
              <TeamBadge id={event.actor.team} />
              <span>{event.actor.name}</span>
              <time>{timestamp(event.at)}</time>
            </div>
            <h3>{event.summary}</h3>
            <p>{event.goalTitle}</p>
            <details>
              <summary>
                View change record
                <ChevronDown size={12} />
              </summary>
              <div className="change-record">
                {Object.keys(event.after || {})
                  .filter(
                    (k) =>
                      ![
                        "actor",
                        "editor",
                        "order",
                        "id",
                        "createdAt",
                        "editedAt",
                      ].includes(k),
                  )
                  .filter(
                    (k) =>
                      JSON.stringify(event.before?.[k]) !==
                      JSON.stringify(event.after[k]),
                  )
                  .map((key) => (
                    <div key={key}>
                      <b>
                        {{
                          outcome: "Goal",
                          dueDate: "Target date",
                          targetWeek: "Target week",
                          completedDate: "Completion date",
                          startDate: "Start date",
                          note: "Update note",
                          progress: "Progress",
                          team: "Owner",
                          phase: "Status",
                        }[key] || key}
                      </b>
                      {event.before?.[key] !== undefined && (
                        <p className="before">
                          {String(event.before[key] ?? "Not set")}
                        </p>
                      )}
                      <p>{String(event.after[key] ?? "Not set")}</p>
                    </div>
                  ))}
              </div>
            </details>
          </div>
        </article>
      ))}
    </div>
  );
}
function GoalDrawer({ goal, data, actor, close, save, unlock, mode, load }) {
  const [tab, setTab] = useState("updates"),
    [editor, setEditor] = useState(
      mode === "edit" ? "goal" : mode === "add" ? "update" : null,
    ),
    [selected, setSelected] = useState(null),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  const progress = currentProgress(goal),
    events = data.history.filter((e) => e.goalId === goal.id);
  const reload = async () => {
    await load();
    setVersion((v) => v + 1);
  };
  return (
    <Modal title={goal.account} close={close} drawer>
      <div className="drawer-content">
        <div className="drawer-meta">
          <span className={`status-badge phase-${goal.phase}`}>
            <i />
            {phases[goal.phase]}
          </span>
          <TeamBadge id={goal.team} />
          <span>{goal.scope}</span>
        </div>
        <h2 className="drawer-title">{goal.title}</h2>
        <div className="goal-statement">
          <span className="eyebrow">GOAL TO ACHIEVE</span>
          <p>{goal.outcome}</p>
        </div>
        <div className="drawer-facts">
          <div>
            <span>Completion</span>
            <b>{progress === null ? "Not set" : progress + "%"}</b>
          </div>
          <div>
            <span>Target / ETA</span>
            <b>{etaLabel(goal)}</b>
          </div>
          <div>
            <span>Last update</span>
            <b>
              {orderedUpdates(goal).at(-1)
                ? dateLabel(orderedUpdates(goal).at(-1).date)
                : "None"}
            </b>
          </div>
        </div>
        {error && <Alert>{error}</Alert>}
        {editor === "goal" && actor ? (
          <GoalForm
            key={version}
            goal={goal}
            data={data}
            actor={actor}
            save={save}
            close={() => setEditor(null)}
            onReload={reload}
          />
        ) : (
          <>
            <div className="status-detail">
              <span className="eyebrow">CURRENT STATUS</span>
              <p>{goal.status}</p>
            </div>
            <div className="drawer-actions">
              {actor ? (
                <>
                  <Button icon={Pencil} onClick={() => setEditor("goal")}>
                    Edit workstream
                  </Button>
                  <Button
                    icon={Plus}
                    primary
                    disabled={goal.archived}
                    onClick={() => {
                      setSelected(null);
                      setEditor("update");
                    }}
                  >
                    Add update
                  </Button>
                  <IconButton
                    icon={Archive}
                    label={
                      goal.archived
                        ? "Restore workstream"
                        : "Archive workstream"
                    }
                    onClick={async () => {
                      if (
                        confirm(
                          `${goal.archived ? "Restore" : "Archive"} this workstream?`,
                        )
                      ) {
                        try {
                          await save(
                            { type: "goal.archive", id: goal.id },
                            data.revision,
                          );
                          close();
                        } catch (err) {
                          setError(err.message);
                        }
                      }
                    }}
                  />
                </>
              ) : (
                <Button icon={LockKeyhole} onClick={unlock}>
                  Unlock to edit
                </Button>
              )}
            </div>
            <div className="detail-tabs">
              <button
                className={tab === "updates" ? "active" : ""}
                onClick={() => setTab("updates")}
              >
                Updates <span>{goal.updates.length}</span>
              </button>
              <button
                className={tab === "history" ? "active" : ""}
                onClick={() => setTab("history")}
              >
                Edit history <span>{events.length}</span>
              </button>
            </div>
            {editor === "update" && actor && (
              <UpdateForm
                key={`${version}-${selected?.id || "new"}`}
                goal={goal}
                update={selected}
                data={data}
                actor={actor}
                save={save}
                close={() => setEditor(null)}
                onReload={reload}
              />
            )}{" "}
            {tab === "history" ? (
              <History events={events} />
            ) : (
              <div className="updates-feed">
                {orderedUpdates(goal)
                  .reverse()
                  .map((u) => (
                    <article key={u.id}>
                      <div className="note-track">
                        <span className={u.progress === 100 ? "complete" : ""}>
                          {u.progress === 100 ? <Check size={12} /> : <span />}
                        </span>
                      </div>
                      <div className="update-body">
                        <header>
                          <TeamBadge id={u.editor?.team || u.actor.team} />
                          <span>{u.editor?.name || u.actor.name}</span>
                          {actor && !goal.archived && (
                            <IconButton
                              icon={Pencil}
                              label={`Edit update from ${dateLabel(u.date)}`}
                              onClick={() => {
                                setSelected(u);
                                setEditor("update");
                              }}
                            />
                          )}
                        </header>
                        <div className="update-meta">
                          <time>{dateLabel(u.date, true)}</time>
                          <span>
                            {u.progress === null
                              ? "Progress not set"
                              : `${u.progress}% complete`}
                          </span>
                        </div>
                        <p>{u.note}</p>
                        {u.editedAt && (
                          <small className="edited-note">
                            Edited {timestamp(u.editedAt)}. Original version
                            retained in history.
                          </small>
                        )}
                        {u.source && (
                          <small className="source-note">
                            Imported from the November 6 status report.
                          </small>
                        )}
                      </div>
                    </article>
                  ))}
                {!goal.updates.length && (
                  <div className="empty-state">
                    <MessageSquare size={25} />
                    <h3>No updates yet</h3>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
function Register({ goals, data, open }) {
  return (
    <div className="register-scroll">
      <table>
        <thead>
          <tr>
            <th>Account / workstream</th>
            <th>Scope</th>
            <th>Status</th>
            <th>ETA</th>
            <th>Last edited by</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {goals.map((g) => (
            <tr key={g.id}>
              <td>
                <button onClick={() => open(g.id)}>
                  <b>{g.account}</b>
                  <small>{g.title}</small>
                </button>
              </td>
              <td>{g.scope}</td>
              <td>
                <span className={`status-badge phase-${g.phase}`}>
                  <i />
                  {phases[g.phase]}
                </span>
                <p>{g.status}</p>
              </td>
              <td className="eta-cell">{etaLabel(g)}</td>
              <td>
                <TeamBadge
                  id={
                    data.history.find((e) => e.goalId === g.id)?.actor.team ||
                    "source"
                  }
                />
              </td>
              <td>
                <IconButton
                  icon={ArrowUpRight}
                  label={`Open ${g.account} ${g.scope}`}
                  onClick={() => open(g.id)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function App() {
  const [data, setData] = useState(null),
    [actor, setActor] = useState(null),
    [preview, setPreview] = useState(true),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [tab, setTab] = useState("timeline"),
    [team, setTeam] = useState("all"),
    [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("report"),
    [modal, setModal] = useState(null),
    [reauth, setReauth] = useState(false),
    [selectedId, setSelectedId] = useState(null),
    [mode, setMode] = useState(null),
    [busy, setBusy] = useState(false),
    [exportMenu, setExportMenu] = useState(false);
  const timer = useRef(),
    inFlight = useRef(false),
    revision = useRef(-1),
    modalRef = useRef(null);
  modalRef.current = modal || selectedId;
  const notify = (message) => {
    setToast(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 4500);
  };
  const accept = (next) => {
    if (next.revision >= revision.current) {
      revision.current = next.revision;
      setData(next);
    }
  };
  async function load() {
    try {
      const next = await request("workspace");
      accept(next);
      setError("");
      return next;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }
  useEffect(() => {
    load();
    request("session")
      .then((s) => {
        setActor(s.actor);
        setPreview(Boolean(s.preview));
      })
      .catch((e) => setError(e.message));
    const interval = setInterval(() => {
      if (!inFlight.current && !modalRef.current) load();
    }, 15000);
    return () => {
      clearInterval(interval);
      clearTimeout(timer.current);
    };
  }, []);
  async function save(action, expectedRevision) {
    if (inFlight.current)
      throw new Error("Another save is in progress. Please wait.");
    inFlight.current = true;
    setBusy(true);
    try {
      const next = await request("workspace", {
        method: "POST",
        body: JSON.stringify({ revision: expectedRevision, action }),
      });
      accept(next);
      notify(
        action.type === "update.save"
          ? "Update saved to the timeline"
          : "Workstream saved",
      );
      return next;
    } catch (err) {
      if (err.status === 401) setReauth(true);
      throw err;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  function open(id, updateId, editMode) {
    setSelectedId(id);
    setMode(editMode || null);
    setExportMenu(false);
  }
  const selected = data?.goals.find((g) => g.id === selectedId);
  if (!data)
    return (
      <div className="loading-page">
        <span className="brand-square">
          AA
          <span />
        </span>
        <h1>TrueMed LIS tracker</h1>
        {error ? (
          <>
            <Alert>{error}</Alert>
            <Button icon={RefreshCw} onClick={load}>
              Retry connection
            </Button>
          </>
        ) : (
          <p>Loading workstreams...</p>
        )}
      </div>
    );
  const active = data.goals.filter((g) => !g.archived),
    live = active.filter((g) => ["live", "enhancement"].includes(g.phase)),
    achieved = active.filter((g) => currentProgress(g) === 100),
    scheduled = active.filter(
      (g) => currentProgress(g) !== 100 && (g.dueDate || g.targetWeek),
    );
  let visible = data.goals
    .filter((g) => (filter === "archived" ? g.archived : !g.archived))
    .filter(
      (g) =>
        team === "all" || (team === "unassigned" ? !g.team : g.team === team),
    )
    .filter((g) =>
      filter === "active"
        ? currentProgress(g) !== 100
        : filter === "achieved"
          ? currentProgress(g) === 100
          : filter === "attention"
            ? ["overdue", "blocked", "at-risk"].includes(goalStatus(g))
            : true,
    )
    .filter((g) =>
      `${g.account} ${g.scope} ${g.title} ${g.status}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  if (sort === "deadline")
    visible = [...visible].sort((a, b) =>
      (a.dueDate || a.targetWeek || "9999").localeCompare(
        b.dueDate || b.targetWeek || "9999",
      ),
    );
  if (sort === "account")
    visible = [...visible].sort((a, b) => a.account.localeCompare(b.account));
  return (
    <div className="app">
      <header className="topbar">
        <a
          className="brand"
          href="https://www.alomariassociates.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="brand-square">
            AA
            <span />
          </span>
          <span>
            Alomari Associates<small>PARTNER OPERATIONS</small>
          </span>
        </a>
        <div className="topbar-divider" />
        <span className="workspace-name">TrueMed LIS</span>
        <div className="topbar-right">
          <span className="sync-state">
            <i className={busy ? "pending" : ""} />
            {busy
              ? "Saving..."
              : preview
                ? "Local preview"
                : "Shared workspace"}
          </span>
          {actor ? (
            <>
              <TeamBadge id={actor.team} />
              <IconButton
                icon={LogOut}
                label="Lock editing"
                onClick={async () => {
                  try {
                    await request("session", { method: "DELETE" });
                    setActor(null);
                    notify("Editing locked");
                  } catch (err) {
                    setError(err.message);
                  }
                }}
              />
            </>
          ) : (
            <Button icon={LockKeyhole} onClick={() => setModal("unlock")}>
              Unlock editing
            </Button>
          )}
        </div>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              <span className="section-dot" />
              AEGIS / QMD INTEGRATION
            </div>
            <h1>
              TrueMed LIS tracker<span className="heading-period">.</span>
            </h1>
            <p>Workstreams, goals & delivery milestones</p>
          </div>
          <div className="heading-actions">
            <div className="export-control">
              <IconButton
                icon={ArrowDownToLine}
                label="Export workspace"
                onClick={() => setExportMenu(!exportMenu)}
              />
              {exportMenu && (
                <div className="export-menu">
                  <button
                    onClick={() => {
                      exportSnapshot(data);
                      setExportMenu(false);
                    }}
                  >
                    <Download size={15} />
                    Embedded HTML snapshot
                  </button>
                  <button
                    onClick={() => {
                      download(
                        "TrueMed-LIS-backup.json",
                        JSON.stringify(data, null, 2),
                        "application/json",
                      );
                      setExportMenu(false);
                    }}
                  >
                    <Download size={15} />
                    Full JSON backup
                  </button>
                </div>
              )}
            </div>
            <IconButton
              icon={RefreshCw}
              label="Refresh workstreams"
              onClick={async () => {
                if (await load()) notify("Workspace up to date");
              }}
            />
            <Button
              icon={Plus}
              primary
              onClick={() => setModal(actor ? "new" : "unlock")}
            >
              New workstream
            </Button>
          </div>
        </div>
        {error && <Alert>{error}</Alert>}
        <div className="summary-strip">
          <div>
            <span>
              <FolderOpen size={15} />
              Workstreams
            </span>
            <strong>{active.length.toString().padStart(2, "0")}</strong>
            <small>Across all accounts</small>
          </div>
          <div>
            <span>
              <Activity size={15} />
              Live integrations
            </span>
            <strong className="green-text">
              {live.length.toString().padStart(2, "0")}
            </strong>
            <small>Including live enhancements</small>
          </div>
          <div>
            <span>
              <CircleCheck size={15} />
              Goals achieved
            </span>
            <strong>{achieved.length.toString().padStart(2, "0")}</strong>
            <small>Production milestones delivered</small>
          </div>
          <div>
            <span>
              <CalendarDays size={15} />
              Scheduled next
            </span>
            <strong className="next-date">
              {scheduled.length
                ? etaLabel(
                    [...scheduled].sort((a, b) =>
                      (a.dueDate || a.targetWeek).localeCompare(
                        b.dueDate || b.targetWeek,
                      ),
                    )[0],
                  )
                : "Not set"}
            </strong>
            <small>
              {scheduled.length
                ? scheduled[0].account
                : "Awaiting target dates"}
            </small>
          </div>
        </div>
        <div className="view-tabs">
          <div>
            {[
              ["timeline", "Timeline", LayoutList],
              ["register", "Account register", Table2],
              ["activity", "Edit history", Activity],
            ].map(([key, name, Icon]) => (
              <button
                key={key}
                aria-label={name}
                onClick={() => setTab(key)}
                className={tab === key ? "active" : ""}
              >
                <Icon size={15} />
                {name}
                {key === "activity" && data.history.length > 0 && (
                  <span>{data.history.length}</span>
                )}
              </button>
            ))}
          </div>
          <span className="source-stamp">
            Source report{" "}
            <b>
              {data.source
                ? dateLabel(data.source.asOf, true)
                : "New workspace"}
            </b>
          </span>
        </div>
        {tab !== "activity" ? (
          <>
            <div className="filter-toolbar">
              <div className="team-filters">
                <button
                  className={team === "all" ? "active" : ""}
                  onClick={() => setTeam("all")}
                >
                  All teams
                </button>
                {teams.map((t) => (
                  <button
                    className={team === t.id ? "active" : ""}
                    key={t.id}
                    onClick={() => setTeam(t.id)}
                  >
                    <i className={t.id} />
                    {t.name}
                  </button>
                ))}
                <button
                  className={team === "unassigned" ? "active" : ""}
                  onClick={() => setTeam("unassigned")}
                >
                  Unassigned
                </button>
              </div>
              <div className="filter-inputs">
                <label className="search-input">
                  <Search size={15} />
                  <input
                    aria-label="Search workstreams"
                    placeholder="Search accounts"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Filter workstreams"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All workstreams</option>
                  <option value="active">Active goals</option>
                  <option value="achieved">Achieved goals</option>
                  <option value="attention">Needs attention</option>
                  <option value="archived">Archived</option>
                </select>
                <select
                  aria-label="Sort workstreams"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="report">Report order</option>
                  <option value="deadline">By deadline</option>
                  <option value="account">By account</option>
                </select>
              </div>
            </div>
            <div className="list-caption">
              <span>{visible.length} WORKSTREAMS</span>
              <div>
                <span>
                  <i className="legend-green" />
                  Recorded progress
                </span>
                <span>
                  <i className="legend-gray" />
                  Remaining
                </span>
                <span>
                  <Flag size={11} />
                  Goal
                </span>
              </div>
            </div>
            {!visible.length ? (
              <div className="empty-state">
                <Search size={27} />
                <h3>No matching workstreams</h3>
                <Button
                  onClick={() => {
                    setTeam("all");
                    setSearch("");
                    setFilter("all");
                  }}
                >
                  Reset filters
                </Button>
              </div>
            ) : tab === "register" ? (
              <Register goals={visible} data={data} open={open} />
            ) : (
              <div className="goal-list">
                {visible.map((g) => (
                  <GoalRow
                    key={g.id}
                    goal={g}
                    data={data}
                    actor={actor}
                    open={open}
                    edit={(id) => open(id, null, "edit")}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="all-history">
            <div className="section-heading">
              <h2>Every change, attributed.</h2>
              <span className="muted">
                {data.history.length} recorded edits
              </span>
            </div>
            <History events={data.history} />
          </div>
        )}
        <footer className="page-footer">
          <span>
            <span className="mini-wordmark">AA</span>Alomari Associates
          </span>
          <span>
            {actor ? (
              <>
                <UnlockKeyhole size={13} />
                Editing as {teamById(actor.team).name}
              </>
            ) : (
              <>
                <LockKeyhole size={13} />
                Read-only view
              </>
            )}
            <i />
            Pacific time
          </span>
        </footer>
      </main>
      {selected && (
        <GoalDrawer
          key={selected.id + ":" + mode}
          goal={selected}
          data={data}
          actor={actor}
          close={() => setSelectedId(null)}
          save={save}
          unlock={() => setModal("unlock")}
          mode={mode}
          load={load}
        />
      )}{" "}
      {(modal === "unlock" || reauth) && (
        <Unlock
          close={() => {
            if (modal === "unlock") setModal(null);
            setReauth(false);
          }}
          success={(identity) => {
            setActor(identity);
            notify(`${teamById(identity.team).name} editing unlocked`);
          }}
        />
      )}
      {modal === "new" && actor && (
        <Modal title="New workstream" close={() => setModal(null)}>
          <GoalForm
            data={data}
            save={save}
            actor={actor}
            close={() => setModal(null)}
            onReload={async () => {
              await load();
              setModal(null);
            }}
          />
        </Modal>
      )}
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
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
