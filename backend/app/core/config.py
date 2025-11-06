import os
from functools import lru_cache
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
  """Application configuration loaded from environment variables or .env file."""

  app_name: str = Field(default="5y-planning-backend")
  debug: bool = Field(default=True)
  database_url: str = Field(
    default="sqlite:///./data/forecast.db",
    description="SQLAlchemy-style database URL."
  )
  delete_confirmation_text: str = Field(
    default="DELETE-ALL",
    min_length=3,
    description="Texto de confirmação necessário para truncar a base."
  )

  class Config:
    env_file = ".env"
    env_file_encoding = "utf-8"

  @classmethod
  def _get_database_url_from_env(cls) -> str:
    """Tenta construir DATABASE_URL a partir de variáveis de ambiente do Railway."""
    # Railway pode fornecer DATABASE_URL ou POSTGRES_URL diretamente
    if db_url := os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL"):
      return db_url
    
    # Se não, tenta construir a partir de variáveis individuais
    pg_host = os.getenv("PGHOST") or os.getenv("POSTGRES_HOSTNAME")
    pg_port = os.getenv("PGPORT") or os.getenv("POSTGRES_PORT", "5432")
    pg_user = os.getenv("PGUSER") or os.getenv("POSTGRES_USER", "postgres")
    pg_password = os.getenv("PGPASSWORD") or os.getenv("POSTGRES_PASSWORD")
    pg_database = os.getenv("PGDATABASE") or os.getenv("POSTGRES_DATABASE", "railway")
    
    if pg_host and pg_user and pg_password:
      return f"postgresql+psycopg://{pg_user}:{pg_password}@{pg_host}:{pg_port}/{pg_database}"
    
    # Fallback para SQLite
    return "sqlite:///./data/forecast.db"
  
  def model_post_init(self, __context) -> None:
    """Ajusta database_url após a inicialização do modelo se necessário."""
    # Se database_url ainda é o padrão SQLite, tenta buscar de outras variáveis Railway
    if self.database_url == "sqlite:///./data/forecast.db":
      env_url = self._get_database_url_from_env()
      if env_url != "sqlite:///./data/forecast.db":
        self.database_url = env_url


@lru_cache
def get_settings() -> Settings:
  return Settings()
