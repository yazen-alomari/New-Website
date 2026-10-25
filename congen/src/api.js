export const base = "/consultative-genomics";
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
    throw new Error(
      "Connection interrupted. Your changes have not been confirmed.",
    );
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("The workspace service is unavailable. Please retry.");
  }
  if (!response.ok) {
    const error = new Error(
      body.error || "The request could not be completed.",
    );
    error.status = response.status;
    throw error;
  }
  return body;
}
