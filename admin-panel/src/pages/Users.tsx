import { useState, useEffect } from 'react';
import { UserPlus, UserMinus, ShieldAlert, Trash2, Edit2, Search, Users as UsersIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  fullName: string;
  username: string;
  email: string;
  role: string;
  zone: string;
  isEnabled: boolean;
}

const MOCK_USERS: User[] = [
  { id: '1', fullName: 'Admin User', username: 'admin', email: 'admin@firesafetypro.local', role: 'ADMIN', isEnabled: true },
  { id: '2', fullName: 'John Inspector', username: 'jinspector', email: 'john@firesafetypro.local', role: 'USER', isEnabled: true },
  { id: '3', fullName: 'Sarah Field', username: 'sfield', email: 'sarah@firesafetypro.local', role: 'USER', isEnabled: true },
  { id: '4', fullName: 'Mike Temp', username: 'mtemp', email: 'mike@firesafetypro.local', role: 'USER', isEnabled: false },
];

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [userRole, setUserRole] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ fullName: '', username: '', email: '', password: '', role: 'ROLE_USER', zoneId: '' });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterZone, setFilterZone] = useState('all');

  const filteredUsers = users.filter(u => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = (u.fullName || '').toLowerCase().includes(searchLower) || 
                          (u.username || '').toLowerCase().includes(searchLower) ||
                          (u.email || '').toLowerCase().includes(searchLower);
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    const matchesZone = filterZone === 'all' || u.zone === filterZone;
    return matchesSearch && matchesRole && matchesZone;
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      setCurrentUserId(session.user.id);
      
      const { data: userData } = await supabase.from('users').select('role, zone_id').eq('id', session.user.id).single();
      if (userData) setUserRole(userData.role);

      const { data: zonesData } = await supabase.from('zones').select('*').order('name');
      if (zonesData) setZones(zonesData);

      let query = supabase
        .from('users')
        .select('*, zones!users_zone_id_fkey(name)')
        .order('created_at', { ascending: false });

      if (userData?.role === 'ROLE_ADMIN' && userData.zone_id) {
        query = query.eq('zone_id', userData.zone_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      if (data) {
        const mappedUsers = data.map(u => ({
          id: u.id,
          fullName: u.full_name,
          username: u.username,
          email: u.email,
          role: u.role,
          zone: u.zones?.name || 'Global',
          isEnabled: u.is_enabled
        }));
        setUsers(mappedUsers);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      alert('Error fetching users: ' + (error.message || JSON.stringify(error)));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session found.");

      const response = await fetch('http://localhost:8080/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          fullName: newUser.fullName,
          username: newUser.username,
          email: newUser.email,
          password: newUser.password,
          role: newUser.role,
          zoneId: newUser.zoneId
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Backend returned status ${response.status}`);
      }

      setIsModalOpen(false);
      setNewUser({ fullName: '', username: '', email: '', password: '', role: 'ROLE_USER', zoneId: '' });
      fetchUsers();
    } catch (error: any) {
      alert(error.message || 'Error registering user');
    }
  };

  const handleDisable = async (id: string) => {
    if (confirm('Are you sure you want to permanently delete this user?')) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("No active session found.");
        
        const response = await fetch(`http://localhost:8080/api/admin/users/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Backend returned status ${response.status}`);
        }
          
        fetchUsers();
      } catch (error: any) {
        alert('Error deleting user: ' + error.message);
      }
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Users Management</h1>
          <p className="page-description">Manage administrators and field inspectors</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <UserPlus size={20} />
          Register New User
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              className="form-control" 
              placeholder="Search by name, username, or email..." 
              style={{ paddingLeft: '3rem' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select 
            className="form-control" 
            style={{ width: '180px' }}
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="ROLE_SUPERADMIN">Super Admin</option>
            <option value="ROLE_ADMIN">Zonal Admin</option>
            <option value="ROLE_USER">Inspector</option>
          </select>
          {userRole === 'ROLE_SUPERADMIN' && (
            <select 
              className="form-control" 
              style={{ width: '180px' }}
              value={filterZone}
              onChange={(e) => setFilterZone(e.target.value)}
            >
              <option value="all">All Zones</option>
              {zones.map(z => (
                <option key={z.id} value={z.name}>{z.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Zone</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} style={{ opacity: user.isEnabled ? 1 : 0.6 }}>
                  <td style={{ fontWeight: 500 }}>{user.fullName}</td>
                  <td>@{user.username}</td>
                  <td>{user.email}</td>
                  <td>
                    {user.role === 'ROLE_SUPERADMIN' ? (
                      <span className="badge badge-danger" style={{ display: 'inline-flex', gap: '4px', whiteSpace: 'nowrap' }}>
                        <ShieldAlert size={12} /> SUPER ADMIN
                      </span>
                    ) : user.role === 'ROLE_ADMIN' ? (
                      <span className="badge badge-warning" style={{ display: 'inline-flex', gap: '4px', whiteSpace: 'nowrap' }}>
                        ADMIN
                      </span>
                    ) : (
                      <span className="badge" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                        INSPECTOR
                      </span>
                    )}
                  </td>
                  <td>{user.zone}</td>
                  <td>
                    {user.isEnabled ? (
                      <span className="badge badge-success">Active</span>
                    ) : (
                      <span className="badge badge-danger">Disabled</span>
                    )}
                  </td>
                  <td>
                    {user.isEnabled && user.role !== 'ROLE_SUPERADMIN' && user.id !== currentUserId && (
                      <button className="btn btn-ghost" title="Disable User" onClick={() => handleDisable(user.id)} style={{ color: 'var(--danger)' }}>
                        <UserMinus size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                    <UsersIcon size={32} style={{ margin: '0 auto 1rem', opacity: 0.5, display: 'block' }} />
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Register New User</h2>
              <button className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  required 
                  value={newUser.fullName}
                  onChange={(e) => setNewUser({...newUser, fullName: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input 
                  type="text" 
                  className="form-control" 
                  required 
                  value={newUser.username}
                  onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input 
                  type="email" 
                  className="form-control" 
                  required 
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Temporary Password</label>
                <input 
                  type="password" 
                  className="form-control" 
                  required 
                  value={newUser.password}
                  onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  placeholder="Min. 8 chars, 1 uppercase, 1 special"
                />
              </div>
              
              {userRole === 'ROLE_SUPERADMIN' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Role</label>
                    <select 
                      className="form-control" 
                      required
                      value={newUser.role}
                      onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                    >
                      <option value="ROLE_USER">Inspector (User)</option>
                      <option value="ROLE_ADMIN">Zonal Admin</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Assign Zone</label>
                    <select 
                      className="form-control" 
                      required
                      value={newUser.zoneId}
                      onChange={(e) => setNewUser({...newUser, zoneId: e.target.value})}
                    >
                      <option value="">Select a zone...</option>
                      {zones.map(z => (
                        <option key={z.id} value={z.id}>{z.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
