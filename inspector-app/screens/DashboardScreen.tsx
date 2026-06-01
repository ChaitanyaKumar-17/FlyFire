import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform, StatusBar, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView } from 'react-native';
import { supabase } from '../lib/supabase';
import { LogOut, QrCode } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { TempStorage } from './LoginScreen';

export default function DashboardScreen() {
  const [userName, setUserName] = useState('');
  const [recentInspections, setRecentInspections] = useState<any[]>([]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  
  const [isFirstLoginPrompt, setIsFirstLoginPrompt] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase
          .from('users')
          .select('full_name, role, zone_id, is_first_login')
          .eq('id', session.user.id)
          .single();
        if (data) {
          setUserName(data.full_name);
          setUserId(session.user.id);
          
          if (data.is_first_login && data.role !== 'ROLE_SUPERADMIN') {
            setIsFirstLoginPrompt(true);
            return;
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
        if (inspections) setRecentInspections(inspections);
      }
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
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
            <TextInput
              style={styles.input}
              placeholder="Enter current password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              value={oldPassword}
              onChangeText={setOldPassword}
            />
            
            <Text style={styles.label}>New Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter new password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />

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
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.userName}>{userName || 'Inspector'}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ready to Inspect?</Text>
          <Text style={styles.cardSubtitle}>Scan a device's QR code to view its details and log a new inspection remark.</Text>
          
          <TouchableOpacity style={styles.scanButton} onPress={handleScan}>
            <QrCode size={24} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.scanButtonText}>Scan QR Code</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Text style={styles.recentTitle}>Recent Inspections</Text>
            <TouchableOpacity onPress={() => navigation.navigate('History' as never)}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
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
        </View>
      </View>
      </>
      )}
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
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  greeting: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  logoutButton: {
    padding: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.05)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3,
      },
    }),
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  cardSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  scanButton: {
    flexDirection: 'row',
    backgroundColor: '#2563EB',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
  },
  scanButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  recentSection: {
    marginTop: 24,
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
});
