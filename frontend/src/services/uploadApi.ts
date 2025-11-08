import { getApiUrl, httpRequest } from "../lib/api";
import {
  AggregateResponse,
  CombinationFilterPayload,
  CombinationSnapshot,
  FilterOptions,
  ForecastResponse,
  PlanningRecord,
  PreprocessSnapshot,
  ScenarioFilterPayload,
  SummarySnapshot,
  TypeProductBaseline,
  UploadSummary,
  RecordsMeta,
  NotificationItem,
  LevelScoreRun,
  LevelScoreRow
} from "../types/forecast";

function appendFilterParams(params: URLSearchParams, filters?: ScenarioFilterPayload) {
  if (!filters) return;
  Object.entries(filters).forEach(([key, value]) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item) params.append(key, item);
      });
    } else if (value) {
      params.append(key, value as string);
    }
  });
}

interface UploadResponse {
  inserted_rows: number;
  updated_rows: number;
  errors?: string[];
}

export async function uploadDataset({
  file,
  strict,
  onProgress
}: {
  file: File;
  strict: boolean;
  onProgress?: (value: number) => void;
}): Promise<UploadSummary> {
  const query = strict ? "strict=true" : "strict=false";
  const uploadUrl = await getApiUrl(`/upload/?${query}`);
  return new Promise<UploadSummary>((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    // Usa /upload/ com barra para evitar redirect do Railway
    xhr.open("POST", uploadUrl);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    };

    xhr.onerror = () => {
      reject(new Error("Falha ao enviar arquivo."));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data: UploadResponse = JSON.parse(xhr.responseText);
          resolve({
            filename: file.name,
            processedAt: new Date().toISOString(),
            strict,
            insertedRows: data.inserted_rows,
            updatedRows: data.updated_rows,
            errors: data.errors
          });
        } catch (error) {
          reject(new Error("Resposta inválida do servidor."));
        }
      } else {
        try {
          const response = JSON.parse(xhr.responseText);
          reject(new Error(response.detail ?? xhr.statusText));
        } catch (error) {
          reject(new Error(xhr.statusText));
        }
      }
    };

    xhr.send(formData);
  });
}

export interface RecordFilters {
  limit?: number;
  ano?: number;
  diretor?: string;
  sigla_uf?: string;
  tipo_produto?: string;
  familia?: string;
  marca?: string;
}

export async function fetchRecords(params: RecordFilters = {}): Promise<PlanningRecord[]> {
  const searchParams = new URLSearchParams();
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.ano) searchParams.set("ano", String(params.ano));
  if (params.diretor) searchParams.set("diretor", params.diretor);
  if (params.sigla_uf) searchParams.set("sigla_uf", params.sigla_uf);
  if (params.tipo_produto) searchParams.set("tipo_produto", params.tipo_produto);
  if (params.familia) searchParams.set("familia", params.familia);
  if (params.marca) searchParams.set("marca", params.marca);

  const url = await getApiUrl(`/upload/records?${searchParams.toString()}`);
  return httpRequest<PlanningRecord[]>(url, {
    method: "GET"
  });
}

interface DeleteResponse {
  deleted_rows: number;
}

export async function deleteAllRecords(
  confirmation: string
): Promise<DeleteResponse> {
  const url = await getApiUrl("/upload/records");
  return httpRequest<DeleteResponse>(url, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ confirmation })
  });
}

export async function fetchSummary(): Promise<SummarySnapshot> {
  const url = await getApiUrl("/analytics/summary");
  return httpRequest<SummarySnapshot>(url);
}

export async function fetchRecordsMeta(): Promise<RecordsMeta> {
  const url = await getApiUrl("/upload/records/meta");
  return httpRequest<RecordsMeta>(url);
}

export async function fetchFilters(filters?: ScenarioFilterPayload): Promise<FilterOptions> {
  const params = new URLSearchParams();
  appendFilterParams(params, filters);
  const query = params.toString();
  const path = query ? `/upload/records/filters?${query}` : "/upload/records/filters";
  const url = await getApiUrl(path);
  return httpRequest<FilterOptions>(url);
}

export async function fetchNotifications(): Promise<NotificationItem[]> {
  const url = await getApiUrl("/notifications");
  return httpRequest<NotificationItem[]>(url);
}

export async function fetchTypeProductBaseline(): Promise<TypeProductBaseline[]> {
  const url = await getApiUrl("/analytics/type-product");
  return httpRequest<TypeProductBaseline[]>(url);
}

export async function fetchAggregate(metric: "volume" | "revenue", groupBy: string[]): Promise<AggregateResponse> {
  const params = new URLSearchParams();
  params.set("metric", metric);
  groupBy.forEach((field) => params.append("group_by", field));
  const url = await getApiUrl(`/analytics/aggregate?${params.toString()}`);
  return httpRequest<AggregateResponse>(url);
}

export async function fetchForecastDetail(groupBy: string[]): Promise<ForecastResponse> {
  const params = new URLSearchParams();
  groupBy.forEach((field) => params.append("group_by", field));
  const url = await getApiUrl(`/analytics/forecast?${params.toString()}`);
  return httpRequest<ForecastResponse>(url);
}

export async function fetchPreprocessSnapshot(
  filters: ScenarioFilterPayload = {}
): Promise<PreprocessSnapshot> {
  const params = new URLSearchParams();
  appendFilterParams(params, filters);
  const query = params.toString();
  const path = query ? `/analytics/preprocess?${query}` : "/analytics/preprocess";
  const url = await getApiUrl(path);
  return httpRequest<PreprocessSnapshot>(url);
}

export async function fetchCombinationsSnapshot(
  filters: CombinationFilterPayload = {}
): Promise<CombinationSnapshot[]> {
  const params = new URLSearchParams();
  const { limit, ano, ...dimensionFilters } = filters;
  if (limit) params.set("limit", String(limit));
  if (typeof ano === "number") params.set("ano", String(ano));

  appendFilterParams(params, dimensionFilters);

  const query = params.toString();
  const path = query ? `/analytics/combinations?${query}` : "/analytics/combinations";
  const url = await getApiUrl(path);
  return httpRequest<CombinationSnapshot[]>(url);
}

export async function startLevelScoreRun(levels?: string[][]): Promise<LevelScoreRun> {
  const url = await getApiUrl("/analytics/level-score/run");
  return httpRequest<LevelScoreRun>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ levels })
  });
}

export async function processLevelScoreChunk(runId: number): Promise<LevelScoreRun> {
  const url = await getApiUrl(`/analytics/level-score/run/${runId}/next`);
  return httpRequest<LevelScoreRun>(url, { method: "POST" });
}

export async function fetchLevelScoreStatus(runId: number): Promise<LevelScoreRun> {
  const url = await getApiUrl(`/analytics/level-score/run/${runId}`);
  return httpRequest<LevelScoreRun>(url);
}

export async function fetchLevelScoreResults(runId: number): Promise<LevelScoreRow[]> {
  const url = await getApiUrl(`/analytics/level-score/results/${runId}`);
  return httpRequest<LevelScoreRow[]>(url);
}
