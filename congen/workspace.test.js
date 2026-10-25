import test from "node:test";
import assert from "node:assert/strict";
import {
  applyChange,
  initialWorkspace,
  progress,
  stages,
  tasksFor,
} from "./src/model.js";
import {
  createSession,
  readSession,
  verifyKey,
  allowedOrigin,
} from "../server/congen-auth.js";
import { validateFile } from "../api/congen/files.js";
import { isWriteConflict } from "../server/congen-store.js";
import { BlobError, BlobPreconditionFailedError } from "@vercel/blob";

const add = (type = "lab") =>
  applyChange(
    initialWorkspace(),
    {
      type: "client.save",
      value: {
        name: "Test organization",
        type,
        contact: "Test contact",
        rep: "Test rep",
      },
    },
    "Tester",
  );
test("starts with no invented clients, four original panels and one baseline", () => {
  const workspace = initialWorkspace();
  assert.equal(workspace.clients.length, 0);
  assert.equal(workspace.rates.panels.length, 4);
  assert.equal(workspace.scenarios.length, 1);
});
test("lab and clinic have distinct document and account requirements", () => {
  assert.ok(
    tasksFor("lab", "documents").some(([id]) => id === "agreementSigned"),
  );
  assert.ok(
    tasksFor("clinic", "documents").some(([id]) => id === "profileReceived"),
  );
  assert.ok(tasksFor("clinic", "account").some(([id]) => id === "ordering"));
});
test("approval requires every milestone, and reopening a milestone revokes approval", () => {
  let data = add();
  const id = data.clients[0].id;
  assert.throws(
    () =>
      applyChange(data, {
        type: "client.task",
        id,
        stage: "live",
        task: "approval",
        done: true,
      }),
    /Complete all/,
  );
  for (const stage of stages)
    for (const [task] of tasksFor("lab", stage.id))
      data = applyChange(data, {
        type: "client.task",
        id,
        stage: stage.id,
        task,
        done: true,
      });
  assert.equal(progress(data.clients[0]).percent, 100);
  assert.equal(progress(data.clients[0]).active, true);
  data = applyChange(data, {
    type: "client.task",
    id,
    stage: "documents",
    task: "agreementSigned",
    done: false,
  });
  assert.equal(progress(data.clients[0]).active, false);
  assert.equal(data.clients[0].tasks["live.approval"], undefined);
});
test("hold prevents task completion; resume preserves completed work", () => {
  let data = add("clinic");
  const id = data.clients[0].id;
  data = applyChange(data, {
    type: "client.task",
    id,
    stage: "introduction",
    task: "contact",
    done: true,
  });
  data = applyChange(data, {
    type: "client.hold",
    id,
    hold: true,
    reason: "Awaiting response",
  });
  assert.throws(
    () =>
      applyChange(data, {
        type: "client.task",
        id,
        stage: "introduction",
        task: "rep",
        done: true,
      }),
    /Resume/,
  );
  data = applyChange(data, { type: "client.hold", id, hold: false });
  assert.equal(progress(data.clients[0]).complete, 1);
});
test("bad mutations do not alter original workspace", () => {
  const data = add(),
    before = JSON.stringify(data);
  assert.throws(
    () =>
      applyChange(data, {
        type: "client.save",
        value: { ...data.clients[0], type: "clinic" },
      }),
    /cannot change/,
  );
  assert.equal(JSON.stringify(data), before);
});
test("document links reject scripts, blanks, invalid URLs and credentials", () => {
  const data = add();
  for (const url of [
    "javascript:alert(1)",
    "http://example.com",
    "",
    "https://",
    "https://user:password@example.com",
  ])
    assert.throws(() =>
      applyChange(data, {
        type: "client.document",
        id: data.clients[0].id,
        name: "Test",
        url,
      }),
    );
});
test("custom panel starts with unknown reagent costs, not free costs", () => {
  const data = applyChange(initialWorkspace(), {
    type: "panel.add",
    name: "New panel",
  });
  const panel = data.rates.panels.at(-1);
  assert.equal(data.scenarios[0].analysis.material.panels[panel.id], null);
});
test("sessions are signed, expiring, and fail closed", () => {
  process.env.CONGEN_ACCESS_KEY = "test-secret";
  process.env.CONGEN_SESSION_SECRET = "long-test-secret";
  assert.equal(verifyKey("wrong"), false);
  assert.equal(verifyKey("test-secret"), true);
  const token = createSession("Tester", 10000);
  const req = { headers: { cookie: `congen_session=${token}` } };
  assert.equal(readSession(req, 10001).name, "Tester");
  assert.equal(readSession(req, 10000 + 8 * 3600000), null);
  assert.equal(
    readSession({ headers: { cookie: `congen_session=${token}bad` } }, 10001),
    null,
  );
  delete process.env.CONGEN_SESSION_SECRET;
  assert.equal(readSession(req, 10001), null);
});
test("cross-origin writes are rejected", () => {
  assert.equal(
    allowedOrigin({ headers: { origin: "https://evil.example" } }),
    false,
  );
  assert.equal(
    allowedOrigin({ headers: { origin: "https://www.alomariassociates.com" } }),
    true,
  );
});
test("Blob concurrency errors are recognized by SDK class, including first-write races", () => {
  assert.equal(
    isWriteConflict(new BlobPreconditionFailedError(), { etag: "old" }),
    true,
  );
  assert.equal(
    isWriteConflict(new BlobError("This blob already exists"), { etag: null }),
    true,
  );
  assert.equal(
    isWriteConflict(new BlobError("Access denied"), { etag: null }),
    false,
  );
});
test("uploads require valid type, signature and size", () => {
  const valid = {
    name: "Agreement",
    filename: "agreement.pdf",
    category: "Signed agreement",
    content: Buffer.from("%PDF-1.4\nTest").toString("base64"),
  };
  assert.equal(validateFile(valid).mime, "application/pdf");
  assert.throws(() => validateFile({ ...valid, filename: "attack.html" }));
  assert.throws(() =>
    validateFile({
      ...valid,
      content: Buffer.from("<script>test</script>").toString("base64"),
    }),
  );
  assert.throws(() =>
    validateFile({
      ...valid,
      content: Buffer.alloc(2000001).toString("base64"),
    }),
  );
});
