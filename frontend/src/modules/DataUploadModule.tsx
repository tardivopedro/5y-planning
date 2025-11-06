import { useEffect, useMemo, useState } from "react";
import { useForecastStore } from "../store/useForecastStore";
import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";

const REQUIRED_HEADERS = [
  "Ano",
  "Diretor",
  "Sigla UF",
  "Tipo Produto",
  "Família",
  "Família Produção",
  "Marca",
  "SITUAÇÃO LISTA",
  "Cod Produto",
  "Produto",
  "Fat Liq (Kg)",
  "Fat Liq (R$)"
];

export function DataUploadModule() {
  const {
    uploadSummary,
    uploadDataset,
    loadingUpload,
    uploadProgress,
    records,
    fetchRecords,
    wipeDataset,
    loadingDelete,
    deleteSummary,
    fetchSummary,
    fetchFilters,
    summary,
    filters
  } = useForecastStore((state) => ({
    uploadSummary: state.uploadSummary,
    uploadDataset: state.uploadDataset,
    loadingUpload: state.loadingUpload,
    uploadProgress: state.uploadProgress,
    records: state.records,
    fetchRecords: state.fetchRecords,
    wipeDataset: state.wipeDataset,
    loadingDelete: state.loadingDelete,
    deleteSummary: state.deleteSummary,
    fetchSummary: state.fetchSummary,
    fetchFilters: state.fetchFilters,
    summary: state.summary,
    filters: state.filters
  }));

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [strictLayout, setStrictLayout] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);
  const deleteToken = import.meta.env.VITE_DELETE_TOKEN ?? "DELETE-ALL";

  useEffect(() => {
    Promise.all([fetchRecords(), fetchSummary(), fetchFilters()]).catch((err) => {
      setError(err.message);
    });
  }, [fetchRecords, fetchSummary, fetchFilters]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFeedback(null);
    setError(null);
    if (!event.target.files?.length) {
      setSelectedFile(null);
      return;
    }
    setSelectedFile(event.target.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setFeedback(null);
    setError(null);
    try {
      await uploadDataset({ file: selectedFile, strict: strictLayout });
      setFeedback("Arquivo processado com sucesso.");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Falha inesperada ao enviar o arquivo.");
      }
    }
  };

  const handleDelete = async () => {
    setDeleteError(null);
    setDeleteFeedback(null);

    if (deleteConfirmation.trim() !== deleteToken) {
      setDeleteError("Texto de confirmação inválido.");
      return;
    }

    try {
      await wipeDataset(deleteConfirmation.trim());
      setDeleteFeedback("Todos os registros foram removidos.");
      setDeleteConfirmation("");
      await fetchRecords();
    } catch (err) {
      if (err instanceof Error) {
        setDeleteError(err.message);
      } else {
        setDeleteError("Falha ao apagar a base.");
      }
    }
  };

  const columns = useMemo(() => REQUIRED_HEADERS, []);

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        title="Upload da Base"
        description="Carregue a planilha consolidada (2017–2026) exatamente no layout abaixo. A validação impede divergências de colunas e orderação."
      >
        <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-4">
            <label
              htmlFor="dataset"
              className="flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-brand-300 bg-brand-50 px-6 py-10 text-center text-sm font-medium text-brand-700 hover:bg-brand-100"
            >
              <span>
                Arraste o arquivo aqui ou{" "}
                <span className="underline">clique para selecionar</span>
              </span>
              <span className="text-xs text-brand-600">
                Formatos aceitos: .xlsx, .xls, .csv
              </span>
              <input
                id="dataset"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700">
                  Layout restrito
                </span>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                  <input
                    type="checkbox"
                    checked={strictLayout}
                    onChange={(event) => setStrictLayout(event.target.checked)}
                    className="h-4 w-4 accent-brand-500"
                  />
                  Validar ordenação e nomes exatos das colunas
                </label>
              </div>
              <p className="text-xs text-slate-500">
                Desative apenas se precisar carregar um arquivo com colunas
                extras. Colunas obrigatórias continuarão sendo verificadas.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleUpload}
                disabled={!selectedFile || loadingUpload}
                className="rounded-full bg-brand-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition enabled:hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loadingUpload ? "Processando..." : "Enviar arquivo"}
              </button>
              {selectedFile ? (
                <span className="text-xs text-slate-500">
                  Selecionado: <strong>{selectedFile.name}</strong>
                </span>
              ) : (
                <span className="text-xs text-slate-400">
                  Nenhum arquivo selecionado
                </span>
              )}
            </div>
            {uploadProgress !== null ? (
              <div className="mt-3 w-full rounded-full bg-slate-200">
                <div
                  className="h-2 rounded-full bg-brand-500 transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
                <div className="mt-1 text-right text-xs font-medium text-slate-600">
                  {uploadProgress}% enviado
                </div>
              </div>
            ) : null}

            {feedback ? (
              <StatusPill level="info">{feedback}</StatusPill>
            ) : null}
            {error ? <StatusPill level="error">{error}</StatusPill> : null}

            {uploadSummary ? (
              <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700 md:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Arquivo
                  </p>
                  <p className="mt-1 font-semibold text-slate-800">
                    {uploadSummary.filename}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Processado em
                  </p>
                  <p className="mt-1">
                    {new Date(uploadSummary.processedAt).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Linhas inseridas
                  </p>
                  <p className="mt-1 text-emerald-600">
                    +{uploadSummary.insertedRows.toLocaleString("pt-BR")}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Linhas atualizadas
                  </p>
                  <p className="mt-1 text-brand-600">
                    {uploadSummary.updatedRows.toLocaleString("pt-BR")}
                  </p>
                </div>
                {uploadSummary.errors && uploadSummary.errors.length ? (
                  <div className="md:col-span-2">
                    <p className="text-xs font-medium uppercase text-slate-500">
                      Alertas
                    </p>
                    <ul className="mt-1 space-y-1 text-xs text-slate-600">
                      {uploadSummary.errors.slice(0, 10).map((item, index) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                    {uploadSummary.errors.length > 10 ? (
                      <p className="mt-1 text-xs text-slate-400">
                        +{uploadSummary.errors.length - 10} mensagens adicionais
                        (confira os logs da API para o detalhe completo).
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Layout esperado
            </h3>
            <div className="grid gap-2 text-sm">
              {columns.map((column) => (
                <span
                  key={column}
                  className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200"
                >
                  {column}
                </span>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              A planilha deve conter apenas essas colunas e os dados de 2017 a
              2026. Utilize `Fat Liq (Kg)` e `Fat Liq (R$)` como valores
              numéricos sem separador de milhar textual.
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Prévia dos registros estorados"
        description="As primeiras linhas persistidas no banco são exibidas abaixo para conferência rápida."
      >
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-[960px] divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Ano</th>
                  <th className="px-3 py-2 text-left font-semibold">Diretor</th>
                  <th className="px-3 py-2 text-left font-semibold">UF</th>
                  <th className="px-3 py-2 text-left font-semibold">
                    Tipo Produto
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">Família</th>
                  <th className="px-3 py-2 text-left font-semibold">Marca</th>
                  <th className="px-3 py-2 text-left font-semibold">
                    Cod Produto
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">
                    Fat Liq (Kg)
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">
                    Fat Liq (R$)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {records.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-6 text-center text-sm text-slate-500"
                    >
                      Nenhum registro encontrado. Faça o upload para carregar a
                      base.
                    </td>
                  </tr>
                ) : (
                  records.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-800">
                        {row.ano}
                      </td>
                      <td className="px-3 py-2">{row.diretor}</td>
                      <td className="px-3 py-2">{row.sigla_uf}</td>
                      <td className="px-3 py-2">{row.tipo_produto}</td>
                      <td className="px-3 py-2">{row.familia}</td>
                      <td className="px-3 py-2">{row.marca}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-600">
                        {row.cod_produto}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {row.fat_liq_kg.toLocaleString("pt-BR")}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {row.fat_liq_reais.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL"
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Resumo consolidado"
        description="Visão anual do histórico e baseline projetado automaticamente para 2027–2030."
      >
        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Histórico 2017–2026
            </h3>
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Ano</th>
                    <th className="px-3 py-2 text-left font-semibold">Volume (Kg)</th>
                    <th className="px-3 py-2 text-left font-semibold">Receita (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                  {summary?.totals.map((row) => (
                    <tr key={row.year}>
                      <td className="px-3 py-2 font-medium text-slate-800">
                        {row.year}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.volume.toLocaleString("pt-BR")}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.revenue.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL"
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Baseline 2027–2030
              </h3>
              <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Ano</th>
                      <th className="px-3 py-2 text-right font-semibold">Volume</th>
                      <th className="px-3 py-2 text-right font-semibold">Receita</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                    {summary?.baseline.map((row) => (
                      <tr key={row.year}>
                        <td className="px-3 py-2 font-medium text-slate-800">
                          {row.year}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {row.volume.toLocaleString("pt-BR", {
                            maximumFractionDigits: 0
                          })}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {row.revenue.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL"
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
              <p className="text-xs font-semibold uppercase text-slate-500">
                Combinações carregadas
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {summary?.combinations.toLocaleString("pt-BR") ?? "—"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Total de linhas consideradas no histórico (ano x SKU x demais dimensões).
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Zona perigosa"
        description="Apague toda a base historicamente carregada. Esta ação é irreversível."
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800">
            <p className="font-semibold">
              Esta ação remove TODOS os registros do banco.
            </p>
            <p className="mt-1 text-rose-700">
              Digite o texto de confirmação exatamente como abaixo para liberar
              o botão de exclusão.
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-medium text-slate-600">
              Texto de confirmação exigido:
            </p>
            <code className="inline-block rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
              {deleteToken}
            </code>
          </div>
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Digite o texto acima para confirmar
            <input
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
              placeholder="Digite aqui..."
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={
                deleteConfirmation.trim() !== deleteToken || loadingDelete
              }
              className="rounded-full bg-rose-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition enabled:hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-200"
            >
              {loadingDelete ? "Apagando..." : "Apagar base"}
            </button>
            <span className="text-xs text-slate-500">
              Esta operação limpa todas as tabelas relacionadas ao histórico.
            </span>
          </div>
          {deleteFeedback ? (
            <StatusPill level="info">{deleteFeedback}</StatusPill>
          ) : null}
          {deleteError ? <StatusPill level="error">{deleteError}</StatusPill> : null}
          {deleteSummary ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
              <p className="text-xs font-medium uppercase text-slate-500">
                Última exclusão
              </p>
              <p className="mt-1">
                <strong>{deleteSummary.deletedRows.toLocaleString("pt-BR")}</strong>{" "}
                registros removidos em{" "}
                {new Date(deleteSummary.processedAt).toLocaleString("pt-BR")}.
              </p>
            </div>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}
