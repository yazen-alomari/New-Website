import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHmac,
  createHash,
} from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { teams } from "./src/model.js";
const hash = (value) => createHash("sha256").update(value).digest();
export async function loadCredentials(directory, accessFile) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const file = join(directory, "credentials.json");
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  const config = { secret: randomBytes(48).toString("base64url"), teams: {} };
  const lines = [];
  for (const team of teams) {
    const password = randomBytes(15).toString("base64url"),
      salt = randomBytes(16).toString("hex");
    config.teams[team.id] = {
      salt,
      digest: scryptSync(password, salt, 32).toString("hex"),
    };
    lines.push(`${team.name}: ${password}`);
  }
  await writeFile(
    accessFile,
    `WORKSTREAM GOALS - PREVIEW TEAM PASSWORDS\n\n${lines.join("\n")}\n\nThese passwords unlock editing, not viewing. Every team can edit every goal.\nHistory attributes changes to the authenticated team; optional names are self-reported.\nPreview data and credentials are stored only on this Mac.\nNot published to Vercel or the Alomari Associates website.\nKeep these passwords within the three teams.\n`,
    { mode: 0o600, flag: "wx" },
  );
  await writeFile(file, JSON.stringify(config), { mode: 0o600, flag: "wx" });
  return config;
}
export function verifyPassword(config, team, password) {
  if (!teams.some((entry) => entry.id === team)) return false;
  const saved = config.teams[team];
  if (!saved || typeof password !== "string" || password.length > 256)
    return false;
  return timingSafeEqual(
    scryptSync(password, saved.salt, 32),
    Buffer.from(saved.digest, "hex"),
  );
}
export function issueSession(config, actor, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({
      ...actor,
      expires: now + 8 * 3600000,
      nonce: randomBytes(12).toString("hex"),
    }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", config.secret).update(payload).digest("base64url")}`;
}
export function readSession(config, cookie = "", now = Date.now()) {
  const token = cookie
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("goals_session="))
    ?.slice(14);
  if (!token || token.length > 1600) return null;
  const pieces = token.split(".");
  if (pieces.length !== 2) return null;
  const [payload, sig] = pieces,
    expected = createHmac("sha256", config.secret)
      .update(payload)
      .digest("base64url");
  if (!timingSafeEqual(hash(sig), hash(expected))) return null;
  try {
    const actor = JSON.parse(Buffer.from(payload, "base64url").toString());
    return actor.expires > now &&
      config.teams[actor.team] &&
      typeof actor.name === "string"
      ? { team: actor.team, name: actor.name }
      : null;
  } catch {
    return null;
  }
}
