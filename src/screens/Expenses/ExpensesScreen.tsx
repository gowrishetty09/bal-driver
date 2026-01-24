import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { submitDriverExpense, type DriverExpenseTypeInput } from "../../api/expenses";
import { Screen } from "../../components/Screen";
import { useTheme, ThemeColors } from "../../context/ThemeContext";
import { typography } from "../../theme/typography";
import { getErrorMessage } from "../../utils/errors";
import { showErrorToast, showSuccessToast } from "../../utils/toast";
import type { ExpensesStackParamList } from "../../types/navigation";

const toTodayYmd = () => new Date().toISOString().slice(0, 10);

const parseYmdToIso = (ymd: string): string | null => {
  const trimmed = (ymd ?? "").trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;

  const [y, m, d] = trimmed.split("-").map((v) => Number(v));
  if (!y || !m || !d) return null;

  const date = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

export const AddExpenseScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<ExpensesStackParamList>>();
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const [expenseType, setExpenseType] = useState<DriverExpenseTypeInput>("fuel");
  const [amountText, setAmountText] = useState("");
  const [description, setDescription] = useState("");
  const [dateText, setDateText] = useState(toTodayYmd());
  const [submitting, setSubmitting] = useState(false);

  const amount = useMemo(() => {
    const val = Number(amountText);
    return Number.isFinite(val) ? val : NaN;
  }, [amountText]);

  const descriptionRequired = expenseType === "other";

  const isValid = useMemo(() => {
    if (!Number.isFinite(amount) || amount <= 0) return false;
    if (descriptionRequired && description.trim().length === 0) return false;
    const iso = parseYmdToIso(dateText);
    return Boolean(iso);
  }, [amount, description, descriptionRequired, dateText]);

  const handleSubmit = async () => {
    if (!isValid || submitting) {
      if (!Number.isFinite(amount) || amount <= 0) {
        showErrorToast("Expenses", "Please enter a valid amount");
      } else if (descriptionRequired && description.trim().length === 0) {
        showErrorToast("Expenses", "Description is required for Other");
      } else if (!parseYmdToIso(dateText)) {
        showErrorToast("Expenses", "Please enter a valid date (YYYY-MM-DD)");
      }
      return;
    }

    const isoDate = parseYmdToIso(dateText);
    if (!isoDate) {
      showErrorToast("Expenses", "Invalid date");
      return;
    }

    setSubmitting(true);
    try {
      await submitDriverExpense({
        expenseType,
        amount,
        description: description.trim() || undefined,
        date: isoDate,
      });

      showSuccessToast("Expense submitted", "Pending admin approval");
      navigation.goBack();
    } catch (error) {
      showErrorToast("Expenses", getErrorMessage(error, "Unable to submit expense"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Add Expense</Text>
        <Text style={styles.subtitle}>Submit fuel/toll/other expenses for approval</Text>

        <Text style={styles.label}>Expense Type</Text>
        <View style={styles.optionRow}>
          {(
            [
              { label: "Fuel", value: "fuel" },
              { label: "Toll", value: "toll" },
              { label: "Other", value: "other" },
            ] as const
          ).map((opt) => (
            <Pressable
              key={opt.value}
              style={[styles.optionChip, opt.value === expenseType && styles.optionChipSelected]}
              onPress={() => setExpenseType(opt.value)}
            >
              <Text style={[styles.optionChipLabel, opt.value === expenseType && styles.optionChipLabelSelected]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Amount</Text>
        <TextInput
          style={styles.input}
          placeholder="0.00"
          placeholderTextColor={colors.muted}
          keyboardType="numeric"
          value={amountText}
          onChangeText={setAmountText}
        />

        <Text style={styles.label}>Description{descriptionRequired ? " (required)" : " (optional)"}</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder={descriptionRequired ? "Enter description" : "Add a note (optional)"}
          placeholderTextColor={colors.muted}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
        />

        <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          placeholder={toTodayYmd()}
          placeholderTextColor={colors.muted}
          value={dateText}
          onChangeText={setDateText}
          autoCapitalize="none"
        />
        <Text style={styles.helperText}>Defaults to today if unchanged</Text>

        <Pressable
          style={[styles.submitButton, (!isValid || submitting) && styles.submitDisabled]}
          disabled={!isValid || submitting}
          onPress={handleSubmit}
        >
          {submitting ? <ActivityIndicator color={colors.brandGold} /> : <Text style={styles.submitLabel}>Submit Expense</Text>}
        </Pressable>
      </ScrollView>
    </Screen>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontFamily: typography.fontFamilyBold,
    color: colors.text,
  },
  subtitle: {
    marginTop: 6,
    color: colors.muted,
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
  },
  label: {
    marginTop: 18,
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
    backgroundColor: colors.inputBackground,
  },
  multiline: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  optionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
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
    marginTop: 6,
    color: colors.muted,
    fontSize: typography.caption,
  },
  submitButton: {
    marginTop: 24,
    backgroundColor: colors.brandNavy,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
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
