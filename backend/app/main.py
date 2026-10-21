from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.routes.auth import router as auth_router
from app.api.routes.developer import router as developer_router
from app.api.routes.payroll import router as payroll_router
from app.api.routes.users import router as users_router
from app.core.config import get_settings
from app.db.session import engine


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.3.0",
    description=(
        "API do PRIME ERP. Inclui autenticação multiempresa e a primeira etapa "
        "do módulo Folha: cadastro de funcionários isolado por transportadora."
    ),
    docs_url="/docs" if settings.app_env != "production" else None,
    redoc_url="/redoc" if settings.app_env != "production" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID", "X-Company-ID"],
)

app.include_router(auth_router, prefix=settings.api_v1_prefix)
app.include_router(developer_router, prefix=settings.api_v1_prefix)
app.include_router(payroll_router, prefix=settings.api_v1_prefix)
app.include_router(users_router, prefix=settings.api_v1_prefix)


@app.get("/health/live", tags=["health"])
def liveness() -> dict[str, str]:
    return {"status": "ok", "service": "prime-api"}


@app.get("/health/ready", tags=["health"])
def readiness() -> dict[str, str]:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        # Não expor detalhes da conexão ou credenciais na resposta HTTP.
        from fastapi import HTTPException

        raise HTTPException(status_code=503, detail="Banco de dados indisponível") from None
    return {"status": "ok", "database": "ok"}
