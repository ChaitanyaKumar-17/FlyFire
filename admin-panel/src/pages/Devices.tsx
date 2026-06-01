import { useState, useEffect } from 'react';
import { Plus, Download, Trash2, Search, History, QrCode } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

interface Device {
  id: string;
  serialNumber: string;
  deviceType: string;
  zone: string;
  registeredAt: string;
  isActive: boolean;
  qrSignedUrl?: string;
}

// Mock data removed in favor of live DB

export default function Devices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceTypes, setDeviceTypes] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [userRole, setUserRole] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDevice, setNewDevice] = useState({ serialNumber: '', deviceTypeId: '', zoneId: '', description: '' });
  const [loading, setLoading] = useState(true);
  const [deviceToDelete, setDeviceToDelete] = useState<string | null>(null);
  const [auditDevice, setAuditDevice] = useState<Device | null>(null);
  const [audits, setAudits] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterZone, setFilterZone] = useState('all');

  const filteredDevices = devices.filter(d => {
    const matchesSearch = d.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          d.deviceType.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || d.deviceType === filterType;
    const matchesStatus = filterStatus === 'all' || (filterStatus === 'active' ? d.isActive : !d.isActive);
    const matchesZone = filterZone === 'all' || d.zone === filterZone;
    return matchesSearch && matchesType && matchesStatus && matchesZone;
  });

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: userData } = await supabase.from('users').select('role, zone_id').eq('id', session.user.id).single();
      if (userData) setUserRole(userData.role);

      // Fetch reference data for dropdowns
      const [typesRes, zonesRes] = await Promise.all([
        supabase.from('device_types').select('*').order('name'),
        supabase.from('zones').select('*').order('name')
      ]);
      if (typesRes.data) setDeviceTypes(typesRes.data);
      if (zonesRes.data) setZones(zonesRes.data);

      let query = supabase
        .from('devices')
        .select('*, device_types(name), zones(name)')
        .order('registered_at', { ascending: false });
        
      if (userData?.role === 'ROLE_ADMIN' && userData.zone_id) {
        query = query.eq('zone_id', userData.zone_id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      if (data) {
        const mappedDevices = data.map(d => ({
          id: d.id,
          serialNumber: d.serial_number,
          deviceType: d.device_types?.name || 'Unknown',
          zone: d.zones?.name || 'Unknown',
          registeredAt: new Date(d.registered_at).toLocaleDateString(),
          isActive: d.is_active,
          qrSignedUrl: d.qr_signed_url
        }));
        setDevices(mappedDevices);
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAudits = async (device: Device) => {
    setAuditDevice(device);
    const { data } = await supabase
      .from('inspections')
      .select('*, users(full_name)')
      .eq('device_id', device.id)
      .order('inspected_at', { ascending: false });
    setAudits(data || []);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // 1. Get the current active session for the JWT token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session found.");

      // 2. Call the Spring Boot backend instead of inserting directly into Supabase.
      // The backend is responsible for creating the QR code and uploading it!
      const response = await fetch('http://localhost:8080/api/admin/devices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}` // Pass JWT for Spring Security
        },
        body: JSON.stringify({
          serialNumber: newDevice.serialNumber,
          deviceTypeId: newDevice.deviceTypeId,
          zoneId: newDevice.zoneId,
          description: newDevice.description
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Backend returned status ${response.status}`);
      }
      
      setIsModalOpen(false);
      setNewDevice({ serialNumber: '', deviceTypeId: '', zoneId: '', description: '' });
      toast.success('Device registered successfully!');
      fetchDevices(); // Refresh list to see the new device with its QR code
    } catch (error: any) {
      toast.error(error.message || 'Error registering device');
    }
  };

  const confirmDeleteDevice = async () => {
    if (!deviceToDelete) return;
    const id = deviceToDelete;
    setDeviceToDelete(null);
    try {
      const { error } = await supabase
        .from('devices')
        .update({ is_active: false })
        .eq('id', id);
        
      if (error) throw error;
      
      toast.success('Device decommissioned successfully!');
      fetchDevices();
    } catch (error: any) {
      toast.error(error.message || 'Error decommissioning device');
    }
  };

  const handleDelete = (id: string) => {
    setDeviceToDelete(id);
  };

  const handlePermanentDelete = async (id: string) => {
    // Kept as-is, can be hooked to custom modal later if needed, but not triggered in UI normally.
    try {
      const { error } = await supabase
        .from('devices')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      toast.success('Device permanently deleted!');
      fetchDevices();
    } catch (error: any) {
      alert('Error permanently deleting device: ' + error.message);
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select 
            className="form-control" 
            style={{ width: '200px' }}
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All Types</option>
            {deviceTypes.map(t => (
              <option key={t.id} value={t.name}>{t.name}</option>
            ))}
          </select>
          <select 
            className="form-control" 
            style={{ width: '200px' }}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="decommissioned">Decommissioned</option>
          </select>
          {userRole === 'ROLE_SUPERADMIN' && (
            <select 
              className="form-control" 
              style={{ width: '200px' }}
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
                <th>Serial Number</th>
                <th>Device Type</th>
                <th>Zone</th>
                <th>Registration Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDevices.map((device) => (
                <tr key={device.id} style={{ opacity: device.isActive ? 1 : 0.6 }}>
                  <td style={{ fontWeight: 500 }}>{device.serialNumber}</td>
                  <td>{device.deviceType}</td>
                  <td>{device.zone}</td>
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
                      <button 
                        className="btn btn-ghost" 
                        title="Download QR" 
                        disabled={!device.isActive || !device.qrSignedUrl}
                        onClick={() => window.open(device.qrSignedUrl, '_blank')}
                      >
                        <Download size={18} />
                      </button>
                      <button 
                        className="btn btn-ghost" 
                        title="View Audit History"
                        onClick={() => fetchAudits(device)}
                      >
                        <History size={18} />
                      </button>
                      {device.isActive ? (
                        <button className="btn btn-ghost" title="Decommission" onClick={() => handleDelete(device.id)} style={{ color: 'var(--danger)' }}>
                          <Trash2 size={18} />
                        </button>
                      ) : userRole === 'ROLE_SUPERADMIN' ? (
                        <button className="btn btn-ghost" title="Permanently Delete" onClick={() => handlePermanentDelete(device.id)} style={{ color: 'var(--danger)' }}>
                          <Trash2 size={18} />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredDevices.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                    <QrCode size={32} style={{ margin: '0 auto 1rem', opacity: 0.5, display: 'block' }} />
                    No devices found.
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
                  value={newDevice.deviceTypeId}
                  onChange={(e) => setNewDevice({...newDevice, deviceTypeId: e.target.value})}
                >
                  <option value="">Select a type...</option>
                  {deviceTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              
              {userRole === 'ROLE_SUPERADMIN' && (
                <div className="form-group">
                  <label className="form-label">Assign Zone</label>
                  <select 
                    className="form-control" 
                    required
                    value={newDevice.zoneId}
                    onChange={(e) => setNewDevice({...newDevice, zoneId: e.target.value})}
                  >
                    <option value="">Select a zone...</option>
                    {zones.map(z => (
                      <option key={z.id} value={z.id}>{z.name}</option>
                    ))}
                  </select>
                </div>
              )}
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

      {auditDevice && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Audit History: {auditDevice.serialNumber}</h2>
              <button className="btn btn-ghost" onClick={() => setAuditDevice(null)}>✕</button>
            </div>
            <div className="table-container" style={{ marginTop: '1rem' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Inspector</th>
                    <th>Status</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {audits.map((a) => (
                    <tr key={a.id}>
                      <td>{new Date(a.inspected_at).toLocaleString()}</td>
                      <td>{a.users?.full_name || 'Unknown'}</td>
                      <td>
                        <span className="badge badge-success">Completed</span>
                      </td>
                      <td>{a.remark || '-'}</td>
                    </tr>
                  ))}
                  {audits.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No audit history found for this device.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {deviceToDelete && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Confirm Deletion</h2>
              <button className="close-button" onClick={() => setDeviceToDelete(null)}>×</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to decommission this device? It will be marked as inactive.</p>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button className="btn btn-secondary" onClick={() => setDeviceToDelete(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={confirmDeleteDevice} style={{ backgroundColor: 'var(--danger)', color: 'white', border: 'none' }}>
                Decommission
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
