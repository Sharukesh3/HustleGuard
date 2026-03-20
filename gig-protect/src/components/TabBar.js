import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Home, Camera, Wallet } from 'lucide-react-native';
import { colors } from '../theme/colors';

export default function TabBar({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'home', label: 'Dashboard', icon: Home },
    { id: 'hazard', label: 'Report Hazard', icon: Camera },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
  ];

  return (
    <View style={styles.container}>
      <BlurView intensity={80} tint="dark" style={styles.blurView}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tabItem}
              onPress={() => onTabChange(tab.id)}
            >
              <Icon color={isActive ? colors.primary : colors.textMuted} size={24} />
              <Text style={[styles.tabLabel, isActive && styles.activeLabel]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 25, // safe area spacing for newer iphones
    backgroundColor: 'transparent',
  },
  blurView: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  tabLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  activeLabel: {
    color: colors.primary,
    fontWeight: 'bold',
  },
});
