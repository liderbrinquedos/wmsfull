"""Leitura do ERP.

O agente nunca escreve no ERP: tudo e SELECT em views dedicadas. Trocar de banco
significa trocar a classe `FonteERP`; o resto do agente nao muda.
"""
from __future__ import annotations

import csv
import os
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Iterable


@dataclass
class ProdutoERP:
    codigo: str
    referencia: str | None = None
    descricao: str | None = None
    ean13: str | None = None
    qtd_embalagem: int | None = None

    def para_payload(self) -> dict:
        return {
            "codigo": self.codigo,
            "referencia": self.referencia,
            "descricao": self.descricao,
            "ean13": self.ean13,
            "qtd_embalagem": self.qtd_embalagem,
        }


@dataclass
class ItemERP:
    codigo_produto: str
    qtd_nota: int
    qtd_embalagem: int | None = None

    def para_payload(self) -> dict:
        return {
            "codigo": self.codigo_produto,
            "qtd_nota": self.qtd_nota,
            "qtd_embalagem": self.qtd_embalagem,
        }


@dataclass
class NotaERP:
    numero: str
    cliente: str
    codigo_empresa: int = 1
    nunota: int | None = None
    chave_nfe: str | None = None
    serie: str | None = None
    cnpj_cliente: str | None = None
    endereco: str | None = None
    data_emissao: date | None = None
    itens: list[ItemERP] = field(default_factory=list)

    def chave(self) -> str:
        if self.nunota is not None:
            return f"nunota:{self.nunota}"
        if self.chave_nfe:
            return f"chave:{self.chave_nfe}"
        return f"{self.codigo_empresa}/{self.serie or '-'}/{self.numero}"

    def para_payload(self) -> dict:
        return {
            "codigo_empresa": self.codigo_empresa,
            "nunota": self.nunota,
            "numero": self.numero,
            "chave_nfe": self.chave_nfe,
            "serie": self.serie,
            "cnpj_cliente": self.cnpj_cliente,
            "cliente": self.cliente,
            "endereco": self.endereco,
            "data_emissao": self.data_emissao.isoformat() if self.data_emissao else None,
            "itens": [item.para_payload() for item in self.itens],
        }


class FonteERP:
    """Contrato de leitura."""

    def produtos(self) -> Iterable[ProdutoERP]:
        raise NotImplementedError

    def notas(self, desde: date) -> Iterable[NotaERP]:
        raise NotImplementedError


def _texto(valor) -> str | None:
    if valor is None:
        return None
    texto = str(valor).strip()
    return texto or None


def _inteiro(valor) -> int | None:
    if valor is None or valor == "":
        return None
    try:
        return int(float(str(valor).replace(",", ".")))
    except ValueError:
        return None


def _data(valor) -> date | None:
    if valor is None or valor == "":
        return None
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    texto = str(valor).strip()[:10]
    for formato in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(texto, formato).date()
        except ValueError:
            continue
    return None


class PostgresERP(FonteERP):
    """Leitura de views no Postgres do ERP.

    Contrato das views em sync-agent/README.md.
    """

    def __init__(self, url: str, view_produtos: str, view_nf: str):
        self.url = url
        self.view_produtos = view_produtos
        self.view_nf = view_nf

    def _conectar(self):
        import psycopg2  # importado aqui para o modo CSV nao exigir o driver
        from psycopg2.extras import RealDictCursor

        conexao = psycopg2.connect(self.url, connect_timeout=15)
        conexao.set_session(readonly=True, autocommit=True)
        return conexao, RealDictCursor

    def produtos(self) -> Iterable[ProdutoERP]:
        conexao, cursor_factory = self._conectar()
        try:
            with conexao.cursor(cursor_factory=cursor_factory) as cur:
                cur.execute(
                    f"SELECT codigo, referencia, descricao, ean13, qtd_embalagem "
                    f"FROM {self.view_produtos}"
                )
                for linha in cur:
                    yield ProdutoERP(
                        codigo=_texto(linha["codigo"]) or "",
                        referencia=_texto(linha["referencia"]),
                        descricao=_texto(linha["descricao"]),
                        ean13=_texto(linha["ean13"]),
                        qtd_embalagem=_inteiro(linha["qtd_embalagem"]),
                    )
        finally:
            conexao.close()

    def notas(self, desde: date) -> Iterable[NotaERP]:
        conexao, cursor_factory = self._conectar()
        try:
            with conexao.cursor(cursor_factory=cursor_factory) as cur:
                cur.execute(
                    f"""
                    SELECT codigo_empresa, nunota, chave_nfe, numero, serie,
                           cnpj_cliente, cliente, endereco, data_emissao,
                           codigo_produto, qtd_nota, qtd_embalagem
                      FROM {self.view_nf}
                     WHERE data_emissao >= %s
                     ORDER BY data_emissao, numero
                    """,
                    (desde,),
                )
                yield from _agrupar_notas(cur)
        finally:
            conexao.close()


class CsvERP(FonteERP):
    """Leitura de dois CSV. Serve para teste e para contingencia manual.

    Colunas identicas as das views (ver README).
    """

    def __init__(self, arquivo_produtos: str, arquivo_nf: str):
        self.arquivo_produtos = arquivo_produtos
        self.arquivo_nf = arquivo_nf

    def produtos(self) -> Iterable[ProdutoERP]:
        with open(self.arquivo_produtos, newline="", encoding="utf-8") as arquivo:
            for linha in csv.DictReader(arquivo):
                yield ProdutoERP(
                    codigo=_texto(linha.get("codigo")) or "",
                    referencia=_texto(linha.get("referencia")),
                    descricao=_texto(linha.get("descricao")),
                    ean13=_texto(linha.get("ean13")),
                    qtd_embalagem=_inteiro(linha.get("qtd_embalagem")),
                )

    def notas(self, desde: date) -> Iterable[NotaERP]:
        with open(self.arquivo_nf, newline="", encoding="utf-8") as arquivo:
            linhas = [linha for linha in csv.DictReader(arquivo)]
        for nota in _agrupar_notas(linhas):
            if nota.data_emissao is None or nota.data_emissao >= desde:
                yield nota


def _agrupar_notas(linhas: Iterable[dict]) -> Iterable[NotaERP]:
    """Uma linha por item -> uma NotaERP com a lista de itens."""
    por_chave: dict[str, NotaERP] = {}
    for linha in linhas:
        numero = _texto(linha.get("numero")) or ""
        chave_nfe = _texto(linha.get("chave_nfe"))
        serie = _texto(linha.get("serie"))
        codigo_empresa = _inteiro(linha.get("codigo_empresa")) or 1
        nunota = _inteiro(linha.get("nunota"))

        # NUNOTA e o id do sistema (Sankhya): agrupa melhor que a chave da SEFAZ.
        if nunota is not None:
            chave = f"nunota:{nunota}"
        elif chave_nfe:
            chave = f"chave:{chave_nfe}"
        else:
            chave = f"{codigo_empresa}/{serie or '-'}/{numero}"

        nota = por_chave.get(chave)
        if nota is None:
            nota = NotaERP(
                numero=numero,
                codigo_empresa=codigo_empresa,
                nunota=nunota,
                chave_nfe=chave_nfe,
                serie=serie,
                cnpj_cliente=_texto(linha.get("cnpj_cliente")),
                cliente=_texto(linha.get("cliente")) or "",
                endereco=_texto(linha.get("endereco")),
                data_emissao=_data(linha.get("data_emissao")),
            )
            por_chave[chave] = nota

        codigo_produto = _texto(linha.get("codigo_produto"))
        if codigo_produto:
            nota.itens.append(
                ItemERP(
                    codigo_produto=codigo_produto,
                    qtd_nota=_inteiro(linha.get("qtd_nota")) or 0,
                    qtd_embalagem=_inteiro(linha.get("qtd_embalagem")),
                )
            )

    return list(por_chave.values())


def criar_fonte(env=os.environ) -> FonteERP:
    tipo = env.get("ERP_TIPO", "postgres").lower()
    if tipo == "csv":
        return CsvERP(
            arquivo_produtos=env["ERP_CSV_PRODUTOS"],
            arquivo_nf=env["ERP_CSV_NF"],
        )
    if tipo == "postgres":
        return PostgresERP(
            url=env["ERP_DATABASE_URL"],
            view_produtos=env.get("ERP_VIEW_PRODUTOS", "wms_produtos"),
            view_nf=env.get("ERP_VIEW_NF", "wms_nf_itens"),
        )
    raise SystemExit(f"ERP_TIPO desconhecido: {tipo} (use 'postgres' ou 'csv')")
