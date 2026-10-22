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
  localizacao: string;
  estoque_caixas: number;
  codigo_barras_master: string;
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
  numero: string;
  fornecedor: string;
  destinatario?: string;
  endereco?: string;
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

export default api;
