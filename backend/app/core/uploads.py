"""Validacao e gravacao de arquivos enviados pela API.

O nome e o content_type enviados pelo cliente nao sao confiaveis: o nome pode
trazer uma extensao executavel e o content_type pode ser falsificado. Por isso a
extensao e escolhida pelo tipo declarado e o conteudo e conferido pela assinatura
binaria antes de ir para o disco.
"""
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import settings

TAMANHO_MAXIMO = 5 * 1024 * 1024  # 5 MB

EXTENSAO_POR_TIPO = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def _assinatura_valida(tipo: str, conteudo: bytes) -> bool:
    if tipo == "image/jpeg":
        return conteudo.startswith(b"\xff\xd8\xff")
    if tipo == "image/png":
        return conteudo.startswith(b"\x89PNG\r\n\x1a\n")
    if tipo == "image/webp":
        return conteudo[:4] == b"RIFF" and conteudo[8:12] == b"WEBP"
    return False


async def salvar_imagem(foto: UploadFile, campo: str = "foto") -> str:
    """Valida a imagem e devolve a URL publica (/uploads/...) do arquivo salvo."""
    tipo = (foto.content_type or "").lower()
    if tipo not in EXTENSAO_POR_TIPO:
        raise HTTPException(
            status_code=400,
            detail=f"{campo}: envie a imagem em JPEG, PNG ou WebP",
        )

    conteudo = await foto.read()
    if not conteudo:
        raise HTTPException(status_code=400, detail=f"{campo}: arquivo vazio")
    if len(conteudo) > TAMANHO_MAXIMO:
        raise HTTPException(
            status_code=413,
            detail=f"{campo}: imagem maior que {TAMANHO_MAXIMO // (1024 * 1024)} MB",
        )
    if not _assinatura_valida(tipo, conteudo):
        raise HTTPException(
            status_code=400,
            detail=f"{campo}: o conteudo do arquivo nao corresponde a uma imagem {tipo}",
        )

    destino = Path(settings.UPLOAD_DIR)
    destino.mkdir(parents=True, exist_ok=True)
    nome = f"{uuid.uuid4()}{EXTENSAO_POR_TIPO[tipo]}"
    (destino / nome).write_bytes(conteudo)
    return f"/uploads/{nome}"
