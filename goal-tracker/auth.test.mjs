import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadCredentials,
  verifyPassword,
  issueSession,
  readSession,
} from "./auth.mjs";
import { teams } from "./src/model.js";

test("fresh credentials reject every previous password and session", async () => {
  const directory = await mkdtemp(join(tmpdir(), "goals-rotation-"));
  try {
    const oldSheet = join(directory, "old.txt"),
      newSheet = join(directory, "new.txt");
    const old = await loadCredentials(join(directory, "old"), oldSheet);
    const next = await loadCredentials(join(directory, "new"), newSheet);
    const oldPasswords = await readFile(oldSheet, "utf8");
    const newPasswords = await readFile(newSheet, "utf8");
    for (const team of teams) {
      const password = newPasswords.match(new RegExp(`${team.name}: (.+)`))[1];
      const oldPassword = oldPasswords.match(
        new RegExp(`${team.name}: (.+)`),
      )[1];
      assert.equal(verifyPassword(next, team.id, password), true);
      assert.equal(verifyPassword(next, team.id, oldPassword), false);
      for (const other of teams.filter((entry) => entry.id !== team.id)) {
        assert.equal(verifyPassword(next, other.id, password), false);
      }
      const actor = { team: team.id, name: "Test editor" };
      assert.equal(
        readSession(next, `goals_session=${issueSession(old, actor)}`),
        null,
      );
      assert.deepEqual(
        readSession(next, `goals_session=${issueSession(next, actor)}`),
        actor,
      );
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
