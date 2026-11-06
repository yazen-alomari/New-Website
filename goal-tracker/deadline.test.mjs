import test from "node:test";
import assert from "node:assert/strict";
import { deadlineState, currentProgress, goalStatus } from "./src/model.js";

const goal = {
  phase: "qa",
  health: "on-track",
  dueDate: "2026-11-09",
  targetWeek: "",
  startDate: "",
  updates: [],
};

test("deadline colors progress from green to yellow, orange and red at exact boundaries", () => {
  for (const [date, tone, daysLeft] of [
    ["2026-11-01", "green", 8],
    ["2026-11-02", "yellow", 7],
    ["2026-11-05", "yellow", 4],
    ["2026-11-06", "orange", 3],
    ["2026-11-07", "orange", 2],
    ["2026-11-08", "red", 1],
    ["2026-11-09", "red", 0],
    ["2026-11-10", "red", -1],
  ]) {
    const actual = deadlineState(goal, date);
    assert.equal(actual.tone, tone);
    assert.equal(actual.daysLeft, daysLeft);
  }
  assert.equal(deadlineState(goal, "2026-11-08").label, "Due tomorrow");
  assert.equal(deadlineState(goal, "2026-11-09").label, "Due today");
  assert.equal(deadlineState(goal, "2026-11-10").label, "1 day overdue");
  assert.equal(deadlineState(goal, "2026-11-11").label, "2 days overdue");
});

test("time advances the deadline rail without changing or inventing work completion", () => {
  const before = JSON.stringify(goal);
  assert.equal(deadlineState(goal, "2026-10-25").elapsed, 0);
  assert.equal(deadlineState(goal, "2026-11-02").elapsed, 50);
  assert.ok(deadlineState(goal, "2026-11-06").elapsed > 75);
  assert.equal(deadlineState(goal, "2026-11-09").elapsed, 100);
  assert.equal(deadlineState(goal, "2026-11-12").elapsed, 100);
  assert.equal(currentProgress(goal), null);
  assert.equal(goalStatus(goal, "2026-11-10"), "overdue");
  assert.equal(JSON.stringify(goal), before);
});

test("achieved goals stay green even after the deadline and use actual completion", () => {
  for (const completed of [
    { ...goal, phase: "live" },
    { ...goal, updates: [{ date: "2026-11-06", order: 1, progress: 100 }] },
  ]) {
    const result = deadlineState(completed, "2026-12-01");
    assert.equal(result.tone, "achieved");
    assert.equal(result.elapsed, 100);
    assert.equal(result.label, "Achieved");
    assert.equal(result.daysLeft, null);
  }
});

test("known starts, same-day goals and reopened cycles have bounded elapsed time", () => {
  assert.equal(
    deadlineState({ ...goal, startDate: "2026-11-01" }, "2026-11-05").elapsed,
    50,
  );
  const reopened = {
    ...goal,
    reopenings: [{ date: "2026-11-05", order: 2 }],
    updates: [
      { date: "2026-11-01", order: 1, progress: 100 },
      { date: "2026-11-05", order: 2, progress: 0 },
    ],
  };
  assert.equal(deadlineState(reopened, "2026-11-07").elapsed, 50);
  assert.equal(deadlineState(reopened, "2026-11-07").tone, "orange");
  assert.equal(currentProgress(reopened), 0);
  const sameDay = { ...goal, startDate: "2026-11-09" };
  assert.equal(deadlineState(sameDay, "2026-11-08").elapsed, 0);
  assert.equal(deadlineState(sameDay, "2026-11-09").elapsed, 100);
});

test("unset deadlines stay neutral and other target weeks retain their original range", () => {
  const noDate = deadlineState({ ...goal, dueDate: "" }, "2026-11-09");
  assert.equal(noDate.tone, "unscheduled");
  assert.equal(noDate.elapsed, null);
  const week = deadlineState(
    { ...goal, dueDate: "", targetWeek: "2026-11-09" },
    "2026-11-09",
  );
  assert.equal(week.dueDate, "2026-11-15");
  assert.equal(week.daysLeft, 6);
});
