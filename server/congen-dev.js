import http from "node:http";
import session from "../api/congen/session.js";
import workspace from "../api/congen/workspace.js";
import files from "../api/congen/files.js";

process.env.CONGEN_LOCAL = "1";
process.env.CONGEN_ACCESS_KEY = "local-preview-only";
process.env.CONGEN_SESSION_SECRET =
  "local-preview-only-not-a-production-secret";
const handlers = { session, workspace, files };
http
  .createServer(async (req, res) => {
    const route = new URL(req.url, "http://localhost").pathname
      .split("/")
      .at(-1);
    try {
      if (handlers[route]) await handlers[route](req, res);
      else {
        res.statusCode = 404;
        res.end("Not found");
      }
    } catch (error) {
      console.error(error);
      res.statusCode = 500;
      res.end("Internal error");
    }
  })
  .listen(5177, "127.0.0.1", () =>
    console.log("ConGen local API listening on 127.0.0.1:5177"),
  );
