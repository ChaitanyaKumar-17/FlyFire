import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { supabase } from '../lib/supabase';

export const TempStorage = { password: '' };

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFirstLoginPrompt, setIsFirstLoginPrompt] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    TempStorage.password = password;

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      Alert.alert('Login Failed', error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { data: profile } = await supabase
        .from('users')
        .select('is_first_login')
        .eq('id', data.user.id)
        .single();

      if (profile?.is_first_login) {
        setIsFirstLoginPrompt(true);
        setUserId(data.user.id);
        setLoading(false);
      }
      // If not first login, App.tsx's onAuthStateChange handles the navigation
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    
    if (updateError) {
      Alert.alert('Update Failed', updateError.message);
      setLoading(false);
      return;
    }

    const { error: dbError } = await supabase
      .from('users')
      .update({ is_first_login: false })
      .eq('id', userId);

    if (dbError) {
      Alert.alert('Error', 'Could not update user record.');
    }
    // Auth state listener handles navigation
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.container}
      >
        <View style={styles.headerContainer}>
          <Text style={styles.title}>FireSafetyPro</Text>
          <Text style={styles.subtitle}>Inspector Portal</Text>
        </View>

        <View style={styles.formContainer}>
          {!isFirstLoginPrompt ? (
            <>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="inspector@firesafetypro.local"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              <TouchableOpacity 
                style={[styles.loginButton, loading && styles.loginButtonDisabled]} 
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.loginButtonText}>Sign In</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[styles.label, { marginBottom: 16, color: '#6B7280', fontWeight: 'normal' }]}>
                You are using a temporary password. Please update your password to continue.
              </Text>
              
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
                style={[styles.loginButton, loading && styles.loginButtonDisabled]} 
                onPress={handleUpdatePassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.loginButtonText}>Update Password</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>Secure Access Only</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#6B7280',
    fontWeight: '500',
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
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
  loginButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footerContainer: {
    alignItems: 'center',
    marginTop: 32,
  },
  footerText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
});
