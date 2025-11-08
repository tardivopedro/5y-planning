import io
import logging
import re
import unicodedata
from typing import Iterable, List, Tuple

import pandas as pd
from sqlalchemy import delete, select

from app.db.session import session_context
from app.models import PlanningRecord
from app.services.notification_service import notification_center
from app.services.preprocess_service import rebuild_combinations_snapshot

logger = logging.getLogger(__name__)


def _normalize_key(column: str) -> str:
  normalized = unicodedata.normalize("NFKD", column)
  normalized = normalized.encode("ASCII", "ignore").decode("ASCII")
  normalized = normalized.strip().lower()
  normalized = re.sub(r"[^a-z0-9]+", "_", normalized)
  normalized = re.sub(r"_+", "_", normalized).strip("_")
  return normalized


EXPECTED_COLUMNS = {
  "ano": "ano",
  "diretor": "diretor",
  "sigla_uf": "sigla_uf",
  "sigla_uf_": "sigla_uf",
  "tipo_produto": "tipo_produto",
  "tipo_produto_": "tipo_produto",
  "familia": "familia",
  "familia_": "familia",
  "familia_producao": "familia_producao",
  "familia_producao_": "familia_producao",
  "marca": "marca",
  "situacao_lista": "situacao_lista",
  "situacao_lista_": "situacao_lista",
  "cod_produto": "cod_produto",
  "cod_produto_": "cod_produto",
  "produto": "produto",
  "fat_liq_kg": "fat_liq_kg",
  "fat_liq_kg_": "fat_liq_kg",
  "fat_liq_reais": "fat_liq_reais",
  "fat_liq_r": "fat_liq_reais",
  "fat_liq_rs": "fat_liq_reais",
  "fat_liq_r_": "fat_liq_reais"
}

REQUIRED_COLUMNS_IN_ORDER = [
  "ano",
  "diretor",
  "sigla_uf",
  "tipo_produto",
  "familia",
  "familia_producao",
  "marca",
  "situacao_lista",
  "cod_produto",
  "produto",
  "fat_liq_kg",
  "fat_liq_reais"
]


def _normalize_columns(columns: Iterable[str]) -> List[str]:
  normalized = []
  for column in columns:
    key = _normalize_key(column)
    mapped = EXPECTED_COLUMNS.get(key, key)
    normalized.append(mapped)
  return normalized


def _read_dataframe(filename: str, file_bytes: bytes) -> pd.DataFrame:
  buffer = io.BytesIO(file_bytes)
  if filename.endswith((".xls", ".xlsx")):
    df = pd.read_excel(buffer)
  else:
    df = pd.read_csv(buffer, sep=";", decimal=",") if b";" in file_bytes else pd.read_csv(buffer)

  df.columns = _normalize_columns(df.columns)
  return df


def ingest_file(
  filename: str,
  file_bytes: bytes,
  *,
  strict_columns: bool = True,
  notification_id: str | None = None
) -> Tuple[int, int, List[str]]:
  """Load the given file into the database, returning inserted and updated counts."""
  task_id = notification_id or notification_center.start(
    category="upload",
    title=f"Processando {filename}",
    message="Arquivo recebido, preparando ingestão...",
    metadata={"filename": filename}
  )

  try:
    df = _read_dataframe(filename, file_bytes)
    total_rows = len(df)
    logger.info("Ingestão iniciada: arquivo=%s linhas=%s", filename, total_rows)
    notification_center.update(
      task_id,
      total_rows=total_rows,
      processed_rows=0,
      progress=0.0,
      message=f"{filename} processadas=0/{total_rows} (0.0%)"
    )

    missing = set(EXPECTED_COLUMNS.values()) - set(df.columns)
    if missing:
      raise ValueError(f"Colunas ausentes: {', '.join(sorted(missing))}")

    if strict_columns:
      if list(df.columns) != REQUIRED_COLUMNS_IN_ORDER:
        raise ValueError(
          "Layout divergente. Esperado: "
          + ", ".join(REQUIRED_COLUMNS_IN_ORDER)
        )

    inserted = updated = 0
    errors: List[str] = []

    with session_context() as session:
      processed = 0
      for _, row in df.iterrows():
        try:
          with session.begin_nested():
            data = row.to_dict()
            # Normalize numeric strings that may come with commas
            for key in ("fat_liq_kg", "fat_liq_reais"):
              value = data.get(key)
              if isinstance(value, str):
                data[key] = float(value.replace(".", "").replace(",", "."))

            unique_key = (
              int(data["ano"]),
              str(data["cod_produto"]),
              str(data.get("diretor", "")),
              str(data.get("sigla_uf", "")),
              str(data.get("tipo_produto", "")),
              str(data.get("familia", "")),
              str(data.get("familia_producao", "")),
              str(data.get("marca", "")),
              str(data.get("situacao_lista", "")),
              str(data.get("produto", ""))
            )
            statement = select(PlanningRecord).where(
              PlanningRecord.ano == unique_key[0],
              PlanningRecord.cod_produto == unique_key[1],
              PlanningRecord.diretor == unique_key[2],
              PlanningRecord.sigla_uf == unique_key[3],
              PlanningRecord.tipo_produto == unique_key[4],
              PlanningRecord.familia == unique_key[5],
              PlanningRecord.familia_producao == unique_key[6],
              PlanningRecord.marca == unique_key[7],
              PlanningRecord.situacao_lista == unique_key[8],
              PlanningRecord.produto == unique_key[9]
            )
            existing = session.exec(statement).scalar_one_or_none()
            if existing:
              for key, value in data.items():
                setattr(existing, key, value)
              updated += 1
            else:
              record = PlanningRecord(**data)
              session.add(record)
              inserted += 1
          processed += 1
          if total_rows:
            percent = (processed / total_rows) * 100
            if processed % 1000 == 0 or processed == total_rows:
              logger.info(
                "Ingestão progresso: arquivo=%s processadas=%s/%s (%.1f%%)",
                filename,
                processed,
                total_rows,
                percent
              )
              notification_center.update(
                task_id,
                processed_rows=processed,
                total_rows=total_rows,
                progress=processed / total_rows,
                message=f"{filename} processadas={processed}/{total_rows} ({percent:.1f}%)"
              )
        except Exception as exc:  # noqa: BLE001 - capture per-row errors
          logger.exception("Erro ao processar linha: %s", exc)
          errors.append(str(exc))

    logger.info(
      "Ingestão concluída: arquivo=%s inseridos=%s atualizados=%s erros=%s",
      filename,
      inserted,
      updated,
      len(errors)
    )
    notification_center.complete(
      task_id,
      message=f"{filename} finalizado: {inserted} inseridos, {updated} atualizados."
    )

    try:
      rebuilt = rebuild_combinations_snapshot()
      logger.info("Snapshot de combinações recalculado (%s linhas).", rebuilt)
    except Exception as exc:  # noqa: BLE001
      logger.exception("Falha ao reconstruir snapshot de combinações: %s", exc)

    return inserted, updated, errors
  except Exception as exc:
    notification_center.fail(
      task_id,
      message=f"{filename} falhou: {exc}"
    )
    raise


def wipe_all_records() -> int:
  with session_context() as session:
    result = session.exec(delete(PlanningRecord))
    deleted = result.rowcount or 0
    return deleted
