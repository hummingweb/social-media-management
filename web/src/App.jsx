import { Routes, Route, Navigate, NavLink, Link } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import Login from './pages/Login.jsx';
import Bootstrap from './pages/Bootstrap.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Designs from './pages/Designs.jsx';
import DesignDetail from './pages/DesignDetail.jsx';
import NewDesign from './pages/NewDesign.jsx';
import Calendar from './pages/Calendar.jsx';
import Clients from './pages/Clients.jsx';
import Settings from './pages/Settings.jsx';
import Billing from './pages/Billing.jsx';
import Analytics from './pages/Analytics.jsx';

export default function App() {
  const { session, profile, loading, signOut } = useAuth();

  if (loading) return <div className="center">Loading…</div>;
  if (!session) return <AuthRoutes />;
  if (!profile) return <Bootstrap />;

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>SMM</h1>
        <NavLink to="/" end>Dashboard</NavLink>
        <NavLink to="/designs">Designs</NavLink>
        <NavLink to="/calendar">Calendar</NavLink>
        <NavLink to="/analytics">Analytics</NavLink>
        <NavLink to="/billing">Billing</NavLink>
        {(profile.role === 'admin' || profile.role === 'account_manager') && (
          <NavLink to="/clients">Clients</NavLink>
        )}
        <NavLink to="/settings">Settings</NavLink>
        <div className="spacer" />
        <div className="me">
          <div>{profile.full_name}</div>
          <div style={{ textTransform: 'capitalize' }}>{profile.role.replace('_', ' ')}</div>
          <button className="secondary" style={{ marginTop: 8, width: '100%' }} onClick={signOut}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/designs" element={<Designs />} />
          <Route path="/designs/new" element={<NewDesign />} />
          <Route path="/designs/:id" element={<DesignDetail />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

function AuthRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}
