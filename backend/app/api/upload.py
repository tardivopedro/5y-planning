from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import distinct
from sqlmodel import select

from app.core.config import get_settings
from app.db.session import get_session, session_context
from app.models import PlanningRecord
from app.schemas.planning import (
  DeleteRequest,
  DeleteResponse,
  FilterOptions,
  PlanningRecordRead,
  UploadSummary
)
from app.services.upload_service import ingest_file, wipe_all_records

router = APIRouter()


@router.post("/", response_model=UploadSummary)
async def upload_dataset(
  file: UploadFile = File(...),
  strict: bool = True
):
  try:
    content = await file.read()
    inserted, updated, errors = ingest_file(file.filename, content, strict_columns=strict)
  except ValueError as exc:
    raise HTTPException(status_code=400, detail=str(exc)) from exc
  except Exception as exc:
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


@router.get("/records/filters", response_model=FilterOptions)
def get_filter_options():
  with session_context() as session:
    def fetch_distinct(field):
      statement = select(distinct(field)).order_by(field)
      return [row[0] for row in session.exec(statement).all() if row[0]]

    return FilterOptions(
      anos=fetch_distinct(PlanningRecord.ano),
      diretores=fetch_distinct(PlanningRecord.diretor),
      ufs=fetch_distinct(PlanningRecord.sigla_uf),
      tipos_produto=fetch_distinct(PlanningRecord.tipo_produto),
      familias=fetch_distinct(PlanningRecord.familia),
      familias_producao=fetch_distinct(PlanningRecord.familia_producao),
      marcas=fetch_distinct(PlanningRecord.marca),
      situacoes=fetch_distinct(PlanningRecord.situacao_lista),
      codigos=fetch_distinct(PlanningRecord.cod_produto),
      produtos=fetch_distinct(PlanningRecord.produto)
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
