from typing import Optional

from sqlmodel import Field, SQLModel


class PlanningRecord(SQLModel, table=True):
  """Represents a single row of the planning dataset."""

  id: Optional[int] = Field(default=None, primary_key=True)
  ano: int = Field(index=True, description="Ano da medição")
  diretor: str = Field(index=True, default="")
  sigla_uf: str = Field(index=True, max_length=8, default="")
  tipo_produto: str = Field(index=True, default="")
  familia: str = Field(index=True, default="")
  familia_producao: str = Field(default="")
  marca: str
  situacao_lista: str = Field(default="ATIVO")
  cod_produto: str = Field(index=True)
  produto: str
  fat_liq_kg: float = Field(default=0)
  fat_liq_reais: float = Field(default=0)
