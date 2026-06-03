import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { ShieldAlert, LayoutDashboard, QrCode, Users as UsersIcon, LogOut, Settings as SettingsIcon, History } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useEffect, useState } from 'react';

export default function Layout() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        navigate('/login');
      } else {
        const { data } = await supabase.from('users').select('role').eq('id', session.user.id).single();
        if (data) setRole(data.role);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) return null;

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <ShieldAlert className="icon" size={28} />
          <span>FireSafetyPro</span>
        </div>
        
        <nav className="nav-menu">
          <NavLink 
            to="/dashboard" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </NavLink>
          
          <NavLink 
            to="/devices" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <QrCode size={20} />
            <span>Devices</span>
          </NavLink>
          
          <NavLink 
            to="/users" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <UsersIcon size={20} />
            <span>Users</span>
          </NavLink>

          <NavLink 
            to="/inspections" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <History size={20} />
            <span>Inspections</span>
          </NavLink>

          {role === 'ROLE_SUPERADMIN' && (
            <NavLink 
              to="/settings" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <SettingsIcon size={20} />
              <span>Settings</span>
            </NavLink>
          )}
        </nav>

        <div className="sidebar-footer" style={{ marginTop: 'auto' }}>
          <div style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
            <p style={{ marginBottom: '0.25rem' }}>For any query or support,</p>
            <p style={{ marginBottom: '0.25rem' }}>kindly contact:</p>
            <a href="mailto:firesafetypro01@gmail.com" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>firesafetypro01@gmail.com</a>
          </div>
          <button className="nav-item" onClick={handleLogout} style={{ width: '100%', textAlign: 'left' }}>
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
      
      <main className="main-content">
        <Outlet />
      </main>

      {showLogoutConfirm && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Confirm Log Out</h2>
              <button className="close-button" onClick={() => setShowLogoutConfirm(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to log out? You will need to enter your credentials to access the portal again.</p>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button className="btn btn-secondary" onClick={() => setShowLogoutConfirm(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={confirmLogout} style={{ backgroundColor: 'var(--danger)', color: 'white', border: 'none' }}>
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
