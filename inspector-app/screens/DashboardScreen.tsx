import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform, StatusBar, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Modal, ScrollView } from 'react-native';
import { supabase } from '../lib/supabase';
import { LogOut, QrCode, Eye, EyeOff, ChevronRight, ShieldCheck } from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { TempStorage } from './LoginScreen';
import { getCachedData, setCachedData, clearCache } from '../lib/cache';

export default function DashboardScreen() {
  const [userName, setUserName] = useState('');
  const [recentInspections, setRecentInspections] = useState<any[]>([]);
  const [activeDevices, setActiveDevices] = useState<any[]>([]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  
  const [isFirstLoginPrompt, setIsFirstLoginPrompt] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showDevicesModal, setShowDevicesModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const fetchUser = async (forceRefresh = false) => {
        if (!forceRefresh) {
          const cached = getCachedData<any>('dashboard');
          if (cached) {
            setUserName(cached.userName);
            setUserId(cached.userId);
            setActiveDevices(cached.activeDevices);
            setRecentInspections(cached.recentInspections);
            return;
          }
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data } = await supabase
            .from('users')
            .select('full_name, role, zone_id, is_first_login')
            .eq('id', session.user.id)
            .single();

          let newUserName = '';
          let newUserId = session.user.id;
          let newActiveDevices: any[] = [];
          let newRecentInspections: any[] = [];

          if (data) {
            newUserName = data.full_name;
            setUserName(newUserName);
            setUserId(newUserId);
            
            if (data.is_first_login && data.role !== 'ROLE_SUPERADMIN') {
              setIsFirstLoginPrompt(true);
              return;
            }
          }
          
          if (data?.zone_id) {
            const { data: devices } = await supabase
              .from('devices')
              .select('id, serial_number, is_active, device_types(name), zones(name)')
              .eq('zone_id', data.zone_id)
              .order('registered_at', { ascending: false });
            if (devices) {
              newActiveDevices = devices;
              setActiveDevices(devices);
            }
          }
          
          let query = supabase
            .from('inspections')
            .select('id, remark, inspected_at, devices!inner(serial_number, zone_id)')
            .order('inspected_at', { ascending: false })
            .limit(5);

          if (data?.role === 'ROLE_SUPERADMIN') {
            // no filter
          } else if (data?.role === 'ROLE_ADMIN' && data?.zone_id) {
            query = query.eq('devices.zone_id', data.zone_id);
          } else {
            query = query.eq('inspector_id', session.user.id);
          }

          const { data: inspections } = await query;
          if (inspections) {
            newRecentInspections = inspections;
            setRecentInspections(inspections);
          }
          
          setCachedData('dashboard', {
            userName: newUserName,
            userId: newUserId,
            activeDevices: newActiveDevices,
            recentInspections: newRecentInspections
          });
        }
    };
    fetchUser();
  }, [])
);

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setIsLoggingOut(true);
    clearCache();
    await supabase.auth.signOut();
  };

  const handleUpdatePassword = async () => {
    setErrorMessage('');
    
    if (!oldPassword) {
      setErrorMessage('Please enter your current temporary password.');
      return;
    }
    
    if (newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters.');
      return;
    }
    
    if (newPassword === oldPassword) {
      setErrorMessage('New password must be strictly different from your temporary password.');
      return;
    }

    setIsUpdating(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    
    if (updateError) {
      if (updateError.message.toLowerCase().includes('different') || updateError.message.toLowerCase().includes('same')) {
        setErrorMessage('New password must be different from your temporary password.');
      } else {
        setErrorMessage(updateError.message);
      }
      setIsUpdating(false);
      return;
    }

    const { error: dbError } = await supabase
      .from('users')
      .update({ is_first_login: false })
      .eq('id', userId);

    if (dbError) {
      Alert.alert('Error', 'Could not update user record.');
    } else {
      setIsFirstLoginPrompt(false);
    }
    setIsUpdating(false);
  };

  const handleUpdatePasswordFromProfile = async () => {
    setErrorMessage('');
    
    if (!oldPassword) {
      setErrorMessage('Please enter your current password.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters.');
      return;
    }
    if (newPassword === oldPassword) {
      setErrorMessage('New password must be strictly different from your current password.');
      return;
    }

    setIsUpdating(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    
    if (updateError) {
      if (updateError.message.toLowerCase().includes('different') || updateError.message.toLowerCase().includes('same')) {
        setErrorMessage('New password must be strictly different.');
      } else {
        setErrorMessage(updateError.message);
      }
      setIsUpdating(false);
      return;
    }

    Alert.alert('Success', 'Your password has been updated.');
    setShowProfileModal(false);
    setOldPassword('');
    setNewPassword('');
    setIsUpdating(false);
  };

  const handleScan = () => {
    navigation.navigate('Scanner');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {isFirstLoginPrompt ? (
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.firstLoginContainer}
        >
          <View style={styles.firstLoginCard}>
            <Text style={styles.firstLoginTitle}>Update Password</Text>
            <Text style={styles.firstLoginSubtitle}>
              You are using a temporary password. Please update your password to continue using the inspector portal.
            </Text>
            
            {errorMessage ? <Text style={{ color: '#EF4444', marginBottom: 12, fontWeight: '500' }}>{errorMessage}</Text> : null}

            <Text style={styles.label}>Current Temporary Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter current password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showOldPassword}
                value={oldPassword}
                onChangeText={setOldPassword}
              />
              <TouchableOpacity onPress={() => setShowOldPassword(!showOldPassword)} style={styles.eyeIcon}>
                {showOldPassword ? <EyeOff size={20} color="#9CA3AF" /> : <Eye size={20} color="#9CA3AF" />}
              </TouchableOpacity>
            </View>
            
            <Text style={styles.label}>New Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter new password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showNewPassword}
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={styles.eyeIcon}>
                {showNewPassword ? <EyeOff size={20} color="#9CA3AF" /> : <Eye size={20} color="#9CA3AF" />}
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.updateButton, isUpdating && styles.updateButtonDisabled]} 
              onPress={handleUpdatePassword}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.updateButtonText}>Update Password</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity onPress={handleLogout} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={{ color: '#EF4444', fontWeight: 'bold' }}>Cancel & Logout</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <>
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={() => { setOldPassword(''); setNewPassword(''); setErrorMessage(''); setShowProfileModal(true); }}
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>{userName ? userName.charAt(0).toUpperCase() : 'I'}</Text>
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.greeting}>Welcome back 👋</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.userName}>{userName || 'Inspector'}</Text>
                  <ChevronRight size={16} color="#6B7280" style={{ marginTop: 2 }} />
                </View>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <LogOut size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>

      <View style={styles.content}>
        
        {activeDevices.length > 0 && (
          <TouchableOpacity 
            style={styles.activeDevicesCard}
            onPress={() => setShowDevicesModal(true)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.activeDevicesIconWrapper}>
                <ShieldCheck size={26} color="#10B981" />
              </View>
              <View style={{ marginLeft: 16, flex: 1 }}>
                <Text style={styles.activeDevicesTitle}>Devices</Text>
                <Text style={styles.activeDevicesSubtitle}>
                  {activeDevices.filter(d => d.is_active).length} active devices in your zone
                </Text>
              </View>
              <ChevronRight size={20} color="#9CA3AF" />
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Text style={styles.recentTitle}>Recent Inspections</Text>
            <TouchableOpacity onPress={() => navigation.navigate('History' as never)}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            {recentInspections.length > 0 ? (
              recentInspections.map((insp) => (
                <View key={insp.id} style={styles.inspectionItem}>
                  <View style={styles.inspectionItemHeader}>
                    <Text style={styles.deviceSerial}>{insp.devices?.serial_number}</Text>
                    <Text style={styles.inspectionDate}>
                      {new Date(insp.inspected_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.inspectionRemark} numberOfLines={2}>{insp.remark}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noHistoryText}>No recent inspections.</Text>
            )}
          </ScrollView>
        </View>

        <View style={styles.bottomCard}>
          <TouchableOpacity style={styles.modernScanButton} onPress={handleScan}>
            <View style={styles.scanIconWrapper}>
              <QrCode size={28} color="#FFFFFF" />
            </View>
            <View style={styles.scanTextWrapper}>
              <Text style={styles.modernScanTitle}>Scan QR Code</Text>
              <Text style={styles.modernScanSubtitle}>Tap here to log a new inspection</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
      </>
      )}

      <Modal
        visible={showLogoutModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Log Out</Text>
            <Text style={styles.modalText}>Are you sure you want to log out? You will need to enter your credentials to access the portal again.</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowLogoutModal(false)} disabled={isLoggingOut}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalLogoutButton, isLoggingOut && { opacity: 0.7 }]} onPress={confirmLogout} disabled={isLoggingOut}>
                {isLoggingOut ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalLogoutText}>Log Out</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDevicesModal}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={styles.modalTitle}>Devices in Your Zone</Text>
              <TouchableOpacity onPress={() => setShowDevicesModal(false)}>
                <Text style={{fontSize: 20, color: '#6B7280'}}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {activeDevices.map(device => (
                <View key={device.id} style={styles.deviceListItem}>
                  <View style={styles.deviceListInfo}>
                    <Text style={styles.deviceListSerial}>{device.serial_number}</Text>
                    <Text style={styles.deviceListType}>{device.device_types?.name}</Text>
                  </View>
                  <View style={[styles.deviceListStatus, !device.is_active && styles.deviceListStatusInactive]}>
                    <View style={[styles.deviceListStatusDot, !device.is_active && styles.deviceListStatusDotInactive]} />
                    <Text style={[styles.deviceListStatusText, !device.is_active && styles.deviceListStatusTextInactive]}>
                      {device.is_active ? 'Active' : 'Decommissioned'}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showProfileModal}
        transparent={true}
        animationType="slide"
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={styles.modalTitle}>My Profile</Text>
              <TouchableOpacity onPress={() => setShowProfileModal(false)}><Text style={{fontSize: 20, color: '#6B7280'}}>✕</Text></TouchableOpacity>
            </View>

            <View style={{ marginBottom: 24 }}>
              <Text style={styles.label}>Name</Text>
              <Text style={{ fontSize: 16, fontWeight: '500', color: '#111827', marginBottom: 8 }}>{userName}</Text>
            </View>

            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#111827', marginBottom: 12 }}>Change Password</Text>
            {errorMessage ? <Text style={{ color: '#EF4444', marginBottom: 12, fontWeight: '500' }}>{errorMessage}</Text> : null}

            <Text style={styles.label}>Current Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter current password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showOldPassword}
                value={oldPassword}
                onChangeText={setOldPassword}
              />
              <TouchableOpacity onPress={() => setShowOldPassword(!showOldPassword)} style={styles.eyeIcon}>
                {showOldPassword ? <EyeOff size={20} color="#9CA3AF" /> : <Eye size={20} color="#9CA3AF" />}
              </TouchableOpacity>
            </View>
            
            <Text style={styles.label}>New Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter new password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showNewPassword}
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={styles.eyeIcon}>
                {showNewPassword ? <EyeOff size={20} color="#9CA3AF" /> : <Eye size={20} color="#9CA3AF" />}
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.updateButton, isUpdating && styles.updateButtonDisabled]} 
              onPress={handleUpdatePasswordFromProfile}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.updateButtonText}>Update Password</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    ...Platform.select({
      web: { boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.05)' },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 16, elevation: 5 },
    }),
    zIndex: 10,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4F46E5',
  },
  greeting: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 2,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  logoutButton: {
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  activeDevicesCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Platform.select({
      web: { boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.05)' },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3 },
    }),
  },
  activeDevicesIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeDevicesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  activeDevicesSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  deviceListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  deviceListInfo: {
    flex: 1,
  },
  deviceListSerial: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  deviceListType: {
    fontSize: 14,
    color: '#6B7280',
  },
  deviceListStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
  },
  deviceListStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  deviceListStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
  },
  deviceListStatusInactive: {
    backgroundColor: '#FEE2E2',
  },
  deviceListStatusDotInactive: {
    backgroundColor: '#EF4444',
  },
  deviceListStatusTextInactive: {
    color: '#991B1B',
  },
  recentSection: {
    flex: 1,
  },
  bottomCard: {
    marginTop: 16,
  },
  modernScanButton: {
    flexDirection: 'row',
    backgroundColor: '#1E3A8A',
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    ...Platform.select({
      web: { boxShadow: '0px 8px 24px rgba(30, 58, 138, 0.25)' },
      default: { shadowColor: '#1E3A8A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 8 },
    }),
  },
  scanIconWrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 14,
    borderRadius: 16,
    marginRight: 16,
  },
  scanTextWrapper: {
    flex: 1,
  },
  modernScanTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  modernScanSubtitle: {
    color: '#93C5FD',
    fontSize: 14,
    fontWeight: '500',
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  recentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  viewAllText: {
    color: '#2563EB',
    fontWeight: '600',
    fontSize: 14,
  },
  inspectionItem: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.05)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  inspectionItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  deviceSerial: {
    fontWeight: '600',
    color: '#111827',
    fontSize: 14,
  },
  inspectionDate: {
    color: '#6B7280',
    fontSize: 12,
  },
  inspectionRemark: {
    color: '#4B5563',
    fontSize: 14,
    lineHeight: 20,
  },
  noHistoryText: {
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 16,
  },
  firstLoginContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  firstLoginCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    ...Platform.select({
      web: { boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.05)' },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3 },
    }),
  },
  firstLoginTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  firstLoginSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    marginBottom: 20,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    marginBottom: 20,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  eyeIcon: {
    padding: 12,
  },
  updateButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  updateButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    ...Platform.select({
      web: { boxShadow: '0px 2px 12px rgba(0,0,0,0.25)' },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
    }),
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  modalText: {
    fontSize: 16,
    color: '#4B5563',
    marginBottom: 24,
    lineHeight: 24,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  modalCancelText: {
    color: '#4B5563',
    fontWeight: '600',
    fontSize: 16,
  },
  modalLogoutButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
  },
  modalLogoutText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
});
