import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Dimensions, Easing, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ShieldAlert, MapPin, Bike, CheckCircle2, XCircle, Cpu, Phone, KeyRound, Link, Activity } from 'lucide-react-native';
import * as Location from 'expo-location';
import { useThemeColors } from '../theme/colors';

const { width, height } = Dimensions.get('window');

export default function OnboardingScreen({ onComplete }) {
  const [step, setStep] = useState(1);
  
  // Auth state
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState('');
  
  // Onboarding state
  const [platform, setPlatform] = useState('');
  const [zone, setZone] = useState('');
  const [locationObj, setLocationObj] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [mockUserData, setMockUserData] = useState(null);

  const [connecting, setConnecting] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [otpError, setOtpError] = useState('');
  
  const colors = useThemeColors();
  const styles = getStyles(colors);

  // Search Debounce timeout
  const searchTimeout = useRef(null);

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
    { id: 'zepto', name: 'Zepto Partner', color: colors.primary },
    { id: 'blinkit', name: 'Blinkit Delivery', color: colors.warning },
    { id: 'instamart', name: 'Swiggy Instamart', color: colors.danger }
  ];

  const handleNextStep = (nextStep) => {
    fadeAnim.setValue(0);
    slideAnim.setValue(50);
    setStep(nextStep);
  };

  const handleSendOtp = async () => {
    try {
      const fullNumber = `+91${mobileNumber}`;
      console.log(`Sending Real OTP request to backend for ${fullNumber}`);
      
      const response = await fetch('http://192.168.1.110:8000/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullNumber })
      });
      const data = await response.json();
      
      // Auto-fetch location in background while OTP is sent
      fetchLocation();

      handleNextStep(2);

      if (data.fallback_otp) {
        // Ensure it's treated as a string for the length-checks to work correctly
        setTimeout(() => setOtp(String(data.fallback_otp)), 600);
      }
    } catch (error) {
      console.error("Failed to send OTP:", error);
    }
  };

  const fetchLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        "Location Required",
        "HustleGuard requires your location to determine your operating zone and verify zero-touch claims.",
        [{ text: "OK" }]
      );
      setZone("Bengaluru, IN"); // fallback
      return;
    }
    let location = await Location.getCurrentPositionAsync({});
    setLocationObj(location);
    
    try {
      if (Platform.OS === 'web') {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.coords.latitude}&lon=${location.coords.longitude}&zoom=10&addressdetails=1`, {
          headers: {
            'User-Agent': 'HustleGuard/1.0',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        });
        const data = await response.json();
        if (data && data.address) {
           const addr = data.address;
           const locationName = `${addr.city || addr.town || addr.county || addr.suburb || data.name}, ${addr.state || addr.country}`;
           setZone(locationName);
        } else {
           setZone("Unknown Location");
        }
      } else {
        let geo = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });
        if (geo && geo.length > 0) {
          const place = geo[0];
          const locationName = `${place.subregion || place.city || place.district}, ${place.region || place.country}`;
          setZone(locationName);
        } else {
          setZone("Unknown Location");
        }
      }
    } catch(e) {
      setZone("Auto-detect failed");
    }
  };

  const handleLocationSearch = (text) => {
    setZone(text);
    
    // Clear existing timeout
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    
    if (text.length > 3) {
      // Set new timeout to prevent 429 Too Many Requests
      searchTimeout.current = setTimeout(async () => {
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&addressdetails=1&limit=5`, {
            headers: {
              'User-Agent': 'HustleGuard/1.0',
              'Accept-Language': 'en-US,en;q=0.9'
            }
          });
          const data = await response.json();
          setSearchResults(data);
        } catch (err) {
          console.log("Search error", err);
        }
      }, 800); // 800ms debounce
    } else {
      setSearchResults([]);
    }
  };

  const selectSuggestedLocation = (loc) => {
    setZone(loc.display_name);
    setSearchResults([]);
    setLocationObj({
      coords: { 
        latitude: parseFloat(loc.lat), 
        longitude: parseFloat(loc.lon) 
      }
    });
  };

  const attemptVerifyOtp = async (inputOtp) => {
    setOtpError('');
    if (inputOtp.length !== 4) return;
    
    try {
      const fullNumber = `+91${mobileNumber}`;
      console.log(`Verifying OTP ${inputOtp} for ${fullNumber}`);
      
      let authUrl = Platform.OS==='web'?'http://localhost:8000/auth/verify-otp':'http://192.168.1.110:8000/auth/verify-otp'; const res = await fetch(authUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullNumber, otp: inputOtp })
      });
      
      if (res.ok) { const authData = await res.json(); setMockUserData({ token: authData.token, user: authData.user });
        handleNextStep(3);
      } else {
        const errorData = await res.json();
        setOtpError(errorData.detail || 'Invalid OTP. Please check the SMS and try again.');
        setOtp('');
      }
    } catch (err) {
      console.error(err);
      setOtpError('Network error. Is the backend server running?');
      setOtp('');
    }
  };

  // Auto-verify OTP when 4 digits entered
  useEffect(() => {
    if (otp.length === 4) {
      attemptVerifyOtp(otp);
    }
  }, [otp]);
  
  const handleConnect = (pId) => {
    setPlatform(pId);
    setConnecting(true);
    startPulse();
    
    // Simulate API fetch delay
    setTimeout(() => {
      setConnecting(false);
      pulseAnim.stopAnimation();
      
      // Mock data returned from simulated SSO
        setMockUserData(prev => ({
          ...prev,
          name: prev?.user?.name || "Rahul K.",
          id: prev?.user?.phone || "RIDER-99824",
          city: "Bengaluru",
          avgEarnings: "4,250",
          riskProfile: "Night owl, 2-Wheeler"
        }));
      setZone(prev => prev || "Koramangala, BLR"); 
      
      handleNextStep(4);
    }, 2000);
  };

  const handleCalculate = async () => {
    setCalculating(true);
    startPulse();
    
    let skipNext = false;
    try {
        const host = Platform.OS === 'web' ? 'localhost:8000' : '192.168.1.110:8000';
        
        // First check if the user has already paid the premium to save API calls
        let alreadyPaidAmount = null;
        if (mockUserData?.token) {
          try {
            const walletRes = await fetch(`http://${host}/wallet`, {
              headers: { 'Authorization': `Bearer ${mockUserData.token}` }
            });
            if (walletRes.ok) {
              const walletData = await walletRes.json();
              const premiumTx = walletData.history?.find(tx => tx.hazard_type === 'premium');
              if (premiumTx && premiumTx.amount < 0) {
                alreadyPaidAmount = Math.abs(premiumTx.amount);
              }
            }
          } catch (e) {
            console.log("Could not check wallet for previous premium:", e);
          }
        }

        if (alreadyPaidAmount) {
          console.log("User already has an active premium subscription. Skipping recalculation.");
          skipNext = true;
          const updatedUser = {
            ...mockUserData,
            premium: alreadyPaidAmount,
            basePremium: alreadyPaidAmount,
            profileInsight: "Active premium subscription detected. Pricing locked for the current cycle."
          };
          setMockUserData(updatedUser);
          
          setCalculating(false);
          pulseAnim.stopAnimation();
          onComplete({ platform, zone, premium: alreadyPaidAmount, user: updatedUser, locationObj, profileInsight: updatedUser.profileInsight });
          return;
        } else {
          // Call the real backend API for pricing logic if not paid
          const destLat = locationObj?.coords?.latitude + 0.05 || 12.9260; // Mock a nearby destination to get traffic
          const destLon = locationObj?.coords?.longitude + 0.05 || 77.6229;
          const apiLat = locationObj?.coords?.latitude || 12.9716;
          const apiLon = locationObj?.coords?.longitude || 77.5946;
          const currentCity = zone.split(",")[0] || "Bangalore";
          
          let apiUrl = `http://${host}/premium/calculate?lat=${apiLat}&lng=${apiLon}&city=${currentCity}&dest_lat=${destLat}&dest_lon=${destLon}`;
          
          console.log("Fetching real premium from:", apiUrl);
          const res = await fetch(apiUrl, {
              headers: {
                  'Authorization': `Bearer ${mockUserData.token}`
              }
          });
          if (!res.ok) throw new Error("API failed");
          const data = await res.json();
          
          // Merge the ML API pricing insights securely to the user profile
          setMockUserData(prev => ({
             ...prev,
             premium: data.final_premium,
             basePremium: data.base_premium,
             profileInsight: data.overall_reason,
             pricingFactors: data.factors
          }));
        }
    } catch (e) {
        console.error("Premium Calc Error fallback:", e);
        // Fallback simulated logic if server isn't reachable
        const factor = zone ? (1 + (zone.length % 5) * 0.1) : 1; 
        const basePremium = 25; 
        setMockUserData(prev => ({
           ...prev,
           premium: Math.round(basePremium * factor),
           profileInsight: "Premium adjusted based on localized geographical risks and standard traffic models."
        }));
    } finally {
          if (!skipNext) {
            setCalculating(false);
            pulseAnim.stopAnimation();
            handleNextStep(5);
          }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      {/* Dynamic Background */}
      <LinearGradient 
        colors={[colors.backgroundDark, colors.background, colors.backgroundDark]} 
        style={StyleSheet.absoluteFill} 
      />
      <View style={[styles.orb, { top: -100, right: -100, backgroundColor: colors.primaryMuted, opacity: 0.5 }]} />
      <View style={[styles.orb, { bottom: -100, left: -100, backgroundColor: 'hsla(52, 19%, 57%, 0.1)', opacity: 0.5 }]} />

      <View style={styles.contentWrapper}>

      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <ShieldAlert color={colors.primary} size={36} strokeWidth={2.5} />
          <Text style={styles.logoText}>HustleGuard</Text>
        </View>
        <Text style={styles.subtitle}>Intelligent Q-Commerce Income Protection</Text>
        
        {/* Progress Dots */}
        <View style={styles.progressContainer}>
           {[1, 2, 3, 4, 5].map(i => (
             <View key={i} style={[styles.dot, step >= i && styles.dotActive]} />
           ))}
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.stepContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          
          {/* STEP 1: MOBILE NUMBER ENTRY */}
          {step === 1 && (
            <View>
              <Text style={styles.stepTitle}>Let's get you protected.</Text>
              <Text style={styles.stepDesc}>Enter your registered mobile number to continue.</Text>
              
              <View style={styles.inputContainer}>
                <Phone color={colors.textMuted} size={20} style={{marginRight: 10}} />
                <Text style={styles.countryCode}>+91</Text>
                <TextInput
                  style={[styles.input, { marginLeft: 10, letterSpacing: 2 }]}
                  placeholder="98765 43210"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={mobileNumber}
                  onChangeText={setMobileNumber}
                  autoFocus
                />
              </View>

              <TouchableOpacity
                style={[styles.button, mobileNumber.length < 10 && styles.buttonDisabled]}
                disabled={mobileNumber.length < 10}
                onPress={handleSendOtp}
              >
                <Text style={styles.buttonText}>Send OTP</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 2: OTP VERIFICATION */}
          {step === 2 && (
            <View>
              <Text style={styles.stepTitle}>Verify your number</Text>
              <Text style={styles.stepDesc}>We've sent a 4-digit OTP to +91 {mobileNumber}</Text>

              <View style={{position: 'relative', marginTop: 10}}>
                <View style={styles.otpGrid}>
                  {[0, 1, 2, 3].map((index) => (
                    <View key={index} style={[styles.otpBox, otp.length === index && styles.otpBoxActive]}>
                      <Text style={styles.otpText}>{otp[index] || ''}</Text>
                    </View>
                  ))}
                </View>
                <TextInput
                  style={styles.hiddenInput}
                  keyboardType="number-pad"
                  maxLength={4}
                  value={otp}
                  onChangeText={setOtp}
                  autoFocus
                />
              </View>
              
              {otpError ? <Text style={[styles.resendText, {color: colors.danger, marginTop: 10}]}>{otpError}</Text> : null}
              
              <Text style={styles.resendText}>Didn't receive code? <Text style={{color: colors.primary}}>Resend</Text></Text>

              {/* No Manual Verify Button Needed */}
            </View>
          )}

          {/* STEP 3: PLATFORM SSO (LINK ACCOUNT) */}
          {step === 3 && (
            <View>
              <Text style={styles.stepTitle}>Link Partner Account</Text>
              <Text style={styles.stepDesc}>Connect your main gig platform to automatically sync your operational data and earnings profile.</Text>
              
              <View style={styles.grid}>
                {platforms.map(p => (
                   <TouchableOpacity
                     key={p.id}
                     activeOpacity={0.8}
                     style={[styles.card, platform === p.id && styles.cardActive]}
                     disabled={connecting}
                     onPress={() => handleConnect(p.id)}
                   >
                     <View style={[styles.iconWrapper, platform === p.id && { backgroundColor: colors.primaryMuted }]}>
                       {connecting && platform === p.id ? (
                          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                            <Link color={colors.primary} size={28} />
                          </Animated.View>
                       ) : (
                          <Bike color={platform === p.id ? colors.primary : colors.textMuted} size={28} />
                       )}
                     </View>
                     <View style={{ flex: 1 }}>
                       <Text style={[styles.cardTitle, platform === p.id && styles.textPrimary]}>{p.name}</Text>
                       {connecting && platform === p.id && (
                         <Text style={{color: colors.primary, fontSize: 13, marginTop: 4, fontWeight: '600'}}>Authenticating via SSO...</Text>
                       )}
                     </View>
                   </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* STEP 4: FETCHED DATA & ZONE CONFIRMATION */}
          {step === 4 && (
            <View>
              <View style={styles.mockDataCard}>
                 <Text style={styles.mockDataTitle}>Partner Account Linked!</Text>
                 <View style={styles.mockDataRow}><Text style={styles.mockDataLabel}>Worker:</Text><Text style={styles.mockDataValue}>{mockUserData?.name} ({mockUserData?.id})</Text></View>
                 <View style={styles.mockDataRow}><Text style={styles.mockDataLabel}>Avg Weekly Earnings:</Text><Text style={[styles.mockDataValue, {color: colors.success}]}>₹{mockUserData?.avgEarnings}</Text></View>
                 <View style={styles.mockDataRow}><Text style={styles.mockDataLabel}>Risk Profile:</Text><Text style={styles.mockDataValue}>{mockUserData?.riskProfile}</Text></View>
              </View>

              <Text style={styles.stepTitle}>Verify your primary zone</Text>
              <Text style={styles.stepDesc}>We auto-detected your zone. Our ML engine uses this to calculate a dynamic premium to protect your earnings.</Text>
              
              {/* Removed hardcoded zones mapping, replacing with a search/auto-detect input */}
              <View style={styles.inputContainer}>
                <MapPin color={colors.textMuted} size={20} style={{marginRight: 10}} />
                <TextInput
                   style={[styles.input, { fontSize: 16 }]}
                   placeholder="Search or enter location manually"
                   placeholderTextColor={colors.textMuted}
                   value={zone}
                   onChangeText={handleLocationSearch}
                />
              </View>

              {searchResults.length > 0 && (
                  <View style={[styles.card, { marginTop: 5, padding: 10, flexDirection: 'column', alignItems: 'flex-start', borderRadius: 12 }]}>
                    {searchResults.map((item, index) => (
                      <TouchableOpacity 
                        key={index} 
                        style={{ paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: index === searchResults.length - 1 ? 0 : 1, borderBottomColor: colors.borderMuted, width: '100%' }}
                        onPress={() => selectSuggestedLocation(item)}
                      >
                        <Text style={{ color: colors.text, fontSize: 14 }} numberOfLines={2}>{item.display_name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
              )}

              <View style={[styles.zoneCard, styles.zoneCardActive, { marginTop: 20 }]}>
                  <View style={styles.zoneHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <MapPin color={colors.primary} size={22} />
                      <Text style={[styles.zoneTitle, styles.textPrimary, { marginLeft: 8, flexShrink: 1 }]} numberOfLines={1}>
                        {zone || 'Enter location'}
                      </Text>
                    </View>
                    <View style={[styles.riskBadge, { backgroundColor: 'hsla(217, 28%, 65%, 0.15)', borderColor: colors.info }]}>
                      <Text style={[styles.riskText, { color: colors.info }]}>AI Analyzing</Text>
                    </View>
                  </View>
                  <Text style={styles.zoneDesc}>Our deep risk engine evaluates real-time congestion and natural hazard models based on this region.</Text>
              </View>

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

          {/* STEP 5: COVERAGE SUMMARY */}
          {step === 5 && (
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
                  <Text style={styles.premiumAmount}>{mockUserData?.premium || 25}</Text>
                </View>
                
                <View style={styles.aiInsightBox}>
                  <Activity color={colors.primary} size={16} />
                  <Text style={styles.aiInsightText}>
                    <Text style={{fontWeight: 'bold'}}>Profile Insight: </Text>
                    {mockUserData?.profileInsight || `Pricing adjusted dynamically for ${zone}, factoring active weather patterns and region history.`}
                  </Text>
                </View>
              </View>

              <View style={styles.coverageList}>
                <Text style={styles.coverageHeader}>Included Zero-Touch Claims:</Text>
                <View style={styles.coverageItemRow}><CheckCircle2 color={colors.primary} size={18}/><Text style={styles.coverageItemText}>Severe Weather & Waterlogging (API Triggered)</Text></View>
                <View style={styles.coverageItemRow}><CheckCircle2 color={colors.primary} size={18}/><Text style={styles.coverageItemText}>Apartment & Gateway Delays</Text></View>
                <View style={styles.coverageItemRow}><CheckCircle2 color={colors.primary} size={18}/><Text style={styles.coverageItemText}>System Outages & Unmapped Hazards</Text></View>

                <View style={{ marginTop: 15 }} />
                
                <Text style={[styles.coverageHeader, { color: colors.danger }]}>Not Included:</Text>
                <View style={styles.coverageItemRow}><XCircle color={colors.danger} size={18}/><Text style={styles.coverageItemText}>Life Insurance</Text></View>
                <View style={styles.coverageItemRow}><XCircle color={colors.danger} size={18}/><Text style={styles.coverageItemText}>Accidental Insurance</Text></View>
                <View style={styles.coverageItemRow}><XCircle color={colors.danger} size={18}/><Text style={styles.coverageItemText}>Vehicle Insurance & Damage</Text></View>
              </View>

              <TouchableOpacity
                style={[styles.button, { marginTop: 10 }]}
                onPress={async () => {
                  try {
                    const host = Platform?.OS === 'web' ? 'localhost:8000' : '192.168.1.110:8000';
                    
                    // Check if they already paid their premium recently
                    const walletRes = await fetch(`http://${host}/wallet`, {
                      headers: { 'Authorization': `Bearer ${mockUserData.token}` }
                    });
                    
                    if (walletRes.ok) {
                      const data = await walletRes.json();
                      const alreadyPaid = data.history?.some(tx => tx.hazard_type === 'premium');
                      
                      if (!alreadyPaid) {
                        // Deduct initial premium if they haven't paid yet
                        const premiumAmount = mockUserData?.premium || 25;
                        await fetch(`http://${host}/wallet/transaction`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${mockUserData.token}`
                          },
                          body: JSON.stringify({
                            amount: -premiumAmount,
                            hazard_type: 'premium',
                            reason: 'Weekly Premium Deduction'
                          })
                        });
                      } else {
                        console.log("User already has an active premium subscription. Skipping deduction.");
                      }
                    }
                  } catch (err) {
                    console.error("Premium deduction failed", err);
                  }
                  
                  onComplete({ platform, zone, premium: mockUserData?.premium || 25, user: mockUserData, locationObj, profileInsight: mockUserData?.profileInsight });
                }}
              >
                <Text style={styles.buttonText}>Subscribe & Start Shift</Text>
              </TouchableOpacity>
              <Text style={styles.fineprint}>By subscribing, ₹{mockUserData?.premium || 25} will be deducted from your {platform === 'zepto' ? 'Zepto' : platform === 'blinkit' ? 'Blinkit' : 'Instamart'} payout weekly.</Text>
            </View>
          )}

        </Animated.View>
      </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundDark },
  contentWrapper: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  orb: { position: 'absolute', width: width, height: width, borderRadius: width / 2, filter: 'blur(50px)' },
  
  header: { paddingHorizontal: 25, paddingTop: 70, paddingBottom: 20 },
  logoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  logoText: { color: colors.text, fontSize: 30, fontWeight: '900', marginLeft: 12, letterSpacing: -0.5 },
  subtitle: { color: colors.textMuted, fontSize: 15, fontWeight: '500', lineHeight: 22 },
  
  progressContainer: { flexDirection: 'row', gap: 6, marginTop: 25 },
  dot: { height: 4, flex: 1, borderRadius: 2, backgroundColor: colors.borderMuted },
  dotActive: { backgroundColor: colors.primary },

  content: { flex: 1, paddingHorizontal: 25 },
  stepContainer: { flex: 1, paddingTop: 15 },
  
  stepTitle: { color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: 8, letterSpacing: -0.5 },
  stepDesc: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginBottom: 30 },
  
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderMuted, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 5 },
  countryCode: { color: colors.text, fontSize: 18, fontWeight: '700', marginRight: 10 },
  input: { flex: 1, color: colors.text, fontSize: 18, fontWeight: '600', paddingVertical: 15 },
  resendText: { color: colors.textMuted, fontSize: 14, fontWeight: '600', marginTop: 15, textAlign: 'center' },

  otpGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  otpBox: { flex: 1, height: 60, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderMuted, justifyContent: 'center', alignItems: 'center' },
  otpBoxActive: { borderColor: colors.primary, backgroundColor: colors.surfaceHighlight },
  otpText: { color: colors.text, fontSize: 24, fontWeight: '700' },
  hiddenInput: { position: 'absolute', width: '100%', height: '100%', opacity: 0 },

  grid: { flexDirection: 'column', gap: 15, marginBottom: 20 },
  card: { width: '100%', flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  cardActive: { borderColor: colors.primary, backgroundColor: colors.surfaceHighlight },
  iconWrapper: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.surfaceHighlight, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  textPrimary: { color: colors.primary },

  mockDataCard: { backgroundColor: 'hsla(146, 17%, 59%, 0.1)', borderWidth: 1, borderColor: colors.success, borderRadius: 16, padding: 20, marginBottom: 30 },
  mockDataTitle: { color: colors.success, fontSize: 14, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 15 },
  mockDataRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  mockDataLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  mockDataValue: { color: colors.text, fontSize: 14, fontWeight: '800' },

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
