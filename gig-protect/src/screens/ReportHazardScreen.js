import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import { Camera, UploadCloud, AlertTriangle, ScanLine, CheckCircle2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { colors } from '../theme/colors';

export default function ReportHazardScreen() {
  const [photoState, setPhotoState] = useState('idle'); // idle, scanning, result

  const simulatePhotoUpload = () => {
    setPhotoState('scanning');
    setTimeout(() => {
      setPhotoState('result');
    }, 2500); // 2.5s scan simulation
  };

  const reset = () => setPhotoState('idle');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Report Unmapped Hazard</Text>
        <Text style={styles.subtitle}>Encountered a fallen tree, severe waterlogging, or blocked road not on Maps?</Text>
      </View>

      <View style={styles.content}>
        {photoState === 'idle' && (
          <TouchableOpacity style={styles.uploadArea} onPress={simulatePhotoUpload}>
            <LinearGradient colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']} style={StyleSheet.absoluteFillObject} />
            <Camera color={colors.textMuted} size={48} />
            <Text style={styles.uploadText}>Tap to Scan Environment</Text>
            <Text style={styles.uploadSubtext}>Use camera to capture hazard</Text>
          </TouchableOpacity>
        )}

        {photoState === 'scanning' && (
          <View style={styles.scanArea}>
             <ScanLine color={colors.primary} size={64} style={styles.pulseIcon} />
             <Text style={styles.scanningText}>YOLOv11 Instance Segmentation Running...</Text>
             <Text style={styles.scanningSubtext}>Authenticating EXIF Metadata & Geolocation</Text>
          </View>
        )}

        {photoState === 'result' && (
          <View style={styles.resultArea}>
            <View style={styles.successIcon}>
              <CheckCircle2 color={colors.primary} size={50} />
            </View>
            <Text style={styles.resultTitle}>Hazard Authenticated</Text>
            
            <View style={styles.aiResultBox}>
              <Text style={styles.aiItem}><Text style={{color: colors.primary}}>Detected:</Text> Severe Route Flooding (94% conf)</Text>
              <Text style={styles.aiItem}><Text style={{color: colors.primary}}>Metadata:</Text> GPS matched to active route</Text>
              <Text style={styles.aiItem}><Text style={{color: colors.primary}}>Recycled Image Check:</Text> Passed (Unique Hash)</Text>
            </View>

            <BlurView intensity={20} tint="dark" style={styles.claimBox}>
              <AlertTriangle color={colors.warning} size={24} style={{ marginBottom: 10 }} />
              <Text style={styles.claimTitle}>Route Diversion Approved</Text>
              <Text style={styles.claimDesc}>₹50 Micro-Payout credited for the unavoidable detour and time loss.</Text>
            </BlurView>

            <TouchableOpacity style={styles.btn} onPress={reset}>
               <Text style={styles.btnText}>Submit Another Hazard</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  header: { paddingHorizontal: 20, marginBottom: 30 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 15, color: colors.textMuted, marginTop: 10, lineHeight: 22 },
  content: { flex: 1, paddingHorizontal: 20 },
  
  uploadArea: { height: 250, borderRadius: 20, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  uploadText: { fontSize: 18, color: '#fff', fontWeight: 'bold', marginTop: 20 },
  uploadSubtext: { fontSize: 14, color: colors.textMuted, marginTop: 8 },

  scanArea: { height: 300, justifyContent: 'center', alignItems: 'center' },
  pulseIcon: { marginBottom: 20 },
  scanningText: { fontSize: 16, color: colors.primary, fontWeight: 'bold', marginBottom: 5 },
  scanningSubtext: { fontSize: 13, color: colors.textMuted },

  resultArea: { alignItems: 'center' },
  successIcon: { marginBottom: 15 },
  resultTitle: { fontSize: 22, color: '#fff', fontWeight: 'bold', marginBottom: 20 },
  aiResultBox: { width: '100%', backgroundColor: colors.surfaceHighlight, padding: 15, borderRadius: 12, marginBottom: 20 },
  aiItem: { color: '#fff', fontSize: 14, marginBottom: 8 },

  claimBox: { width: '100%', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: colors.warning, alignItems: 'center', marginBottom: 25 },
  claimTitle: { color: colors.warning, fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  claimDesc: { color: colors.textMuted, textAlign: 'center', fontSize: 14, lineHeight: 20 },

  btn: { backgroundColor: colors.surfaceHighlight, paddingVertical: 15, paddingHorizontal: 30, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
