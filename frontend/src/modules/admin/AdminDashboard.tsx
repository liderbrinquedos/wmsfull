import React, { useState, useEffect } from 'react';
import { adminApi, User, DeliveryReportItem, AdminOverview } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { SyncPanel } from './SyncPanel';

export const AdminDashboard: React.FC = () => {
  const [tab, setTab] = useState<'overview' | 'users' | 'reports' | 'sync'>('overview');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [motoristas, setMotoristas] = useState<User[]>([]);
  const [selectedMotorista, setSelectedMotorista] = useState<string>('');
  const [reports, setReports] = useState<DeliveryReportItem[]>([]);
  const [loading, setLoading] = useState(true);

  // New user form state
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({
    nome: '',
    email: '',
    senha: '',
    perfil: 'operador',
  });
  const [userError, setUserError] = useState('');

  const { user } = useAuthStore();
  const isAdmin = user?.perfil === 'admin';

  const loadData = async () => {
    try {
      setLoading(true);
      const [ov, mot] = await Promise.all([
        adminApi.getOverview(),
        adminApi.getMotoristas(),
      ]);
      setOverview(ov);
      setMotoristas(mot);

      if (isAdmin) {
        const u = await adminApi.getUsers();
        setUsers(u);
      }
    } catch (err) {
      console.error('Erro ao carregar dados admin:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadReports = async () => {
    try {
      const rep = await adminApi.getReports(selectedMotorista || undefined);
      setReports(rep);
    } catch (err) {
      console.error('Erro ao carregar relatórios:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (tab === 'reports') {
      loadReports();
    }
  }, [tab, selectedMotorista]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');
    try {
      await adminApi.createUser(newUser);
      setShowAddUser(false);
      setNewUser({ nome: '', email: '', senha: '', perfil: 'operador' });
      const u = await adminApi.getUsers();
      setUsers(u);
    } catch (err: any) {
      setUserError(err.response?.data?.detail || 'Erro ao criar usuário');
    }
  };

  const handleToggleUser = async (u: User) => {
    try {
      await adminApi.updateUser(u.id, { ativo: !u.ativo });
      setUsers((prev) => prev.map((item) => (item.id === u.id ? { ...item, ativo: !item.ativo } : item)));
    } catch (err) {
      console.error('Erro ao atualizar usuário:', err);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2>⚙️ Painel de Gestão & Supervisão</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Métricas gerais do armazém, relatórios de expedição e controle de acessos
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button
          onClick={() => setTab('overview')}
          className={`btn ${tab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
        >
          📊 Visão Geral
        </button>

        {isAdmin && (
          <button
            onClick={() => setTab('users')}
            className={`btn ${tab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
          >
            👥 Usuários do Sistema
          </button>
        )}

        <button
          onClick={() => setTab('reports')}
          className={`btn ${tab === 'reports' ? 'btn-primary' : 'btn-secondary'}`}
        >
          📋 Histórico de Entregas
        </button>

        <button
          onClick={() => setTab('sync')}
          className={`btn ${tab === 'sync' ? 'btn-primary' : 'btn-secondary'}`}
        >
          🔄 Sincronização
        </button>
      </div>

      {/* TAB: SYNC */}
      {tab === 'sync' && <SyncPanel />}

      {/* TAB 1: OVERVIEW */}
      {tab === 'overview' && overview && (
        <div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <div className="card">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                Total de Notas Fiscais
              </span>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
                {overview.total_nfs}
              </div>
            </div>

            <div className="card">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                Motoristas Ativos
              </span>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
                {overview.motoristas_ativos}
              </div>
            </div>

            <div className="card">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                Usuários Cadastrados
              </span>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#a78bfa', marginTop: '4px' }}>
                {overview.total_usuarios}
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '16px' }}>Status Operacional das NFs</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
              {Object.entries(overview.by_status).map(([st, qtd]) => (
                <div key={st} style={{
                  background: '#090d16',
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)'
                }}>
                  <span className={`badge badge-${st}`}>{st.replace('_', ' ')}</span>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginTop: '8px' }}>
                    {qtd}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USERS */}
      {tab === 'users' && isAdmin && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3>Usuários Cadastrados</h3>
            <button
              onClick={() => setShowAddUser(true)}
              className="btn btn-primary"
              style={{ fontSize: '0.85rem' }}
            >
              + Novo Usuário
            </button>
          </div>

          {showAddUser && (
            <div className="card" style={{ marginBottom: '20px', border: '1px solid var(--primary)' }}>
              <h4 style={{ marginBottom: '14px' }}>Cadastrar Novo Usuário</h4>
              {userError && (
                <div style={{ background: 'var(--danger-bg)', color: '#fca5a5', padding: '10px', borderRadius: 'var(--radius-md)', marginBottom: '12px', fontSize: '0.85rem' }}>
                  {userError}
                </div>
              )}
              <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Nome Completo</label>
                  <input
                    type="text"
                    required
                    className="input"
                    value={newUser.nome}
                    onChange={(e) => setNewUser({ ...newUser, nome: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">E-mail</label>
                  <input
                    type="email"
                    required
                    className="input"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Senha</label>
                  <input
                    type="password"
                    required
                    className="input"
                    value={newUser.senha}
                    onChange={(e) => setNewUser({ ...newUser, senha: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Perfil de Acesso</label>
                  <select
                    className="select"
                    value={newUser.perfil}
                    onChange={(e) => setNewUser({ ...newUser, perfil: e.target.value })}
                  >
                    <option value="operador">Operador / Conferente</option>
                    <option value="motorista">Motorista</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowAddUser(false)} className="btn btn-secondary">
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Salvar Usuário
                  </button>
                </div>
              </form>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {users.map((u) => (
              <div key={u.id} className="card" style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <strong style={{ color: '#fff', fontSize: '1rem' }}>{u.nome}</strong>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: '#1e293b',
                      color: 'var(--primary)'
                    }}>
                      {u.perfil}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {u.email}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '0.8rem', color: u.ativo ? 'var(--success)' : 'var(--danger)' }}>
                    {u.ativo ? '● Ativo' : '○ Inativo'}
                  </span>
                  <button
                    onClick={() => handleToggleUser(u)}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                  >
                    {u.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: REPORTS */}
      {tab === 'reports' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <h3>Histórico e Canhotos de Entrega</h3>
            <select
              className="select"
              value={selectedMotorista}
              onChange={(e) => setSelectedMotorista(e.target.value)}
              style={{ maxWidth: '260px' }}
            >
              <option value="">Todos os Motoristas</option>
              {motoristas.map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>

          {reports.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Nenhum registro de baixa de entrega encontrado.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {reports.map((r) => (
                <div key={r.id} className="card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '1.05rem', color: '#fff' }}>NF: {r.nf_numero || '—'}</strong>
                        <span className={`badge badge-${r.status}`}>{r.status}</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Motorista: <strong style={{ color: '#fff' }}>{r.motorista}</strong> · Data: {new Date(r.created_at).toLocaleString('pt-BR')}
                      </div>

                      {r.status === 'reagendado' && (
                        <div style={{ marginTop: '8px', padding: '8px 12px', background: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: '#fca5a5' }}>
                          ⚠️ Motivo: <strong>{r.motivo_falha}</strong> · Reagendado para: <strong>{r.data_reagendamento}</strong>
                        </div>
                      )}
                    </div>

                    {r.foto_canhoto_url && (
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>
                          Canhoto Assinado
                        </span>
                        <a
                          href={r.foto_canhoto_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ display: 'inline-block' }}
                        >
                          <img
                            src={r.foto_canhoto_url}
                            alt="Canhoto"
                            style={{
                              width: '80px',
                              height: '60px',
                              objectFit: 'cover',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-color)'
                            }}
                          />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
