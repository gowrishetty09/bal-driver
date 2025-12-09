import React from 'react';
import { ScrollView, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { colors } from '../theme/colors';

export type ScreenProps = {
  children: React.ReactNode;
  scrollable?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  edges?: ("top" | "bottom" | "left" | "right")[];
};

const gradientTop = colors.pagenavy ?? colors.brandNavy ?? '#151E2D';
const gradientBottom = colors.pagegold ?? 'rgba(189, 146, 80, 0.15)';
const gradientColors: [string, string] = [gradientTop, gradientBottom];

export const Screen: React.FC<ScreenProps> = ({ children, scrollable, contentContainerStyle, edges = [] }) => {
  return (
    <LinearGradient colors={gradientColors} style={styles.gradient}>
      <SafeAreaView style={styles.container} edges={edges}>
        {scrollable ? (
          <ScrollView
            contentContainerStyle={[styles.content, contentContainerStyle]}
            style={styles.container}
            contentInsetAdjustmentBehavior="never"
          >
            {children}
          </ScrollView>
        ) : (
          <>
            {children}
          </>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flexGrow: 1,
  },
});
