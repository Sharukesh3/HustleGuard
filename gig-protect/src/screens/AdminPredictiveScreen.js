import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { getBaseUrl } from '../config';
import { ShieldAlert } from 'lucide-react-native';
import Svg, { Path, G } from 'react-native-svg';
import * as d3 from 'd3-geo';
import indiaGeoData from '../../assets/india_states.json';

const RISK_CATEGORIES = [
    "Weather Events", 
    "Heavy Rainfall", 
    "Traffic", 
    "Social Strikes", 
    "Lockdowns", 
    "Grid Failure"
];

const TIMELINE_WEEKS = [
    { label: "Current", val: 0 },
    { label: "+1 Week", val: 1 },
    { label: "+2 Weeks", val: 2 },
    { label: "+3 Weeks", val: 3 },
    { label: "+4 Weeks", val: 4 }
];

export default function AdminPredictiveScreen() {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState("Weather Events");
    const [selectedTimeline, setSelectedTimeline] = useState(1);
    const [predictions, setPredictions] = useState([]);
    
    // Map State Name to Prediction Data for fast lookup
    const [stateRiskMap, setStateRiskMap] = useState({});

    const fetchPredictiveRisk = async () => {
        setLoading(true);
        try {
            const url = `${getBaseUrl()}/admin/predictive-risk?risk_category=${encodeURIComponent(selectedCategory)}&timeline_week=${selectedTimeline}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.predictions) {
                setPredictions(data.predictions);
                
                const riskMap = {};
                data.predictions.forEach(p => {
                    riskMap[p.state] = p;
                });
                setStateRiskMap(riskMap);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPredictiveRisk();
    }, [selectedCategory, selectedTimeline]);

    const getRiskColor = (score) => {
        if (!score && score !== 0) return colors.surface;
        if (score > 0.75) return '#ef4444'; // Red
        if (score > 0.50) return '#f97316'; // Orange
        if (score > 0.30) return '#eab308'; // Yellow
        if (score > 0.15) return '#22c55e'; // Green
        return '#0284c7'; // Blue/Cyan
    };
    
    // Map dimensions
    const mapWidth = Dimensions.get('window').width - 40;
    const mapHeight = mapWidth * 1.1;
    
    // Create the projection centered and scaled for the SVG dimensions
    const projection = d3.geoMercator().fitSize([mapWidth, mapHeight], indiaGeoData);
    const pathGenerator = d3.geoPath().projection(projection);

    return (
        <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16 }}>
            
            <View style={{ marginBottom: 24, padding: 16, backgroundColor: colors.surface, borderRadius: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <ShieldAlert color={colors.primary} size={24} style={{ marginRight: 8 }} />
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text }}>AI Predictive Risk Map</Text>
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 14 }}>
                    Anticipate operational hazards, severe weather, and socio-economic disruptions per State. Powered by AI forecasting.
                </Text>
            </View>

            <View style={{ marginBottom: 20 }}>
                <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 8 }}>Risk Event Model</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    {RISK_CATEGORIES.map(cat => (
                        <TouchableOpacity 
                            key={cat}
                            onPress={() => setSelectedCategory(cat)}
                            style={{ 
                                paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, 
                                backgroundColor: selectedCategory === cat ? colors.primary : colors.surface,
                                marginRight: 10
                            }}>
                            <Text style={{ color: selectedCategory === cat ? '#000' : colors.text, fontWeight: '600' }}>{cat}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
                
                <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 8, marginTop: 10 }}>Projection Timeline (Weeks)</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    {TIMELINE_WEEKS.map(tl => (
                        <TouchableOpacity 
                            key={tl.val}
                            onPress={() => setSelectedTimeline(tl.val)}
                            style={{ 
                                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, 
                                backgroundColor: selectedTimeline === tl.val ? colors.surface : 'transparent',
                                borderWidth: 1,
                                borderColor: selectedTimeline === tl.val ? colors.primary : colors.border
                            }}>
                            <Text style={{ color: selectedTimeline === tl.val ? colors.primary : colors.textMuted, fontWeight: 'bold' }}>{tl.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={{ 
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#0f172a', 
                borderRadius: 24, 
                paddingVertical: 20,
                borderWidth: 1,
                borderColor: colors.border,
                minHeight: mapHeight + 50,
                position: 'relative'
            }}>
                {loading && (
                    <View style={{ position: 'absolute', zIndex: 10, top: '45%' }}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                )}

                <Svg width={mapWidth} height={mapHeight} style={{ opacity: loading ? 0.3 : 1 }}>
                    <G>
                        {indiaGeoData.features.map((feature, i) => {
                            const stateName = feature.properties.NAME_1;
                            const stateData = stateRiskMap[stateName];
                            const riskScore = stateData ? stateData.risk_score : null;
                            const fillColor = getRiskColor(riskScore);
                            
                            return (
                                <Path
                                    key={i}
                                    d={pathGenerator(feature)}
                                    fill={fillColor}
                                    stroke={colors.backgroundDark}
                                    strokeWidth={0.5}
                                />
                            );
                        })}
                    </G>
                </Svg>
                
                <View style={{ flexDirection: 'row', marginTop: 20, flexWrap: 'wrap', justifyContent: 'center', gap: 10, paddingHorizontal: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#0284c7', marginRight: 4 }} />
                        <Text style={{ color: colors.textMuted, fontSize: 11 }}>Optimal</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#22c55e', marginRight: 4 }} />
                        <Text style={{ color: colors.textMuted, fontSize: 11 }}>Low</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#eab308', marginRight: 4 }} />
                        <Text style={{ color: colors.textMuted, fontSize: 11 }}>Elevated</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#f97316', marginRight: 4 }} />
                        <Text style={{ color: colors.textMuted, fontSize: 11 }}>High</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#ef4444', marginRight: 4 }} />
                        <Text style={{ color: colors.textMuted, fontSize: 11 }}>Critical</Text>
                    </View>
                </View>
            </View>
        </ScrollView>
    );
}