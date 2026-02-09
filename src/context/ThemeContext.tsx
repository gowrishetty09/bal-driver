import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  // Background colors
  background: string;
  backgroundSecondary: string;
  card: string;
  cardSecondary: string;
  inputBackground: string;
  
  // Text colors
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  muted: string;
  
  // UI elements
  border: string;
  divider: string;
  notification: string;
  
  // Status colors
  success: string;
  error: string;
  warning: string;
  danger: string;
  
  // Brand colors
  primary: string;
  primaryLight: string;
  accent: string;
  highlight: string;
  brandNavy: string;
  brandGold: string;
  
  // Map specific
  mapPin: string;
  mapOverlay: string;
  
  // Tab bar
  tabBarBackground: string;
  tabBarActive: string;
  tabBarInactive: string;
  
  // Buttons
  buttonPrimary: string;
  buttonPrimaryText: string;
  buttonSecondary: string;
  buttonSecondaryText: string;
  
  // Header
  headerBackground: string;
  headerText: string;
  headerIcon: string;
  
  // Status bar
  statusBarStyle: 'light-content' | 'dark-content';
}

export const lightTheme: ThemeColors = {
  // Background colors
  background: '#F5F5F5',
  backgroundSecondary: '#FFFFFF',
  card: '#FFFFFF',
  cardSecondary: '#F9FAFB',
  inputBackground: '#FFFFFF',
  
  // Text colors
  text: '#333333',
  textSecondary: '#666666',
  textMuted: '#999999',
  textInverse: '#FFFFFF',
  muted: '#999999',
  
  // UI elements
  border: '#E5E5E5',
  divider: '#F0F0F0',
  notification: '#EF4444',
  
  // Status colors
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
  danger: '#EF4444',
  
  // Brand colors
  primary: '#151e2d',
  primaryLight: '#2A3A4D',
  accent: '#BD9250',
  highlight: '#D4A853',
  brandNavy: '#151e2d',
  brandGold: '#BD9250',
  
  // Map specific
  mapPin: '#BD9250',
  mapOverlay: 'rgba(255, 255, 255, 0.95)',
  
  // Tab bar
  tabBarBackground: '#FFFFFF',
  tabBarActive: '#151e2d',
  tabBarInactive: '#999999',
  
  // Buttons
  buttonPrimary: '#151e2d',
  buttonPrimaryText: '#FFFFFF',
  buttonSecondary: '#F5F5F5',
  buttonSecondaryText: '#333333',
  
  // Header
  headerBackground: '#151e2d',
  headerText: '#FFFFFF',
  headerIcon: '#BD9250',
  
  // Status bar
  statusBarStyle: 'dark-content',
};

export const darkTheme: ThemeColors = {
  // Background colors
  background: '#0D0D0D',
  backgroundSecondary: '#1A1A1A',
  card: '#1A1A1A',
  cardSecondary: '#242424',
  inputBackground: '#242424',
  
  // Text colors
  text: '#FFFFFF',
  textSecondary: '#B3B3B3',
  textMuted: '#666666',
  textInverse: '#151e2d',
  muted: '#919191',
  
  // UI elements
  border: '#333333',
  divider: '#2A2A2A',
  notification: '#EF4444',
  
  // Status colors
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
  danger: '#EF4444',
  
  // Brand colors
  primary: '#FFFFFF',
  primaryLight: '#E5E5E5',
  accent: '#BD9250',
  highlight: '#D4A853',
  brandNavy: 'rgba(255, 255, 255, 0.9)',
  brandGold: '#BD9250',
  
  // Map specific
  mapPin: '#BD9250',
  mapOverlay: 'rgba(26, 26, 26, 0.95)',
  
  // Tab bar
  tabBarBackground: '#1A1A1A',
  tabBarActive: '#BD9250',
  tabBarInactive: '#666666',
  
  // Buttons
  buttonPrimary: '#BD9250',
  buttonPrimaryText: '#151e2d',
  buttonSecondary: '#2A2A2A',
  buttonSecondaryText: '#FFFFFF',
  
  // Header
  headerBackground: '#151e2d',
  headerText: '#FFFFFF',
  headerIcon: '#BD9250',
  
  // Status bar
  statusBarStyle: 'light-content',
};

// Dark map style for Google Maps
export const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#212121' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#181818' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#373737' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
  { featureType: 'road.highway.controlled_access', elementType: 'geometry', stylers: [{ color: '#4e4e4e' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] },
];

interface ThemeContextType {
  theme: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@driver_app_theme';

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>('light');

  // Load saved theme on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme === 'light' || savedTheme === 'dark') {
          setThemeState(savedTheme);
        }
      } catch (error) {
        console.warn('Failed to load theme:', error);
      }
    };
    loadTheme();
  }, []);

  const setTheme = async (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (error) {
      console.warn('Failed to save theme:', error);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const colors = theme === 'light' ? lightTheme : darkTheme;
  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, colors, isDark, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
