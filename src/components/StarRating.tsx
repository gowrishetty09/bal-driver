import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../theme/colors';

export type StarRatingProps = {
  rating: number;
  onRatingChange?: (rating: number) => void;
  size?: number;
  readonly?: boolean;
  starColor?: string;
  emptyColor?: string;
};

export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  onRatingChange,
  size = 40,
  readonly = false,
  starColor = colors.brandGold,
  emptyColor = colors.border,
}) => {
  const handlePress = (star: number) => {
    if (!readonly && onRatingChange) {
      onRatingChange(star);
    }
  };

  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          onPress={() => handlePress(star)}
          disabled={readonly}
          hitSlop={8}
          style={({ pressed }) => [
            styles.star,
            !readonly && pressed && styles.starPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${star} star${star > 1 ? 's' : ''}`}
          accessibilityState={{ selected: star <= rating }}
        >
          <Ionicons
            name={star <= rating ? 'star' : 'star-outline'}
            size={size}
            color={star <= rating ? starColor : emptyColor}
          />
        </Pressable>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  star: {
    padding: 4,
  },
  starPressed: {
    opacity: 0.7,
    transform: [{ scale: 1.1 }],
  },
});
