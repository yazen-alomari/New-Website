import {
  readSession,
  allowedOrigin,
  send,
  bodyOf,
} from "../../server/congen-auth.js";
import {
  readWorkspace,
  writeWorkspace,
  Conflict,
} from "../../server/congen-store.js";
import { applyChange } from "../../congen/src/model.js";

export default async function handler(req, res) {
  const session = readSession(req);
  if (!session)
    return send(res, 401, {
      error: "Your session has ended. Sign in again to continue.",
    });
  if (!["GET", "POST"].includes(req.method))
    return send(res, 405, { error: "Method not allowed." });
  if (req.method === "POST" && !allowedOrigin(req))
    return send(res, 403, { error: "This request origin is not allowed." });
  try {
    const current = await readWorkspace();
    if (req.method === "GET")
      return send(res, 200, { data: current.data, revision: current.revision });
    let body, data;
    try {
      body = await bodyOf(req);
    } catch {
      return send(res, 400, { error: "Invalid request." });
    }
    if (body.revision !== current.revision)
      return send(res, 409, {
        error:
          "A teammate saved newer changes. Reload the workspace before saving your draft.",
      });
    try {
      data = applyChange(current.data, body.action, session.name);
    } catch (error) {
      return send(res, 400, { error: error.message });
    }
    return send(res, 200, await writeWorkspace(data, current));
  } catch (error) {
    if (error instanceof Conflict)
      return send(res, 409, {
        error: "Another save finished first. Reload the workspace and retry.",
      });
    console.error("ConGen storage failure", error.name);
    return send(res, 503, {
      error:
        "Shared storage is unavailable. Your edits have not been confirmed. Keep this page open and retry.",
    });
  }
}
