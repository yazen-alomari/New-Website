import http from "node:http";
import { readFile, writeFile, rename, mkdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadCredentials,
  verifyPassword,
  issueSession,
  readSession,
} from "./auth.mjs";
import { applyAction, initialWorkspace, teams } from "./src/model.js";

export async function createGoalServer({
  directory = join(homedir(), ".local/share/aa-goal-tracker-preview"),
  accessFile = join(homedir(), "Documents/Goal Tracker Team Access.txt"),
  port = 6021,
} = {}) {
  const credentials = await loadCredentials(directory, accessFile),
    root = fileURLToPath(
      new URL("../dist/TrueMedLIStracker/", import.meta.url),
    ),
    stateFile = join(directory, "workspace.json");
  let state;
  try {
    state = JSON.parse(await readFile(stateFile, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    let seed;
    try {
      seed = JSON.parse(
        await readFile(
          fileURLToPath(new URL("./seed.json.local", import.meta.url)),
          "utf8",
        ),
      );
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    state = initialWorkspace(seed);
    await writeFile(stateFile, JSON.stringify(state), { mode: 0o600 });
  }
  let queue = Promise.resolve();
  const attempts = new Map();
  const send = (res, status, value) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(JSON.stringify(value));
  };
  const bodyOf = async (req) => {
    if (!req.headers["content-type"]?.startsWith("application/json"))
      throw new Error("Use a JSON request.");
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (Buffer.byteLength(raw) > 100000)
        throw new Error("Request too large.");
    }
    return JSON.parse(raw);
  };
  const server = http.createServer(async (req, res) => {
    const path = new URL(req.url, "http://localhost").pathname;
    const actor = readSession(credentials, req.headers.cookie);
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      if (path.startsWith("/TrueMedLIStracker/api/")) {
        if (!["GET", "POST", "DELETE"].includes(req.method))
          return send(res, 405, { error: "Method not allowed." });
        if (
          req.method !== "GET" &&
          req.headers.origin &&
          ![
            "http://127.0.0.1:" + server.address().port,
            "http://localhost:" + server.address().port,
          ].includes(req.headers.origin)
        )
          return send(res, 403, {
            error: "This request origin is not allowed.",
          });
        if (path === "/TrueMedLIStracker/api/session") {
          if (req.method === "GET")
            return send(res, 200, { actor, teams, preview: true });
          if (req.method === "DELETE") {
            res.setHeader(
              "Set-Cookie",
              "goals_session=; HttpOnly; SameSite=Strict; Path=/TrueMedLIStracker; Max-Age=0",
            );
            return send(res, 200, { ok: true });
          }
          const key = req.socket.remoteAddress,
            record = attempts.get(key);
          if (record && record.count >= 12 && record.until > Date.now())
            return send(res, 429, {
              error: "Too many attempts. Wait five minutes and try again.",
            });
          const input = await bodyOf(req);
          if (!verifyPassword(credentials, input.team, input.password)) {
            attempts.set(key, {
              count: record && record.until > Date.now() ? record.count + 1 : 1,
              until: Date.now() + 300000,
            });
            return send(res, 401, {
              error: "That team password was not recognized.",
            });
          }
          const name = typeof input.name === "string" ? input.name.trim() : "";
          if (name.length > 80)
            return send(res, 400, {
              error: "Keep your name under 80 characters.",
            });
          const identity = { team: input.team, name };
          attempts.delete(key);
          res.setHeader(
            "Set-Cookie",
            `goals_session=${issueSession(credentials, identity)}; HttpOnly; SameSite=Strict; Path=/TrueMedLIStracker; Max-Age=28800`,
          );
          return send(res, 200, { actor: identity });
        }
        if (path !== "/TrueMedLIStracker/api/workspace")
          return send(res, 404, { error: "Not found." });
        if (req.method === "GET") return send(res, 200, state);
        if (req.method !== "POST")
          return send(res, 405, { error: "Method not allowed." });
        if (!actor)
          return send(res, 401, {
            error: "Unlock team editing to save changes.",
          });
        const input = await bodyOf(req);
        const operation = queue.then(async () => {
          if (input.revision !== state.revision)
            return send(res, 409, {
              error:
                "A newer update was saved by another team. Refresh the page before saving again; your draft is still open.",
            });
          let next;
          try {
            next = applyAction(state, input.action, actor);
          } catch (e) {
            return send(res, 400, { error: e.message });
          }
          const temporary = join(directory, "workspace.next.json");
          await writeFile(temporary, JSON.stringify(next), { mode: 0o600 });
          await rename(temporary, stateFile);
          state = next;
          send(res, 200, state);
        });
        queue = operation.catch(() => {});
        await operation;
        return;
      }
      if (!["GET", "HEAD"].includes(req.method))
        return send(res, 405, { error: "Method not allowed." });
      if (path === "/" || path === "/TrueMedLIStracker") {
        res.writeHead(302, { Location: "/TrueMedLIStracker/" });
        return res.end();
      }
      if (!path.startsWith("/TrueMedLIStracker/"))
        return send(res, 404, { error: "Not found." });
      const relative = decodeURIComponent(
        path.slice("/TrueMedLIStracker/".length),
      );
      let file = resolve(root, relative || "index.html");
      if (!file.startsWith(root))
        return send(res, 404, { error: "Not found." });
      try {
        if (!(await stat(file)).isFile()) file = join(root, "index.html");
      } catch {
        if (extname(file)) return send(res, 404, { error: "Not found." });
        file = join(root, "index.html");
      }
      const types = {
        ".html": "text/html; charset=utf-8",
        ".js": "application/javascript",
        ".css": "text/css",
        ".woff2": "font/woff2",
        ".png": "image/png",
      };
      res.setHeader(
        "Content-Type",
        types[extname(file)] || "application/octet-stream",
      );
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'",
      );
      res.end(req.method === "HEAD" ? undefined : await readFile(file));
    } catch (error) {
      if (!res.headersSent)
        send(res, 500, {
          error: "The change could not be saved. Your draft remains open.",
        });
      else res.end();
      console.error("Goal preview request failed:", error.name);
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return server;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let server;
  for (
    let port = Number(process.env.GOALS_PORT || 6021);
    port < Number(process.env.GOALS_PORT || 6021) + 10;
    port++
  ) {
    try {
      server = await createGoalServer({ port });
      break;
    } catch (e) {
      if (e.code !== "EADDRINUSE") throw e;
    }
  }
  if (!server) throw new Error("No available preview port.");
  console.log(
    `Goal tracker preview: http://127.0.0.1:${server.address().port}/TrueMedLIStracker/`,
  );
  console.log("Team passwords: ~/Documents/Goal Tracker Team Access.txt");
}
