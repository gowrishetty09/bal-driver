import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { AppText as Text } from './AppText';
import { Ionicons } from '@expo/vector-icons';

import { useSos } from '../hooks/useSos';
import { useTheme, ThemeColors } from '../context/ThemeContext';

export const SosButton: React.FC = () => {
  const { openSos } = useSos();
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Emergency assistance" style={styles.button} onPress={openSos} hitSlop={4}>
      <Ionicons name="alert-circle" size={18} color={colors.brandGold} />
      <Text style={styles.label}>SOS</Text>
    </Pressable>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  button: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.brandGold,
    backgroundColor: colors.brandNavy,
  },
  label: {
    color: colors.brandGold,
    fontWeight: '600',
  },
});
