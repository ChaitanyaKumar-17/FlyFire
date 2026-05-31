import { useState, useEffect } from 'react';
import { UserPlus, UserMinus, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  fullName: string;
  username: string;
  email: string;
  role: string;
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ fullName: '', username: '', email: '', password: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      if (data) {
        const mappedUsers = data.map(u => ({
          id: u.id,
          fullName: u.full_name,
          username: u.username,
          email: u.email,
          role: u.role,
          isEnabled: u.is_enabled
        }));
        setUsers(mappedUsers);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
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
          password: newUser.password
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Backend returned status ${response.status}`);
      }

      setIsModalOpen(false);
      setNewUser({ fullName: '', username: '', email: '', password: '' });
      fetchUsers();
    } catch (error: any) {
      alert(error.message || 'Error registering user');
    }
  };

  const handleDisable = async (id: string) => {
    if (confirm('Are you sure you want to disable this user?')) {
      try {
        const { error } = await supabase
          .from('users')
          .update({ is_enabled: false })
          .eq('id', id);
          
        if (error) throw error;
        fetchUsers();
      } catch (error: any) {
        alert('Error disabling user');
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
          Register Inspector
        </button>
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
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} style={{ opacity: user.isEnabled ? 1 : 0.6 }}>
                  <td style={{ fontWeight: 500 }}>{user.fullName}</td>
                  <td>@{user.username}</td>
                  <td>{user.email}</td>
                  <td>
                    {user.role === 'ADMIN' ? (
                      <span className="badge badge-danger" style={{ display: 'inline-flex', gap: '4px' }}>
                        <ShieldAlert size={12} /> {user.role}
                      </span>
                    ) : (
                      <span className="badge" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)' }}>
                        {user.role}
                      </span>
                    )}
                  </td>
                  <td>
                    {user.isEnabled ? (
                      <span className="badge badge-success">Active</span>
                    ) : (
                      <span className="badge badge-danger">Disabled</span>
                    )}
                  </td>
                  <td>
                    {user.isEnabled && user.role !== 'ADMIN' && (
                      <button className="btn btn-ghost" title="Disable User" onClick={() => handleDisable(user.id)} style={{ color: 'var(--danger)' }}>
                        <UserMinus size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Register New Inspector</h2>
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
