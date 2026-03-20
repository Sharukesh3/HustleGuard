import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Shield, RefreshCw, ArrowUpRight, Clock, CheckCircle } from 'lucide-react-native';
import { colors } from '../theme/colors';

export default function WalletScreen() {
  const [balance, setBalance] = useState(1150);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [transactions, setTransactions] = useState([
    { id: 1, title: 'Rain Disruption Cover', type: 'credit', amount: 150, date: 'Today, 2:40 PM', status: 'Completed' },
    { id: 2, title: 'Hazard Detour Payout', type: 'credit', amount: 50, date: 'Today, 1:15 PM', status: 'Completed' },
    { id: 3, title: 'Weekly Premium Deduction', type: 'debit', amount: 25, date: 'Monday', status: 'Paid' },
  ]);

  const handleWithdraw = () => {
    setIsWithdrawing(true);
    setTimeout(() => {
      setTransactions([
        { id: Math.random(), title: 'Instant UPI Payout', type: 'debit', amount: balance, date: 'Just now', status: 'Success' },
        ...transactions
      ]);
      setBalance(0);
      setIsWithdrawing(false);
    }, 2000);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
         <Text style={styles.title}>Secure Wallet</Text>
         <View style={styles.secureBadge}>
            <Shield color={colors.primary} size={14} />
            <Text style={styles.secureText}>Powered by Razorpay</Text>
         </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
         <View style={styles.balanceCard}>
           <Text style={styles.cardLabel}>Available Payout Balance</Text>
           <Text style={styles.balanceAmount}>₹{balance}</Text>
           <Text style={styles.protectedText}>Earnings protected this month: ₹12,400</Text>
           
           <TouchableOpacity 
              style={[styles.withdrawBtn, (balance === 0 || isWithdrawing) && styles.disabledBtn]} 
              onPress={handleWithdraw}
              disabled={balance === 0 || isWithdrawing}
           >
              {isWithdrawing ? (
                <>
                  <RefreshCw color="#000" size={20} style={{ marginRight: 8 }} />
                  <Text style={styles.btnText}>Processing UPI...</Text>
                </>
              ) : (
                <>
                  <Text style={styles.btnText}>Withdraw Instantly</Text>
                  <ArrowUpRight color="#000" size={20} style={{ marginLeft: 8 }} />
                </>
              )}
           </TouchableOpacity>
         </View>

         <Text style={styles.subtitle}>Recent Transactions</Text>
         
         {transactions.map(txn => (
           <View key={txn.id} style={styles.txnCard}>
             <View style={styles.txnLeft}>
                <View style={[styles.iconBox, { backgroundColor: txn.type === 'credit' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
                   {txn.type === 'credit' ? <CheckCircle color={colors.primary} size={20} /> : <AlertTrianglePlaceholder color={colors.danger} size={20} />}
                </View>
                <View>
                   <Text style={styles.txnTitle}>{txn.title}</Text>
                   <Text style={styles.txnDate}>{txn.date} • {txn.status}</Text>
                </View>
             </View>
             <Text style={[styles.txnAmount, { color: txn.type === 'credit' ? colors.primary : '#fff' }]}>
               {txn.type === 'credit' ? '+' : '-'}₹{txn.amount}
             </Text>
           </View>
         ))}
      </ScrollView>
    </View>
  );
}

// Dummy placeholder since AlertTriangle is imported in another file, using Clock here
const AlertTrianglePlaceholder = ({color, size}) => <Clock color={color} size={size} />;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  header: { paddingHorizontal: 20, marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#fff' },
  secureBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceHighlight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  secureText: { color: colors.primary, fontSize: 12, marginLeft: 4, fontWeight: 'bold' },
  
  content: { flex: 1, paddingHorizontal: 20, width: '100%', maxWidth: 600, alignSelf: 'center' },
  balanceCard: { backgroundColor: colors.surface, borderRadius: 24, padding: 30, borderWidth: 1, borderColor: colors.border, marginBottom: 30 },
  cardLabel: { color: colors.textMuted, fontSize: 14, marginBottom: 10 },
  balanceAmount: { color: '#fff', fontSize: 48, fontWeight: 'bold', marginBottom: 10 },
  protectedText: { color: colors.primary, fontSize: 14, marginBottom: 25 },
  
  withdrawBtn: { backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 16 },
  disabledBtn: { opacity: 0.5 },
  btnText: { color: '#000', fontSize: 18, fontWeight: 'bold' },

  subtitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  txnCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, padding: 15, borderRadius: 16, marginBottom: 12 },
  txnLeft: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  txnTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  txnDate: { color: colors.textMuted, fontSize: 12 },
  txnAmount: { fontSize: 16, fontWeight: 'bold' }
});
