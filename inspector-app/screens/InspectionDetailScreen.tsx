import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { supabase } from '../lib/supabase';
import { clearCache } from '../lib/cache';
import { ArrowLeft, CheckCircle, ClipboardList } from 'lucide-react-native';

type InspectionDetailRouteProp = RouteProp<RootStackParamList, 'InspectionDetail'>;

export default function InspectionDetailScreen() {
  const route = useRoute<InspectionDetailRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { deviceId } = route.params;

  const [device, setDevice] = useState<any>(null);
  const [lastInspection, setLastInspection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [remark, setRemark] = useState('');
  const [deviceRemark, setDeviceRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetchDeviceDetails();
  }, [deviceId]);

  const fetchDeviceDetails = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Not authenticated');

      const { data: userData } = await supabase.from('users').select('role, zone_id').eq('id', session.user.id).single();

      const { data, error } = await supabase
        .from('devices')
        .select(`
          id,
          serial_number,
          is_active,
          zone_id,
          description,
          device_types!devices_device_type_id_fkey(name),
          zones!devices_zone_id_fkey(name)
        `)
        .eq('id', deviceId)
        .single();

      if (error) throw error;
      
      // Authorization Check
      if (userData?.role !== 'ROLE_SUPERADMIN') {
        if (userData?.zone_id !== data.zone_id) {
          Alert.alert(
            'Unauthorized Zone', 
            'This equipment belongs to a different zone. You are not authorized to inspect it.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
          return;
        }
      }

      setDevice(data);
      if (data.description) {
        setDeviceRemark(data.description);
      }

      if (data.is_active) {
        const { data: inspectionData } = await supabase
          .from('inspections')
          .select('inspected_at, remark')
          .eq('device_id', deviceId)
          .order('inspected_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (inspectionData) {
          setLastInspection(inspectionData);
        }
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to fetch equipment details. ' + error.message);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    
    if (remark.trim().length < 10) {
      setSubmitError('Inspection remark must be at least 10 characters long.');
      return;
    }

    if (!device?.is_active) {
      setSubmitError('Cannot inspect decommissioned equipment.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Not authenticated');

      const { error } = await supabase.from('inspections').insert({
        device_id: device.id,
        inspector_id: session.user.id,
        remark: remark.trim()
      });

      if (error) throw error;

      if (deviceRemark.trim() !== (device.description || '')) {
        const { error: deviceError } = await supabase
          .from('devices')
          .update({ description: deviceRemark.trim() })
          .eq('id', device.id);
          
        if (deviceError) console.error("Failed to update device remark", deviceError);
      }

      clearCache();

      // Navigate back to Dashboard without blocking on an alert
      navigation.reset({
        index: 0,
        routes: [{ name: 'Dashboard' as never }],
      });
    } catch (error: any) {
      setSubmitError('Failed to submit inspection. ' + (error.message || ''));
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Fetching equipment details...</Text>
      </View>
    );
  }

  if (!device) return null;

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#1E3A8A" barStyle="light-content" />
      <SafeAreaView style={{ flex: 0, backgroundColor: '#1E3A8A' }} edges={['top']} />
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ArrowLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <View style={styles.headerIconWrapper}>
              <ClipboardList size={26} color="#1E3A8A" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Inspection Detail</Text>
              <Text style={styles.headerSubtitle}>Submit inspection report</Text>
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Equipment Information</Text>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Serial Number</Text>
              <Text style={styles.infoValue}>{device.serial_number}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Type</Text>
              <Text style={styles.infoValue}>{device.device_types?.name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Zone</Text>
              <Text style={styles.infoValue}>{device.zones?.name}</Text>
            </View>
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={[styles.infoValue, { color: device.is_active ? '#10B981' : '#EF4444' }]}>
                {device.is_active ? 'Active' : 'Decommissioned'}
              </Text>
            </View>
          </View>

          {device.is_active && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Previous Inspection</Text>
              {lastInspection ? (
                <>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Date</Text>
                    <Text style={styles.infoValue}>
                      {new Date(lastInspection.inspected_at).toLocaleDateString()} {new Date(lastInspection.inspected_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={[styles.infoRow, { borderBottomWidth: 0, flexDirection: 'column', alignItems: 'flex-start' }]}>
                    <Text style={[styles.infoLabel, { marginBottom: 8 }]}>Remark</Text>
                    <Text style={[styles.infoValue, { fontWeight: '400', lineHeight: 20 }]}>{lastInspection.remark}</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.noHistoryText}>No previous inspection history found.</Text>
              )}
            </View>
          )}

          <View style={styles.formContainer}>
            <Text style={styles.sectionTitle}>Log New Inspection</Text>
            
            <Text style={styles.label}>Equipment Remark</Text>
            <TextInput
              style={[styles.textArea, { height: 80, marginBottom: 16 }]}
              placeholder="Add or update equipment specific remark..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              value={deviceRemark}
              onChangeText={setDeviceRemark}
              editable={!submitting && device.is_active}
              textAlignVertical="top"
            />

            <Text style={styles.label}>Inspection Remark</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Enter your physical inspection findings (minimum 10 characters)..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              value={remark}
              onChangeText={setRemark}
              editable={!submitting && device.is_active}
              textAlignVertical="top"
            />
            
            {submitError && (
              <Text style={{ color: '#EF4444', marginBottom: 12, fontWeight: '500' }}>
                {submitError}
              </Text>
            )}

            <TouchableOpacity 
              style={[styles.submitButton, (submitting || !device.is_active) && styles.submitButtonDisabled]} 
              onPress={handleSubmit}
              disabled={submitting || !device.is_active}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <CheckCircle size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.submitButtonText}>Submit Inspection</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: '#1E3A8A',
  },
  backButton: {
    padding: 8,
    marginRight: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#93C5FD',
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  noHistoryText: {
    color: '#6B7280',
    fontSize: 14,
    fontStyle: 'italic',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabel: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
  infoValue: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
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
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textArea: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#111827',
    minHeight: 120,
    marginBottom: 20,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#A7F3D0',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
