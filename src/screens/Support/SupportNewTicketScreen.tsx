import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '../../components/Screen';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { SupportStackParamList } from '../../types/navigation';
import { useSupportStore } from '../../store/supportStore';
import { getErrorMessage } from '../../utils/errors';
import { showErrorToast, showSuccessToast } from '../../utils/toast';
import { TicketCategory, TicketPriority } from '../../api/support';

const categoryOptions: Array<{ label: string; value: TicketCategory }> = [
  { label: 'Payment Issue', value: 'PAYMENT_ISSUE' },
  { label: 'App Issue', value: 'APP_ISSUE' },
  { label: 'Driver Issue', value: 'DRIVER_ISSUE' },
  { label: 'Other', value: 'OTHER' },
];

const priorityOptions: Array<{ label: string; value: TicketPriority }> = [
  { label: 'Low', value: 'LOW' },
  { label: 'Normal', value: 'NORMAL' },
  { label: 'High', value: 'HIGH' },
];

type Props = NativeStackScreenProps<SupportStackParamList, 'NewSupportTicket'>;

export const SupportNewTicketScreen: React.FC<Props> = ({ navigation }) => {
  const { createTicket } = useSupportStore();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TicketCategory>('DRIVER_ISSUE');
  const [priority, setPriority] = useState<TicketPriority | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isValid = useMemo(
    () => subject.trim().length >= 4 && description.trim().length >= 10 && Boolean(priority),
    [subject, description, priority]
  );

  const handleSubmit = async () => {
    if (!isValid) {
      return;
    }
    setSubmitting(true);
    if (!priority) {
      showErrorToast('Support', 'Please choose a priority');
      setSubmitting(false);
      return;
    }
    try {
      const ticket = await createTicket({
        subject: subject.trim(),
        description: description.trim(),
        category,
        priority,
      });
      if (ticket) {
        showSuccessToast('Ticket created', 'Support will be in touch shortly.');
        navigation.reset({
          index: 0,
          routes: [{ name: 'SupportTickets' }],
        });
      }
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to create ticket');
      showErrorToast('Support', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Subject</Text>
        <TextInput
          style={styles.input}
          placeholder="Brief title"
          placeholderTextColor={colors.muted}
          value={subject}
          onChangeText={setSubject}
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.optionRow}>
          {categoryOptions.map((option) => (
            <Pressable
              key={option.value}
              style={[styles.optionChip, option.value === category && styles.optionChipSelected]}
              onPress={() => setCategory(option.value)}
            >
              <Text style={[styles.optionChipLabel, option.value === category && styles.optionChipLabelSelected]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Priority</Text>
        <View style={styles.optionRow}>
          {priorityOptions.map((option) => (
            <Pressable
              key={option.value}
              style={[styles.optionChipSmall, option.value === priority && styles.optionChipSelected]}
              onPress={() => setPriority(option.value)}
            >
              <Text style={[styles.optionChipLabel, option.value === priority && styles.optionChipLabelSelected]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {!priority && <Text style={styles.helperText}>Select a priority so dispatch can triage the ticket</Text>}

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Describe the issue in detail"
          placeholderTextColor={colors.muted}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={6}
        />

        <Pressable
          style={[styles.submitButton, (!isValid || submitting) && styles.submitDisabled]}
          disabled={!isValid || submitting}
          onPress={handleSubmit}
        >
          {submitting ? <ActivityIndicator color={colors.brandGold} /> : <Text style={styles.submitLabel}>Create ticket</Text>}
        </Pressable>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  label: {
    marginTop: 16,
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
    color: colors.text,
  },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: typography.body,
    color: colors.text,
    backgroundColor: '#fff',
  },
  multiline: {
    minHeight: 140,
    textAlignVertical: 'top',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionChipSmall: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionChipSelected: {
    backgroundColor: colors.brandNavy,
    borderColor: colors.brandNavy,
  },
  optionChipLabel: {
    color: colors.text,
    fontSize: typography.caption,
  },
  optionChipLabelSelected: {
    color: colors.brandGold,
    fontFamily: typography.fontFamilyMedium,
  },
  helperText: {
    marginTop: 4,
    color: colors.muted,
    fontSize: typography.caption,
  },
  submitButton: {
    marginTop: 24,
    backgroundColor: colors.brandNavy,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitLabel: {
    color: colors.brandGold,
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
  },
});
