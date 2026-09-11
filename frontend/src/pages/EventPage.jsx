import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

function formatDate(value) {
  if (!value) return 'Data a confirmar';
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR');
}

export default function EventPage() {
  const { slug } = useParams();
  const [bingo, setBingo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = () => {
      axios.get(`${API_URL}/public/bingo/${encodeURIComponent(slug)}`)
        .then((response) => {
          if (active) {
            setBingo(response.data.bingo);
            setError('');
          }
        })
        .catch((err) => {
          if (active) setError(err.response?.data?.message || 'Não foi possível carregar este evento.');
        })
        .finally(() => active && setLoading(false));
    };
    load();
    const timer = window.setInterval(load, 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [slug]);

  if (loading) {
    return <div className="public-status"><div className="card status-card">Carregando evento...</div></div>;
  }

  if (error || !bingo) {
    return <div className="public-status"><div className="card status-card"><h2>Evento não encontrado</h2><p>{error}</p><a className="btn btn-primary" href="/">Voltar</a></div></div>;
  }

  const drawn = bingo.drawnNumbers || [];
  const latest = drawn.length ? drawn[drawn.length - 1].value : null;

  return (
    <div className="app-shell">
      <div className="container">
        <nav className="navbar card">
          <div className="brand">Bingo <span>Fácil</span></div>
          <a href="/" className="btn btn-secondary">Início</a>
        </nav>

        <div className="public-layout">
          <div className="card hero-copy">
            <div className={`badge ${bingo.status === 'active' ? 'success' : bingo.status === 'closed' ? 'danger' : 'warning'}`} style={{ marginBottom: 16 }}>
              {bingo.status === 'active' ? 'Evento ativo' : bingo.status === 'closed' ? 'Evento encerrado' : 'Evento em preparação'}
            </div>
            <h1 style={{ marginBottom: 12 }}>{bingo.name}</h1>
            <p>{formatDate(bingo.event_date)} {bingo.start_time ? `• ${bingo.start_time}` : ''} {bingo.location ? `• ${bingo.location}` : ''}</p>
            {bingo.description && <p>{bingo.description}</p>}
            <ul className="pitch-list">
              <li>Cartela: R$ {Number(bingo.card_price || 0).toFixed(2)}</li>
              <li>Formato: {bingo.type} bolas</li>
              {bingo.contact_info && <li>Contato: {bingo.contact_info}</li>}
            </ul>
          </div>

          <div className="card hero-panel live-panel">
            <div className="section-header"><h2>Sorteio ao vivo</h2></div>
            <div className="public-current-number">{latest ?? '—'}</div>
            <p className="muted">A página atualiza automaticamente.</p>
          </div>
        </div>

        <section className="card section form-card">
          <div className="section-header"><h2>Números sorteados</h2><span className="badge warning">{drawn.length} sorteado(s)</span></div>
          <div className="draw-history public-draw-history">
            {drawn.map((item) => <span key={`${item.position}-${item.value}`}>{item.value}</span>)}
            {!drawn.length && <p className="muted">O sorteio ainda não começou.</p>}
          </div>
        </section>

        <section className="card section form-card">
          <div className="section-header"><h2>Prêmios</h2></div>
          <div className="prize-grid">
            {(bingo.prizes || []).map((prize) => (
              <div className="prize-card" key={prize.id}>
                <span className="badge success">{prize.position}º</span>
                <h3>{prize.name}</h3>
                {prize.description && <p>{prize.description}</p>}
                {prize.value != null && <strong>R$ {Number(prize.value).toFixed(2)}</strong>}
              </div>
            ))}
            {!bingo.prizes?.length && <p className="muted">Os prêmios ainda não foram publicados.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
