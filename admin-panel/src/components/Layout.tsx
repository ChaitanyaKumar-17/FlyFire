import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { ShieldAlert, LayoutDashboard, QrCode, Users as UsersIcon, LogOut } from 'lucide-react';

export default function Layout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate('/login');
  };

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
