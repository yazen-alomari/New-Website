import { useState, useRef } from "react";
import {
  LockKeyhole,
  Save,
  Check,
  ArrowRight,
  Plus,
  RefreshCw,
} from "./icons.js";
import { teams, teamById, phases, today, currentProgress } from "./model.js";
import { Alert, Button, Field, Modal, TeamBadge } from "./ui.jsx";
import { base, request } from "./api.js";

export function Unlock({ close, success }) {
  const [team, setTeam] = useState("congen"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal title="Unlock team editing" close={close}>
      <div className="unlock-intro">
        <div className="lock-symbol">
          <LockKeyhole size={24} />
        </div>
        <p>Choose your team</p>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setBusy(true);
          const form = new FormData(e.currentTarget);
          try {
            const response = await request("session", {
              method: "POST",
              body: JSON.stringify({
                team,
                password: form.get("password"),
                name: form.get("name"),
              }),
            });
            success(response.actor);
            close();
          } catch (err) {
            setError(err.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="team-picker">
          {teams.map((t) => (
            <button
              type="button"
              className={team === t.id ? "selected" : ""}
              key={t.id}
              onClick={() => setTeam(t.id)}
              aria-pressed={team === t.id}
              aria-label={t.name}
            >
              <span className={`team-avatar ${t.id}`}>{t.id==='congen'?<img src={`${base}/congen.png`} alt="Consultative Genomics"/>:t.initials}</span>
              <span>{t.name}</span>
              {team === t.id && <Check size={14} />}
            </button>
          ))}
        </div>
        {error && <Alert>{error}</Alert>}
        <Field label="Team password">
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            maxLength={256}
            placeholder={`${teamById(team).name} password`}
          />
        </Field>
        <Field label="Your name (optional)">
          <input
            name="name"
            autoComplete="name"
            maxLength={80}
            placeholder="Shown alongside your team badge"
          />
        </Field>
        <div className="identity-note">
          <TeamBadge id={team} />
          <span>Verified team. Names are self-reported.</span>
        </div>
        <button className="button primary full" disabled={busy}>
          {busy ? "Checking password..." : "Unlock editing"}
          <ArrowRight size={17} />
        </button>
      </form>
    </Modal>
  );
}

export function GoalForm({ goal, data, save, close, actor, onReload }) {
  const [values, setValues] = useState(
    goal
      ? { ...goal }
      : {
          title: "",
          account: "",
          scope: "",
          status: "",
          outcome: "",
          team: actor.team,
          phase: "planned",
          health: "on-track",
          startDate: today(),
          dueDate: "",
          targetWeek: "",
          eta: "TBD",
          completedDate: "",
        },
  );
  const [kind, setKind] = useState(
    goal?.dueDate
      ? "date"
      : goal?.targetWeek
        ? "week"
        : goal?.eta === "Live"
          ? "live"
          : goal?.eta === "TBC"
            ? "tbc"
            : "tbd",
  );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const revision = useRef(data.revision);
  const field = (key, value) => setValues((old) => ({ ...old, [key]: value }));
  return (
    <form
      className="editor-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setBusy(true);
        try {
          await save(
            {
              type: "goal.save",
              value: {
                ...values,
                dueDate: kind === "date" ? values.dueDate : "",
                targetWeek: kind === "week" ? values.targetWeek : "",
                eta:
                  kind === "live"
                    ? "Live"
                    : kind === "tbc"
                      ? "TBC"
                      : kind === "tbd"
                        ? "TBD"
                        : "",
              },
            },
            revision.current,
          );
          close();
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && <Alert>{error}</Alert>}
      <div className="field-grid">
        <Field label="Account">
          <input
            required
            maxLength={120}
            value={values.account}
            onChange={(e) => field("account", e.target.value)}
          />
        </Field>
        <Field label="Scope">
          <input
            required
            maxLength={240}
            value={values.scope}
            onChange={(e) => field("scope", e.target.value)}
          />
        </Field>
      </div>
      <Field label="Workstream title">
        <input
          required
          maxLength={120}
          value={values.title}
          onChange={(e) => field("title", e.target.value)}
        />
      </Field>
      <Field label="Goal to achieve">
        <textarea
          required
          maxLength={700}
          rows={3}
          value={values.outcome}
          onChange={(e) => field("outcome", e.target.value)}
        />
      </Field>
      <div className="field-grid">
        <Field label="Status">
          <select
            value={values.phase}
            onChange={(e) => field("phase", e.target.value)}
          >
            {Object.entries(phases).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Owning team">
          <select
            value={values.team}
            onChange={(e) => field("team", e.target.value)}
          >
            <option value="">Unassigned</option>
            {teams.map((t) => (
              <option value={t.id} key={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Current status detail">
        <textarea
          required
          maxLength={2000}
          rows={4}
          value={values.status}
          onChange={(e) => field("status", e.target.value)}
        />
      </Field>
      <div className="field-grid">
        <Field label="Start date">
          <input
            type="date"
            value={values.startDate}
            onChange={(e) => field("startDate", e.target.value)}
          />
        </Field>
        <Field label="Deadline / ETA">
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="date">Exact date</option>
            <option value="week">Target week</option>
            <option value="tbc">To be confirmed (TBC)</option>
            <option value="tbd">To be determined (TBD)</option>
            <option value="live">Live</option>
          </select>
        </Field>
        {kind === "date" && (
          <Field label="Target completion date">
            <input
              type="date"
              required
              min={values.startDate || undefined}
              value={values.dueDate}
              onChange={(e) => field("dueDate", e.target.value)}
            />
          </Field>
        )}
        {kind === "week" && (
          <Field label="Target week starting">
            <input
              type="date"
              required
              value={values.targetWeek}
              onChange={(e) => field("targetWeek", e.target.value)}
            />
          </Field>
        )}
        <Field label="Actual completion date">
          <input
            type="date"
            max={today()}
            value={values.completedDate}
            onChange={(e) => field("completedDate", e.target.value)}
          />
        </Field>
        <Field label="Delivery health">
          <select
            value={values.health}
            onChange={(e) => field("health", e.target.value)}
          >
            <option value="on-track">No issue flagged</option>
            <option value="at-risk">At risk</option>
            <option value="blocked">Blocked</option>
          </select>
        </Field>
      </div>
      <footer className="form-footer">
        <TeamBadge id={actor.team} />
        <div>
          <Button onClick={close}>Cancel</Button>
          <button className="button primary" disabled={busy}>
            <Save size={16} />
            {busy ? "Saving..." : "Save workstream"}
          </button>
        </div>
      </footer>
      {error.includes("newer") && (
        <Button
          icon={RefreshCw}
          onClick={() => {
            if (confirm("Discard this draft and load the latest workstream?"))
              onReload();
          }}
        >
          Load latest version
        </Button>
      )}
    </form>
  );
}

export function UpdateForm({
  goal,
  update,
  data,
  save,
  close,
  actor,
  onReload,
}) {
  const [note, setNote] = useState(update?.note || ""),
    [date, setDate] = useState(update?.date || today()),
    [progress, setProgress] = useState(
      update ? update.progress : currentProgress(goal),
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const revision = useRef(data.revision);
  return (
    <form
      className="update-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await save(
            {
              type: "update.save",
              id: goal.id,
              value: { id: update?.id, note, date, progress },
            },
            revision.current,
          );
          close();
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="section-heading">
        <h3>{update ? "Edit update" : "Add a progress update"}</h3>
        <TeamBadge id={actor.team} />
      </div>
      {error && <Alert>{error}</Alert>}
      <Field label="Update note">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          required
          maxLength={3000}
          rows={5}
          placeholder="What changed? What comes next?"
          autoFocus
        />
      </Field>
      <div className="field-grid">
        <Field label="Update date">
          <input
            type="date"
            required
            min={goal.startDate || undefined}
            max={today()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Completion (%)">
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={progress ?? ""}
            placeholder="Not set"
            onChange={(e) =>
              setProgress(e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </Field>
      </div>
      <div className="progress-control">
        <input
          aria-label="Completion progress"
          type="range"
          min={0}
          max={100}
          step={1}
          value={progress ?? 0}
          onChange={(e) => setProgress(Number(e.target.value))}
        />
        <span>{progress === null ? "Unset" : `${progress}%`}</span>
      </div>
      {progress === 100 && (
        <p className="completion-note">
          <Check size={16} />
          This records the goal as achieved.
        </p>
      )}
      <footer className="form-footer">
        <span className="muted">{actor.name || teamById(actor.team).name}</span>
        <div>
          <Button onClick={close}>Cancel</Button>
          <button className="button primary" disabled={busy}>
            <Save size={16} />
            {busy ? "Saving..." : "Save update"}
          </button>
        </div>
      </footer>
      {error.includes("newer") && (
        <Button
          icon={RefreshCw}
          onClick={() => {
            if (confirm("Discard this draft and load the latest updates?"))
              onReload();
          }}
        >
          Load latest version
        </Button>
      )}
    </form>
  );
}
