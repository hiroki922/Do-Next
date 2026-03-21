from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:password@localhost:5432/appdb"

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
