export default function PublicPage() {
  return (
    <div className="app-shell">
      <div className="container">
        <nav className="navbar card">
          <div className="brand">Bingo <span>Fácil</span></div>
          <a href="/login" className="btn btn-primary">Painel</a>
        </nav>

        <div className="public-layout">
          <div className="card hero-copy">
            <div className="badge success" style={{ marginBottom: 16 }}>Evento ao vivo</div>
            <h1 style={{ marginBottom: 12 }}>Bingo Beneficente</h1>
            <p>12 de outubro de 2026 • 20:00 • Rua da Esperança, 100</p>
            <ul className="pitch-list">
              <li>Prêmios em dinheiro e brindes para os vencedores</li>
              <li>Cartelas disponíveis com pagamento por Pix ou dinheiro</li>
              <li>Confira os números sorteados em tempo real</li>
            </ul>
          </div>

          <div className="card hero-panel">
            <div className="section-header"><h2>Resultados ao vivo</h2></div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[12, 24, 42, 55, 68].map((n) => (
                <div key={n} className="badge warning" style={{ minWidth: 42 }}>{n}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
