import { readGoals, writeGoals, Conflict } from "../../server/goals-store.js";
import { goalActor } from "../../server/goals-auth.js";
import { allowedOrigin, bodyOf, send } from "../../server/congen-auth.js";
import { applyAction } from "../../goal-tracker/src/model.js";
export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method))
    return send(res, 405, { error: "Method not allowed." });
  try {
    if (req.method === "GET") return send(res, 200, (await readGoals()).state);
    if (!allowedOrigin(req))
      return send(res, 403, { error: "This request origin is not allowed." });
    const actor = goalActor(req);
    if (!actor)
      return send(res, 401, { error: "Unlock team editing to save changes." });
    const current = await readGoals();
    let input;
    try {
      input = await bodyOf(req, 100000);
    } catch {
      return send(res, 400, { error: "Invalid request." });
    }
    if (input.revision !== current.state.revision)
      return send(res, 409, {
        error:
          "A newer update was saved by another team. Refresh before saving again; your draft is still open.",
      });
    let next;
    try {
      next = applyAction(current.state, input.action, actor);
    } catch (error) {
      return send(res, 400, { error: error.message });
    }
    return send(res, 200, await writeGoals(next, current));
  } catch (error) {
    if (error instanceof Conflict)
      return send(res, 409, {
        error:
          "Another team saved an update first. Load the latest version and retry.",
      });
    console.error("Goal tracker storage error", error.name);
    return send(res, 503, {
      error:
        "Shared storage is unavailable. Your draft has not been saved. Keep it open and retry.",
    });
  }
}
