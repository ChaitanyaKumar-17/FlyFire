import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, LogIn } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isFirstLoginPrompt, setIsFirstLoginPrompt] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: username,
        password: password,
      });

      if (signInError) throw signInError;

      // Check if user is admin
      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('role, is_first_login')
          .eq('id', data.user.id)
          .single();

        if (profileError) throw profileError;

        if (profile?.role !== 'ROLE_ADMIN' && profile?.role !== 'ROLE_SUPERADMIN') {
          await supabase.auth.signOut();
          throw new Error('Access denied. Admin privileges required.');
        }

        if (profile?.is_first_login && profile?.role !== 'ROLE_SUPERADMIN') {
          setIsFirstLoginPrompt(true);
          setUserId(data.user.id);
          setLoading(false);
          return;
        }

        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      
      const { error: dbError } = await supabase.from('users').update({ is_first_login: false }).eq('id', userId);
      if (dbError) throw dbError;
      
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <ShieldAlert size={32} />
          </div>
          <h1 className="page-title" style={{ fontSize: '1.5rem' }}>FireSafetyPro Admin</h1>
          <p className="page-description">Sign in to manage devices and inspections</p>
        </div>

        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}
        
        {!isFirstLoginPrompt ? (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label" htmlFor="username">Username</label>
              <input 
                id="username"
                type="text" 
                className="form-control" 
                placeholder="admin@firesafetypro.local"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input 
                id="password"
                type="password" 
                className="form-control" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: '1rem' }}
              disabled={loading}
            >
              <LogIn size={20} />
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleUpdatePassword}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9em' }}>
              You are using a temporary password. Please update your password to continue.
            </p>
            <div className="form-group">
              <label className="form-label" htmlFor="newPassword">New Password</label>
              <input 
                id="newPassword"
                type="password" 
                className="form-control" 
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: '1rem' }}
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
