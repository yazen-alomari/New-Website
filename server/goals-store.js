import { get, put } from "@vercel/blob";
import { initialWorkspace } from "../goal-tracker/src/model.js";
import { Conflict, isWriteConflict } from "./congen-store.js";
const path = "goals-tracker/workspace.json";
export { Conflict };
export async function readGoals() {
  const result = await get(path, {
    access: "private",
    useCache: false,
    headers: { "Accept-Encoding": "identity" },
  });
  if (!result) return { state: initialWorkspace(), etag: null };
  if (!result.blob.etag || result.blob.etag.startsWith("W/"))
    throw new Error("A strong storage ETag is required.");
  return {
    state: await new Response(result.stream).json(),
    etag: result.blob.etag,
  };
}
export async function writeGoals(state, current) {
  try {
    await put(path, JSON.stringify(state), {
      access: "private",
      addRandomSuffix: false,
      contentType: "application/json",
      allowOverwrite: Boolean(current.etag),
      ...(current.etag ? { ifMatch: current.etag } : {}),
      cacheControlMaxAge: 60,
    });
  } catch (error) {
    if (isWriteConflict(error, current)) throw new Conflict();
    throw error;
  }
  return state;
}
