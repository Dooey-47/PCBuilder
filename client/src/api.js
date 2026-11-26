import { viError } from "./vi.js";

let csrfToken;
let initializing;

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      credentials: "same-origin",
      ...options,
    });
  } catch {
    throw new Error("Không thể kết nối với máy chủ. Vui lòng thử lại.");
  }
  const data = await response
    .json()
    .catch(() => ({ message: "Unexpected response from the server." }));
  if (!response.ok) {
    const error = new Error(viError(data.message));
    error.status = response.status;
    error.fields = Object.fromEntries(
      Object.entries(data.fields ?? {}).map(([key, messages]) => [
        key,
        messages.map(viError),
      ]),
    );
    error.code = data.code;
    throw error;
  }
  if (data.csrfToken) csrfToken = data.csrfToken;
  return data;
}

export async function api(path, { method = "GET", body, headers = {} } = {}) {
  if (path === "/auth/session" && method === "GET") {
    initializing ??= request(path).finally(() => {
      initializing = null;
    });
    return initializing;
  }
  if (method !== "GET" && !csrfToken) {
    initializing ??= request("/auth/session").finally(() => {
      initializing = null;
    });
    await initializing;
  }
  const data = await request(path, {
    method,
    headers: {
      ...headers,
      ...(body && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(method !== "GET" ? { "X-CSRF-Token": csrfToken } : {}),
    },
    ...(body
      ? { body: body instanceof FormData ? body : JSON.stringify(body) }
      : {}),
  });
  if (path === "/auth/logout") csrfToken = undefined;
  return data;
}
