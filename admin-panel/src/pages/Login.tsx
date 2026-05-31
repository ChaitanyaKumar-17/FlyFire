import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, LogIn } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Mock authentication
    setTimeout(() => {
      setLoading(false);
      navigate('/dashboard');
    }, 800);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <ShieldAlert size={32} />
          </div>
          <h1 className="page-title" style={{ fontSize: '1.5rem' }}>DSVS Admin Portal</h1>
          <p className="page-description">Sign in to manage devices and inspections</p>
        </div>
        
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">Username</label>
            <input 
              id="username"
              type="text" 
              className="form-control" 
              placeholder="admin@dsvs.local"
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
      </div>
    </div>
  );
}
