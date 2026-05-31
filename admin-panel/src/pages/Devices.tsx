import { useState, useEffect } from 'react';
import { Plus, Download, Trash2, Search, History } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Device {
  id: string;
  serialNumber: string;
  deviceType: string;
  registeredAt: string;
  isActive: boolean;
}

const MOCK_DEVICES: Device[] = [
  { id: '1', serialNumber: 'FE-0012A', deviceType: 'Fire Extinguisher', registeredAt: '2026-05-20', isActive: true },
  { id: '2', serialNumber: 'SD-9981B', deviceType: 'Smoke Detector', registeredAt: '2026-05-21', isActive: true },
  { id: '3', serialNumber: 'FH-4422C', deviceType: 'Fire Hose', registeredAt: '2026-05-22', isActive: true },
  { id: '4', serialNumber: 'FA-1100D', deviceType: 'Fire Alarm', registeredAt: '2026-05-23', isActive: false },
];

export default function Devices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDevice, setNewDevice] = useState({ serialNumber: '', deviceType: '', description: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('registered_at', { ascending: false });
        
      if (error) throw error;
      
      if (data) {
        const mappedDevices = data.map(d => ({
          id: d.id,
          serialNumber: d.serial_number,
          deviceType: d.device_type,
          registeredAt: new Date(d.registered_at).toLocaleDateString(),
          isActive: d.is_active
        }));
        setDevices(mappedDevices);
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase.from('devices').insert([{
        serial_number: newDevice.serialNumber,
        device_type: newDevice.deviceType,
        description: newDevice.description,
        registered_by: userData.user?.id
      }]);

      if (error) throw error;
      
      setIsModalOpen(false);
      setNewDevice({ serialNumber: '', deviceType: '', description: '' });
      fetchDevices(); // Refresh list
    } catch (error: any) {
      alert(error.message || 'Error registering device');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to decommission this device?')) {
      try {
        const { error } = await supabase
          .from('devices')
          .update({ is_active: false })
          .eq('id', id);
          
        if (error) throw error;
        fetchDevices();
      } catch (error: any) {
        alert('Error decommissioning device');
      }
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Devices</h1>
          <p className="page-description">Manage and track all registered safety devices</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={20} />
          Register Device
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              className="form-control" 
              placeholder="Search by serial number or type..." 
              style={{ paddingLeft: '3rem' }}
            />
          </div>
          <select className="form-control" style={{ width: '200px' }}>
            <option value="all">All Types</option>
            <option value="extinguisher">Fire Extinguisher</option>
            <option value="detector">Smoke Detector</option>
          </select>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Serial Number</th>
                <th>Device Type</th>
                <th>Registration Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr key={device.id} style={{ opacity: device.isActive ? 1 : 0.6 }}>
                  <td style={{ fontWeight: 500 }}>{device.serialNumber}</td>
                  <td>{device.deviceType}</td>
                  <td>{device.registeredAt}</td>
                  <td>
                    {device.isActive ? (
                      <span className="badge badge-success">Active</span>
                    ) : (
                      <span className="badge badge-danger">Decommissioned</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-ghost" title="Download QR" disabled={!device.isActive}>
                        <Download size={18} />
                      </button>
                      <button className="btn btn-ghost" title="View Audit History">
                        <History size={18} />
                      </button>
                      {device.isActive && (
                        <button className="btn btn-ghost" title="Decommission" onClick={() => handleDelete(device.id)} style={{ color: 'var(--danger)' }}>
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
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
              <h2 className="modal-title">Register New Device</h2>
              <button className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label className="form-label">Serial Number</label>
                <input 
                  type="text" 
                  className="form-control" 
                  required 
                  value={newDevice.serialNumber}
                  onChange={(e) => setNewDevice({...newDevice, serialNumber: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Device Type</label>
                <select 
                  className="form-control" 
                  required
                  value={newDevice.deviceType}
                  onChange={(e) => setNewDevice({...newDevice, deviceType: e.target.value})}
                >
                  <option value="">Select a type...</option>
                  <option value="Fire Extinguisher">Fire Extinguisher</option>
                  <option value="Smoke Detector">Smoke Detector</option>
                  <option value="Fire Hose">Fire Hose</option>
                  <option value="Fire Alarm">Fire Alarm</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Description (Optional)</label>
                <textarea 
                  className="form-control" 
                  rows={3}
                  value={newDevice.description}
                  onChange={(e) => setNewDevice({...newDevice, description: e.target.value})}
                ></textarea>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Register Device</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
