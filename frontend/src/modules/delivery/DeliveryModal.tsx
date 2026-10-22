import React, { useState, useRef } from 'react';
import { NotaFiscal, deliveryApi } from '../../api/client';

interface DeliveryModalProps {
  nf: NotaFiscal;
  onClose: () => void;
  onSuccess: () => void;
}

export const DeliveryModal: React.FC<DeliveryModalProps> = ({ nf, onClose, onSuccess }) => {
  const [actionType, setActionType] = useState<'deliver' | 'reschedule'>('deliver');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [motivoFalha, setMotivoFalha] = useState('Cliente Ausente');
  const [dataReagendamento, setDataReagendamento] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeliverSubmit = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      await deliveryApi.deliver(nf.id, photoFile || undefined);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao registrar entrega');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRescheduleSubmit = async () => {
    if (!dataReagendamento) {
      setError('Selecione uma data para o reagendamento');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      await deliveryApi.reschedule(nf.id, motivoFalha, dataReagendamento);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao reagendar entrega');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', color: '#fff' }}>Baixa de Entrega</h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>NF {nf.numero}</span>
          </div>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '4px 10px' }}>✕</button>
        </div>

        {/* Client & Address Info */}
        <div style={{ background: '#1e293b', padding: '14px', borderRadius: 'var(--radius-md)', marginBottom: '18px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
            Cliente
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', marginTop: '2px' }}>
            {nf.cliente || 'Cliente'}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            📍 {nf.endereco || 'Endereço não informado'}
          </div>
        </div>

        {error && (
          <div style={{ background: 'var(--danger-bg)', color: '#fca5a5', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {/* Action Toggle */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
          <button
            type="button"
            className={`btn ${actionType === 'deliver' ? 'btn-success' : 'btn-secondary'}`}
            onClick={() => setActionType('deliver')}
            style={{ padding: '12px', fontSize: '0.9rem' }}
          >
            ✅ Entrega Concluída
          </button>
          <button
            type="button"
            className={`btn ${actionType === 'reschedule' ? 'btn-danger' : 'btn-secondary'}`}
            onClick={() => setActionType('reschedule')}
            style={{ padding: '12px', fontSize: '0.9rem' }}
          >
            ⚠️ Não Entregue (Reagendar)
          </button>
        </div>

        {/* OPTION A: Deliver with optional photo */}
        {actionType === 'deliver' && (
          <div>
            <div style={{ marginBottom: '18px' }}>
              <label className="form-label">Foto do Canhoto Assinado (Opcional)</label>
              
              {/* Hidden file input with native camera capture */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoCapture}
                style={{ display: 'none' }}
              />

              {photoPreview ? (
                <div style={{ position: 'relative', marginTop: '8px' }}>
                  <img
                    src={photoPreview}
                    alt="Canhoto"
                    style={{
                      width: '100%',
                      maxHeight: '220px',
                      objectFit: 'cover',
                      borderRadius: 'var(--radius-md)',
                      border: '2px solid var(--success)'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoFile(null);
                      setPhotoPreview(null);
                    }}
                    className="btn btn-danger"
                    style={{ position: 'absolute', top: '8px', right: '8px', padding: '4px 8px', fontSize: '0.75rem' }}
                  >
                    Remover Foto
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-secondary"
                  style={{
                    width: '100%',
                    padding: '24px 16px',
                    border: '2px dashed var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <span style={{ fontSize: '1.8rem' }}>📷</span>
                  <strong style={{ fontSize: '0.95rem', color: '#fff' }}>Tirar Foto com a Câmera</strong>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Toque para acionar a câmera do celular</span>
                </button>
              )}
            </div>

            <button
              onClick={handleDeliverSubmit}
              disabled={isSubmitting}
              className="btn btn-success"
              style={{ width: '100%', padding: '14px', fontSize: '1rem', fontWeight: 700 }}
            >
              {isSubmitting ? 'Registrando...' : '✓ Confirmar Entrega'}
            </button>
          </div>
        )}

        {/* OPTION B: Reschedule */}
        {actionType === 'reschedule' && (
          <div>
            <div className="form-group">
              <label className="form-label">Motivo da Falha na Entrega</label>
              <select
                className="select"
                value={motivoFalha}
                onChange={(e) => setMotivoFalha(e.target.value)}
              >
                <option value="Cliente Ausente">Cliente Ausente</option>
                <option value="Endereço Não Localizado">Endereço Não Localizado</option>
                <option value="Cliente Recusou Receber">Cliente Recusou Receber</option>
                <option value="Estabelecimento Fechado">Estabelecimento Fechado</option>
                <option value="Avaria na Mercadoria">Avaria na Mercadoria</option>
                <option value="Outro Motivo">Outro Motivo</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Nova Data Prevista para Entrega</label>
              <input
                type="date"
                className="input"
                required
                value={dataReagendamento}
                onChange={(e) => setDataReagendamento(e.target.value)}
              />
            </div>

            <button
              onClick={handleRescheduleSubmit}
              disabled={isSubmitting}
              className="btn btn-danger"
              style={{ width: '100%', padding: '14px', fontSize: '1rem', fontWeight: 700 }}
            >
              {isSubmitting ? 'Salvando...' : '⚠️ Reagendar Entrega'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
