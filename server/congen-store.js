import { get, put, BlobError, BlobPreconditionFailedError } from "@vercel/blob";
import { initialWorkspace } from "../congen/src/model.js";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";

const pathname = "congen/workspace.json";
const localPath = "/tmp/congen-development/workspace.json";
export class Conflict extends Error {}
export function isWriteConflict(error, current) {
  return (
    error instanceof BlobPreconditionFailedError ||
    (!current.etag &&
      error instanceof BlobError &&
      error.message.includes("This blob already exists"))
  );
}
export async function readWorkspace() {
  if (process.env.CONGEN_LOCAL === "1" && !process.env.VERCEL) {
    try {
      const raw = await readFile(localPath, "utf8");
      return {
        ...JSON.parse(raw),
        etag: createHash("sha256").update(raw).digest("hex"),
      };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      return { data: initialWorkspace(), revision: 0, etag: null };
    }
  }
  // Compressed responses carry weak ETags, which cannot guard conditional writes.
  const result = await get(pathname, {
    access: "private",
    useCache: false,
    headers: { "Accept-Encoding": "identity" },
  });
  if (!result) return { data: initialWorkspace(), revision: 0, etag: null };
  if (!result.blob.etag || result.blob.etag.startsWith("W/"))
    throw new Error("Storage did not provide a strong ETag.");
  const saved = await new Response(result.stream).json();
  return { ...saved, etag: result.blob.etag };
}
let localQueue = Promise.resolve();
export async function writeWorkspace(data, current) {
  const payload = JSON.stringify({ data, revision: current.revision + 1 });
  if (process.env.CONGEN_LOCAL === "1" && !process.env.VERCEL) {
    const operation = localQueue.then(async () => {
      const latest = await readWorkspace();
      if (latest.etag !== current.etag) throw new Conflict();
      await mkdir("/tmp/congen-development", { recursive: true });
      await writeFile(localPath, payload);
      return { data, revision: current.revision + 1 };
    });
    localQueue = operation.catch(() => {});
    return operation;
  }
  try {
    await put(pathname, payload, {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: Boolean(current.etag),
      ...(current.etag ? { ifMatch: current.etag } : {}),
      cacheControlMaxAge: 60,
    });
  } catch (error) {
    if (isWriteConflict(error, current)) throw new Conflict();
    throw error;
  }
  return { data, revision: current.revision + 1 };
}
