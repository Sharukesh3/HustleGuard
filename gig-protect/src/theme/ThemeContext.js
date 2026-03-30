import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';

const light = {
  backgroundDark: 'hsl(220, 59%, 91%)',
  background: 'hsl(220, 100%, 97%)',
  surfaceHighlight: 'hsl(220, 100%, 100%)', // bg-light
  surface: 'hsl(220, 100%, 97%)',
  text: 'hsl(226, 85%, 7%)',
  textMuted: 'hsl(220, 26%, 31%)',
  highlight: 'hsl(220, 100%, 100%)',
  border: 'hsl(220, 19%, 53%)',
  borderMuted: 'hsl(220, 27%, 65%)',
  primary: 'hsl(221, 49%, 33%)',
  primaryMuted: 'hsla(221, 49%, 33%, 0.15)',
  secondary: 'hsl(44, 100%, 14%)',
  danger: 'hsl(9, 21%, 41%)',
  warning: 'hsl(52, 23%, 34%)',
  success: 'hsl(147, 19%, 36%)',
  info: 'hsl(217, 22%, 41%)',
  isDark: false
};

const dark = {
  backgroundDark: 'hsl(228, 79%, 2%)',
  background: 'hsl(222, 55%, 5%)',
  surfaceHighlight: 'hsl(220, 35%, 10%)', // bg-light
  surface: 'hsl(222, 55%, 5%)',
  text: 'hsl(220, 100%, 98%)',
  textMuted: 'hsl(220, 35%, 73%)',
  highlight: 'hsl(220, 20%, 42%)',
  border: 'hsl(220, 26%, 31%)',
  borderMuted: 'hsl(220, 37%, 20%)',
  primary: 'hsl(220, 78%, 76%)',
  primaryMuted: 'hsla(220, 78%, 76%, 0.15)',
  secondary: 'hsl(40, 53%, 60%)',
  danger: 'hsl(9, 26%, 64%)',
  warning: 'hsl(52, 19%, 57%)',
  success: 'hsl(146, 17%, 59%)',
  info: 'hsl(217, 28%, 65%)',
  isDark: true
};

export const ThemeContext = createContext({
  theme: 'system',
  colors: dark,
  setTheme: () => {},
  toggleTheme: () => {}
});

export const ThemeProvider = ({ children }) => {
  const systemScheme = useColorScheme();
  const [theme, setThemeState] = useState('system'); // 'light', 'dark', 'system'
  const [activeColors, setActiveColors] = useState(systemScheme === 'light' ? light : dark);

  useEffect(() => {
    if (theme === 'system') {
      setActiveColors(systemScheme === 'light' ? light : dark);
    } else {
      setActiveColors(theme === 'light' ? light : dark);
    }
  }, [theme, systemScheme]);

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState((prevTheme) => {
      if (prevTheme === 'light') return 'dark';
      if (prevTheme === 'dark') return 'system';
      return systemScheme === 'light' ? 'dark' : 'light';
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, colors: activeColors, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
export const useThemeColors = () => useContext(ThemeContext).colors;
