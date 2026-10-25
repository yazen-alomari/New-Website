import { get, put, del } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
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

const local = () => process.env.CONGEN_LOCAL === "1" && !process.env.VERCEL;
const directory = "/tmp/congen-development/files";
const types = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};
export function validateFile(body) {
  const extension = String(body.filename || "")
    .split(".")
    .at(-1)
    .toLowerCase();
  if (
    !types[extension] ||
    typeof body.content !== "string" ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(body.content)
  )
    throw new Error("Choose a PDF, DOCX, PNG or JPG file.");
  const bytes = Buffer.from(body.content, "base64");
  if (!bytes.length || bytes.length > 2000000)
    throw new Error("Choose a file smaller than 2 MB.");
  const signature = bytes.subarray(0, 8).toString("hex");
  if (
    !(extension === "pdf"
      ? bytes.subarray(0, 5).toString() === "%PDF-"
      : extension === "docx"
        ? signature.startsWith("504b0304")
        : extension === "png"
          ? signature === "89504e470d0a1a0a"
          : signature.startsWith("ffd8ff"))
  )
    throw new Error("The file content does not match its extension.");
  if (
    typeof body.name !== "string" ||
    !body.name.trim() ||
    body.name.length > 160 ||
    typeof body.category !== "string" ||
    body.category.length > 100
  )
    throw new Error("Enter a document name and category.");
  return {
    bytes,
    mime: types[extension],
    filename: String(body.filename)
      .replace(/[^a-zA-Z0-9._ -]/g, "_")
      .slice(-180),
  };
}
export default async function handler(req, res) {
  const session = readSession(req);
  if (!session)
    return send(res, 401, { error: "Sign in to access team documents." });
  if (!["GET", "POST"].includes(req.method))
    return send(res, 405, { error: "Method not allowed." });
  if (req.method === "POST" && !allowedOrigin(req))
    return send(res, 403, { error: "This request origin is not allowed." });
  let uploaded;
  try {
    const current = await readWorkspace();
    if (req.method === "GET") {
      const id = new URL(
        req.url,
        "https://www.alomariassociates.com",
      ).searchParams.get("id");
      const document = [
        ...current.data.resources,
        ...current.data.clients.flatMap((c) => c.documents),
      ].find((d) => d.fileId === id);
      if (!document?.pathname)
        return send(res, 404, { error: "Document not found." });
      let bytes;
      if (local()) bytes = await readFile(`${directory}/${document.fileId}`);
      else {
        const file = await get(document.pathname, {
          access: "private",
          useCache: false,
        });
        if (!file) return send(res, 404, { error: "Document not found." });
        bytes = Buffer.from(await new Response(file.stream).arrayBuffer());
      }
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Type", document.mime);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${document.filename}"`,
      );
      res.statusCode = 200;
      return res.end(bytes);
    }
    let body, file;
    try {
      body = await bodyOf(req);
      file = validateFile(body);
    } catch (error) {
      return send(res, 400, { error: error.message });
    }
    if (body.revision !== current.revision)
      return send(res, 409, {
        error:
          "A teammate saved newer changes. Refresh the workspace and upload again.",
      });
    const data = structuredClone(current.data);
    const client = body.clientId
      ? data.clients.find((c) => c.id === body.clientId)
      : null;
    if (body.clientId && !client)
      return send(res, 404, { error: "Client not found." });
    const id = randomUUID(),
      pathname = `congen/documents/${id}`;
    if (local()) {
      await mkdir(directory, { recursive: true });
      await writeFile(`${directory}/${id}`, file.bytes);
      uploaded = id;
    } else {
      await put(pathname, file.bytes, {
        access: "private",
        addRandomSuffix: false,
        contentType: file.mime,
      });
      uploaded = pathname;
    }
    const at = new Date().toISOString();
    const document = {
      id,
      fileId: id,
      pathname,
      name: body.name.trim(),
      category: body.category,
      filename: file.filename,
      mime: file.mime,
      size: file.bytes.length,
      actor: session.name,
      at,
    };
    if (client) {
      client.documents.unshift(document);
      client.updatedAt = at;
      client.events.unshift({
        id: randomUUID(),
        message: `Document uploaded: ${document.name}`,
        actor: session.name,
        at,
      });
      client.events = client.events.slice(0, 500);
    } else data.resources.unshift(document);
    if (JSON.stringify(data).length > 2500000)
      throw new Error("Workspace limit reached.");
    const saved = await writeWorkspace(data, current);
    uploaded = null;
    return send(res, 200, saved);
  } catch (error) {
    if (uploaded) {
      try {
        if (local()) await unlink(`${directory}/${uploaded}`);
        else await del(uploaded);
      } catch {}
    }
    if (error instanceof Conflict)
      return send(res, 409, {
        error:
          "Another save finished first. Refresh the workspace and upload again.",
      });
    console.error("ConGen document failure", error.name);
    return send(res, 503, {
      error: "The document could not be saved. Please retry.",
    });
  }
}
