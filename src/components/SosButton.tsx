import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useSos } from '../hooks/useSos';
import { useTheme, ThemeColors } from '../context/ThemeContext';

export const SosButton: React.FC = () => {
  const { openSos } = useSos();
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable style={styles.button} onPress={openSos} hitSlop={10}>
      <Ionicons name="alert-circle" size={18} color={colors.brandGold} />
      <Text style={styles.label}>SOS</Text>
    </Pressable>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  button: {
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
