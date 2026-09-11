import { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function LoginPage({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [message, setMessage] = useState('');
  const [setupPending, setSetupPending] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get(`${API_URL}/setup/status`)
      .then((response) => setSetupPending(!response.data?.initialized))
      .catch(() => setSetupPending(false));
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await axios.post(`${API_URL}/auth/login`, form);
      onLogin(response.data.token);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-box card">
        <div style={{ marginBottom: 20 }}>
          <div className="brand" style={{ fontSize: '2rem', marginBottom: 8 }}>Bingo <span>Fácil</span></div>
          <p style={{ margin: 0, color: '#5f6b7a' }}>Acesso ao painel administrativo</p>
        </div>

        {setupPending && (
          <div className="badge warning" style={{ display: 'block', borderRadius: 12, marginBottom: 14, lineHeight: 1.5 }}>
            Configuração inicial pendente. No Cloudflare, configure ADMIN_EMAIL, ADMIN_PASSWORD e JWT_SECRET e faça um novo deploy.
          </div>
        )}

        <form className="form-grid" onSubmit={handleSubmit}>
          <div>
            <label className="label">E-mail</label>
            <input className="input" type="email" autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <label className="label">Senha</label>
            <input className="input" type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </div>
          {message && <div className="badge danger" style={{ justifyContent: 'flex-start', padding: '10px 12px' }}>{message}</div>}
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
