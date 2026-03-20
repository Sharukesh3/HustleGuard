import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ShieldAlert, MapPin, Bike, CheckCircle2 } from 'lucide-react-native';
import { colors } from '../theme/colors';

export default function OnboardingScreen({ onComplete }) {
  const [step, setStep] = useState(1);
  const [platform, setPlatform] = useState('');
  const [zone, setZone] = useState('');
  const [calculating, setCalculating] = useState(false);

  const platforms = [
    { id: 'zepto', name: 'Zepto', color: '#6A1B9A' },
    { id: 'blinkit', name: 'Blinkit', color: '#FBC02D' },
    { id: 'instamart', name: 'Instamart', color: '#E65100' }
  ];

  const zones = [
    { id: 'koramangala', name: 'Koramangala, BLR', risk: 'High', factor: 1.2 },
    { id: 'indiranagar', name: 'Indiranagar, BLR', risk: 'Medium', factor: 1.0 },
    { id: 'hsr', name: 'HSR Layout, BLR', risk: 'Low', factor: 0.8 }
  ];

  const handleCalculate = () => {
    setCalculating(true);
    setTimeout(() => {
      setCalculating(false);
      setStep(3);
    }, 1500);
  };

  const getPremium = () => {
    const selectedZone = zones.find(z => z.id === zone);
    const basePremium = 25; // Base weekly premium in INR
    return selectedZone ? Math.round(basePremium * selectedZone.factor) : basePremium;
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[colors.background, 'rgba(16, 185, 129, 0.1)', colors.background]} style={StyleSheet.absoluteFill} />
      
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <ShieldAlert color={colors.primary} size={32} />
          <Text style={styles.logoText}>GigProtect</Text>
        </View>
        <Text style={styles.subtitle}>Q-Commerce Income Protection</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Select your platform</Text>
            {platforms.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.card, platform === p.id && styles.cardActive]}
                onPress={() => setPlatform(p.id)}
              >
                <Bike color={platform === p.id ? colors.primary : colors.textMuted} size={24} />
                <Text style={[styles.cardTitle, platform === p.id && styles.textPrimary]}>{p.name}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.button, !platform && styles.buttonDisabled]}
              disabled={!platform}
              onPress={() => setStep(2)}
            >
              <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Select your primary zone</Text>
            {zones.map(z => (
              <TouchableOpacity
                key={z.id}
                style={[styles.card, zone === z.id && styles.cardActive]}
                onPress={() => setZone(z.id)}
              >
                <MapPin color={zone === z.id ? colors.primary : colors.textMuted} size={24} />
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTitle, zone === z.id && styles.textPrimary]}>{z.name}</Text>
                  <Text style={styles.cardRisk}>Risk Level: {z.risk}</Text>
                </View>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.button, (!zone || calculating) && styles.buttonDisabled]}
              disabled={!zone || calculating}
              onPress={handleCalculate}
            >
              <Text style={styles.buttonText}>{calculating ? 'Analyzing AI Risk...' : 'Calculate Weekly Premium'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContainer}>
            <View style={styles.successIcon}>
              <CheckCircle2 color={colors.primary} size={64} />
            </View>
            <Text style={styles.stepTitle}>Your Weekly Coverage</Text>
            <View style={styles.premiumBox}>
              <Text style={styles.currency}>₹</Text>
              <Text style={styles.premiumAmount}>{getPremium()}</Text>
              <Text style={styles.premiumUnit}>/ week</Text>
            </View>
            <Text style={styles.premiumDesc}>
              Dynamic pricing applied based on {zones.find(z=>z.id===zone)?.risk} risk level for {zones.find(z=>z.id===zone)?.name}.
            </Text>
            
            <View style={styles.coverageList}>
              <Text style={styles.coverageItem}>• Severe Weather Protection</Text>
              <Text style={styles.coverageItem}>• Apartment/Elevator Security Delays</Text>
              <Text style={styles.coverageItem}>• System Outage Loss</Text>
              <Text style={styles.coverageItem}>• Huge Building Navigation</Text>
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={() => onComplete({ platform, zone, premium: getPremium() })}
            >
              <Text style={styles.buttonText}>Subscribe & Start Shift</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: 30, paddingTop: 60, alignItems: 'center' },
  logoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  logoText: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginLeft: 10, letterSpacing: 1 },
  subtitle: { color: colors.textMuted, fontSize: 16 },
  content: { flex: 1, paddingHorizontal: 20, width: '100%', maxWidth: 600, alignSelf: 'center' },
  stepContainer: { flex: 1, marginTop: 20 },
  stepTitle: { color: '#fff', fontSize: 22, fontWeight: '600', marginBottom: 20, textAlign: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: 20, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: colors.border },
  cardActive: { borderColor: colors.primary, backgroundColor: colors.surfaceHighlight },
  cardContent: { marginLeft: 15 },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '500' },
  cardRisk: { color: colors.textMuted, fontSize: 14, marginTop: 4 },
  textPrimary: { color: colors.primary },
  button: { backgroundColor: colors.primary, padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 30 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#000', fontSize: 18, fontWeight: 'bold' },
  successIcon: { alignItems: 'center', marginBottom: 20 },
  premiumBox: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginVertical: 20 },
  currency: { color: colors.primary, fontSize: 30, fontWeight: 'bold', marginRight: 5 },
  premiumAmount: { color: colors.primary, fontSize: 60, fontWeight: 'bold' },
  premiumUnit: { color: colors.textMuted, fontSize: 18, marginLeft: 10 },
  premiumDesc: { color: colors.textMuted, textAlign: 'center', marginBottom: 30, fontSize: 15, lineHeight: 22 },
  coverageList: { backgroundColor: colors.surface, padding: 20, borderRadius: 12, marginBottom: 30 },
  coverageItem: { color: '#fff', fontSize: 15, marginBottom: 10 }
});
