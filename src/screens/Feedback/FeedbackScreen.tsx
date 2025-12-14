import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '../../components/Screen';
import { StarRating } from '../../components/StarRating';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { FeedbackStackParamList } from '../../types/navigation';
import { FeedbackCategory } from '../../api/feedback';
import { useFeedbackStore } from '../../store/feedbackStore';
import { getErrorMessage } from '../../utils/errors';
import { showErrorToast, showSuccessToast } from '../../utils/toast';

const MAX_COMMENT_LENGTH = 1000;

type CategoryOption = {
  label: string;
  value: FeedbackCategory;
  description: string;
};

const categoryOptions: CategoryOption[] = [
  {
    label: 'App Experience',
    value: 'APP_EXPERIENCE',
    description: 'App bugs, crashes, navigation issues',
  },
  {
    label: 'Booking Process',
    value: 'BOOKING_PROCESS',
    description: 'Dispatch issues, booking clarity',
  },
  {
    label: 'Pricing',
    value: 'PRICING',
    description: 'Fare concerns, commission issues',
  },
  {
    label: 'Service Quality',
    value: 'SERVICE_QUALITY',
    description: 'Support response, issue resolution',
  },
  {
    label: 'Vehicle Condition',
    value: 'VEHICLE_CONDITION',
    description: 'Company-provided vehicle issues',
  },
  {
    label: 'Other',
    value: 'OTHER',
    description: 'General feedback or suggestions',
  },
];

type Props = NativeStackScreenProps<FeedbackStackParamList, 'Feedback'>;

export const FeedbackScreen: React.FC<Props> = ({ navigation, route }) => {
  const { submit, isSubmitting, pendingFeedback } = useFeedbackStore();
  
  // Pre-select category if provided (e.g., from Report Issue)
  const initialCategory = route.params?.preSelectedCategory;
  const bookingId = route.params?.bookingId;
  const isReportIssue = route.params?.isReportIssue ?? false;

  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState<FeedbackCategory | null>(initialCategory ?? null);
  const [comment, setComment] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const isValid = useMemo(() => rating >= 1 && rating <= 5, [rating]);
  const characterCount = comment.length;

  const handleSubmit = useCallback(async () => {
    if (!isValid) {
      showErrorToast('Feedback', 'Please select a rating');
      return;
    }

    try {
      const response = await submit({
        rating,
        category: category ?? undefined,
        comment: comment.trim() || undefined,
        bookingId: bookingId ?? undefined,
      });

      if (response) {
        showSuccessToast('Thank you!', 'Feedback submitted successfully');
        setShowSuccess(true);
      } else {
        // Saved offline
        showSuccessToast('Saved', 'Feedback saved and will be submitted when online');
        setShowSuccess(true);
      }
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to submit feedback');
      showErrorToast('Feedback', message);
    }
  }, [rating, category, comment, bookingId, isValid, submit]);

  const handleDone = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  if (showSuccess) {
    return (
      <Screen>
        <View style={styles.successContainer}>
          <View style={styles.successIconContainer}>
            <Ionicons name="checkmark-circle" size={80} color={colors.success} />
          </View>
          <Text style={styles.successTitle}>Thank You!</Text>
          <Text style={styles.successMessage}>
            Your feedback helps us improve the app and service for all drivers.
          </Text>
          <Pressable style={styles.doneButton} onPress={handleDone}>
            <Text style={styles.doneButtonLabel}>Done</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Pending feedback indicator */}
        {pendingFeedback.length > 0 && (
          <View style={styles.pendingBanner}>
            <Ionicons name="cloud-offline-outline" size={18} color={colors.brandGold} />
            <Text style={styles.pendingText}>
              {pendingFeedback.length} pending feedback{pendingFeedback.length > 1 ? 's' : ''} will sync when online
            </Text>
          </View>
        )}

        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={styles.title}>
            {isReportIssue ? 'Report an Issue' : 'Share Your Feedback'}
          </Text>
          <Text style={styles.subtitle}>
            {isReportIssue
              ? 'Help us resolve your issue quickly'
              : 'Your feedback helps us improve the driver experience'}
          </Text>
        </View>

        {/* Star Rating */}
        <View style={styles.section}>
          <Text style={styles.label}>How would you rate your experience?</Text>
          <View style={styles.ratingContainer}>
            <StarRating rating={rating} onRatingChange={setRating} size={48} />
          </View>
          {rating > 0 && (
            <Text style={styles.ratingLabel}>
              {rating === 1 && 'Poor'}
              {rating === 2 && 'Fair'}
              {rating === 3 && 'Good'}
              {rating === 4 && 'Very Good'}
              {rating === 5 && 'Excellent'}
            </Text>
          )}
        </View>

        {/* Category Selection */}
        <View style={styles.section}>
          <Text style={styles.label}>Category (optional)</Text>
          <View style={styles.categoryGrid}>
            {categoryOptions.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.categoryChip,
                  category === option.value && styles.categoryChipSelected,
                ]}
                onPress={() =>
                  setCategory(category === option.value ? null : option.value)
                }
              >
                <Text
                  style={[
                    styles.categoryLabel,
                    category === option.value && styles.categoryLabelSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {category && (
            <Text style={styles.categoryDescription}>
              {categoryOptions.find((c) => c.value === category)?.description}
            </Text>
          )}
        </View>

        {/* Comment Input */}
        <View style={styles.section}>
          <View style={styles.commentHeader}>
            <Text style={styles.label}>Additional Comments (optional)</Text>
            <Text style={styles.characterCount}>
              {characterCount}/{MAX_COMMENT_LENGTH}
            </Text>
          </View>
          <TextInput
            style={styles.commentInput}
            placeholder="Tell us more about your experience or suggestions..."
            placeholderTextColor={colors.muted}
            value={comment}
            onChangeText={(text) =>
              setComment(text.slice(0, MAX_COMMENT_LENGTH))
            }
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </View>

        {/* Submit Button */}
        <Pressable
          style={[
            styles.submitButton,
            (!isValid || isSubmitting) && styles.submitDisabled,
          ]}
          disabled={!isValid || isSubmitting}
          onPress={handleSubmit}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.brandGold} />
          ) : (
            <>
              <Ionicons
                name="send"
                size={20}
                color={isValid ? colors.brandGold : colors.muted}
              />
              <Text
                style={[
                  styles.submitLabel,
                  !isValid && styles.submitLabelDisabled,
                ]}
              >
                Submit Feedback
              </Text>
            </>
          )}
        </Pressable>

        {/* Quick Tips */}
        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>Quick Tips</Text>
          <Text style={styles.tipText}>
            • Only rating is required - takes just one tap
          </Text>
          <Text style={styles.tipText}>
            • Categories help us route feedback to the right team
          </Text>
          <Text style={styles.tipText}>
            • Feedback is synced automatically when you're back online
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.brandNavy,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  pendingText: {
    color: colors.brandGold,
    fontSize: typography.caption,
    flex: 1,
  },
  headerSection: {
    marginBottom: 24,
  },
  title: {
    fontSize: typography.heading,
    fontFamily: typography.fontFamilyBold,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.body,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 8,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
    color: colors.text,
    marginBottom: 12,
  },
  ratingContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ratingLabel: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: typography.body,
    color: colors.brandGold,
    fontFamily: typography.fontFamilyMedium,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  categoryChipSelected: {
    backgroundColor: colors.brandNavy,
    borderColor: colors.brandNavy,
  },
  categoryLabel: {
    fontSize: typography.caption,
    color: colors.text,
  },
  categoryLabelSelected: {
    color: colors.brandGold,
    fontFamily: typography.fontFamilyMedium,
  },
  categoryDescription: {
    marginTop: 8,
    fontSize: typography.caption,
    color: colors.muted,
    fontStyle: 'italic',
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  characterCount: {
    fontSize: typography.caption,
    color: colors.muted,
  },
  commentInput: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: typography.body,
    color: colors.text,
    backgroundColor: '#fff',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.brandNavy,
    paddingVertical: 18,
    borderRadius: 16,
    marginTop: 8,
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitLabel: {
    color: colors.brandGold,
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
  },
  submitLabelDisabled: {
    color: colors.muted,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  successIconContainer: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: typography.heading,
    fontFamily: typography.fontFamilyBold,
    color: colors.text,
    marginBottom: 12,
  },
  successMessage: {
    fontSize: typography.body,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 24,
  },
  doneButton: {
    marginTop: 32,
    backgroundColor: colors.brandNavy,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 16,
  },
  doneButtonLabel: {
    color: colors.brandGold,
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
  },
  tipsContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 12,
  },
  tipsTitle: {
    fontSize: typography.caption,
    fontFamily: typography.fontFamilyMedium,
    color: colors.text,
    marginBottom: 8,
  },
  tipText: {
    fontSize: typography.caption,
    color: colors.muted,
    lineHeight: 20,
  },
});
