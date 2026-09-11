import { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function DashboardPage({ onLogout }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('bingo_token');
    axios.get(`${API_URL}/bingos/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setStats(res.data.stats))
      .catch(() => setStats({ totalBingos: 0, activeBingos: 0, closedBingos: 0, totalCards: 0, soldCards: 0, availableCards: 0, estimatedRevenue: 0, participants: 0 }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="app-shell">
      <div className="container">
        <nav className="navbar card">
          <div className="brand">Bingo <span>Fácil</span></div>
          <div className="topbar-actions">
            <button className="btn btn-secondary">Criar bingo</button>
            <button className="btn btn-primary" onClick={onLogout}>Sair</button>
          </div>
        </nav>

        <section className="hero">
          <div className="hero-copy card">
            <h1>Seu bingo em um painel profissional.</h1>
            <p>Gerencie eventos, cartelas, vendas, prêmios, sorteios e relatórios em uma plataforma organizada e fácil de operar.</p>
            <div className="hero-actions">
              <button className="btn btn-primary">Criar bingo</button>
              <button className="btn btn-secondary">Gerar cartelas</button>
            </div>
          </div>
          <div className="hero-panel card">
            <div className="section-header">
              <h2>Próximos eventos</h2>
            </div>
            <ul className="pitch-list">
              <li>Bingo Beneficente — 12/10 às 20:00</li>
              <li>Feira da Comunidade — 18/10 às 19:30</li>
              <li>Evento Solidário — 25/10 às 18:00</li>
            </ul>
          </div>
        </section>

        <section className="dashboard-grid">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card metric-card"><div style={{ height: 18, background: '#eef3ff', borderRadius: 8, marginBottom: 10 }} />
                <div style={{ height: 28, background: '#eef3ff', borderRadius: 8, width: '60%' }} /></div>
            ))
          ) : (
            <>
              <div className="card metric-card"><div className="metric-label">Bingos criados</div><div className="metric-value">{stats?.totalBingos ?? 0}</div></div>
              <div className="card metric-card"><div className="metric-label">Bingos ativos</div><div className="metric-value">{stats?.activeBingos ?? 0}</div></div>
              <div className="card metric-card"><div className="metric-label">Cartelas vendidas</div><div className="metric-value">{stats?.soldCards ?? 0}</div></div>
              <div className="card metric-card"><div className="metric-label">Receita estimada</div><div className="metric-value">R$ {Number(stats?.estimatedRevenue ?? 0).toFixed(2)}</div></div>
            </>
          )}
        </section>

        <section className="card section" style={{ padding: 24 }}>
          <div className="section-header">
            <h2>Resumo rápido</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Indicador</th>
                  <th>Atual</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Cartelas disponíveis</td><td>{stats?.availableCards ?? 0}</td><td><span className="badge success">Disponível</span></td></tr>
                <tr><td>Participantes</td><td>{stats?.participants ?? 0}</td><td><span className="badge warning">Ativo</span></td></tr>
                <tr><td>Bingos encerrados</td><td>{stats?.closedBingos ?? 0}</td><td><span className="badge danger">Finalizados</span></td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
