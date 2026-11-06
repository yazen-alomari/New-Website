export const teams = [
  { id: "congen", name: "Congen", initials: "CG", color: "#458b48" },
  { id: "aegis", name: "Aegis", initials: "AE", color: "#397b9c" },
  { id: "truemed", name: "True Med", initials: "TM", color: "#9a6b48" },
];
export const teamById = (id) => teams.find((t) => t.id === id);
export const phases = {
  planned: "Not integrated",
  waiting: "Awaiting kickoff",
  development: "In development",
  validation: "Validating",
  qa: "In QA",
  live: "Live",
  enhancement: "Live + development",
};
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const dayNumber = (date) => Date.parse(`${date}T12:00:00Z`) / 86400000;
export const offsetDay = (date, amount) =>
  new Date((dayNumber(date) + amount) * 86400000).toISOString().slice(0, 10);
export const dateLabel = (date, year = false) =>
  new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(year ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
export const timestamp = (value) =>
  new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
export const orderedUpdates = (goal) =>
  [...goal.updates].sort(
    (a, b) => a.date.localeCompare(b.date) || a.order - b.order,
  );
export const currentProgress = (goal) =>
  orderedUpdates(goal)
    .filter(
      (u) =>
        u.progress !== null && u.order >= (goal.reopenings?.at(-1)?.order || 0),
    )
    .at(-1)?.progress ?? (goal.phase === "live" ? 100 : null);
export function deadlineState(goal, date = today()) {
  const dueDate =
    goal.dueDate || (goal.targetWeek ? offsetDay(goal.targetWeek, 6) : "");
  if (currentProgress(goal) === 100)
    return {
      tone: "achieved",
      dueDate,
      daysLeft: null,
      elapsed: 100,
      label: "Achieved",
    };
  if (!dueDate)
    return {
      tone: "unscheduled",
      dueDate: "",
      daysLeft: null,
      elapsed: null,
      label: "No deadline",
    };
  const daysLeft = Math.round(dayNumber(dueDate) - dayNumber(date));
  // Unknown starts use a fixed two-week countdown window, not an invented work start.
  const start =
    goal.reopenings?.at(-1)?.date || goal.startDate || offsetDay(dueDate, -14);
  const duration = dayNumber(dueDate) - dayNumber(start);
  const elapsed =
    duration > 0
      ? Math.max(
          0,
          Math.min(
            100,
            (100 * (dayNumber(date) - dayNumber(start))) / duration,
          ),
        )
      : date >= dueDate
        ? 100
        : 0;
  return {
    dueDate,
    daysLeft,
    elapsed,
    tone:
      daysLeft <= 1
        ? "red"
        : daysLeft <= 3
          ? "orange"
          : daysLeft <= 7
            ? "yellow"
            : "green",
    label:
      daysLeft < 0
        ? `${-daysLeft} ${daysLeft === -1 ? "day" : "days"} overdue`
        : daysLeft === 0
          ? "Due today"
          : daysLeft === 1
            ? "Due tomorrow"
            : `${daysLeft} days left`,
  };
}
export function goalStatus(goal, date = today()) {
  if (currentProgress(goal) === 100) return "achieved";
  if (goal.health === "blocked") return "blocked";
  if (
    (goal.dueDate && goal.dueDate < date) ||
    (goal.targetWeek && offsetDay(goal.targetWeek, 6) < date)
  )
    return "overdue";
  if (goal.health === "at-risk") return "at-risk";
  return "on-track";
}
export const statusLabels = {
  achieved: "Achieved",
  blocked: "Blocked",
  overdue: "Overdue",
  "at-risk": "At risk",
  "on-track": "On track",
};
export function initialWorkspace(seed) {
  const goals = (seed?.items || []).map((item, i) => ({
    id: crypto.randomUUID(),
    ...item,
    team: item.team || "",
    health: "on-track",
    startDate: "",
    dueDate: "",
    targetWeek: "",
    completedDate: "",
    ...item,
    archived: false,
    createdAt: new Date().toISOString(),
    updates: [
      {
        id: crypto.randomUUID(),
        date: seed.asOf,
        progress: item.phase === "live" ? 100 : null,
        note: item.status,
        actor: { team: "source", name: "Screenshot import" },
        createdAt: new Date().toISOString(),
        editedAt: null,
        order: 1,
        source: true,
      },
    ],
  }));
  return {
    version: 1,
    revision: 0,
    sample: false,
    source: seed ? { title: seed.title, asOf: seed.asOf } : null,
    goals,
    history: [],
  };
}
export const etaLabel = (goal) =>
  goal.dueDate
    ? dateLabel(goal.dueDate)
    : goal.targetWeek
      ? `Week of ${dateLabel(goal.targetWeek)}`
      : goal.eta || "TBD";
export const completionDate = (goal) =>
  currentProgress(goal) === 100
    ? goal.completedDate ||
      orderedUpdates(goal)
        .filter(
          (u) =>
            u.progress === 100 &&
            u.order >= (goal.reopenings?.at(-1)?.order || 0),
        )
        .at(-1)?.date
    : null;
function text(value, max = 2000) {
  if (typeof value !== "string" || value.trim().length > max)
    throw new Error(`Enter text of no more than ${max} characters.`);
  return value.trim();
}
function required(value, max = 160) {
  const result = text(value, max);
  if (!result) throw new Error("Complete all required fields.");
  return result;
}
function validDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(dayNumber(value)) ||
    new Date(dayNumber(value) * 86400000).toISOString().slice(0, 10) !== value
  )
    throw new Error("Choose a valid date.");
  return value;
}
export function applyAction(
  state,
  action,
  actor,
  now = new Date().toISOString(),
  date = today(),
) {
  if (!actor || !teamById(actor.team))
    throw new Error("Unlock team editing first.");
  const data = structuredClone(state);
  if (!action || typeof action.type !== "string")
    throw new Error("Choose an action.");
  const find = () => {
    const goal = data.goals.find((g) => g.id === action.id);
    if (!goal) throw new Error("This workstream no longer exists.");
    return goal;
  };
  let goal,
    summary,
    before = null,
    after = null;
  switch (action.type) {
    case "goal.save": {
      const value = action.value || {};
      goal = value.id ? data.goals.find((g) => g.id === value.id) : null;
      if (value.id && !goal)
        throw new Error("This workstream no longer exists.");
      if (value.team && !teamById(value.team))
        throw new Error("Choose an owning team.");
      if (!["on-track", "at-risk", "blocked"].includes(value.health))
        throw new Error("Choose a valid health status.");
      if (!Object.hasOwn(phases, value.phase))
        throw new Error("Choose a workstream status.");
      const fields = {
        title: required(value.title, 120),
        account: required(value.account, 120),
        scope: required(value.scope, 240),
        status: required(value.status, 2000),
        outcome: required(value.outcome, 700),
        requirements: text(value.requirements || "", 1500),
        team: value.team || "",
        phase: value.phase,
        eta: text(value.eta || "TBD", 80),
        startDate: value.startDate ? validDate(value.startDate) : "",
        dueDate: value.dueDate ? validDate(value.dueDate) : "",
        targetWeek: value.targetWeek ? validDate(value.targetWeek) : "",
        completedDate: value.completedDate
          ? validDate(value.completedDate)
          : "",
        health: value.health,
      };
      if (
        fields.dueDate &&
        fields.startDate &&
        fields.dueDate < fields.startDate
      )
        throw new Error("The target date must be on or after the start date.");
      if (fields.dueDate && fields.targetWeek)
        throw new Error("Choose an exact deadline or a target week, not both.");
      if (fields.completedDate > date)
        throw new Error("A completion date cannot be in the future.");
      if (
        fields.startDate &&
        goal?.updates.some((u) => u.date < fields.startDate)
      )
        throw new Error("The start date cannot be after an existing update.");
      if (goal) {
        before = Object.fromEntries(
          Object.keys(fields).map((k) => [k, goal[k]]),
        );
        Object.assign(goal, fields);
        summary = "Workstream details updated";
      } else {
        if (data.goals.length >= 300)
          throw new Error("The workspace supports up to 300 workstreams.");
        goal = {
          id: crypto.randomUUID(),
          ...fields,
          createdAt: now,
          archived: false,
          updates: [],
        };
        data.goals.unshift(goal);
        summary = "Workstream created";
      }
      after = fields;
      break;
    }
    case "goal.reopen": {
      goal = find();
      if (goal.archived)
        throw new Error("Restore this workstream before reopening it.");
      if (currentProgress(goal) !== 100)
        throw new Error("Only a completed goal can be reopened.");
      const dueDate = validDate(action.value?.dueDate);
      if (dueDate < date)
        throw new Error("Choose a new deadline of today or later.");
      const requirements = text(action.value?.requirements || "", 1500);
      const completedDate = completionDate(goal) || "";
      const completedUpdate = orderedUpdates(goal)
        .filter((u) => u.progress === 100)
        .at(-1);
      const order = Math.max(0, ...goal.updates.map((u) => u.order)) + 1;
      const updateId = crypto.randomUUID();
      before = {
        dueDate: goal.dueDate,
        targetWeek: goal.targetWeek,
        eta: goal.eta,
        completedDate,
        requirements: goal.requirements || "",
        phase: goal.phase,
        status: goal.status,
        health: goal.health,
        progress: 100,
      };
      goal.reopenings ||= [];
      goal.reopenings.push({
        id: crypto.randomUUID(),
        date,
        at: now,
        order,
        updateId,
        completedDate,
        completedOutcome: goal.requirements || goal.outcome,
        completedUpdateId: completedUpdate?.id || null,
        dueDate,
        requirements,
        actor: structuredClone(actor),
      });
      Object.assign(goal, {
        dueDate,
        targetWeek: "",
        eta: "TBD",
        completedDate: "",
        requirements,
        phase: ["live", "enhancement"].includes(goal.phase)
          ? "enhancement"
          : "development",
        health: "on-track",
        status: `Reopened. ${requirements || "Additional work scheduled."}`,
      });
      goal.updates.push({
        id: updateId,
        date,
        progress: 0,
        kind: "reopen",
        order,
        note: `Goal reopened. New deadline: ${dateLabel(dueDate, true)}.${requirements ? `\nAdditional requirements: ${requirements}` : ""}`,
        actor: structuredClone(actor),
        createdAt: now,
        editedAt: null,
      });
      after = {
        dueDate,
        targetWeek: "",
        eta: goal.eta,
        completedDate: "",
        requirements,
        phase: goal.phase,
        status: goal.status,
        health: goal.health,
        progress: 0,
      };
      summary = "Goal reopened with a new deadline";
      break;
    }
    case "update.save": {
      goal = find();
      const priorProgress = currentProgress(goal);
      if (goal.archived)
        throw new Error("Restore this workstream before editing it.");
      const value = action.value || {},
        progress = value.progress;
      if (
        progress !== null &&
        (!Number.isInteger(progress) || progress < 0 || progress > 100)
      )
        throw new Error(
          "Progress must be a whole number from 0 to 100, or left unset.",
        );
      const updateDate = validDate(value.date);
      if ((goal.startDate && updateDate < goal.startDate) || updateDate > date)
        throw new Error(
          "Updates must fall between the workstream start and today.",
        );
      const fields = {
        note: required(value.note, 3000),
        progress,
        date: updateDate,
      };
      const existing = value.id
        ? goal.updates.find((u) => u.id === value.id)
        : null;
      if (value.id && !existing)
        throw new Error("This update no longer exists.");
      const reopened = goal.reopenings?.at(-1);
      if (
        reopened &&
        (!existing || existing.order >= reopened.order) &&
        updateDate < reopened.date
      )
        throw new Error(
          "New work updates cannot be dated before the goal was reopened.",
        );
      if (existing) {
        before = structuredClone(existing);
        Object.assign(existing, fields, {
          editor: structuredClone(actor),
          editedAt: now,
        });
        after = structuredClone(existing);
        summary = "Progress update edited";
      } else {
        const update = {
          id: crypto.randomUUID(),
          ...fields,
          actor: structuredClone(actor),
          createdAt: now,
          editedAt: null,
          order: Math.max(0, ...goal.updates.map((u) => u.order)) + 1,
        };
        goal.updates.push(update);
        after = structuredClone(update);
        summary = progress === 100 ? "Goal achieved" : "Progress update added";
      }
      const nextProgress = currentProgress(goal);
      if (nextProgress !== 100) goal.completedDate = "";
      else if (priorProgress !== 100)
        goal.completedDate = orderedUpdates(goal)
          .filter(
            (u) =>
              u.progress === 100 &&
              u.order >= (goal.reopenings?.at(-1)?.order || 0),
          )
          .at(-1).date;
      break;
    }
    case "goal.archive":
      goal = find();
      before = { archived: goal.archived };
      goal.archived = !goal.archived;
      after = { archived: goal.archived };
      summary = goal.archived ? "Workstream archived" : "Workstream restored";
      break;
    case "samples.clear": {
      if (!data.sample)
        throw new Error("The sample workspace has already been cleared.");
      const samples = data.goals.filter((g) => g.id.startsWith("sample-"));
      before = { goals: samples };
      data.goals = data.goals.filter((g) => !g.id.startsWith("sample-"));
      data.sample = false;
      summary = "Sample workstreams cleared";
      break;
    }
    default:
      throw new Error("Unsupported action.");
  }
  data.revision++;
  data.history.unshift({
    id: crypto.randomUUID(),
    at: now,
    actor: structuredClone(actor),
    goalId: goal?.id || null,
    goalTitle: goal?.title || "Workspace",
    summary,
    before,
    after,
  });
  if (JSON.stringify(data).length > 5000000)
    throw new Error(
      "The workspace storage limit has been reached. Export a backup before adding more records.",
    );
  return data;
}

// A measured data path, not a decorative animation: progress determines its extent.
export function wavePath(start, end, y = 36, amplitude = 8) {
  if (end <= start) return `M ${start} ${y}`;
  const waves = Math.max(1, Math.round((end - start) / 37)),
    step = (end - start) / waves;
  let d = `M ${start} ${y}`;
  for (let i = 0; i < waves; i++) {
    const x = start + i * step;
    d += ` C ${x + step * 0.25} ${y - amplitude}, ${x + step * 0.25} ${y - amplitude}, ${x + step * 0.5} ${y} S ${x + step * 0.75} ${y + amplitude}, ${x + step} ${y}`;
  }
  return d;
}
