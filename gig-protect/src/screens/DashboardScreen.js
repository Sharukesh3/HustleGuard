import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Image } from 'react-native';
import { BlurView } from 'expo-blur';
import { CloudRain, WifiOff, Navigation, IndianRupee, ShieldCheck, AlertTriangle } from 'lucide-react-native';
import { colors } from '../theme/colors';

export default function DashboardScreen({ userProfile }) {
  const [isRaining, setIsRaining] = useState(false);
  const [isDeadZone, setIsDeadZone] = useState(false);
  const [claimStatus, setClaimStatus] = useState(null); // null, 'processing_rain', 'processing_network', 'approved'

  const simulateRain = () => {
    setIsRaining(true);
    setTimeout(() => {
      setClaimStatus('processing_rain');
      setTimeout(() => {
        setClaimStatus('approved');
      }, 2000);
    }, 1500);
  };

  const simulateDeadZone = () => {
    setIsDeadZone(true);
    setTimeout(() => {
      setClaimStatus('processing_network');
      setTimeout(() => {
        setClaimStatus('approved');
      }, 2000);
    }, 1500);
  };

  const getOverlayColor = () => {
    if (isRaining) return 'rgba(56, 189, 248, 0.15)';
    if (isDeadZone) return 'rgba(239, 68, 68, 0.15)';
    return 'transparent';
  };

  return (
    <View style={styles.container}>
      {/* Map Background Placeholder */}
      <View style={styles.mapPlaceholder}>
        <View style={styles.gridOverlay} />
        <View style={[styles.gridOverlay, { backgroundColor: getOverlayColor() }]} />
        
        <View style={[styles.marker, isDeadZone && { backgroundColor: 'rgba(239, 68, 68, 0.3)' }]}>
          <View style={[styles.pulse, isDeadZone && { borderColor: colors.danger, opacity: 0.8 }]} />
          <Navigation color={isDeadZone ? colors.textMuted : colors.primary} size={24} style={{ transform: [{ rotate: '45deg' }] }} />
        </View>

        {isDeadZone && <Text style={styles.mapAlertText}>No Signal • Disconnected</Text>}
      </View>

      <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Active Shift</Text>
              <Text style={styles.zoneText}>Zone: {userProfile?.zone.toUpperCase() || 'KORAMANGALA'}</Text>
            </View>
            <View style={styles.shieldBadge}>
              <ShieldCheck color={colors.primary} size={20} />
              <Text style={styles.badgeText}>Protected</Text>
            </View>
          </View>

        {/* Claim Simulation Status */}
        {claimStatus && (
          <BlurView intensity={80} tint="dark" style={styles.claimOverlay}>
            <View style={styles.claimBox}>
              {claimStatus.startsWith('processing') ? (
                <>
                  <AlertTriangle color={colors.warning} size={40} />
                  <Text style={styles.claimTitle}>Disruption Detected</Text>
                  <Text style={styles.claimDesc}>
                    {claimStatus === 'processing_rain' 
                      ? 'AI assessing severe waterlogging in your grid...' 
                      : 'WebSocket cluster timeout. Detecting local ISP outage...'}
                  </Text>
                </>
              ) : (
                <>
                  <IndianRupee color={colors.primary} size={40} />
                  <Text style={styles.claimTitle}>Insta-Claim Approved</Text>
                  <Text style={styles.claimDesc}>₹150 credited to your wallet for current shift downtime.</Text>
                  <TouchableOpacity style={styles.dismissBtn} onPress={() => {setClaimStatus(null); setIsRaining(false); setIsDeadZone(false);}}>
                    <Text style={styles.dismissText}>Resume Shift</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </BlurView>
        )}

        <View style={styles.contentWrapper}>
          <View style={styles.bottomSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll}>
            <BlurView intensity={40} tint="dark" style={styles.statCard}>
              <Text style={styles.statLabel}>Earnings Protected</Text>
              <Text style={styles.statValue}>₹4,500/Mo</Text>
            </BlurView>
            <BlurView intensity={40} tint="dark" style={styles.statCard}>
              <Text style={styles.statLabel}>Current Risk Level</Text>
              <Text style={[styles.statValue, (isRaining || isDeadZone) && { color: colors.danger }]}>
                {isRaining ? 'HIGH (Rain)' : isDeadZone ? 'HIGH (Outage)' : 'LOW'}
              </Text>
            </BlurView>
            <BlurView intensity={40} tint="dark" style={styles.statCard}>
              <Text style={styles.statLabel}>Policy Expiry</Text>
              <Text style={styles.statValue}>6 Days</Text>
            </BlurView>
          </ScrollView>

          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionButton, { flex: 1, maxWidth: 200, marginRight: 10 }]} onPress={simulateRain} disabled={isRaining || isDeadZone}>
              <CloudRain color="#fff" size={20} style={{ marginBottom: 5 }} />
              <Text style={styles.actionText}>Simulate Rain</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.actionButton, { flex: 1, maxWidth: 200, marginLeft: 10, borderColor: colors.danger }]} onPress={simulateDeadZone} disabled={isRaining || isDeadZone}>
              <WifiOff color={colors.danger} size={20} style={{ marginBottom: 5 }} />
              <Text style={[styles.actionText, { color: colors.danger }]}>Simulate Outage</Text>
            </TouchableOpacity>
          </View>
        </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

// Custom Safe Area since we overlay the map
const SafeAreaView = ({ children, style }) => (
  <View style={[{ paddingTop: 50, flex: 1, justifyContent: 'space-between' }, style]}>{children}</View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  contentWrapper: { flex: 1, width: '100%', justifyContent: 'flex-end', paddingBottom: 20 },
  mapPlaceholder: { ...StyleSheet.absoluteFillObject, backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center' },
  gridOverlay: { ...StyleSheet.absoluteFillObject, opacity: 0.1, borderWidth: 1, borderColor: '#3f3f46', borderStyle: 'dashed' },
  mapAlertText: { color: colors.danger, fontWeight: 'bold', fontSize: 18, marginTop: 20 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  greeting: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  zoneText: { color: colors.textMuted, fontSize: 14, marginTop: 4 },
  shieldBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceHighlight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.primaryMuted },
  badgeText: { color: colors.primary, fontWeight: 'bold', marginLeft: 6 },
  marker: { width: 40, height: 40, backgroundColor: 'rgba(16, 185, 129, 0.2)', borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  pulse: { position: 'absolute', width: 60, height: 60, borderRadius: 30, borderWidth: 1, borderColor: colors.primary, opacity: 0.5 },
  bottomSection: { paddingBottom: 100 }, // Account for TabBar height
  statsScroll: { paddingHorizontal: 20, marginBottom: 20 },
  statCard: { padding: 20, borderRadius: 20, marginRight: 15, width: 160, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  statLabel: { color: colors.textMuted, fontSize: 13, marginBottom: 8 },
  statValue: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  actionRow: { flexDirection: 'row', paddingHorizontal: 20 },
  actionButton: { backgroundColor: colors.surfaceHighlight, alignItems: 'center', justifyContent: 'center', paddingVertical: 18, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  actionText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  claimOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  claimBox: { backgroundColor: colors.surfaceHighlight, padding: 30, borderRadius: 24, width: '85%', maxWidth: 500, alignItems: 'center', borderWidth: 1, borderColor: colors.primaryMuted },
  claimTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginTop: 15, marginBottom: 10 },
  claimDesc: { color: colors.textMuted, textAlign: 'center', fontSize: 15, lineHeight: 22 },
  dismissBtn: { marginTop: 20, backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  dismissText: { color: '#000', fontWeight: 'bold', fontSize: 16 }
});
