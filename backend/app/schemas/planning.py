from typing import List, Optional

from pydantic import BaseModel


class PlanningRecordBase(BaseModel):
  ano: int
  diretor: str
  sigla_uf: str
  tipo_produto: str
  familia: str
  familia_producao: str
  marca: str
  situacao_lista: str
  cod_produto: str
  produto: str
  fat_liq_kg: float
  fat_liq_reais: float


class PlanningRecordRead(PlanningRecordBase):
  id: int


class UploadSummary(BaseModel):
  inserted_rows: int
  updated_rows: int
  errors: Optional[List[str]] = None


class DeleteRequest(BaseModel):
  confirmation: str


class DeleteResponse(BaseModel):
  deleted_rows: int


class FilterOptions(BaseModel):
  anos: List[int]
  diretores: List[str]
  ufs: List[str]
  tipos_produto: List[str]
  familias: List[str]
  familias_producao: List[str]
  marcas: List[str]
  situacoes: List[str]
  codigos: List[str]
  produtos: List[str]


class RecordsMeta(BaseModel):
  total_records: int
