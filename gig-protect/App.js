import React, { useState, useEffect } from 'react';
import { View, StyleSheet, StatusBar, Platform } from 'react-native';
import OnboardingScreen from './src/screens/OnboardingScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import PolicyScreen from './src/screens/PolicyScreen';
import ReportHazardScreen from './src/screens/ReportHazardScreen';
import WalletScreen from './src/screens/WalletScreen';
import AdminDashboardScreen from './src/screens/AdminDashboardScreen';
import AdminLoginScreen from './src/screens/AdminLoginScreen';
import TabBar from './src/components/TabBar';
import { ThemeProvider, useThemeColors } from './src/theme/ThemeContext';

function MainApp() {
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  
  // Admin state
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web' && window.location.pathname === '/admin') {
      setIsAdminMode(true);
    }
  }, []);

  const colors = useThemeColors();
  const styles = getStyles(colors);

  const handleCompleteOnboarding = (profile) => {
    setUserProfile(profile);
    setIsOnboarded(true);
  };

  const renderScreen = () => {
    if (isAdminMode) {
      return isAdminLoggedIn ? (
        <AdminDashboardScreen />
      ) : (
        <AdminLoginScreen onLoginSuccess={() => setIsAdminLoggedIn(true)} />
      );
    }

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
      
      {isAdminMode ? (
         <View style={styles.appContainer}>
            {isAdminLoggedIn ? (
              <AdminDashboardScreen />
            ) : (
              <AdminLoginScreen onLoginSuccess={() => setIsAdminLoggedIn(true)} />
            )}
         </View>
      ) : !isOnboarded ? (
        <OnboardingScreen onComplete={handleCompleteOnboarding} onAdminRequest={() => setIsAdminMode(true)} />
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

