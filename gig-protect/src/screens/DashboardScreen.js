import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Easing, Dimensions, Switch, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { CloudRain, WifiOff, Navigation, IndianRupee, ShieldCheck, AlertTriangle, Car, Zap, Building, Lock, Moon, Sun, Map } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useTheme } from '../theme/ThemeContext';
import { MapView, Marker, Polyline } from '../components/NativeMap';
import { darkMapStyle } from '../theme/mapStyles';

const { width } = Dimensions.get('window');

export default function DashboardScreen({ userProfile }) {
  const [activeHazard, setActiveHazard] = useState(null); 
  const [claimStatus, setClaimStatus] = useState(null); 
  const [autoClaimReason, setAutoClaimReason] = useState(null); // Traces auto reason from backend
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSimulatedRoute, setShowSimulatedRoute] = useState(false);
  const [deviceHeading, setDeviceHeading] = useState(0);
  
  const { colors, theme, toggleTheme } = useTheme();
  const styles = getStyles(colors);

  // Animations
  const mapPulseAnim = useRef(new Animated.Value(0)).current;
  const overlaySlideAnim = useRef(new Animated.Value(width)).current;
  const overlayScaleAnim = useRef(new Animated.Value(0.9)).current;
  const overlayOpacityAnim = useRef(new Animated.Value(0)).current;
  const panelHeightAnim = useRef(new Animated.Value(0)).current;

  const togglePanel = () => {
    const toValue = isExpanded ? 0 : 1;
    Animated.timing(panelHeightAnim, {
      toValue,
      duration: 300,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();
    setIsExpanded(!isExpanded);
  };

  useEffect(() => {
    let ws;
    if (userProfile && userProfile?.user?.id) {
       const host = Platform.OS === 'web' ? 'localhost:8000' : '192.168.1.110:8000';
       ws = new WebSocket(`ws://${host}/ws/telemetry/${userProfile.user.id}?token=${userProfile.user.token}`);
       
       ws.onopen = () => {
          console.log("Telemetry WS Connected to Central System!");
          ws.send(JSON.stringify({
             lat: userProfile.locationObj?.coords?.latitude || 12.9716,
             lng: userProfile.locationObj?.coords?.longitude || 77.5946,
             city: userProfile.zone?.split(",")[0] || 'Bangalore'
          }));
       };
       
       ws.onmessage = (e) => {
          try {
             const packet = JSON.parse(e.data);
             if (packet.type === 'auto_payout') {
                console.log("Received AI Auto Trigger!", packet.reason);
                triggerHazard(packet.hazard, packet.reason);
             }
          } catch(err) { console.error("WS Parse Err", err); }
       };
    }
    
    Animated.loop(
      Animated.timing(mapPulseAnim, {
        toValue: 1,
        duration: 2500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    ).start();

    let subscription;
    (async () => {
      if (Platform.OS !== 'web') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          subscription = await Location.watchHeadingAsync((headingInfo) => {
            setDeviceHeading(Math.round(headingInfo.magHeading || headingInfo.trueHeading || 0));
          });
        }
      }
    })();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  const triggerHazard = async (type, overrideReason = null) => {
    setActiveHazard(type);
    setAutoClaimReason(overrideReason);
    
    // Slide in Processing Overlay
    setClaimStatus('processing');
    Animated.parallel([
      Animated.timing(overlaySlideAnim, { toValue: 0, duration: 400, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
      Animated.timing(overlayScaleAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
      Animated.timing(overlayOpacityAnim, { toValue: 1, duration: 300, useNativeDriver: true })
    ]).start();

    // Determine payout amount
    let payoutAmount = 50; 
    if(type === 'waterlogging') payoutAmount = 75;
    if(type === 'accident') payoutAmount = 150;

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
            amount: payoutAmount,
            hazard_type: type,
            reason: overrideReason || `Reported ${type} hazard during shift`
          })
        });
      }
    } catch (err) {
      console.error("Manual transaction failed", err);
    }

    // Simulate API Auth & Payout
    setTimeout(() => {
      setClaimStatus('approved');
    }, 3000);
  };

  const resetClaim = () => {
    Animated.parallel([
      Animated.timing(overlaySlideAnim, { toValue: width, duration: 300, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(overlayOpacityAnim, { toValue: 0, duration: 300, useNativeDriver: true })
    ]).start(() => {
      setClaimStatus(null);
      setActiveHazard(null);
      setAutoClaimReason(null);
      overlayScaleAnim.setValue(0.9);
    });
  };

  const getHazardConfig = () => {
    switch(activeHazard) {
      case 'rain': return { color: colors.info, icon: CloudRain, title: 'Severe Waterlogging', API: 'IMD Weather API' };
      case 'network': return { color: colors.danger, icon: WifiOff, title: 'Carrier Outage', API: 'Telecom Ping API' };
      case 'traffic': return { color: colors.warning, icon: Car, title: 'Gridlock / Accident', API: 'TomTom Traffic API' };
      case 'gate': return { color: '#A855F7', icon: Building, title: 'Gate Approval Delay', API: 'MyGate Integration' };
      case 'power': return { color: '#F97316', icon: Zap, title: 'Power Grid Failure', API: 'State Power Board API' };
      default: return { color: colors.primary, icon: Navigation, title: 'Telemetry Active', API: 'Device GPS' };
    }
  };

  const activeConfig = getHazardConfig();

  const baseLat = userProfile?.locationObj?.coords?.latitude || 12.9352;
  const baseLng = userProfile?.locationObj?.coords?.longitude || 77.6245;

  const simulatedRoute = [
    { latitude: baseLat, longitude: baseLng },
    { latitude: baseLat + 0.0008, longitude: baseLng - 0.0005 },
    { latitude: baseLat + 0.0020, longitude: baseLng + 0.0010 },
    { latitude: baseLat + 0.0033, longitude: baseLng + 0.0023 },
  ];

  return (
    <View style={styles.container}>
      {/* Dynamic Radar Map */}
      <Animated.View style={[styles.mapContainer, { 
        transform: [{ translateY: panelHeightAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -80] }) }] 
      }]}>
        {Platform.OS !== 'web' ? (
          <MapView 
            style={StyleSheet.absoluteFillObject}
            initialRegion={{
              latitude: showSimulatedRoute ? simulatedRoute[1].latitude : baseLat,
              longitude: showSimulatedRoute ? simulatedRoute[1].longitude : baseLng,
              latitudeDelta: 0.015,
              longitudeDelta: 0.0121,
            }}
            userInterfaceStyle={colors.isDark ? "dark" : "light"}
            customMapStyle={colors.isDark ? darkMapStyle : []}
          >
            {showSimulatedRoute ? (
               <Polyline coordinates={simulatedRoute} strokeColor={colors.primary} strokeWidth={4} />
            ) : null}
            <Marker 
               coordinate={{
                 latitude: showSimulatedRoute ? simulatedRoute[1].latitude : baseLat,
                 longitude: showSimulatedRoute ? simulatedRoute[1].longitude : baseLng
               }}
               rotation={deviceHeading}
            />
          </MapView>
        ) : (
            <View style={StyleSheet.absoluteFillObject}>
              <iframe 
                width="100%" 
                height="100%" 
                frameBorder="0" 
                style={{ border: 0, filter: colors.isDark ? 'invert(90%) hue-rotate(180deg)' : 'none' }} 
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${baseLng - 0.01},${baseLat - 0.015},${baseLng + 0.01},${baseLat + 0.015}&layer=mapnik&marker=${showSimulatedRoute ? simulatedRoute[1].latitude : baseLat},${showSimulatedRoute ? simulatedRoute[1].longitude : baseLng}`}
            />
          </View>
        )}
        
        {/* Radar Rings overlays mapped marker */}
        <View style={styles.radarCenter} pointerEvents="none">
           <Animated.View style={[styles.radarRing, { 
              borderColor: activeHazard ? activeConfig.color : colors.primaryMuted,
              transform: [{ scale: mapPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 3] }) }],
              opacity: mapPulseAnim.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0.8, 0, 0] })
           }]} />
           <Animated.View style={[styles.radarRing, { 
              borderColor: activeHazard ? activeConfig.color : colors.primaryMuted,
              transform: [{ scale: mapPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 2] }) }],
              opacity: mapPulseAnim.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 0, 0] })
           }]} />
        </View>

        {/* HUD Overlay */}
        <View style={styles.hudTop}>
           <View style={styles.hudBadge}>
             <ShieldCheck color={colors.primary} size={14} />
             <Text style={styles.hudText}>{userProfile?.zone?.toUpperCase() || 'KORAMANGALA'} SECURED</Text>
           </View>
           <TouchableOpacity onPress={() => setShowSimulatedRoute(!showSimulatedRoute)} style={[styles.hudBadge, { marginLeft: 10, paddingHorizontal: 10 }]}>
             <Map color={showSimulatedRoute ? colors.primary : colors.text} size={16} />
           </TouchableOpacity>
           <TouchableOpacity onPress={toggleTheme} style={[styles.hudBadge, { marginLeft: 10, paddingHorizontal: 10 }]}>
             {colors.isDark ? <Sun color={colors.text} size={16} /> : <Moon color={colors.text} size={16} />}
           </TouchableOpacity>
        </View>
        
        {activeHazard && (
          <View style={[styles.targetLock, { borderColor: activeConfig.color }]}>
             <View style={styles.cornerTL} /><View style={styles.cornerTR} />
             <View style={styles.cornerBL} /><View style={styles.cornerBR} />
             <View style={[styles.scanLine, { backgroundColor: activeConfig.color }]} />
             <Text style={[styles.targetText, { color: activeConfig.color }]}>DETECTED</Text>
          </View>
        )}
      </Animated.View>

      {/* Main Content Area */}
      <Animated.View style={[styles.sheetContainer, { height: panelHeightAnim.interpolate({ inputRange: [0, 1], outputRange: ['40%', '65%'] }) }]}>
        <BlurView intensity={colors.isDark ? 30 : 70} tint={colors.isDark ? "dark" : "light"} style={styles.glassSheet}>
          <TouchableOpacity activeOpacity={0.8} onPress={togglePanel} style={{ paddingVertical: 10, marginBottom: 15 }}>
            <View style={styles.dragHandle} />
          </TouchableOpacity>
          
          <ScrollView 
            scrollEnabled={!isExpanded}
            contentContainerStyle={{ paddingBottom: isExpanded ? 20 : 100 }} 
            showsVerticalScrollIndicator={false}
          >
            {/* Real-time Earnings Strip */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Shift Earnings</Text>
                <Text style={styles.statValue}>₹1,240</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Active Time</Text>
                <Text style={[styles.statValue, activeHazard && { color: colors.warning }]}>
                  {activeHazard ? 'Delayed' : '4h 12m'}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Claims Used</Text>
                <Text style={styles.statValue}>1/5</Text>
              </View>
            </View>

            {/* Diagnostic Triggers Panel */}
            <View style={styles.diagnosticPanel}>
               <View style={styles.diagnosticHeader}>
                 <Text style={styles.diagnosticTitle}>DEV MODE: API SIMULATION TRIGGERS</Text>
                 <Lock color={colors.textMuted} size={14} />
               </View>
               <Text style={styles.diagnosticDesc}>Inject mock payloads to test the Zero-Touch Claims Engine.</Text>
               
               <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.triggerGrid}>
                  {[
                    { type: 'rain', icon: CloudRain, color: colors.info, label: 'IMD Rain API' },
                    { type: 'network', icon: WifiOff, color: colors.danger, label: 'Ping Loss' },
                    { type: 'traffic', icon: Car, color: colors.warning, label: 'TomTom Gridlock' },
                    { type: 'gate', icon: Building, color: '#A855F7', label: 'MyGate Delay' },
                    { type: 'power', icon: Zap, color: '#F97316', label: 'Power Grid' },
                  ].map((btn) => (
                    <TouchableOpacity 
                      key={btn.type}
                      style={[styles.triggerBtn, { borderColor: btn.color, backgroundColor: activeHazard === btn.type ? 'hsla(0,0%,100%,0.05)' : colors.surface }]}
                      onPress={() => triggerHazard(btn.type)}
                      disabled={!!activeHazard}
                      activeOpacity={0.7}
                    >
                      <btn.icon color={btn.color} size={24} />
                      <Text style={[styles.triggerLabel, { color: btn.color }]}>{btn.label}</Text>
                    </TouchableOpacity>
                  ))}
               </ScrollView>
            </View>
          </ScrollView>
        </BlurView>
      </Animated.View>

      {/* Claim Processing Overlay */}
      {claimStatus && (
        <Animated.View style={[styles.claimOverlay, { opacity: overlayOpacityAnim }]}>
          <BlurView intensity={colors.isDark ? 40 : 80} tint={colors.isDark ? "dark" : "light"} style={StyleSheet.absoluteFillObject} />
          
          <Animated.View style={[styles.claimBoxWrapper, { 
              transform: [{ translateY: overlaySlideAnim }, { scale: overlayScaleAnim }] 
          }]}>
            <LinearGradient 
              colors={claimStatus === 'processing' ? [colors.surfaceHighlight, colors.surface] : [colors.surfaceHighlight, colors.surfaceHighlight]} 
              style={styles.claimBox}
            >
              {claimStatus === 'processing' ? (
                <>
                  <View style={styles.processingIconBox}>
                    <ShieldCheck color={colors.primary} size={50} />
                  </View>
                  <Text style={styles.claimTitle}>AI Analysing {activeConfig.API}</Text>
                    {autoClaimReason ? (
                       <View style={styles.verifyingList}>
                         <Text style={{color: colors.primary, fontWeight: '700', marginBottom: 10, fontSize: 16}}>System Alert:</Text>
                         <Text style={{color: colors.text}}>{autoClaimReason}</Text>
                       </View>
                    ) : (
                       <View style={styles.verifyingList}>
                         <Text style={styles.verifyingItem}>• Fetching latest endpoint data...</Text>
                         <Text style={styles.verifyingItem}>• Triangulating GPS coordinates...</Text>
                         <Text style={styles.verifyingItem}>• Matching policy bounds...</Text>
                       </View>
                    )}
                  <Text style={styles.processingWait}>Please wait, verifying parameters.</Text>
                </>
              ) : (
                <>
                  <View style={[styles.processingIconBox, { backgroundColor: 'hsla(146, 17%, 59%, 0.1)' }]}>
                    <IndianRupee color={colors.success} size={50} />
                  </View>
                  <Text style={[styles.claimTitle, { color: colors.text }]}>Zero-Touch Payout Issued</Text>
                  
                  <View style={styles.receiptBox}>
                    <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Event:</Text><Text style={[styles.receiptValue, { color: activeConfig.color }]}>{activeConfig.title}</Text></View>
                    <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Validation:</Text><Text style={styles.receiptValue}>{activeConfig.API}</Text></View>
                    <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Disbursal:</Text><Text style={styles.receiptValue}>Instant Razorpay</Text></View>
                    <View style={[styles.receiptRow, styles.receiptTotalRow]}>
                       <Text style={styles.receiptTotalLabel}>Amount Credited:</Text>
                       <Text style={styles.receiptTotalAmount}>₹50</Text>
                    </View>
                  </View>

                  <TouchableOpacity style={styles.dismissBtn} onPress={resetClaim}>
                    <Text style={styles.dismissText}>Acknowledge & Resume Shift</Text>
                  </TouchableOpacity>
                </>
              )}
            </LinearGradient>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundDark },
  mapContainer: { flex: 1, height: '60%', justifyContent: 'center', alignItems: 'center', backgroundColor: colors.backgroundDark, position: 'relative' },
  
  radarCenter: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
  radarRing: { position: 'absolute', width: 250, height: 250, borderRadius: 125, borderWidth: 1 },
  
  hudTop: { position: 'absolute', top: 60, left: 20, flexDirection: 'row', alignItems: 'center' },
  hudBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'hsla(220, 78%, 76%, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.primaryMuted },
  hudText: { color: colors.primary, fontSize: 11, fontWeight: '800', marginLeft: 6, letterSpacing: 1 },

  markerContainer: { width: 120, height: 120, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  marker: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', borderWidth: 2, zIndex: 10 },
  
  targetLock: { position: 'absolute', width: 200, height: 200, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  cornerTL: { position: 'absolute', top: -5, left: -5, width: 20, height: 20, borderTopWidth: 3, borderLeftWidth: 3, borderColor: 'inherit' },
  cornerTR: { position: 'absolute', top: -5, right: -5, width: 20, height: 20, borderTopWidth: 3, borderRightWidth: 3, borderColor: 'inherit' },
  cornerBL: { position: 'absolute', bottom: -5, left: -5, width: 20, height: 20, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: 'inherit' },
  cornerBR: { position: 'absolute', bottom: -5, right: -5, width: 20, height: 20, borderBottomWidth: 3, borderRightWidth: 3, borderColor: 'inherit' },
  scanLine: { position: 'absolute', width: '100%', height: 2, opacity: 0.5 },
  targetText: { position: 'absolute', bottom: -30, fontSize: 14, fontWeight: '900', letterSpacing: 2 },

  sheetContainer: { position: 'absolute', bottom: 0, width: '100%', height: '40%' },
  glassSheet: { flex: 1, borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 25, borderWidth: 1, borderColor: colors.isDark ? 'hsla(0,0%,100%,0.05)' : 'hsla(0,0%,0%,0.05)' },
  dragHandle: { width: 40, height: 5, backgroundColor: colors.borderMuted, borderRadius: 3, alignSelf: 'center' },
  
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surfaceHighlight, padding: 20, borderRadius: 24, borderWidth: 1, borderColor: colors.border, marginBottom: 30 },
  statBox: { flex: 1, alignItems: 'center' },
  divider: { width: 1, backgroundColor: colors.border, marginHorizontal: 10 },
  statLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 },
  statValue: { color: colors.text, fontSize: 22, fontWeight: '900' },

  diagnosticPanel: { padding: 10 },
  diagnosticHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  diagnosticTitle: { color: colors.textMuted, fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  diagnosticDesc: { color: colors.textMuted, fontSize: 13, lineHeight: 20, marginBottom: 20 },
  
  triggerGrid: { flexDirection: 'row', gap: 12, paddingRight: 20, marginBottom: 15 },
  triggerBtn: { width: 120, padding: 15, borderRadius: 20, borderWidth: 1, alignItems: 'center' },
  triggerLabel: { fontSize: 12, fontWeight: '800', marginTop: 10, textAlign: 'center' },
  
  triggerBtnFull: { width: '100%', flexDirection: 'row', padding: 18, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  claimOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  claimBoxWrapper: { width: '90%', alignItems: 'center' },
  claimBox: { width: '100%', padding: 35, borderRadius: 30, alignItems: 'center', borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  processingIconBox: { width: 90, height: 90, borderRadius: 45, backgroundColor: colors.primaryMuted, justifyContent: 'center', alignItems: 'center', marginBottom: 25 },
  claimTitle: { color: colors.text, fontSize: 24, fontWeight: '900', marginBottom: 20, textAlign: 'center', letterSpacing: -0.5 },
  verifyingList: { width: '100%', backgroundColor: colors.backgroundDark, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  verifyingItem: { color: colors.textMuted, fontSize: 14, fontFamily: 'monospace', marginBottom: 10 },
  processingWait: { color: colors.textMuted, marginTop: 20, fontSize: 14, fontWeight: '600' },

  receiptBox: { width: '100%', backgroundColor: colors.backgroundDark, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: colors.border, marginTop: 10, marginBottom: 30 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  receiptLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  receiptValue: { color: colors.text, fontSize: 14, fontWeight: '800' },
  receiptTotalRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 5, borderStyle: 'dashed' },
  receiptTotalLabel: { color: colors.text, fontSize: 16, fontWeight: '800' },
  receiptTotalAmount: { color: colors.success, fontSize: 24, fontWeight: '900' },

  dismissBtn: { backgroundColor: colors.surfaceHighlight, width: '100%', paddingVertical: 18, borderRadius: 16, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  dismissText: { color: colors.text, fontSize: 16, fontWeight: '800' }
});
