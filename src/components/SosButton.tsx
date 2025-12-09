import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useSos } from '../hooks/useSos';
import { colors } from '../theme/colors';

export const SosButton: React.FC = () => {
  const { openSos } = useSos();

  return (
    <Pressable style={styles.button} onPress={openSos} hitSlop={10}>
      <Ionicons name="alert-circle" size={18} color={colors.brandGold} />
      <Text style={styles.label}>SOS</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
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
