import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Easing, Dimensions } from 'react-native';
import { Camera, AlertTriangle, ScanLine, CheckCircle2, ShieldAlert } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useThemeColors } from '../theme/colors';

const { width } = Dimensions.get('window');

import { Platform } from 'react-native';

export default function ReportHazardScreen({ userProfile }) {
  const [photoState, setPhotoState] = useState('idle'); // idle, scanning, result
  const colors = useThemeColors();
  const styles = getStyles(colors);

  // Animations
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const startScanAnim = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })
      ])
    ).start();
  };

  const simulatePhotoUpload = async () => {
    setPhotoState('scanning');
    startScanAnim();
    
    // Simulate API fetch delay
    setTimeout(async () => {
      // POST the manual hazard transaction!
      try {
        if (userProfile && userProfile.user && userProfile.user.token) {
          const host = Platform?.OS === 'web' ? 'localhost:8000' : '192.168.1.110:8000';
          await fetch(`http://${host}/wallet/transaction`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${userProfile.user.token}`
            },
            body: JSON.stringify({
              amount: 50,
              hazard_type: 'Reported Hazard',
              reason: 'Manual Photographic Hazard Report'
            })
          });
        }
      } catch (err) {
        console.error('Hazard report payout failed:', err);
      }

      setPhotoState('result');
      scanLineAnim.stopAnimation();
      pulseAnim.stopAnimation();
      
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, 3000);
  };

  const reset = () => {
    fadeAnim.setValue(0);
    setPhotoState('idle');
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[colors.backgroundDark, colors.surfaceHighlight, colors.backgroundDark]} style={StyleSheet.absoluteFillObject} />

      <View style={styles.header}>
        <View style={styles.titleRow}>
           <ShieldAlert color={colors.primary} size={28} />
           <Text style={styles.title}>Unmapped Hazard</Text>
        </View>
        <Text style={styles.subtitle}>Encountered an obstacle not on the map? Use your camera to verify the delay via YOLOv11 computer vision.</Text>
      </View>

      <View style={styles.content}>
        {photoState === 'idle' && (
          <TouchableOpacity activeOpacity={0.8} style={styles.uploadArea} onPress={simulatePhotoUpload}>
            <LinearGradient colors={[colors.surface, colors.backgroundDark]} style={StyleSheet.absoluteFillObject} />
            <View style={styles.cameraIconBox}>
               <Camera color={colors.primary} size={42} />
            </View>
            <Text style={styles.uploadText}>INITIATE ENVIRONMENT SCAN</Text>
            <Text style={styles.uploadSubtext}>Upload photo of the blockade for AI verification</Text>
            
            <View style={styles.corners}>
               <View style={styles.cornerTL} /><View style={styles.cornerTR} />
               <View style={styles.cornerBL} /><View style={styles.cornerBR} />
            </View>
          </TouchableOpacity>
        )}

        {photoState === 'scanning' && (
          <View style={styles.scanArea}>
             <View style={styles.viewfinder}>
                <View style={[styles.cornerTL, { borderColor: colors.primary }]} /><View style={[styles.cornerTR, { borderColor: colors.primary }]} />
                <View style={[styles.cornerBL, { borderColor: colors.primary }]} /><View style={[styles.cornerBR, { borderColor: colors.primary }]} />
                
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                   <ScanLine color={colors.primary} size={64} />
                </Animated.View>

                <Animated.View style={[styles.activeScanLine, { 
                   transform: [{ translateY: scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: [-100, 100] }) }]
                }]} />
             </View>
             
             <Text style={styles.scanningText}>RUNNING YOLOv11 INFERENCE</Text>
             <Text style={styles.scanningSubtext}>Authenticating EXIF Metadata & Geo-Coordinates...</Text>
          </View>
        )}

        {photoState === 'result' && (
          <Animated.ScrollView contentContainerStyle={styles.resultArea} style={{ opacity: fadeAnim }} showsVerticalScrollIndicator={false}>
            <View style={styles.successIconBox}>
              <CheckCircle2 color={colors.success} size={50} strokeWidth={2.5} />
            </View>
            <Text style={styles.resultTitle}>Hazard Authenticated</Text>
            
            <View style={styles.terminalBox}>
               <Text style={styles.terminalHeader}>VISION LOG OUTPUT</Text>
               <View style={styles.terminalLine}><Text style={styles.termLabel}>Entity Recognized:</Text><Text style={styles.termValue}>Fallen Tree / Debris</Text></View>
               <View style={styles.terminalLine}><Text style={styles.termLabel}>Confidence Score:</Text><Text style={styles.termHighlight}>94.2%</Text></View>
               <View style={styles.terminalLine}><Text style={styles.termLabel}>GPS Coordinates:</Text><Text style={styles.termValue}>Match Active Route</Text></View>
               <View style={styles.terminalLine}><Text style={styles.termLabel}>Unique Image Hash:</Text><Text style={styles.termSuccess}>PASSED (No Dupe)</Text></View>
            </View>

            <View style={styles.claimBox}>
              <View style={styles.claimGlow} />
              <AlertTriangle color={colors.warning} size={32} style={{ marginBottom: 15 }} />
              <Text style={styles.claimTitle}>Route Diversion Approved</Text>
              <Text style={styles.claimDesc}>A ₹50 micro-payout has been securely deposited to your Razorpay Wallet to cover the unavoidable detour.</Text>
            </View>

            <TouchableOpacity style={styles.btn} onPress={reset} activeOpacity={0.8}>
               <Text style={styles.btnText}>REPORT ANOTHER HAZARD</Text>
            </TouchableOpacity>
          </Animated.ScrollView>
        )}
      </View>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundDark, paddingTop: 60 },
  header: { paddingHorizontal: 25, marginBottom: 40 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: colors.text, marginLeft: 12, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.textMuted, lineHeight: 22, fontWeight: '500' },
  
  content: { flex: 1, paddingHorizontal: 25 },
  
  uploadArea: { height: 320, borderRadius: 32, borderWidth: 1, borderColor: colors.borderMuted, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  cameraIconBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'hsla(220, 78%, 76%, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  uploadText: { fontSize: 16, color: colors.text, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  uploadSubtext: { fontSize: 13, color: colors.textMuted },
  
  corners: { ...StyleSheet.absoluteFillObject, margin: 20 },
  cornerTL: { position: 'absolute', top: 0, left: 0, width: 30, height: 30, borderTopWidth: 2, borderLeftWidth: 2, borderColor: colors.borderMuted },
  cornerTR: { position: 'absolute', top: 0, right: 0, width: 30, height: 30, borderTopWidth: 2, borderRightWidth: 2, borderColor: colors.borderMuted },
  cornerBL: { position: 'absolute', bottom: 0, left: 0, width: 30, height: 30, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: colors.borderMuted },
  cornerBR: { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderBottomWidth: 2, borderRightWidth: 2, borderColor: colors.borderMuted },

  scanArea: { height: 400, justifyContent: 'center', alignItems: 'center' },
  viewfinder: { width: 200, height: 200, justifyContent: 'center', alignItems: 'center', marginBottom: 40, position: 'relative' },
  activeScanLine: { position: 'absolute', width: '100%', height: 2, backgroundColor: colors.primary, shadowColor: colors.primary, shadowOffset: {width:0, height:0}, shadowOpacity: 1, shadowRadius: 10, elevation: 5 },
  scanningText: { fontSize: 16, color: colors.primary, fontWeight: '900', letterSpacing: 1.5, marginBottom: 10 },
  scanningSubtext: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },

  resultArea: { alignItems: 'center', paddingBottom: 60 },
  successIconBox: { width: 90, height: 90, borderRadius: 45, backgroundColor: 'hsla(146, 17%, 59%, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  resultTitle: { fontSize: 24, color: colors.text, fontWeight: '900', marginBottom: 25, letterSpacing: -0.5 },
  
  terminalBox: { width: '100%', backgroundColor: colors.surface, padding: 25, borderRadius: 24, borderWidth: 1, borderColor: colors.borderMuted, marginBottom: 25 },
  terminalHeader: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 15, borderBottomWidth: 1, borderBottomColor: colors.borderMuted, paddingBottom: 10 },
  terminalLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  termLabel: { color: colors.textMuted, fontSize: 13, fontFamily: 'monospace' },
  termValue: { color: colors.text, fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold' },
  termHighlight: { color: colors.primary, fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold' },
  termSuccess: { color: colors.success, fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold' },

  claimBox: { width: '100%', padding: 30, borderRadius: 28, borderWidth: 1, borderColor: colors.warning, alignItems: 'center', marginBottom: 35, backgroundColor: 'hsla(52, 19%, 57%, 0.05)', overflow: 'hidden' },
  claimGlow: { position: 'absolute', top: -50, width: 100, height: 100, borderRadius: 50, backgroundColor: colors.warning, opacity: 0.1, filter: 'blur(30px)' },
  claimTitle: { color: colors.warning, fontSize: 18, fontWeight: '900', marginBottom: 10, letterSpacing: 0.5 },
  claimDesc: { color: colors.text, textAlign: 'center', fontSize: 14, lineHeight: 22, fontWeight: '500' },

  btn: { backgroundColor: colors.surface, width: '100%', paddingVertical: 20, borderRadius: 20, borderWidth: 1, borderColor: colors.borderMuted, alignItems: 'center' },
  btnText: { color: colors.text, fontWeight: '900', fontSize: 14, letterSpacing: 1.5 }
});
