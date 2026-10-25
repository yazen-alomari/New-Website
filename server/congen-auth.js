import {
  createHmac,
  createHash,
  timingSafeEqual,
  randomBytes,
} from "node:crypto";

export const cookieName = "congen_session";
const lifetime = 8 * 60 * 60;
const digest = (value) => createHash("sha256").update(value).digest();
export function configured() {
  return Boolean(
    process.env.CONGEN_ACCESS_KEY && process.env.CONGEN_SESSION_SECRET,
  );
}
export function verifyKey(key) {
  return (
    configured() &&
    typeof key === "string" &&
    key.length <= 256 &&
    timingSafeEqual(digest(key), digest(process.env.CONGEN_ACCESS_KEY))
  );
}
export function createSession(name, now = Date.now()) {
  if (!configured()) throw new Error("Team access is not configured.");
  const payload = Buffer.from(
    JSON.stringify({
      name,
      expires: now + lifetime * 1000,
      nonce: randomBytes(12).toString("hex"),
    }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", process.env.CONGEN_SESSION_SECRET).update(payload).digest("base64url")}`;
}
export function readSession(request, now = Date.now()) {
  if (!configured()) return null;
  const cookie = (request.headers.cookie || "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  if (!cookie || cookie.length > 1500) return null;
  const [payload, signature] = cookie.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", process.env.CONGEN_SESSION_SECRET)
    .update(payload)
    .digest("base64url");
  if (!timingSafeEqual(digest(signature), digest(expected))) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof value.name === "string" && value.expires > now ? value : null;
  } catch {
    return null;
  }
}
export function sessionCookie(value, remove = false) {
  return `${cookieName}=${value}; Path=/consultative-genomics; HttpOnly; SameSite=Strict; Max-Age=${remove ? 0 : lifetime}${process.env.VERCEL ? "; Secure" : ""}`;
}
export function allowedOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  const allowed = new Set([
    "https://www.alomariassociates.com",
    "https://alomariassociates.com",
  ]);
  if (process.env.VERCEL_URL) allowed.add(`https://${process.env.VERCEL_URL}`);
  if (!process.env.VERCEL && process.env.CONGEN_LOCAL === "1")
    allowed.add("http://127.0.0.1:5176");
  return allowed.has(origin);
}
export function send(res, status, body) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Type", "application/json");
  res.statusCode = status;
  res.end(JSON.stringify(body));
}
export async function bodyOf(req, limit = 3000000) {
  if (!String(req.headers["content-type"] || "").startsWith("application/json"))
    throw new Error("Use a JSON request.");
  if (req.body !== undefined) {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (JSON.stringify(body).length > limit)
      throw new Error("Request is too large.");
    return body;
  }
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text) > limit)
      throw new Error("Request is too large.");
  }
  return JSON.parse(text);
}
