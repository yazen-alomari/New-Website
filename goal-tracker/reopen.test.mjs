import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyAction,
  initialWorkspace,
  currentProgress,
  completionDate,
  goalStatus,
  today,
  offsetDay,
} from "./src/model.js";
import { createGoalServer } from "./server.mjs";

const date = "2026-11-06",
  now = `${date}T18:00:00.000Z`;
const actor = { team: "aegis", name: "Reviewer" };
const completed = () =>
  initialWorkspace({
    title: "Test report",
    asOf: date,
    items: [
      {
        account: "Test account",
        scope: "PGx",
        title: "Production integration",
        outcome: "Deliver integration",
        phase: "live",
        status: "Live in production",
        eta: "Live",
        completedDate: "2026-10-22",
      },
    ],
  });
const reopen = (
  state,
  value = {
    dueDate: "2026-11-20",
    requirements: "Add corrected-result support",
  },
) =>
  applyAction(
    state,
    {
      type: "goal.reopen",
      id: state.goals[0].id,
      value,
      actor: { team: "congen" },
    },
    actor,
    now,
    date,
  );

test("reopening preserves completion and notes, extends deadline and attributes the team", () => {
  const original = completed(),
    originalJSON = JSON.stringify(original);
  const state = reopen(original),
    goal = state.goals[0];
  assert.equal(JSON.stringify(original), originalJSON);
  assert.deepEqual(goal.updates[0], original.goals[0].updates[0]);
  assert.equal(goal.reopenings[0].completedDate, "2026-10-22");
  assert.equal(goal.reopenings[0].completedOutcome, "Deliver integration");
  assert.equal(goal.dueDate, "2026-11-20");
  assert.equal(goal.targetWeek, "");
  assert.equal(goal.phase, "enhancement");
  assert.equal(currentProgress(goal), 0);
  assert.equal(completionDate(goal), null);
  assert.equal(goalStatus(goal, date), "on-track");
  assert.equal(goal.requirements, "Add corrected-result support");
  assert.equal(goal.updates.at(-1).actor.team, "aegis");
  assert.equal(goal.updates.at(-1).kind, "reopen");
  assert.equal(state.history[0].before.completedDate, "2026-10-22");
  assert.equal(state.history[0].after.dueDate, "2026-11-20");
});

test("only completed, unarchived goals can reopen with a valid new deadline", () => {
  const state = completed(),
    original = JSON.stringify(state);
  for (const value of [
    {},
    { dueDate: "2026-11-05" },
    { dueDate: "2026-02-30" },
    { dueDate: "2026-11-20", requirements: "x".repeat(1501) },
  ])
    assert.throws(() => reopen(state, value));
  const archived = structuredClone(state);
  archived.goals[0].archived = true;
  assert.throws(() => reopen(archived));
  assert.throws(() => reopen(reopen(state)));
  assert.throws(() =>
    applyAction(
      state,
      {
        type: "goal.reopen",
        id: state.goals[0].id,
        value: { dueDate: "2026-11-20" },
      },
      null,
    ),
  );
  assert.equal(JSON.stringify(state), original);
});

test("editing an earlier completion never replaces reopened progress", () => {
  let state = reopen(completed());
  const goal = state.goals[0],
    id = goal.id;
  state = applyAction(
    state,
    {
      type: "update.save",
      id,
      value: {
        id: goal.updates[0].id,
        note: "Old completion corrected",
        progress: 100,
        date: "2026-11-07",
      },
    },
    actor,
    now,
    "2026-11-07",
  );
  assert.equal(currentProgress(state.goals[0]), 0);
  assert.equal(state.goals[0].reopenings[0].completedDate, "2026-10-22");
  assert.throws(() =>
    applyAction(
      state,
      {
        type: "update.save",
        id,
        value: { note: "Backdated", progress: 80, date: "2026-11-05" },
      },
      actor,
      now,
      "2026-11-07",
    ),
  );
  state = applyAction(
    state,
    {
      type: "update.save",
      id,
      value: {
        note: "New requirements verified",
        progress: 100,
        date: "2026-11-07",
      },
    },
    actor,
    now,
    "2026-11-07",
  );
  assert.equal(completionDate(state.goals[0]), "2026-11-07");
});

test("repeated reopenings retain every completed milestone and requirements are optional", () => {
  let state = reopen(completed());
  const id = state.goals[0].id;
  state = applyAction(
    state,
    {
      type: "update.save",
      id,
      value: { note: "Verified", date, progress: 100 },
    },
    actor,
    now,
    date,
  );
  state = reopen(state, { dueDate: "2026-12-01" });
  assert.equal(state.goals[0].reopenings.length, 2);
  assert.equal(
    state.goals[0].reopenings[1].completedOutcome,
    "Add corrected-result support",
  );
  assert.equal(state.goals[0].reopenings[1].completedDate, date);
  assert.equal(state.goals[0].requirements, "");
  assert.equal(currentProgress(state.goals[0]), 0);
});

test("reopen API requires a team session, rejects stale writes and persists the extension", async () => {
  const directory = await mkdtemp(join(tmpdir(), "goals-reopen-")),
    accessFile = join(directory, "access.txt");
  let server;
  try {
    server = await createGoalServer({ directory, accessFile, port: 0 });
    let base = `http://127.0.0.1:${server.address().port}/TrueMedLIStracker/api`;
    const post = (path, body, cookie) =>
      fetch(base + path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: JSON.stringify(body),
      });
    const password = (await readFile(accessFile, "utf8")).match(
      /Aegis: (.+)/,
    )[1];
    const session = await post("/session", { team: "aegis", password });
    const cookie = session.headers.get("set-cookie").split(";")[0];
    let state = await (await fetch(base + "/workspace")).json();
    const value = {
      account: "Test",
      scope: "Test",
      title: "Completed API goal",
      outcome: "Initial delivery",
      status: "Complete",
      phase: "live",
      health: "on-track",
      team: "",
      eta: "Live",
      completedDate: today(),
    };
    state = await (
      await post(
        "/workspace",
        { revision: state.revision, action: { type: "goal.save", value } },
        cookie,
      )
    ).json();
    const id = state.goals[0].id,
      revision = state.revision;
    const body = {
      revision,
      action: {
        type: "goal.reopen",
        id,
        value: {
          dueDate: offsetDay(today(), 14),
          requirements: "Additional check",
        },
      },
    };
    assert.equal((await post("/workspace", body)).status, 401);
    const response = await post("/workspace", body, cookie);
    assert.equal(response.status, 200);
    state = await response.json();
    assert.equal(state.history[0].actor.team, "aegis");
    assert.equal(currentProgress(state.goals[0]), 0);
    assert.equal((await post("/workspace", body, cookie)).status, 409);
    await new Promise((resolve) => server.close(resolve));
    server = await createGoalServer({ directory, accessFile, port: 0 });
    base = `http://127.0.0.1:${server.address().port}/TrueMedLIStracker/api`;
    const restored = await (await fetch(base + "/workspace")).json();
    assert.deepEqual(restored, state);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
