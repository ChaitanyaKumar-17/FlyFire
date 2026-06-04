import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import Users from './pages/Users';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Inspections from './pages/Inspections';

function App() {
  return (
    <>
      <div className="mobile-warning">
        <div>
          <h2>Desktop Required</h2>
          <p>The FireSafetyPro Admin Portal is designed for laptop and PC displays.</p>
          <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>Please switch to a larger device to continue.</p>
        </div>
      </div>
      <div className="desktop-app">
        <BrowserRouter>
          <Toaster position="top-right" />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="equipment" element={<Devices />} />
              <Route path="users" element={<Users />} />
              <Route path="inspections" element={<Inspections />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </div>
    </>
  );
}

export default App;
