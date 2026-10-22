import axios from 'axios';

export interface User {
  id: string;
  nome: string;
  email: string;
  perfil: 'admin' | 'supervisor' | 'operador' | 'motorista';
  ativo: boolean;
}

export interface Product {
  id: string;
  codigo: string;
  referencia: string;
  descricao: string;
  qtd_embalagem: number;
  // Nulo enquanto o produto nao recebeu endereco (a planilha de referencia
  // cobre 617 de 1.998 SKUs).
  localizacao?: string | null;
  estoque_caixas: number;
  // ean13 = unidade; ean14 = caixa master (DUN14); master legado = codigo
  // unico antigo, ainda aceito na bipagem.
  ean13?: string | null;
  ean14?: string | null;
  ean13_origem?: string | null;
  ean14_origem?: string | null;
  codigo_barras_master?: string | null;
}

export interface NFItem {
  id: string;
  product_id: string;
  qtd_nota: number;
  qtd_embalagem: number;
  caixas_necessarias: number;
  caixas_lidas: number;
  conferido: boolean;
  produto?: Product;
}

export interface NotaFiscal {
  id: string;
  codigo_empresa: number;
  nunota?: number | null;
  numero: string;
  serie?: string | null;
  chave_nfe?: string | null;
  cliente: string;
  cnpj_cliente?: string | null;
  endereco?: string;
  data_emissao?: string | null;
  status: 'pendente' | 'em_conferencia' | 'conferida' | 'em_entrega' | 'entregue' | 'reagendado';
  motorista_id?: string;
  motorista?: User;
  created_at: string;
  itens: NFItem[];
}

export interface DeliveryReportItem {
  id: string;
  nf_numero?: string;
  motorista?: string;
  status: string;
  motivo_falha?: string;
  data_reagendamento?: string;
  foto_canhoto_url?: string;
  created_at: string;
}

export interface AdminOverview {
  total_nfs: number;
  by_status: Record<string, number>;
  total_usuarios: number;
  motoristas_ativos: number;
}

const api = axios.create({
  baseURL: '/api',
});

// Interceptor para injetar token JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para deslogar em caso de 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: async (username: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    const res = await api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return res.data;
  },
  me: async (): Promise<User> => {
    const res = await api.get('/auth/me');
    return res.data;
  },
};

export const wmsApi = {
  getProducts: async (search?: string): Promise<Product[]> => {
    const res = await api.get('/wms/products', { params: { search } });
    return res.data;
  },
  getProduct: async (id: string): Promise<Product> => {
    const res = await api.get(`/wms/products/${id}`);
    return res.data;
  },
  updateLocation: async (id: string, localizacao: string, estoque_caixas?: number): Promise<Product> => {
    const res = await api.put(`/wms/products/${id}/location`, { localizacao, estoque_caixas });
    return res.data;
  },
  updateEan: async (
    id: string,
    ean: { ean13?: string | null; ean14?: string | null }
  ): Promise<Product> => {
    const res = await api.put(`/wms/products/${id}/ean`, ean);
    return res.data;
  },
  getStats: async () => {
    const res = await api.get('/wms/stats');
    return res.data;
  },
};

export const conferenceApi = {
  getNFs: async (status?: string): Promise<NotaFiscal[]> => {
    const res = await api.get('/conference/nf', { params: { status } });
    return res.data;
  },
  getNF: async (id: string): Promise<NotaFiscal> => {
    const res = await api.get(`/conference/nf/${id}`);
    return res.data;
  },
  start: async (id: string): Promise<NotaFiscal> => {
    const res = await api.post(`/conference/nf/${id}/start`);
    return res.data;
  },
  scan: async (id: string, codigo_barras: string): Promise<NotaFiscal> => {
    const res = await api.post(`/conference/nf/${id}/scan`, { codigo_barras });
    return res.data;
  },
  assignMotorista: async (id: string, motorista_id: string): Promise<NotaFiscal> => {
    const res = await api.post(`/conference/nf/${id}/assign`, { motorista_id });
    return res.data;
  },
};

export const deliveryApi = {
  getMyNFs: async (): Promise<NotaFiscal[]> => {
    const res = await api.get('/delivery/nf');
    return res.data;
  },
  deliver: async (id: string, fotoFile?: File) => {
    const formData = new FormData();
    if (fotoFile) {
      formData.append('foto', fotoFile);
    }
    const res = await api.post(`/delivery/nf/${id}/deliver`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  reschedule: async (id: string, motivo: string, data_reagendamento: string) => {
    const res = await api.post(`/delivery/nf/${id}/reschedule`, { motivo, data_reagendamento });
    return res.data;
  },
};

export const adminApi = {
  getUsers: async (): Promise<User[]> => {
    const res = await api.get('/admin/users');
    return res.data;
  },
  createUser: async (user: { nome: string; email: string; senha: string; perfil: string }): Promise<User> => {
    const res = await api.post('/admin/users', user);
    return res.data;
  },
  updateUser: async (id: string, user: Partial<User>): Promise<User> => {
    const res = await api.put(`/admin/users/${id}`, user);
    return res.data;
  },
  getMotoristas: async (): Promise<User[]> => {
    const res = await api.get('/admin/motoristas');
    return res.data;
  },
  getReports: async (motorista_id?: string): Promise<DeliveryReportItem[]> => {
    const res = await api.get('/admin/reports/deliveries', { params: { motorista_id } });
    return res.data;
  },
  getOverview: async (): Promise<AdminOverview> => {
    const res = await api.get('/admin/overview');
    return res.data;
  },
};

// ── Ingestao (painel do admin) ───────────────────────────────────

export interface SyncRunResumo {
  id: string;
  tipo: 'erp' | 'ficha' | 'localizacao';
  origem: 'agenda' | 'manual' | 'upload';
  status: 'executando' | 'ok' | 'parcial' | 'erro';
  iniciado_em: string | null;
  finalizado_em: string | null;
  lidos: number;
  gravados: number;
  erros: number;
  arquivo: string | null;
  mensagem: string | null;
}

export interface SyncPedido {
  id: string;
  status: string;
  solicitado_em: string | null;
  atendido_em: string | null;
  run_id: string | null;
}

export interface SyncStatus {
  ultima_por_tipo: Record<string, SyncRunResumo | null>;
  pedido_pendente: SyncPedido | null;
  consultado_em: string;
}

export interface SyncRunDetalhe extends SyncRunResumo {
  erros_detalhe: Array<{
    entidade: string;
    chave: string | null;
    campo: string | null;
    motivo: string;
  }>;
}

export const syncApi = {
  status: async (): Promise<SyncStatus> => {
    const res = await api.get('/admin/sync/status');
    return res.data;
  },
  solicitar: async (): Promise<SyncPedido> => {
    const res = await api.post('/admin/sync/request');
    return res.data;
  },
  runs: async (tipo?: string): Promise<SyncRunResumo[]> => {
    const res = await api.get('/admin/sync/runs', { params: { tipo } });
    return res.data;
  },
  run: async (id: string): Promise<SyncRunDetalhe> => {
    const res = await api.get(`/admin/sync/runs/${id}`);
    return res.data;
  },
};

// ── Importacao de planilhas ──────────────────────────────────────

export interface ImportRelatorio {
  tipo: 'ficha' | 'localizacao';
  arquivo: string;
  linhas_lidas: number;
  validas: number;
  rejeitadas: number;
  nao_encontradas: number;
  sem_alteracao: number;
  sem_localizacao: number;
  divergencias: Array<{ chave: string; campo: string; planilha: number; atual: number }>;
  erros: Array<{ linha: number; chave: string | null; motivo: string }>;
  amostra: Array<{ chave: string; antes: Record<string, unknown>; depois: Record<string, unknown> }>;
  aplicado: boolean;
  run_id?: string | null;
  gravados?: number;
  status?: string;
  mensagem?: string;
}

export const importApi = {
  preview: async (tipo: string, arquivo: File): Promise<ImportRelatorio> => {
    const form = new FormData();
    form.append('tipo', tipo);
    form.append('arquivo', arquivo);
    const res = await api.post('/import/preview', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  apply: async (tipo: string, arquivo: File): Promise<ImportRelatorio> => {
    const form = new FormData();
    form.append('tipo', tipo);
    form.append('arquivo', arquivo);
    const res = await api.post('/import/apply', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
};

export default api;
