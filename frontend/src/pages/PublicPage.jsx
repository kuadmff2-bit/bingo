export default function PublicPage() {
  return (
    <div className="app-shell">
      <div className="container">
        <nav className="navbar card">
          <div className="brand">Bingo <span>Fácil</span></div>
          <a href="/login" className="btn btn-primary">Painel</a>
        </nav>

        <section className="hero landing-hero">
          <div className="card hero-copy">
            <div className="badge success" style={{ marginBottom: 16 }}>Gestão de bingo online</div>
            <h1>Organize seu bingo sem planilhas improvisadas.</h1>
            <p>Crie eventos, gere cartelas numeradas, registre vendas, cadastre prêmios e acompanhe o sorteio em uma página pública.</p>
            <div className="hero-actions">
              <a className="btn btn-primary" href="/login">Entrar no painel</a>
            </div>
          </div>
          <div className="card hero-panel">
            <div className="section-header"><h2>O que já funciona</h2></div>
            <ul className="pitch-list">
              <li>Cartelas de 75 e 90 bolas com código de validação</li>
              <li>Registro de vendas e cálculo de receita</li>
              <li>Cadastro de prêmios e página pública do evento</li>
              <li>Sorteio sem repetição com histórico em tempo real</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
