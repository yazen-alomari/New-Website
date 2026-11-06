import { readSession } from "../goal-tracker/auth.mjs";
export function getGoalAuth() {
  if (!process.env.GOALS_AUTH_CONFIG)
    throw new Error("Goal tracker access is not configured.");
  return JSON.parse(process.env.GOALS_AUTH_CONFIG);
}
export const goalActor = (req) =>
  readSession(getGoalAuth(), req.headers.cookie);
export const goalCookie = (token = "", remove = false) =>
  `goals_session=${token}; Path=/TrueMedLIStracker; HttpOnly; SameSite=Strict; Secure; Max-Age=${remove ? 0 : 28800}`;
