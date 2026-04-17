import { getBaseUrl, getWsUrl } from '../config';
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated, Easing, Platform, TextInput, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Shield, RefreshCw, ArrowUpRight, CheckCircle, Clock } from 'lucide-react-native';
import { useThemeColors } from '../theme/colors';

const { width } = Dimensions.get('window');

export default function WalletScreen({ userProfile }) {
  const [activeTab, setActiveTab] = useState('wallet'); // 'wallet' | 'claims'
  const [balance, setBalance] = useState(0);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [transactions, setTransactions] = useState([]);
  
  const colors = useThemeColors();
  const styles = getStyles(colors);

  // Animations
  const balanceScaleAnim = useRef(new Animated.Value(1)).current;
  const listFadeAnim = useRef(new Animated.Value(0)).current;

  // Fetch persistent wallet data
  useEffect(() => {
      if (userProfile && userProfile.user && userProfile.user.token) {
        
        fetch(`${getBaseUrl()}/wallet`, {
          headers: {
            'Authorization': `Bearer ${userProfile.user.token}`
          }
        })
        .then(res => res.json())
      .then(data => {
        if(data.history) {
          setBalance(data.balance);
          const formattedTx = data.history.map(tx => ({
             id: tx.id,
             title: tx.hazard_type === 'premium' ? 'Weekly Premium' : (tx.hazard_type || 'Parametric Trigger'),
             type: tx.amount < 0 ? 'debit' : 'credit',
             amount: Math.abs(tx.amount),
             date: new Date(tx.timestamp).toLocaleString(),
             status: 'Completed',
             reason: tx.reason
          }));
          setTransactions(formattedTx);
          
          // Populate claims list with only positive hazard payouts (not premium deductions or withdrawals)
          if (data.hazard_reports) {
            const parsedReports = data.hazard_reports.map(r => {
              let titleParsed = 'Hazard Verification';
              try { titleParsed = (JSON.parse(r.yolo_detections).join(', ') || 'Hazard Verification'); } catch(e){}
              return {
                id: `HR-${r.id}`,
                rawId: r.id,
                title: titleParsed,
                date: new Date(r.timestamp).toLocaleDateString(),
                amount: r.status === 'approved' || r.status === 'appealed_approved' ? 20 : 0,
                status: r.status.replace('_', ' '),
                rejection_reason: r.rejection_reason || 'AI Vision Rejected'
              };
            });
            setClaims(parsedReports);
          } else {
             // Fallback
             const hazardClaims = formattedTx
               .filter(tx => tx.type === 'credit' && tx.amount > 0)
               .map(tx => ({
                  id: `HG-${tx.id}X`,
                  title: tx.title,
                  date: tx.date.split(',')[0],
                  amount: tx.amount,
                  status: 'approved'
               }));
             setClaims(hazardClaims);
          }
        }
      })
      .catch(err => console.error("Error fetching wallet", err));
    }
    Animated.timing(listFadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [activeTab, userProfile]);

  const [claims, setClaims] = useState([]);
  const [appealingId, setAppealingId] = useState(null);
  const [appealReason, setAppealReason] = useState("");
  const [isSubmittingAppeal, setIsSubmittingAppeal] = useState(false);

  const submitAppeal = async (reportId) => {
      const showAlert = (title, message) => {
         if (Platform.OS === 'web') window.alert(`${title}: ${message}`);
         else Alert.alert(title, message);
      };

      if(!appealReason.trim()) return showAlert("Error", "Please provide a reason to appeal.");
      setIsSubmittingAppeal(true);
      try {
         const formData = new FormData();
         formData.append('appeal_reason', appealReason);
         
         const res = await fetch(`${getBaseUrl()}/hazard/appeal/${reportId}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${userProfile.user.token}`
            },
            body: formData
         });
         const data = await res.json();
         if(res.ok) {
            showAlert("Appeal Completed", "Your claim was reviewed by Premium AI. " + ((data.payout_credited || data.gemini_passed) ? "It was APPROVED and credited." : "It was REJECTED again."));
            
            // Update the local claims state so the button disappears based on new status
            setClaims(prev => prev.map(c => {
               if (c.rawId === reportId) {
                  return {
                     ...c,
                     status: (data.payout_credited || data.gemini_passed) ? 'approved' : 'appealed_rejected'
                  };
               }
               return c;
            }));

            setAppealingId(null);
            setAppealReason("");
         } else {
            showAlert("Appeal Failed", data.detail || data.message || "Could not appeal.");
            setAppealingId(null);
         }
      } catch(e) {
         showAlert("Error", e.message);
      } finally {
         setIsSubmittingAppeal(false);
      }
  };

  const handleWithdraw = async () => {
    setIsWithdrawing(true);
    Animated.sequence([
      Animated.timing(balanceScaleAnim, { toValue: 0.95, duration: 150, useNativeDriver: true }),
      Animated.timing(balanceScaleAnim, { toValue: 1, duration: 150, useNativeDriver: true })
    ]).start();

    // Call backend to deduct
    try {
      if (userProfile && userProfile.user && userProfile.user.token) {
        
        const response = await fetch(`${getBaseUrl()}/wallet/payout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userProfile.user.token}`
          }
        });

        const data = await response.json();
        
        if (data.status === 'success') {
          setTransactions([
            { id: data.payout_ref, title: 'Instant UPI Payout', type: 'debit', amount: balance, date: 'Just now', status: 'Success', reason: data.message },
            ...transactions
          ]);
          setBalance(data.remaining_balance || 0);
        } else {
           console.error("Payout rejected:", data.detail);
        }
      }
    } catch (err) {
      console.error("Instant withdraw failed", err);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const renderTransactions = () => (
    <Animated.View style={{ opacity: listFadeAnim }}>
       {transactions.map(txn => (
         <View key={txn.id} style={styles.txnCard}>
           <View style={styles.txnLeft}>
              <View style={[styles.iconBox, { backgroundColor: txn.type === 'credit' ? 'hsla(146, 17%, 59%, 0.15)' : 'hsla(9, 26%, 64%, 0.15)' }]}>
                 {txn.type === 'credit' ? <CheckCircle color={colors.success} size={22} /> : <Clock color={colors.danger} size={22} />}
              </View>
              <View>
                 <Text style={styles.txnTitle}>{txn.title}</Text>
                 <Text style={styles.txnDate}>{txn.date} • {txn.status}</Text>
              </View>
           </View>
           <Text style={[styles.txnAmount, { color: txn.type === 'credit' ? colors.success : colors.text }]}>
             {txn.type === 'credit' ? '+' : '-'}₹{txn.amount}
           </Text>
         </View>
       ))}
    </Animated.View>
  );

  const renderClaims = () => (
    <Animated.View style={{ paddingTop: 10, opacity: listFadeAnim }}>
       {claims.map((claim, index) => (
         <View key={index} style={styles.claimCard}>
            <View style={styles.claimHeader}>
               <Text style={styles.claimId}>{claim.id}</Text>
               <View style={[styles.statusBadge, 
                  (claim.status === 'rejected' || claim.status === 'appealed_rejected' || claim.status === 'appealed rejected') ? { backgroundColor: 'hsla(9, 26%, 64%, 0.1)' } : { backgroundColor: 'hsla(220, 78%, 76%, 0.15)' }
               ]}>
                  <Text style={[styles.statusText, 
                     (claim.status === 'rejected' || claim.status === 'appealed_rejected' || claim.status === 'appealed rejected') ? { color: colors.danger } : { color: colors.primary }
                  ]}>{claim.status.replace('_', ' ').toUpperCase()}</Text>
               </View>
            </View>
            <Text style={styles.claimTitle}>{claim.title}</Text>

            {(claim.status === 'rejected' || claim.status === 'appealed_rejected' || claim.status === 'appealed rejected') && (
               <Text style={{color: colors.textMuted, marginBottom: 10, fontSize: 13}}>Reason: {claim.rejection_reason}</Text>
            )}
            
            {(claim.status === 'rejected' && (!claim.rejection_reason || !claim.rejection_reason.toLowerCase().includes('fraud'))) && (
               appealingId === claim.rawId ? (
                 <View style={{marginTop: 10, marginBottom: 10}}>
                   <TextInput
                     style={{backgroundColor: colors.backgroundDark, color: colors.text, padding: 12, borderRadius: 8, borderColor: colors.borderMuted, borderWidth: 1, marginBottom: 10}}
                     placeholder="Why was this an error?"
                     placeholderTextColor={colors.textMuted}
                     value={appealReason}
                     onChangeText={setAppealReason}
                   />
                   <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                     <TouchableOpacity onPress={() => setAppealingId(null)} style={{padding: 10}}><Text style={{color: colors.textMuted, fontWeight: 'bold'}}>CANCEL</Text></TouchableOpacity>
                     <TouchableOpacity style={{backgroundColor: colors.primary, padding: 10, borderRadius: 8}} onPress={() => submitAppeal(claim.rawId)} disabled={isSubmittingAppeal}>
                       <Text style={{color: colors.backgroundDark, fontWeight: 'bold'}}>{isSubmittingAppeal ? "SUBMITTING..." : "SUBMIT APPEAL"}</Text>
                     </TouchableOpacity>
                   </View>
                 </View>
               ) : (
                 <TouchableOpacity onPress={() => { setAppealingId(claim.rawId); setAppealReason(""); }} style={{marginBottom: 10}}>
                   <Text style={{color: colors.warning, fontWeight: 'bold'}}>APPEAL WITH GEMINI VISION</Text>
                 </TouchableOpacity>
               )
            )}

            <View style={styles.claimFooter}>
               <Text style={styles.claimDate}>{claim.date}</Text>
               <Text style={styles.claimAmount}>₹{claim.amount}</Text>
            </View>
         </View>
       ))}
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={[colors.backgroundDark, colors.surfaceHighlight, colors.backgroundDark]} style={StyleSheet.absoluteFillObject} />

      <View style={styles.header}>
         <Text style={styles.headerTitle}>Razorpay Vault</Text>
         <View style={styles.secureBadge}>
            <Shield color={colors.success} size={14} />
            <Text style={styles.secureText}>Protected</Text>
         </View>
      </View>

      <View style={styles.segmentContainer}>
         <View style={styles.segmentWrapper}>
            <TouchableOpacity 
               activeOpacity={0.8}
               style={[styles.segmentBtn, activeTab === 'wallet' && styles.segmentActive]} 
               onPress={() => { setActiveTab('wallet'); listFadeAnim.setValue(0); }}
            >
               <Text style={[styles.segmentText, activeTab === 'wallet' && styles.segmentTextActive]}>Balances</Text>
            </TouchableOpacity>
            <TouchableOpacity 
               activeOpacity={0.8}
               style={[styles.segmentBtn, activeTab === 'claims' && styles.segmentActive]} 
               onPress={() => { setActiveTab('claims'); listFadeAnim.setValue(0); }}
            >
               <Text style={[styles.segmentText, activeTab === 'claims' && styles.segmentTextActive]}>Claim History</Text>
            </TouchableOpacity>
         </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
         {activeTab === 'wallet' ? (
           <>
              <Animated.View style={[styles.balanceCard, { transform: [{ scale: balanceScaleAnim }] }]}>
                 <LinearGradient colors={[colors.surface, colors.backgroundDark]} style={StyleSheet.absoluteFillObject} />
                 
                 <Text style={styles.cardLabel}>AVAILABLE PAYOUT BALANCE</Text>
                 <Text style={styles.balanceAmount}>₹{balance}</Text>
                 <Text style={styles.protectedText}>Lifetime Earnings Protected: ₹12,400</Text>
                 
                 <TouchableOpacity 
                    activeOpacity={0.8}
                    style={[styles.withdrawBtn, (balance === 0 || isWithdrawing) && styles.disabledBtn]} 
                    onPress={handleWithdraw}
                    disabled={balance === 0 || isWithdrawing}
                 >
                    {isWithdrawing ? (
                      <>
                        <RefreshCw color={colors.backgroundDark} size={20} style={{ marginRight: 10 }} />
                        <Text style={styles.btnText}>Securing UPI Transfer...</Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.btnText}>Withdraw Instantly</Text>
                        <ArrowUpRight color={colors.backgroundDark} size={20} style={{ marginLeft: 6 }} />
                      </>
                    )}
                 </TouchableOpacity>
              </Animated.View>

              <Text style={styles.sectionTitle}>Recent Payouts</Text>
              {renderTransactions()}
           </>
         ) : renderClaims()}
      </ScrollView>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundDark, paddingTop: 60 },
  header: { paddingHorizontal: 25, marginBottom: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  secureBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'hsla(146, 17%, 59%, 0.15)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.borderMuted },
  secureText: { color: colors.success, fontSize: 12, marginLeft: 6, fontWeight: '800', textTransform: 'uppercase' },
  
  segmentContainer: { paddingHorizontal: 25, marginBottom: 30 },
  segmentWrapper: { flexDirection: 'row', backgroundColor: colors.surfaceHighlight, borderRadius: 16, padding: 6, borderWidth: 1, borderColor: colors.border },
  segmentBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 12 },
  segmentActive: { backgroundColor: colors.surface, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5, borderWidth: 1, borderColor: colors.borderMuted },
  segmentText: { color: colors.textMuted, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  segmentTextActive: { color: colors.text, fontWeight: '900' },

  content: { flex: 1, paddingHorizontal: 25 },
  balanceCard: { borderRadius: 32, padding: 35, borderWidth: 1, borderColor: colors.borderMuted, marginBottom: 35, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  cardLabel: { color: colors.textMuted, fontSize: 12, marginBottom: 12, fontWeight: '800', letterSpacing: 1.5 },
  balanceAmount: { color: colors.text, fontSize: 64, fontWeight: '900', marginBottom: 12, letterSpacing: -2, lineHeight: 70 },
  protectedText: { color: colors.primary, fontSize: 14, marginBottom: 35, fontWeight: '600', letterSpacing: 0.5 },
  
  withdrawBtn: { backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20, borderRadius: 20 },
  disabledBtn: { opacity: 0.5, backgroundColor: colors.surfaceHighlight, borderWidth: 1, borderColor: colors.primaryMuted },
  btnText: { color: colors.backgroundDark, fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },

  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '900', marginBottom: 20, letterSpacing: -0.5 },
  
  txnCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 22, borderRadius: 24, marginBottom: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderMuted },
  txnLeft: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  txnTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  txnDate: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  txnAmount: { fontSize: 18, fontWeight: '900' },

  claimCard: { padding: 25, borderRadius: 24, marginBottom: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderMuted },
  claimHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  claimId: { color: colors.textMuted, fontSize: 15, fontWeight: '700', fontFamily: 'monospace' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  statusText: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  claimTitle: { color: colors.text, fontSize: 20, fontWeight: '900', marginBottom: 15 },
  claimFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.borderMuted, paddingTop: 18, borderStyle: 'dashed' },
  claimDate: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  claimAmount: { color: colors.text, fontSize: 18, fontWeight: '900' }
});
