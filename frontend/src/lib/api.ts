const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

export function getApiUrl(path: string): string {
  return `${apiBaseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function httpRequest<T>(
  input: RequestInfo,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, init);
  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    let detail = response.statusText;
    if (contentType.includes("application/json")) {
      const data = await response.json();
      detail = data.detail ?? JSON.stringify(data);
    } else {
      detail = await response.text();
    }
    throw new Error(detail || `Erro HTTP ${response.status}`);
  }

  if (contentType.includes("application/json")) {
    return response.json() as Promise<T>;
  }

  return (await response.text()) as T;
}
