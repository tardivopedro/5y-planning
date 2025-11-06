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


@lru_cache
def get_settings() -> Settings:
  return Settings()
