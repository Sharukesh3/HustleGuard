import React, { useState } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import OnboardingScreen from './src/screens/OnboardingScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import PolicyScreen from './src/screens/PolicyScreen';
import ReportHazardScreen from './src/screens/ReportHazardScreen';
import WalletScreen from './src/screens/WalletScreen';
import TabBar from './src/components/TabBar';
import { ThemeProvider, useThemeColors } from './src/theme/ThemeContext';

function MainApp() {
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const handleCompleteOnboarding = (profile) => {
    setUserProfile(profile);
    setIsOnboarded(true);
  };

  const renderScreen = () => {
    switch(activeTab) {
      case 'home':
        return <DashboardScreen userProfile={userProfile} />;
      case 'policy':
        return <PolicyScreen userProfile={userProfile} />;
      case 'hazard':
        return <ReportHazardScreen userProfile={userProfile} />;
      case 'wallet':
        return <WalletScreen userProfile={userProfile} />;
      default:
        return <DashboardScreen userProfile={userProfile} />;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={colors.isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
      />
      {!isOnboarded ? (
        <OnboardingScreen onComplete={handleCompleteOnboarding} />
      ) : (
        <View style={styles.appContainer}>
           {renderScreen()}
           <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
        </View>
      )}
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MainApp />
    </ThemeProvider>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundDark || colors.background, // Fill the whole web window with the dark theme natively
  },
  appContainer: {
    flex: 1,
    position: 'relative',
    width: '100%',
    backgroundColor: colors.background
  }
});

