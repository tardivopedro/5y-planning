const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

function normalizeApiUrl(url: string): string {
  // Remove trailing slash
  url = url.trim().replace(/\/$/, "");
  
  // Se não começar com http:// ou https://, adiciona https://
  if (!url.match(/^https?:\/\//)) {
    // Se parece ser um domínio (contém ponto), assume https
    if (url.includes(".")) {
      url = `https://${url}`;
    } else {
      // Caso contrário, assume http para localhost
      url = `http://${url}`;
    }
  }
  
  return url;
}

const normalizedApiBaseUrl = normalizeApiUrl(apiBaseUrl);

export function getApiUrl(path: string): string {
  // Remove leading slash from path if present, we'll add it
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedApiBaseUrl}${cleanPath}`;
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
