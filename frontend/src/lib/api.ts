const DEFAULT_REMOTE_API = "https://5y-planning-production.up.railway.app";
const DEFAULT_LOCAL_API = "http://127.0.0.1:8000";
const HEALTH_TIMEOUT_MS = 1200;
const DEFAULT_HEALTH_PATH = "/health";

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

const envApiUrl = import.meta.env.VITE_API_URL;
const candidateUrls = envApiUrl
  ? [envApiUrl]
  : import.meta.env.DEV
    ? [DEFAULT_LOCAL_API, DEFAULT_REMOTE_API]
    : [DEFAULT_REMOTE_API, DEFAULT_LOCAL_API];

const normalizedCandidates = Array.from(
  new Set(candidateUrls.map(normalizeApiUrl))
);

let resolvedApiBaseUrl: string | null = normalizedCandidates.length === 1 ? normalizedCandidates[0] : null;
let resolvingPromise: Promise<string> | null = null;

async function pingHealth(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(`${url}${DEFAULT_HEALTH_PATH}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveApiBaseUrl(): Promise<string> {
  if (resolvedApiBaseUrl) {
    return resolvedApiBaseUrl;
  }

  if (!resolvingPromise) {
    resolvingPromise = (async () => {
      for (const candidate of normalizedCandidates) {
        if (await pingHealth(candidate)) {
          resolvedApiBaseUrl = candidate;
          return candidate;
        }
      }
      resolvedApiBaseUrl = normalizedCandidates[0];
      return resolvedApiBaseUrl;
    })().finally(() => {
      resolvingPromise = null;
    });
  }

  return resolvingPromise;
}

export async function getApiUrl(path: string): Promise<string> {
  const baseUrl = await resolveApiBaseUrl();
  // Remove leading slash from path if present, we'll add it
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
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
