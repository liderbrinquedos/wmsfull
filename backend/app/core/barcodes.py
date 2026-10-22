"""Validacao de codigos de barras (EAN13 / DUN14).

O digito verificador e a unica forma barata de pegar erro de digitacao. As fichas
tecnicas de 2026-10 tinham 2 EAN13 e 12 DUN14 invalidos; sem esta checagem eles
entrariam no catalogo e so apareceriam quando alguem tentasse bipar.
"""


def calcular_dv(payload: str) -> int:
    """Digito verificador GTIN (pesos 3,1,3,1... da direita para a esquerda)."""
    soma = 0
    for i, caractere in enumerate(reversed(payload)):
        soma += int(caractere) * (3 if i % 2 == 0 else 1)
    return (10 - soma % 10) % 10


def ean_valido(codigo: str | None, tamanho: int) -> bool:
    """Confere tamanho, se e numerico e o digito verificador."""
    if not codigo or len(codigo) != tamanho or not codigo.isdigit():
        return False
    return calcular_dv(codigo[:-1]) == int(codigo[-1])


def ean13_valido(codigo: str | None) -> bool:
    return ean_valido(codigo, 13)


def ean14_valido(codigo: str | None) -> bool:
    return ean_valido(codigo, 14)
