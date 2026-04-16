import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Platform } from 'react-native';
import { ShieldAlert, KeyRound, User } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';

export default function AdminLoginScreen({ onLoginSuccess }) {
  const { colors } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    if (username.toLowerCase() === 'admin' && password === 'admin') {
      if (Platform.OS === 'web') {
        alert("Welcome, Administrator.");
      } else {
        Alert.alert("Success", "Welcome, Administrator.");
      }
      onLoginSuccess();
    } else {
      if (Platform.OS === 'web') {
        alert("Invalid credentials.");
      } else {
        Alert.alert("Error", "Invalid credentials.");
      }
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: '100%', maxWidth: 400, padding: 24, backgroundColor: colors.surface, borderRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 }}>
        
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
            <ShieldAlert size={32} color={colors.primary} />
          </View>
          <Text style={{ fontSize: 24, fontWeight: '900', color: colors.text, letterSpacing: -0.5 }}>Command<Text style={{color: colors.primary}}>Center</Text> Login</Text>
          <Text style={{ color: colors.textMuted, marginTop: 8, textAlign: 'center' }}>HustleGuard Insurer Portal</Text>
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 8, marginLeft: 4 }}>Username</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 16 }}>
            <User size={20} color={colors.textMuted} />
            <TextInput 
              style={{ flex: 1, paddingVertical: 16, paddingHorizontal: 12, color: colors.text, fontSize: 16 }}
              placeholder="Username"
              placeholderTextColor={colors.textMuted}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={{ marginBottom: 32 }}>
          <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 8, marginLeft: 4 }}>Password</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 16 }}>
            <KeyRound size={20} color={colors.textMuted} />
            <TextInput 
              style={{ flex: 1, paddingVertical: 16, paddingHorizontal: 12, color: colors.text, fontSize: 16 }}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>
        </View>

        <TouchableOpacity 
          style={{ backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 16, alignItems: 'center' }}
          onPress={handleLogin}
        >
          <Text style={{ color: '#FFF', fontSize: 16, fontWeight: 'bold' }}>Login to Dashboard</Text>
        </TouchableOpacity>

      </View>
    </View>
  );
}
