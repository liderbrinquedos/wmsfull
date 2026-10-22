import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.routers import auth, wms, conference, delivery, admin

app = FastAPI(
    title="WMSFull API",
    description="Sistema Logístico: WMS + Conferência + Entrega",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS — permite frontend React acessar a API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Servir arquivos de upload (fotos de canhoto)
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Incluir routers
app.include_router(auth.router)
app.include_router(wms.router)
app.include_router(conference.router)
app.include_router(delivery.router)
app.include_router(admin.router)


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "app": "WMSFull API", "version": "1.0.0"}


@app.get("/health", tags=["Health"])
def health():
    return {"status": "healthy"}
