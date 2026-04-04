import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ShieldCheck, Calendar, FileText, AlertCircle, RefreshCw, Layers } from 'lucide-react-native';
import { useThemeColors } from '../theme/colors';

const { width } = Dimensions.get('window');

export default function PolicyScreen({ userProfile }) {
  const premium = userProfile?.premium || 25;
  const zoneName = userProfile?.zone === 'koramangala' ? 'Koramangala, BLR' : 
                   userProfile?.zone === 'indiranagar' ? 'Indiranagar, BLR' : 
                   userProfile?.zone === 'hsr' ? 'HSR Layout, BLR' : 'Zone Unassigned';

  const colors = useThemeColors();
  const styles = getStyles(colors);

  // Intro Animation
  const slideAnim = useRef(new Animated.Value(50)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 600, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true })
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <LinearGradient colors={[colors.backgroundDark, colors.surface, colors.backgroundDark]} style={StyleSheet.absoluteFillObject} />
      
      {/* Decorative Orbs */}
      <View style={[styles.orb, { top: -60, right: -40, backgroundColor: colors.primaryMuted }]} />
      <View style={[styles.orb, { top: 200, left: -100, backgroundColor: 'hsla(146, 17%, 59%, 0.1)', width: 200, height: 200 }]} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Coverage Policy</Text>
        <View style={styles.renewBtn}>
           <RefreshCw color={colors.primary} size={14} />
           <Text style={styles.renewText}>Auto-Renew ON</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        
        {/* Animated Certificate Card */}
        <Animated.View style={[styles.certificateLayer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
           <LinearGradient colors={[colors.surfaceHighlight, colors.surface]} style={styles.certificate}>
              
              <View style={styles.cardGlow} />
              <View style={styles.certHeader}>
                 <ShieldCheck color={colors.primary} size={36} strokeWidth={2.5} />
                 <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.certStatus}>ACTIVE PROTECTION</Text>
                    <Text style={styles.certId}>#HG-984210</Text>
                 </View>
              </View>
              
              <View style={styles.divider} />
              
              <View style={styles.certRow}>
                 <View>
                    <Text style={styles.certLabel}>Weekly Premium</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                      <Text style={styles.currencySymbol}>₹</Text>
                      <Text style={styles.certValueHigh}>{premium}</Text>
                    </View>
                 </View>
                 <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.certLabel}>Max Weekly Payout</Text>
                    <Text style={styles.certValue}>₹5,000</Text>
                 </View>
              </View>
              
              <View style={styles.certRow}>
                 <View>
                    <Text style={styles.certLabel}>Operating Territory</Text>
                    <Text style={styles.certValueBold}>{zoneName}</Text>
                 </View>
                 <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.certLabel}>Valid Until</Text>
                    <Text style={styles.certValueBold}>24 Mar 2026</Text>
                 </View>
              </View>

              {/* Watermark */}
              <View style={styles.watermark}>
                 <Layers color={colors.primaryMuted} size={120} />
              </View>
           </LinearGradient>
        </Animated.View>

        <Text style={styles.sectionTitle}>Coverage Details & Exclusions</Text>
        <Text style={styles.sectionSubtitle}>Zero-touch claims processed automatically via designated API triggers.</Text>
        
        <View style={styles.grid}>
           {[
             { icon: Calendar, color: colors.info, title: 'Weather Events', desc: 'Severe rain, heatwaves, flooding & AQI drops.' },
             { icon: AlertCircle, color: colors.danger, title: 'Access & Grids', desc: 'Apartment complex delays & road closures.' },
             { icon: RefreshCw, color: colors.warning, title: 'System Outages', desc: 'Cascading power grid & telecom failures.' },
             { icon: FileText, color: colors.success, title: 'Unmapped Hazards', desc: 'Verified social strikes & unmapped obstructions.' }
           ].map((item, index) => (
             <BlurView intensity={colors.isDark ? 20 : 60} tint={colors.isDark ? "dark" : "light"} style={styles.gridItem} key={index}>
                <View style={[styles.iconBox, { backgroundColor: item.color + '20' }]}>
                   <item.icon color={item.color} size={24} />
                </View>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemDesc}>{item.desc}</Text>
             </BlurView>
           ))}
        </View>

        <View style={styles.disclaimerContainer}>
           <AlertCircle color={colors.textMuted} size={16} />
           <Text style={styles.disclaimerText}>Payouts strictly cover explicit loss of income. Vehicle repairs and personal health incidents are explicitly excluded from this policy.</Text>
        </View>

        <TouchableOpacity style={styles.termsBtn} activeOpacity={0.7}>
           <Text style={styles.termsText}>Review Legal Master Policy</Text>
           <FileText color={colors.primary} size={18} />
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundDark, paddingTop: 60 },
  orb: { position: 'absolute', width: 250, height: 250, borderRadius: 125, filter: 'blur(40px)' },
  
  header: { paddingHorizontal: 25, marginBottom: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  renewBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.isDark ? 'hsla(0,0%,100%,0.05)' : 'hsla(0,0%,0%,0.05)', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.borderMuted },
  renewText: { color: colors.primary, fontSize: 13, fontWeight: '800', marginLeft: 8, letterSpacing: 0.5 },
  
  content: { flex: 1, paddingHorizontal: 25 },
  
  certificateLayer: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10, marginBottom: 40 },
  certificate: { borderRadius: 28, padding: 30, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  cardGlow: { position: 'absolute', top: -50, left: -50, width: 150, height: 150, borderRadius: 75, backgroundColor: colors.primaryMuted, opacity: 0.5, filter: 'blur(30px)' },
  
  certHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 25, zIndex: 2 },
  certStatus: { color: colors.primary, fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
  certId: { color: colors.textMuted, fontSize: 14, fontFamily: 'monospace', marginTop: 4, letterSpacing: 1 },
  
  divider: { height: 1, backgroundColor: colors.borderDash, borderStyle: 'dashed', marginVertical: 20, zIndex: 2 },
  borderDash: colors.borderMuted,
  
  certRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, zIndex: 2 },
  certLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 8, letterSpacing: 0.5 },
  certValue: { color: colors.text, fontSize: 18, fontWeight: '600', letterSpacing: 0.5 },
  certValueBold: { color: colors.text, fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  currencySymbol: { color: colors.text, fontSize: 20, fontWeight: '800', marginRight: 4, transform: [{translateY: -5}] },
  certValueHigh: { color: colors.text, fontSize: 36, fontWeight: '900', letterSpacing: -1, lineHeight: 40 },
  
  watermark: { position: 'absolute', right: -20, bottom: -20, opacity: 0.1, zIndex: 0, transform: [{ rotate: '-15deg' }] },

  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '900', marginBottom: 5, letterSpacing: -0.5 },
  sectionSubtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 20 },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginBottom: 30 },
  gridItem: { width: (width - 65) / 2, padding: 20, borderRadius: 24, borderWidth: 1, borderColor: colors.borderMuted, overflow: 'hidden' },
  iconBox: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  itemTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 6 },
  itemDesc: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },

  disclaimerContainer: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: 'hsla(220, 26%, 31%, 0.15)', borderRadius: 12, marginBottom: 25 },
  disclaimerText: { color: colors.textMuted, fontSize: 13, marginLeft: 12, flex: 1, lineHeight: 18 },

  termsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 22, backgroundColor: colors.surfaceHighlight, borderRadius: 20, borderWidth: 1, borderColor: colors.primaryMuted, gap: 12 },
  termsText: { color: colors.primary, fontSize: 15, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }
});
