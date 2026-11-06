export const base = "/TrueMedLIStracker";
export async function request(endpoint, options = {}) {
  let response;
  try {
    response = await fetch(`${base}/api/${endpoint}`, {
      credentials: "same-origin",
      cache: "no-store",
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch {
    throw new Error("Connection lost. Your draft has not been saved.");
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(
      "The workspace service is unavailable. Keep your draft open and retry.",
    );
  }
  if (!response.ok) {
    const error = new Error(
      result.error || "The request could not be completed.",
    );
    error.status = response.status;
    throw error;
  }
  return result;
}
