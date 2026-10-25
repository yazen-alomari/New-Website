import baseRates from "./rates.json" with { type: "json" };
import {
  molecularDefaults,
  normalizeMolecularAnalysis,
} from "./cost-engine.js";

export const stages = [
  {
    id: "introduction",
    name: "Introduction",
    short: "Introduced",
    icon: "contact",
  },
  { id: "vetting", name: "Vetting", short: "Vetting", icon: "shield" },
  {
    id: "documents",
    name: "Agreements & profile",
    short: "Documents",
    icon: "file",
  },
  { id: "account", name: "Account setup", short: "Account", icon: "user" },
  {
    id: "logistics",
    name: "Collection & logistics",
    short: "Logistics",
    icon: "truck",
  },
  {
    id: "readiness",
    name: "Readiness review",
    short: "Readiness",
    icon: "check",
  },
  { id: "live", name: "Go live", short: "Active", icon: "activity" },
];
const common = {
  introduction: [
    ["contact", "Primary contact confirmed"],
    ["rep", "Introducing representative recorded"],
  ],
  vetting: [
    ["scope", "Requested tests and expected volume reviewed"],
    ["service", "Service area and referral fit reviewed"],
    ["credentials", "Required organization credentials reviewed"],
    ["billing", "Billing arrangement reviewed"],
  ],
  logistics: [
    ["guide", "Collection guide delivered"],
    ["rejection", "Rejection criteria acknowledged"],
    ["supplies", "Collection supplies agreed"],
    ["shipping", "Courier / shipping plan confirmed"],
    ["schedule", "Pickup schedule and first shipment agreed"],
  ],
  readiness: [
    ["training", "Ordering and result-access training completed"],
    ["testOrder", "Test order workflow verified"],
    ["support", "Support and escalation contacts confirmed"],
  ],
  live: [["approval", "Final onboarding approval recorded"]],
};
export function tasksFor(type, stage) {
  if (stage === "documents")
    return type === "lab"
      ? [
          ["materials", "Service material delivered"],
          ["agreementSent", "Reference laboratory agreement sent"],
          ["agreementSigned", "Signed agreement received"],
          ["profile", "Laboratory information received"],
        ]
      : [
          ["materials", "Service material delivered"],
          ["profileSent", "Client profile form sent"],
          ["profileReceived", "Completed client profile received"],
          ["terms", "Applicable service terms completed"],
        ];
  if (stage === "account")
    return type === "lab"
      ? [
          ["account", "Referral account created"],
          ["menu", "Test menu and routing confirmed"],
          ["results", "Results delivery method confirmed"],
        ]
      : [
          ["account", "LIS account created"],
          ["ordering", "Ordering portal access issued"],
          ["results", "Results monitoring access verified"],
        ];
  return common[stage] || [];
}
export function progress(client) {
  const all = stages.flatMap((s) =>
    tasksFor(client.type, s.id).map(([id]) => `${s.id}.${id}`),
  );
  const complete = all.filter((id) => client.tasks[id]?.done).length;
  const index = stages.findIndex((s) =>
    tasksFor(client.type, s.id).some(
      ([id]) => !client.tasks[`${s.id}.${id}`]?.done,
    ),
  );
  return {
    complete,
    total: all.length,
    percent: Math.round((complete / all.length) * 100),
    stage: index < 0 ? "live" : stages[index].id,
    index: index < 0 ? 6 : index,
    active: index < 0,
  };
}
export const isoDay = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
export const money = (cents) =>
  cents === null || !Number.isFinite(cents)
    ? "Not set"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(cents / 100);
export const dayLabel = (value) =>
  value
    ? new Date(
        value.includes("T") ? value : `${value}T12:00:00`,
      ).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "No date";
export const uid = () => crypto.randomUUID();
export function initialWorkspace() {
  return {
    version: 1,
    clients: [],
    scenarios: [
      {
        id: "baseline",
        name: "PCR baseline",
        updatedAt: null,
        analysis: molecularDefaults(baseRates),
      },
    ],
    rates: structuredClone(baseRates),
    resources: [],
    settings: {
      teamName: "Consultative Genomics",
      orderingPortal: "",
      ownerName: "Operations team",
    },
  };
}
function text(value, max = 500) {
  if (typeof value !== "string" || value.length > max)
    throw new Error(`Text must be no more than ${max} characters.`);
  return value.trim();
}
function required(value, max = 120) {
  const result = text(value, max);
  if (!result) throw new Error("Complete the required fields.");
  return result;
}
function date(value) {
  const s = text(value || "", 10);
  if (
    s &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(s) ||
      new Date(s).toISOString().slice(0, 10) !== s)
  )
    throw new Error("Enter a valid date.");
  return s;
}
function safeUrl(value) {
  const s = text(value || "", 1500);
  if (s) {
    let url;
    try {
      url = new URL(s);
    } catch {
      throw new Error("Use a valid HTTPS link.");
    }
    if (url.protocol !== "https:" || url.username || url.password)
      throw new Error("Use an HTTPS link without embedded credentials.");
  }
  return s;
}
function log(client, message, actor, at) {
  client.events.unshift({ id: uid(), message, actor, at });
  if (client.events.length > 500) client.events.length = 500;
  client.updatedAt = at;
}
export function applyChange(
  workspace,
  action,
  actor = "Operations team",
  at = new Date().toISOString(),
) {
  const data = structuredClone(workspace);
  if (!action || typeof action.type !== "string")
    throw new Error("Choose an action.");
  const find = () => {
    const c = data.clients.find((c) => c.id === action.id);
    if (!c) throw new Error("Client no longer exists.");
    return c;
  };
  switch (action.type) {
    case "client.save": {
      const v = action.value || {},
        existing = v.id ? data.clients.find((c) => c.id === v.id) : null;
      if (v.id && !existing) throw new Error("Client no longer exists.");
      if (!["lab", "clinic"].includes(v.type))
        throw new Error("Choose a referring lab or clinic.");
      if (existing && v.type !== existing.type)
        throw new Error("Client type cannot change after creation.");
      const email = text(v.email || "", 254);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new Error("Enter a valid contact email.");
      const fields = {
        name: required(v.name),
        type: v.type,
        contact: required(v.contact),
        rep: required(v.rep),
        owner: text(v.owner || "", 120),
        email,
        phone: text(v.phone || "", 60),
        city: text(v.city || "", 120),
        tests: text(v.tests || "", 500),
        volume: text(v.volume || "", 80),
        dueDate: date(v.dueDate),
        nextAction: text(v.nextAction || "", 300),
        lisId: text(v.lisId || "", 100),
        shipping: text(v.shipping || "", 500),
      };
      if (existing) {
        Object.assign(existing, fields);
        log(existing, "Client details updated", actor, at);
      } else {
        const client = {
          ...fields,
          id: uid(),
          tasks: {},
          notes: [],
          events: [],
          documents: [],
          hold: false,
          archived: false,
          createdAt: at,
          updatedAt: at,
        };
        log(client, `Introduced by ${client.rep}`, actor, at);
        data.clients.unshift(client);
      }
      break;
    }
    case "client.task": {
      const c = find();
      const stage = stages.find((s) => s.id === action.stage);
      const task =
        stage && tasksFor(c.type, stage.id).find(([id]) => id === action.task);
      if (!task || typeof action.done !== "boolean")
        throw new Error("Unknown milestone.");
      if (
        action.stage === "live" &&
        action.done &&
        stages
          .slice(0, -1)
          .some((s) =>
            tasksFor(c.type, s.id).some(
              ([id]) => !c.tasks[`${s.id}.${id}`]?.done,
            ),
          )
      )
        throw new Error(
          "Complete all required milestones before final approval.",
        );
      if (action.done && c.hold)
        throw new Error("Resume this client before completing milestones.");
      c.tasks[`${stage.id}.${task[0]}`] = { done: action.done, at, actor };
      if (!action.done && stage.id !== "live") delete c.tasks["live.approval"];
      log(
        c,
        `${action.done ? "Completed" : "Reopened"}: ${task[1]}`,
        actor,
        at,
      );
      break;
    }
    case "client.note": {
      const c = find();
      const note = required(action.text, 3000);
      c.notes.unshift({ id: uid(), text: note, actor, at });
      log(c, "Note added", actor, at);
      break;
    }
    case "client.hold": {
      const c = find();
      if (typeof action.hold !== "boolean") throw new Error("Invalid status.");
      c.hold = action.hold;
      log(
        c,
        c.hold
          ? `On hold: ${required(action.reason, 300)}`
          : "Onboarding resumed",
        actor,
        at,
      );
      break;
    }
    case "client.archive": {
      const c = find();
      c.archived = !c.archived;
      log(c, c.archived ? "Client archived" : "Client restored", actor, at);
      break;
    }
    case "client.document": {
      const c = find();
      c.documents.unshift({
        id: uid(),
        name: required(action.name, 160),
        url: safeUrl(required(action.url, 1500)),
        category: text(action.category || "Other", 80),
        at,
        actor,
      });
      log(c, `Document linked: ${action.name}`, actor, at);
      break;
    }
    case "scenario.save": {
      const value = action.value || {};
      const analysis = normalizeMolecularAnalysis(value.analysis, data.rates);
      const name = required(value.name, 100);
      const existing = data.scenarios.find((s) => s.id === value.id);
      if (existing) Object.assign(existing, { name, analysis, updatedAt: at });
      else {
        if (data.scenarios.length >= 100)
          throw new Error("Archive a scenario before adding more.");
        data.scenarios.push({ id: uid(), name, analysis, updatedAt: at });
      }
      break;
    }
    case "scenario.delete": {
      if (data.scenarios.length < 2)
        throw new Error("Keep at least one scenario.");
      data.scenarios = data.scenarios.filter((s) => s.id !== action.id);
      break;
    }
    case "panel.add": {
      const name = required(action.name, 80);
      if (data.rates.panels.length >= 30)
        throw new Error("A maximum of 30 panels is supported.");
      if (
        data.rates.panels.some(
          (p) => p.name.toLowerCase() === name.toLowerCase(),
        )
      )
        throw new Error("A panel with this name already exists.");
      data.rates.panels.push({
        id: `panel-${uid()}`,
        name,
        reagentCentsPerSample: 0,
      });
      for (const s of data.scenarios) {
        s.analysis = normalizeMolecularAnalysis(s.analysis, data.rates);
        s.analysis.material.panels[data.rates.panels.at(-1).id] = null;
      }
      break;
    }
    case "resource.save": {
      data.resources.unshift({
        id: uid(),
        name: required(action.name, 160),
        category: required(action.category, 100),
        url: safeUrl(required(action.url, 1500)),
        at,
      });
      break;
    }
    case "resource.delete": {
      data.resources = data.resources.filter((r) => r.id !== action.id);
      break;
    }
    case "settings.save": {
      data.settings = {
        teamName: required(action.value.teamName),
        ownerName: required(action.value.ownerName),
        orderingPortal: safeUrl(action.value.orderingPortal),
      };
      break;
    }
    default:
      throw new Error("Unsupported action.");
  }
  if (JSON.stringify(data).length > 2500000)
    throw new Error(
      "Workspace size limit reached. Export a backup and archive older records.",
    );
  return data;
}
