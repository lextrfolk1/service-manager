const API_BASE =
  process.env.NODE_ENV === "production" ? "http://localhost:4000" : "";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function apiRequest(path, options = {}) {
  const url = `${API_BASE}${path}`;

  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ApiError(text || response.statusText, response.status);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(error.message || "Network error", 0);
  }
}

export const api = {
  get: (path) => apiRequest(path),

  post: (path, body) =>
    apiRequest(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: (path, body) =>
    apiRequest(path, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};

export default api;
