import { getApiUrl, httpRequest } from "../lib/api";
import {
  FilterOptions,
  PlanningRecord,
  SummarySnapshot,
  TypeProductBaseline,
  UploadSummary,
  AggregateResponse,
  ForecastResponse
} from "../types/forecast";

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
  return new Promise<UploadSummary>((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);

    const query = strict ? "?strict=true" : "?strict=false";
    const xhr = new XMLHttpRequest();
    xhr.open("POST", getApiUrl(`/upload${query}`));

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

  const url = getApiUrl(`/upload/records?${searchParams.toString()}`);
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
  const response = await fetch(getApiUrl("/upload/records"), {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ confirmation })
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const detail = data.detail ?? response.statusText;
    throw new Error(detail);
  }

  return response.json() as Promise<DeleteResponse>;
}

export async function fetchSummary(): Promise<SummarySnapshot> {
  return httpRequest<SummarySnapshot>(getApiUrl("/analytics/summary"));
}

export async function fetchFilters(): Promise<FilterOptions> {
  return httpRequest<FilterOptions>(getApiUrl("/upload/records/filters"));
}

export async function fetchTypeProductBaseline(): Promise<TypeProductBaseline[]> {
  return httpRequest<TypeProductBaseline[]>(getApiUrl("/analytics/type-product"));
}

export async function fetchAggregate(metric: "volume" | "revenue", groupBy: string[]): Promise<AggregateResponse> {
  const params = new URLSearchParams();
  params.set("metric", metric);
  groupBy.forEach((field) => params.append("group_by", field));
  return httpRequest<AggregateResponse>(getApiUrl(`/analytics/aggregate?${params.toString()}`));
}

export async function fetchForecastDetail(groupBy: string[]): Promise<ForecastResponse> {
  const params = new URLSearchParams();
  groupBy.forEach((field) => params.append("group_by", field));
  return httpRequest<ForecastResponse>(getApiUrl(`/analytics/forecast?${params.toString()}`));
}
