import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Platform } from 'react-native';
import { ShieldAlert, TrendingUp, Users, AlertTriangle, RefreshCw, BarChart2, Map } from 'lucide-react-native';
import AdminPredictiveScreen from './AdminPredictiveScreen';
import { useTheme } from '../theme/ThemeContext';
import { getBaseUrl } from '../config';

export default function AdminDashboardScreen() {
    const { colors } = useTheme();
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [adminView, setAdminView] = useState('dashboard');

    const fetchMetrics = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${getBaseUrl()}/admin/metrics`);
            const data = await response.json();
            setMetrics(data.metrics);
        } catch (error) {
            console.error("Fetch metrics error:", error);
            // Fallback mock data
            setMetrics({
               activePolicies: 1250,
               totalPremiums: 85000,
               claimsPaid: 12000,
               lossRatio: "14.1%",
               fraudAttemptsBlocked: 42,
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
    }, []);

    const MetricCard = ({ title, value, subtext, icon: Icon, statColor }) => (
        <View style={{
            flex: 1,
            backgroundColor: colors.surface,
            padding: 16,
            borderRadius: 16,
            marginHorizontal: 6,
            marginBottom: 12,
            minWidth: 150,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3
        }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: '600' }}>{title}</Text>
                <View style={{ padding: 6, backgroundColor: colors.background, borderRadius: 8 }}>
                    <Icon size={16} color={statColor} />
                </View>
            </View>
            <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text }}>{value}</Text>
            {subtext && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                    <TrendingUp size={12} color={colors.primary} />
                    <Text style={{ fontSize: 11, color: colors.primary, marginLeft: 4 }}>{subtext}</Text>
                </View>
            )}
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={{ paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 15 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 32, fontWeight: '900', color: colors.text, letterSpacing: -1 }}>
                        Command<Text style={{ color: colors.primary }}>Center</Text>
                    </Text>
                    <TouchableOpacity onPress={fetchMetrics} disabled={loading}>
                        <RefreshCw size={20} color={colors.text} style={{ opacity: loading ? 0.3 : 1 }} />
                    </TouchableOpacity>
                </View>
                <Text style={{ color: colors.textMuted, marginTop: 4 }}>HustleGuard Live Telemetry</Text>

                {/* Internal Admin Navigation */}
                <View style={{ flexDirection: 'row', marginTop: 24, backgroundColor: colors.surface, borderRadius: 12, padding: 4 }}>
                    <TouchableOpacity 
                        onPress={() => setAdminView('dashboard')}
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8, backgroundColor: adminView === 'dashboard' ? colors.card : 'transparent' }}>
                        <BarChart2 color={adminView === 'dashboard' ? colors.primary : colors.textMuted} size={18} style={{ marginRight: 6 }} />
                        <Text style={{ color: adminView === 'dashboard' ? colors.primary : colors.textMuted, fontWeight: 'bold' }}>Dashboard</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setAdminView('predictive')}
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8, backgroundColor: adminView === 'predictive' ? colors.card : 'transparent' }}>
                        <Map color={adminView === 'predictive' ? '#0ea5e9' : colors.textMuted} size={18} style={{ marginRight: 6 }} />
                        <Text style={{ color: adminView === 'predictive' ? '#0ea5e9' : colors.textMuted, fontWeight: 'bold' }}>AI Predictive Map</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {adminView === 'predictive' ? (
                <AdminPredictiveScreen />
            ) : (
            <ScrollView 
                contentContainerStyle={{ padding: 14 }}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchMetrics} tintColor={colors.primary} />}
            >
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                    <MetricCard 
                        title="ACTIVE POLICIES" 
                        value={metrics ? metrics.activePolicies.toLocaleString() : "..."} 
                        subtext="Live riders insured"
                        icon={Users} 
                        statColor={colors.primary} 
                    />
                    <MetricCard 
                        title="LOSS RATIO" 
                        value={metrics ? metrics.lossRatio : "..."} 
                        subtext="Extremely healthy"
                        icon={ShieldAlert} 
                        statColor={colors.success} 
                    />
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                    <MetricCard 
                        title="PREMIUMS POOLED" 
                        value={`₹${metrics ? metrics.totalPremiums.toLocaleString() : "..."}`} 
                        subtext="+14% this week"
                        icon={TrendingUp} 
                        statColor={colors.secondary} 
                    />
                    <MetricCard 
                        title="FRAUD BLOCKED" 
                        value={metrics ? metrics.fraudAttemptsBlocked.toString() : "..."} 
                        subtext="AI Telemetry intercepted"
                        icon={AlertTriangle} 
                        statColor={colors.error} 
                    />
                </View>

                <View style={{ marginTop: 20, paddingHorizontal: 6 }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12 }}>Recent Intelligent Payouts</Text>
                    {metrics && metrics.recentPayouts && metrics.recentPayouts.length > 0 ? metrics.recentPayouts.map((payout, i) => (
                        <View key={i} style={{ 
                            flexDirection: 'row', 
                            justifyContent: 'space-between', 
                            backgroundColor: colors.surface, 
                            padding: 16, 
                            borderRadius: 16, 
                            marginBottom: 8 
                        }}>
                            <View style={{ flex: 1, paddingRight: 10 }}>
                                <Text style={{ color: colors.text, fontWeight: '600' }}>Claim #HG-{payout.id}</Text>
                                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>{payout.reason || payout.hazard_type}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                                <Text style={{ color: colors.primary, fontWeight: '800' }}>₹{payout.amount}</Text>
                                <Text style={{ color: colors.success, fontSize: 11, marginTop: 4 }}>Auto-approved</Text>
                            </View>
                        </View>
                    )) : (
                        <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 10, marginBottom: 20 }}>No recent payouts recorded yet.</Text>
                    )}
                </View>
            </ScrollView>
            )}
        </View>
    );
}