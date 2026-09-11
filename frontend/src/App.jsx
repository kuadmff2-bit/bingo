import { Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import PublicPage from './pages/PublicPage.jsx';
import EventPage from './pages/EventPage.jsx';

const TOKEN_KEY = 'bingo_token';

function App() {
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || '');

  const handleLogin = (nextToken) => {
    localStorage.setItem(TOKEN_KEY, nextToken);
    setToken(nextToken);
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken('');
  };

  return (
    <Routes>
      <Route path="/" element={<PublicPage />} />
      <Route path="/evento/:slug" element={<EventPage />} />
      <Route path="/login" element={token ? <Navigate to="/dashboard" replace /> : <LoginPage onLogin={handleLogin} />} />
      <Route path="/dashboard" element={token ? <DashboardPage onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
