import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { ShieldAlert, LayoutDashboard, QrCode, Users as UsersIcon, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useEffect, useState } from 'react';

export default function Layout() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>('');

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
          <button className="nav-item" onClick={handleLogout} style={{ width: '100%', textAlign: 'left' }}>
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
      
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
