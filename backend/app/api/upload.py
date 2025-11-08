from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import distinct, func
from sqlmodel import select

from app.core.config import get_settings
from app.db.session import get_session, session_context
from app.models import PlanningRecord
from app.schemas.planning import (
  DeleteRequest,
  DeleteResponse,
  FilterOptions,
  PlanningRecordRead,
  RecordsMeta,
  UploadSummary
)
from app.services.notification_service import notification_center
from app.services.preprocess_service import apply_filters
from app.services.upload_service import ingest_file, wipe_all_records

router = APIRouter()


def _normalize_multi(values: list[str] | None) -> list[str] | None:
  if not values:
    return None
  normalized = [value for value in values if value]
  return normalized or None

@router.post("/", response_model=UploadSummary)
@router.post("", response_model=UploadSummary)  # Aceita /upload e /upload/
async def upload_dataset(
  file: UploadFile = File(...),
  strict: bool = True
):
  filename = file.filename or "dataset"
  task_id = notification_center.start(
    category="upload",
    title=f"Recebendo {filename}",
    message="Upload em andamento...",
    metadata={"filename": filename}
  )
  try:
    content = await file.read()
    notification_center.update(
      task_id,
      message="Arquivo recebido, validando layout..."
    )
    inserted, updated, errors = await run_in_threadpool(
      ingest_file,
      filename,
      content,
      strict_columns=strict,
      notification_id=task_id
    )
  except ValueError as exc:
    notification_center.fail(task_id, message=f"{filename} inválido: {exc}")
    raise HTTPException(status_code=400, detail=str(exc)) from exc
  except Exception as exc:
    notification_center.fail(task_id, message=f"{filename} falhou: {exc}")
    raise HTTPException(status_code=500, detail="Erro ao processar arquivo") from exc

  return UploadSummary(inserted_rows=inserted, updated_rows=updated, errors=errors or None)


@router.get("/records", response_model=list[PlanningRecordRead])
def list_records(
  limit: int = 100,
  ano: int | None = None,
  diretor: str | None = None,
  sigla_uf: str | None = None,
  tipo_produto: str | None = None,
  familia: str | None = None,
  marca: str | None = None,
  session=Depends(get_session)
):
  statement = select(PlanningRecord)
  if ano is not None:
    statement = statement.where(PlanningRecord.ano == ano)
  if diretor:
    statement = statement.where(PlanningRecord.diretor == diretor)
  if sigla_uf:
    statement = statement.where(PlanningRecord.sigla_uf == sigla_uf)
  if tipo_produto:
    statement = statement.where(PlanningRecord.tipo_produto == tipo_produto)
  if familia:
    statement = statement.where(PlanningRecord.familia == familia)
  if marca:
    statement = statement.where(PlanningRecord.marca == marca)

  statement = statement.limit(limit)

  results = session.exec(statement).all()
  return results


@router.get("/records/meta", response_model=RecordsMeta)
def get_records_meta(session=Depends(get_session)):
  result = session.exec(
    select(func.count()).select_from(PlanningRecord)
  ).one()
  total = result[0] if isinstance(result, (tuple, list)) else result
  return RecordsMeta(total_records=int(total or 0))


@router.get("/records/filters", response_model=FilterOptions)
def get_filter_options(
  diretor: list[str] | None = Query(default=None),
  sigla_uf: list[str] | None = Query(default=None),
  tipo_produto: list[str] | None = Query(default=None),
  familia: list[str] | None = Query(default=None),
  familia_producao: list[str] | None = Query(default=None),
  marca: list[str] | None = Query(default=None),
  situacao_lista: list[str] | None = Query(default=None),
  cod_produto: list[str] | None = Query(default=None),
  produto: list[str] | None = Query(default=None)
):
  applied_filters = {
    "diretor": _normalize_multi(diretor),
    "sigla_uf": _normalize_multi(sigla_uf),
    "tipo_produto": _normalize_multi(tipo_produto),
    "familia": _normalize_multi(familia),
    "familia_producao": _normalize_multi(familia_producao),
    "marca": _normalize_multi(marca),
    "situacao_lista": _normalize_multi(situacao_lista),
    "cod_produto": _normalize_multi(cod_produto),
    "produto": _normalize_multi(produto)
  }

  with session_context() as session:
    def fetch_distinct(field_name: str, column):
      filters_except_current = {
        key: value
        for key, value in applied_filters.items()
        if key != field_name
      }
      statement = select(distinct(column)).order_by(column)
      statement = apply_filters(statement, filters_except_current)
      values = []
      for row in session.exec(statement).all():
        value = row[0] if isinstance(row, (tuple, list)) else row
        if value:
          values.append(value)
      return values

    return FilterOptions(
      anos=fetch_distinct("ano", PlanningRecord.ano),
      diretores=fetch_distinct("diretor", PlanningRecord.diretor),
      ufs=fetch_distinct("sigla_uf", PlanningRecord.sigla_uf),
      tipos_produto=fetch_distinct("tipo_produto", PlanningRecord.tipo_produto),
      familias=fetch_distinct("familia", PlanningRecord.familia),
      familias_producao=fetch_distinct("familia_producao", PlanningRecord.familia_producao),
      marcas=fetch_distinct("marca", PlanningRecord.marca),
      situacoes=fetch_distinct("situacao_lista", PlanningRecord.situacao_lista),
      codigos=fetch_distinct("cod_produto", PlanningRecord.cod_produto),
      produtos=fetch_distinct("produto", PlanningRecord.produto)
    )


@router.delete("/records", response_model=DeleteResponse)
def delete_records(payload: DeleteRequest):
  settings = get_settings()
  if payload.confirmation.strip() != settings.delete_confirmation_text:
    raise HTTPException(
      status_code=400,
      detail="Texto de confirmação inválido."
    )
  deleted = wipe_all_records()
  return DeleteResponse(deleted_rows=deleted)
