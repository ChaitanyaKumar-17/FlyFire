import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MapPin, Tag, Plus, Trash2 } from 'lucide-react';

interface Zone {
  id: string;
  name: string;
  created_at: string;
}

interface DeviceType {
  id: string;
  name: string;
  created_at: string;
}

export default function Settings() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [deviceTypes, setDeviceTypes] = useState<DeviceType[]>([]);
  
  const [newZone, setNewZone] = useState('');
  const [newDeviceType, setNewDeviceType] = useState('');

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [zonesRes, typesRes] = await Promise.all([
        supabase.from('zones').select('*').order('created_at', { ascending: true }),
        supabase.from('device_types').select('*').order('created_at', { ascending: true })
      ]);
      
      if (zonesRes.data) setZones(zonesRes.data);
      if (typesRes.data) setDeviceTypes(typesRes.data);
    } catch (error) {
      console.error('Error fetching settings data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZone.trim()) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('http://localhost:8080/api/admin/zones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ name: newZone })
      });
      
      if (response.ok) {
        setNewZone('');
        fetchData();
      } else {
        const err = await response.json().catch(()=>({}));
        alert(err.error || 'Failed to create zone');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleCreateDeviceType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceType.trim()) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('http://localhost:8080/api/admin/devicetypes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ name: newDeviceType })
      });
      
      if (response.ok) {
        setNewDeviceType('');
        fetchData();
      } else {
        const err = await response.json().catch(()=>({}));
        alert(err.error || 'Failed to create device type');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteZone = async (id: string) => {
    if (!confirm('Are you sure you want to delete this zone?')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`http://localhost:8080/api/admin/zones/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (response.ok) {
        fetchData();
      } else {
        const err = await response.json().catch(()=>({}));
        alert(err.error || 'Failed to delete zone');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteDeviceType = async (id: string) => {
    if (!confirm('Are you sure you want to delete this device type?')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`http://localhost:8080/api/admin/devicetypes/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (response.ok) {
        fetchData();
      } else {
        const err = await response.json().catch(()=>({}));
        alert(err.error || 'Failed to delete device type');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">System Settings</h1>
          <p className="page-description">Manage global configurations, zones, and device catalogs</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        
        {/* Zones Panel */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <MapPin size={24} style={{ color: 'var(--primary)' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Operational Zones</h2>
          </div>
          
          <form onSubmit={handleCreateZone} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. North Wing, Building A" 
              value={newZone}
              onChange={(e) => setNewZone(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
              <Plus size={18} /> Add Zone
            </button>
          </form>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Zone Name</th>
                  <th>Created</th>
                  <th style={{ width: '60px' }}></th>
                </tr>
              </thead>
              <tbody>
                {zones.map(z => (
                  <tr key={z.id}>
                    <td style={{ fontWeight: 500 }}>{z.name}</td>
                    <td>{new Date(z.created_at).toLocaleDateString()}</td>
                    <td>
                      <button className="btn btn-ghost" style={{ color: 'var(--danger)', padding: '0.25rem' }} onClick={() => handleDeleteZone(z.id)} title="Delete Zone">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {zones.length === 0 && !loading && (
                  <tr><td colSpan={2} style={{ textAlign: 'center' }}>No zones created yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Device Types Panel */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <Tag size={24} style={{ color: 'var(--primary)' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Device Types Catalog</h2>
          </div>
          
          <form onSubmit={handleCreateDeviceType} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. Fire Extinguisher, AED" 
              value={newDeviceType}
              onChange={(e) => setNewDeviceType(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
              <Plus size={18} /> Add Type
            </button>
          </form>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type Name</th>
                  <th>Created</th>
                  <th style={{ width: '60px' }}></th>
                </tr>
              </thead>
              <tbody>
                {deviceTypes.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 500 }}>{d.name}</td>
                    <td>{new Date(d.created_at).toLocaleDateString()}</td>
                    <td>
                      <button className="btn btn-ghost" style={{ color: 'var(--danger)', padding: '0.25rem' }} onClick={() => handleDeleteDeviceType(d.id)} title="Delete Device Type">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {deviceTypes.length === 0 && !loading && (
                  <tr><td colSpan={2} style={{ textAlign: 'center' }}>No device types created yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
