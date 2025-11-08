from typing import Optional

from sqlmodel import Field, SQLModel


class PlanningCombination(SQLModel, table=True):
  """Snapshot agregada das combinações únicas de dimensões comerciais/produto."""

  id: Optional[int] = Field(default=None, primary_key=True)
  diretor: str = Field(default="", index=True)
  sigla_uf: str = Field(default="", index=True, max_length=8)
  tipo_produto: str = Field(default="", index=True)
  familia: str = Field(default="", index=True)
  familia_producao: str = Field(default="")
  marca: str = Field(default="", index=True)
  cod_produto: str = Field(index=True)
  produto: str = Field(default="")
  registros: int = Field(default=0, description="Total de linhas que compõem a combinação")
  first_year: int = Field(default=0, description="Primeiro ano presente na combinação")
  last_year: int = Field(default=0, description="Último ano presente na combinação")
  volume_total: float = Field(default=0.0)
  receita_total: float = Field(default=0.0)
