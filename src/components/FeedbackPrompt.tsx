import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { StarRating } from './StarRating';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { useFeedbackStore } from '../store/feedbackStore';
import { showErrorToast, showSuccessToast } from '../utils/toast';
import { getErrorMessage } from '../utils/errors';

const AUTO_DISMISS_TIMEOUT = 30000; // 30 seconds
const SCREEN_HEIGHT = Dimensions.get('window').height;

export type FeedbackPromptProps = {
  visible: boolean;
  onClose: () => void;
  bookingId?: string;
  title?: string;
};

export const FeedbackPrompt: React.FC<FeedbackPromptProps> = ({
  visible,
  onClose,
  bookingId,
  title = 'How was this trip?',
}) => {
  const { submit, isSubmitting } = useFeedbackStore();
  const [rating, setRating] = useState(0);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const autoDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animate in/out
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 9,
      }).start();

      // Set auto-dismiss timer
      autoDismissTimer.current = setTimeout(() => {
        handleClose();
      }, AUTO_DISMISS_TIMEOUT);
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      if (autoDismissTimer.current) {
        clearTimeout(autoDismissTimer.current);
      }
    };
  }, [visible]);

  const handleClose = useCallback(() => {
    if (autoDismissTimer.current) {
      clearTimeout(autoDismissTimer.current);
    }
    setRating(0);
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(async () => {
    if (rating < 1) {
      return;
    }

    // Clear auto-dismiss timer on interaction
    if (autoDismissTimer.current) {
      clearTimeout(autoDismissTimer.current);
    }

    try {
      const response = await submit({
        rating,
        bookingId,
        category: 'BOOKING_PROCESS',
      });

      if (response) {
        showSuccessToast('Thank you!', 'Your feedback helps us improve');
      } else {
        showSuccessToast('Saved', 'Will sync when online');
      }
      handleClose();
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to submit');
      showErrorToast('Feedback', message);
    }
  }, [rating, bookingId, submit, handleClose]);

  const handleRatingChange = useCallback((newRating: number) => {
    // Clear auto-dismiss on interaction
    if (autoDismissTimer.current) {
      clearTimeout(autoDismissTimer.current);
    }
    setRating(newRating);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdropPress} onPress={handleClose} />
        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Close button */}
          <Pressable
            style={styles.closeButton}
            onPress={handleClose}
            hitSlop={12}
          >
            <Ionicons name="close" size={24} color={colors.muted} />
          </Pressable>

          {/* Content */}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            Rate your experience with this booking
          </Text>

          <View style={styles.ratingSection}>
            <StarRating
              rating={rating}
              onRatingChange={handleRatingChange}
              size={44}
            />
            {rating > 0 && (
              <Text style={styles.ratingText}>
                {rating === 1 && 'Poor'}
                {rating === 2 && 'Fair'}
                {rating === 3 && 'Good'}
                {rating === 4 && 'Very Good'}
                {rating === 5 && 'Excellent'}
              </Text>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={styles.skipButton}
              onPress={handleClose}
              disabled={isSubmitting}
            >
              <Text style={styles.skipLabel}>Skip</Text>
            </Pressable>
            <Pressable
              style={[
                styles.submitButton,
                (rating < 1 || isSubmitting) && styles.submitDisabled,
              ]}
              onPress={handleSubmit}
              disabled={rating < 1 || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.brandGold} size="small" />
              ) : (
                <Text style={styles.submitLabel}>Submit</Text>
              )}
            </Pressable>
          </View>

          {/* Auto-dismiss hint */}
          <Text style={styles.autoDismissHint}>
            This will close automatically in 30 seconds
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdropPress: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
  title: {
    fontSize: typography.heading,
    fontFamily: typography.fontFamilyBold,
    color: colors.text,
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    fontSize: typography.body,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 8,
  },
  ratingSection: {
    alignItems: 'center',
    marginVertical: 24,
  },
  ratingText: {
    marginTop: 12,
    fontSize: typography.body,
    color: colors.brandGold,
    fontFamily: typography.fontFamilyMedium,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  skipButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  skipLabel: {
    fontSize: typography.body,
    color: colors.muted,
  },
  submitButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: colors.brandNavy,
    alignItems: 'center',
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitLabel: {
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
    color: colors.brandGold,
  },
  autoDismissHint: {
    marginTop: 16,
    fontSize: typography.caption,
    color: colors.muted,
    textAlign: 'center',
  },
});
