import { verifyPassword, issueSession } from "../../goal-tracker/auth.mjs";
import { getGoalAuth, goalActor, goalCookie } from "../../server/goals-auth.js";
import { allowedOrigin, bodyOf, send } from "../../server/congen-auth.js";
const failures = new Map();
export default async function handler(req, res) {
  if (!["GET", "POST", "DELETE"].includes(req.method))
    return send(res, 405, { error: "Method not allowed." });
  if (req.method !== "GET" && !allowedOrigin(req))
    return send(res, 403, { error: "This request origin is not allowed." });
  try {
    if (req.method === "GET")
      return send(res, 200, { actor: goalActor(req), preview: false });
    if (req.method === "DELETE") {
      res.setHeader("Set-Cookie", goalCookie("", true));
      return send(res, 200, { ok: true });
    }
    const ip = req.headers["x-forwarded-for"]?.split(",")[0] || "unknown",
      entry = failures.get(ip);
    if (entry && entry.until > Date.now() && entry.count >= 12)
      return send(res, 429, {
        error: "Too many attempts. Wait five minutes and retry.",
      });
    const input = await bodyOf(req, 2000),
      config = getGoalAuth();
    if (!verifyPassword(config, input.team, input.password)) {
      if (failures.size > 1000) failures.clear();
      failures.set(ip, {
        count: entry && entry.until > Date.now() ? entry.count + 1 : 1,
        until: Date.now() + 300000,
      });
      return send(res, 401, {
        error: "That team password was not recognized.",
      });
    }
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (name.length > 80)
      return send(res, 400, { error: "Keep your name under 80 characters." });
    const actor = { team: input.team, name };
    failures.delete(ip);
    res.setHeader("Set-Cookie", goalCookie(issueSession(config, actor)));
    return send(res, 200, { actor });
  } catch (error) {
    console.error("Goal tracker access error", error.name);
    return send(res, 503, {
      error: "Editing access is unavailable. Please retry.",
    });
  }
}
