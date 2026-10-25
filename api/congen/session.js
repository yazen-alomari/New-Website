import {
  configured,
  verifyKey,
  createSession,
  readSession,
  sessionCookie,
  allowedOrigin,
  send,
  bodyOf,
} from "../../server/congen-auth.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const session = readSession(req);
    return send(res, 200, {
      authenticated: Boolean(session),
      name: session?.name,
      configured: configured(),
    });
  }
  if (!allowedOrigin(req))
    return send(res, 403, { error: "This request origin is not allowed." });
  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", sessionCookie("", true));
    return send(res, 200, { ok: true });
  }
  if (req.method !== "POST")
    return send(res, 405, { error: "Method not allowed." });
  if (!configured())
    return send(res, 503, {
      error: "Workspace setup is in progress. Please try again shortly.",
    });
  try {
    const body = await bodyOf(req, 2000);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 80)
      return send(res, 400, { error: "Enter your name, up to 80 characters." });
    if (!verifyKey(body.key))
      return send(res, 401, { error: "That access key was not recognized." });
    res.setHeader("Set-Cookie", sessionCookie(createSession(name)));
    return send(res, 200, { authenticated: true, name });
  } catch {
    return send(res, 400, { error: "Check your name and access key." });
  }
}
