from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuracao da API.

    SECRET_KEY e DATABASE_URL nao tem valor padrao de proposito: sem eles a API
    nao sobe. Falhar no boot e melhor do que rodar em producao com uma chave
    publica ou apontando para o banco errado (P0-01).
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = Field(min_length=1)
    SECRET_KEY: str = Field(min_length=32)

    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    UPLOAD_DIR: str = "./uploads"

    # Origens permitidas no CORS, separadas por virgula.
    # Vazio = nenhuma origem externa (o frontend e servido pelo mesmo dominio).
    CORS_ORIGINS: str = ""

    # Popula o banco com dados de demonstracao no boot. Nunca em producao.
    SEED_DEMO_DATA: bool = False

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
