let csrfToken;
let initializing;

async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...options,
  });
  const data = await response
    .json()
    .catch(() => ({ message: "Unexpected response from the server." }));
  if (!response.ok) {
    const error = new Error(data.message ?? "The request failed.");
    error.status = response.status;
    error.fields = data.fields ?? {};
    throw error;
  }
  if (data.csrfToken) csrfToken = data.csrfToken;
  return data;
}

export async function api(path, { method = "GET", body } = {}) {
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
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(method !== "GET" ? { "X-CSRF-Token": csrfToken } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (path === "/auth/logout") csrfToken = undefined;
  return data;
}
