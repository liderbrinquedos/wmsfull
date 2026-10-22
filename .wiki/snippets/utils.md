# Snippets - WMSFull

> **Ultima revisao:** 2026-10-22
> Padroes reutilizaveis. Ao usar um snippet novo, registre aqui com o caminho de origem.

---

## 1. Refocus automatico do input de codigo de barras

O leitor USB de codes de barras **digita os caracteres e envia Enter**. O input precisa
voltar a receber foco depois de cada resposta da API, senao a proxima bipagem se perde.

**Origem:** `frontend/src/modules/conference/ConferenceSession.tsx`

```tsx
const inputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  inputRef.current?.focus();
}, [currentNf?.id, isScanning]);

const handleScanSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!barcodeInput.trim()) return;
  try {
    await conferenceApi.scan(currentNf!.id, barcodeInput.trim());
    setBarcodeInput('');
    setSuccessMsg('Caixa bipada!');
    setErrorMsg(null);
  } catch (err: any) {
    setErrorMsg(err.response?.data?.detail || 'Codigo de barras invalido ou item ja conferido!');
  } finally {
    // o foco volta para o campo, com um tick de atraso para o Android nao abrir o teclado
    setTimeout(() => inputRef.current?.focus(), 50);
  }
};
```

**Quando usar:** qualquer tela que receba leitura de codigo de barras.

---

## 2. Formatar data em pt-BR

**Origem:** `frontend/src/modules/admin/AdminDashboard.tsx`, `DeliveryPage.tsx`

```ts
const formatDate = (iso?: string | null) => {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('pt-BR');
};

const formatDateOnly = (iso?: string | null) => {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('pt-BR');
};
```

> Para **gerar** a data de hoje, cuidado com o fuso: `toISOString()` devolve UTC e erra
> entre 00:00 e 03:00 no America/Sao_Paulo (backlog P3-03). Use
> `new Date().toLocaleDateString('sv-SE')` ou monte a data a partir dos componentes locais.

---

## 3. Badge de status da NF

**Origem:** `frontend/src/index.css` + `frontend/src/modules/conference/ConferencePage.tsx`

```tsx
const statusLabel: Record<string, string> = {
  pendente: 'Pendente',
  em_conferencia: 'Em Conferencia',
  conferida: 'Conferida',
  em_entrega: 'Em Entrega',
  entregue: 'Entregue',
  reagendado: 'Reagendado',
};

<span className={`badge badge-${nf.status}`}>
  {statusLabel[nf.status] ?? nf.status}
</span>
```

Classes CSS: `.badge-pendente`, `.badge-em_conferencia`, `.badge-conferida`,
`.badge-em_entrega`, `.badge-entregue`, `.badge-reagendado`.

---

## 4. Decodificar a localizacao do estoque

Formato: `RUA` + `PRAT` + `POS(2)` + `NIVEL` -> 5 caracteres.

**Origem:** `frontend/src/modules/wms/LocationBadge.tsx`

```tsx
export const LocationBadge: React.FC<{ location: string }> = ({ location }) => {
  const rua = location[0] ?? '';
  const prateleira = location[1] ?? '';
  const posicao = location.slice(2, 4);
  const nivel = location.length >= 5 ? location[4] : '';

  return (
    <div className="location-badge" title={`Rua ${rua} - Prateleira ${prateleira} - Posicao ${posicao} - Nivel ${nivel}`}>
      <span className="loc-rua">{rua}</span>
      <span>{prateleira}</span>
      <span>{posicao}</span>
      <span>{nivel}</span>
    </div>
  );
};
```

---

## 5. Montar a localizacao a partir dos campos do modal

**Origem:** `frontend/src/modules/wms/MoveLocationModal.tsx`

```ts
const fullLocation =
  rua.toUpperCase() +
  prateleira +
  posicao.padStart(2, '0') +
  nivel.toUpperCase();
```

Regras: Rua = 1 letra maiuscula; Prateleira = 1 digito (1-9); Posicao = 2 digitos
(`padStart(2,'0')`); Nivel = 1 letra maiuscula.

---

## 6. Debounce de busca (250 ms)

**Origem:** `frontend/src/modules/wms/WMSPage.tsx`

```tsx
useEffect(() => {
  const timer = setTimeout(() => {
    loadData();
  }, 250);
  return () => clearTimeout(timer);
}, [search]);
```

---

## 7. Carregamento paralelo

**Origem:** `frontend/src/modules/wms/WMSPage.tsx`, `AdminDashboard.tsx`

```tsx
const [products, stats] = await Promise.all([
  wmsApi.getProducts(search),
  wmsApi.getStats(),
]);
```

---

## 8. Mensagem de erro da API

O backend retorna `{ "detail": "..." }` nos erros do FastAPI.

```ts
const message = err?.response?.data?.detail || 'Erro ao carregar dados';
```

---

## 9. Preview de imagem antes do upload

**Origem:** `frontend/src/modules/delivery/DeliveryModal.tsx`

```tsx
const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  setPhotoFile(file);

  const reader = new FileReader();
  reader.onloadend = () => setPhotoPreview(reader.result as string);
  reader.readAsDataURL(file);
};
```

O `FileReader` escolhe `data:` URL, **nao** `blob:` - o preview e local e some ao
fechar o modal, o que e o comportamento desejado.

---

## 10. Captura de foto pela camera do celular

**Origem:** `frontend/src/modules/delivery/DeliveryModal.tsx`

```tsx
<input
  type="file"
  accept="image/*"
  capture="environment"
  onChange={handlePhotoChange}
  style={{ display: 'none' }}
  ref={fileInputRef}
/>
<button type="button" onClick={() => fileInputRef.current?.click()}>
  Tirar Foto com a Camera
</button>
```

`capture="environment"` abre a camera traseira em mobile.

---

## 11. Dependencia de rota por perfil (backend)

**Origem:** `backend/app/core/security.py`

```python
from fastapi import Depends, HTTPException

def require_roles(*roles: str):
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.perfil not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"Acesso negado. Perfil necessario: {', '.join(roles)}"
            )
        return current_user
    return role_checker
```

Uso:
```python
@router.put("/products/{product_id}/location", response_model=ProductOut)
def update_location(
    product_id: str,
    body: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor")),
):
    ...
```

---

## 12. Guard de rota por perfil (frontend)

**Origem:** `frontend/src/auth/AuthGuard.tsx`

```tsx
export const AuthGuard: React.FC<{ allowedRoles?: User['perfil'][] }> = ({ allowedRoles }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(user.perfil)) {
    const fallback = user.perfil === 'motorista' ? '/delivery'
      : user.perfil === 'operador' ? '/conference'
      : '/wms';
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
};
```

---

## 13. Numero de caixas necessarias

**Backend** (`backend/app/routers/conference.py` e `seed.py`):
```python
caixas_necessarias = math.ceil(qtd_nota / qtd_embalagem)
```

**Frontend** (para exibicao em tempo real):
```ts
const totalCaixas = itens.reduce((acc, i) => acc + i.caixas_necessarias, 0);
const totalLidas = itens.reduce((acc, i) => acc + i.caixas_lidas, 0);
const percent = totalCaixas ? Math.round((totalLidas / totalCaixas) * 100) : 0;
```

---

## Links Relacionados

- [[patterns/coding-standards]]
- [[patterns/frontend-standards]]
- [[brain/business-rules]]
