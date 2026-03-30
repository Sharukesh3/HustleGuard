import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Dimensions, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ShieldAlert, MapPin, Bike, CheckCircle2, Cpu } from 'lucide-react-native';
import { useThemeColors } from '../theme/colors';

const { width, height } = Dimensions.get('window');

export default function OnboardingScreen({ onComplete }) {
  const [step, setStep] = useState(1);
  const [platform, setPlatform] = useState('');
  const [zone, setZone] = useState('');
  const [calculating, setCalculating] = useState(false);
  
  const colors = useThemeColors();
  const styles = getStyles(colors);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true })
    ]).start();
  }, [step]);

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })
      ])
    ).start();
  };

  const platforms = [
    { id: 'zepto', name: 'Zepto', color: colors.primary },
    { id: 'blinkit', name: 'Blinkit', color: colors.warning },
    { id: 'instamart', name: 'Instamart', color: colors.danger }
  ];

  const zones = [
    { id: 'koramangala', name: 'Koramangala, BLR', risk: 'High', factor: 1.2, desc: 'Frequent waterlogging & traffic gridlocks.' },
    { id: 'indiranagar', name: 'Indiranagar, BLR', risk: 'Medium', factor: 1.0, desc: 'Moderate congestion, adequate drainage.' },
    { id: 'hsr', name: 'HSR Layout, BLR', risk: 'Low', factor: 0.8, desc: 'Historical safety, wide roads.' }
  ];

  const handleCalculate = () => {
    setCalculating(true);
    startPulse();
    setTimeout(() => {
      setCalculating(false);
      pulseAnim.stopAnimation();
      setStep(3);
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
    }, 2000);
  };

  const getPremium = () => {
    const selectedZone = zones.find(z => z.id === zone);
    const basePremium = 25; // Base weekly premium in INR
    return selectedZone ? Math.round(basePremium * selectedZone.factor) : basePremium;
  };

  return (
    <View style={styles.container}>
      {/* Dynamic Background */}
      <LinearGradient 
        colors={[colors.backgroundDark, colors.background, colors.backgroundDark]} 
        style={StyleSheet.absoluteFill} 
      />
      <View style={[styles.orb, { top: -100, right: -100, backgroundColor: colors.primaryMuted, opacity: 0.5 }]} />
      <View style={[styles.orb, { bottom: -100, left: -100, backgroundColor: 'hsla(52, 19%, 57%, 0.1)', opacity: 0.5 }]} />
      
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <ShieldAlert color={colors.primary} size={36} strokeWidth={2.5} />
          <Text style={styles.logoText}>HustleGuard</Text>
        </View>
        <Text style={styles.subtitle}>Intelligent Q-Commerce Income Protection</Text>
        
        {/* Progress Dots */}
        <View style={styles.progressContainer}>
           {[1, 2, 3].map(i => (
             <View key={i} style={[styles.dot, step >= i && styles.dotActive]} />
           ))}
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.stepContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          
          {step === 1 && (
            <View>
              <Text style={styles.stepTitle}>Which platform do you ride for?</Text>
              <Text style={styles.stepDesc}>This helps us tailor your coverage based on platform SLA requirements.</Text>
              
              <View style={styles.grid}>
                {platforms.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    activeOpacity={0.8}
                    style={[styles.card, platform === p.id && styles.cardActive]}
                    onPress={() => setPlatform(p.id)}
                  >
                    <View style={[styles.iconWrapper, platform === p.id && { backgroundColor: colors.primaryMuted }]}>
                      <Bike color={platform === p.id ? colors.primary : colors.textMuted} size={28} />
                    </View>
                    <Text style={[styles.cardTitle, platform === p.id && styles.textPrimary]}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.button, !platform && styles.buttonDisabled]}
                disabled={!platform}
                onPress={() => { setStep(2); fadeAnim.setValue(0); slideAnim.setValue(50); }}
              >
                <Text style={styles.buttonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 2 && (
            <View>
              <Text style={styles.stepTitle}>Select your primary grid/zone</Text>
              <Text style={styles.stepDesc}>Our ML engine dynamically adjusts your premium based on hyper-local risk factors and historical delays.</Text>
              
              {zones.map(z => (
                <TouchableOpacity
                  key={z.id}
                  activeOpacity={0.8}
                  style={[styles.zoneCard, zone === z.id && styles.zoneCardActive]}
                  onPress={() => setZone(z.id)}
                >
                  <View style={styles.zoneHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <MapPin color={zone === z.id ? colors.primary : colors.textMuted} size={22} />
                      <Text style={[styles.zoneTitle, zone === z.id && styles.textPrimary]}>{z.name}</Text>
                    </View>
                    <View style={[styles.riskBadge, 
                        z.risk === 'High' ? { backgroundColor: 'hsla(9, 26%, 64%, 0.15)', borderColor: colors.danger } : 
                        z.risk === 'Medium' ? { backgroundColor: 'hsla(52, 19%, 57%, 0.15)', borderColor: colors.warning } : 
                        { backgroundColor: 'hsla(146, 17%, 59%, 0.15)', borderColor: colors.success }
                    ]}>
                      <Text style={[styles.riskText, 
                        z.risk === 'High' ? { color: colors.danger } : 
                        z.risk === 'Medium' ? { color: colors.warning } : 
                        { color: colors.success }
                      ]}>{z.risk} Risk</Text>
                    </View>
                  </View>
                  <Text style={styles.zoneDesc}>{z.desc}</Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={[styles.button, (!zone || calculating) && styles.buttonDisabled, calculating && styles.buttonCalculating]}
                disabled={!zone || calculating}
                onPress={handleCalculate}
              >
                {calculating ? (
                  <View style={styles.calculatingContainer}>
                    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                      <Cpu color={colors.primary} size={24} style={{ marginRight: 10 }} />
                    </Animated.View>
                    <Text style={[styles.buttonText, { color: colors.primary }]}>AI Analyzing Risk Vectors...</Text>
                  </View>
                ) : (
                  <Text style={styles.buttonText}>Calculate Dynamic Premium</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {step === 3 && (
            <View style={styles.successContainer}>
              <View style={styles.successIconWrapper}>
                <CheckCircle2 color={colors.success} size={70} strokeWidth={2} />
              </View>
              <Text style={styles.stepTitle}>Your Coverage is Ready</Text>
              
              <View style={styles.premiumBox}>
                <LinearGradient colors={[colors.surfaceHighlight, colors.surface]} style={StyleSheet.absoluteFillObject} />
                <Text style={styles.planLabel}>WEEKLY PROTECTION PLAN</Text>
                <View style={styles.priceContainer}>
                  <Text style={styles.currency}>₹</Text>
                  <Text style={styles.premiumAmount}>{getPremium()}</Text>
                </View>
                
                <View style={styles.aiInsightBox}>
                  <Cpu color={colors.primary} size={16} />
                  <Text style={styles.aiInsightText}>
                    <Text style={{fontWeight: 'bold'}}>AI Pricing Insight: </Text>
                    {zone === 'hsr' ? 'Premium discounted due to safe zone history.' : 'Pricing adjusted for active monsoon risks in your zone.'}
                  </Text>
                </View>
              </View>

              <View style={styles.coverageList}>
                <Text style={styles.coverageHeader}>Included Zero-Touch Claims:</Text>
                <View style={styles.coverageItemRow}><CheckCircle2 color={colors.primary} size={18}/><Text style={styles.coverageItemText}>Severe Weather & Waterlogging (API Triggered)</Text></View>
                <View style={styles.coverageItemRow}><CheckCircle2 color={colors.primary} size={18}/><Text style={styles.coverageItemText}>Apartment & Gateway Delays</Text></View>
                <View style={styles.coverageItemRow}><CheckCircle2 color={colors.primary} size={18}/><Text style={styles.coverageItemText}>System Outages & Unmapped Hazards</Text></View>
              </View>

              <TouchableOpacity
                style={[styles.button, { marginTop: 10 }]}
                onPress={() => onComplete({ platform, zone, premium: getPremium() })}
              >
                <Text style={styles.buttonText}>Subscribe & Start Shift</Text>
              </TouchableOpacity>
              <Text style={styles.fineprint}>By subscribing, ₹{getPremium()} will be deducted from your payout weekly.</Text>
            </View>
          )}

        </Animated.View>
      </ScrollView>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundDark },
  orb: { position: 'absolute', width: width, height: width, borderRadius: width / 2, filter: 'blur(50px)' },
  
  header: { paddingHorizontal: 25, paddingTop: 70, paddingBottom: 20 },
  logoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  logoText: { color: colors.text, fontSize: 30, fontWeight: '900', marginLeft: 12, letterSpacing: -0.5 },
  subtitle: { color: colors.textMuted, fontSize: 15, fontWeight: '500', lineHeight: 22 },
  
  progressContainer: { flexDirection: 'row', gap: 8, marginTop: 25 },
  dot: { height: 4, width: 25, borderRadius: 2, backgroundColor: colors.borderMuted },
  dotActive: { backgroundColor: colors.primary, width: 40 },

  content: { flex: 1, paddingHorizontal: 25 },
  stepContainer: { flex: 1, paddingTop: 15 },
  
  stepTitle: { color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: 8, letterSpacing: -0.5 },
  stepDesc: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginBottom: 30 },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 15, marginBottom: 20 },
  card: { width: '100%', flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  cardActive: { borderColor: colors.primary, backgroundColor: colors.surfaceHighlight },
  iconWrapper: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.surfaceHighlight, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  textPrimary: { color: colors.primary },

  zoneCard: { backgroundColor: colors.surface, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
  zoneCardActive: { borderColor: colors.primary, backgroundColor: colors.surfaceHighlight },
  zoneHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  zoneTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginLeft: 10 },
  riskBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  riskText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  zoneDesc: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginLeft: 32 },
  
  button: { backgroundColor: colors.primary, paddingVertical: 18, borderRadius: 16, alignItems: 'center', marginTop: 30, shadowColor: colors.primary, shadowOffset: {width:0, height:4}, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  buttonCalculating: { backgroundColor: colors.surfaceHighlight, shadowOpacity: 0, borderWidth: 1, borderColor: colors.primary },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.backgroundDark, fontSize: 17, fontWeight: '800' },
  calculatingContainer: { flexDirection: 'row', alignItems: 'center' },

  successContainer: { alignItems: 'center', paddingTop: 10 },
  successIconWrapper: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'hsla(146, 17%, 59%, 0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  
  premiumBox: { width: '100%', borderRadius: 24, padding: 25, marginTop: 25, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', alignItems: 'center' },
  planLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginBottom: 15 },
  priceContainer: { flexDirection: 'row', alignItems: 'flex-start' },
  currency: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: 5, marginRight: 4 },
  premiumAmount: { color: colors.text, fontSize: 56, fontWeight: '900', letterSpacing: -2 },
  aiInsightBox: { flexDirection: 'row', backgroundColor: 'hsla(220, 78%, 76%, 0.1)', padding: 12, borderRadius: 12, marginTop: 20, width: '100%', alignItems: 'center' },
  aiInsightText: { color: colors.primary, fontSize: 13, marginLeft: 10, flex: 1, lineHeight: 18 },

  coverageList: { width: '100%', marginTop: 30, marginBottom: 10 },
  coverageHeader: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 15 },
  coverageItemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, paddingHorizontal: 10 },
  coverageItemText: { color: colors.textMuted, fontSize: 15, marginLeft: 15, fontWeight: '500' },
  
  fineprint: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 20 }
});
