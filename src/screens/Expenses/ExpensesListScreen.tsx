import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { listDriverExpenses, type Expense } from "../../api/expenses";
import { Screen } from "../../components/Screen";
import { useTheme, ThemeColors } from "../../context/ThemeContext";
import { typography } from "../../theme/typography";
import { getErrorMessage } from "../../utils/errors";
import { showErrorToast } from "../../utils/toast";
import type { ExpensesStackParamList } from "../../types/navigation";

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

export const ExpensesListScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<ExpensesStackParamList>>();
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [history, setHistory] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const rows = await listDriverExpenses();
      setHistory(rows ?? []);
    } catch (error) {
      showErrorToast(
        "Expenses",
        getErrorMessage(error, "Failed to load expenses")
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadHistory();
    }, [loadHistory])
  );

  const refreshHistory = useCallback(async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  }, [loadHistory]);

  const renderHistoryItem = ({ item }: { item: Expense }) => {
    const pending = item.status === "PENDING";
    const approved = item.status === "APPROVED";
    return (
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>
            {item.expenseType === "FUEL"
              ? "Fuel"
              : item.expenseType === "TOLL"
              ? "Toll"
              : "Other"}
          </Text>
          <Text style={styles.cardAmount}>
            RM {Number(item.amount ?? 0).toFixed(2)}
          </Text>
        </View>
        <Text style={styles.cardText} numberOfLines={2}>
          {item.description || "No description"}
        </Text>
        <View style={styles.cardRow}>
          <Text style={styles.cardSub}>
            {formatDateTime(item.createdAt ?? item.date)}
          </Text>
          <View
            style={[
              styles.statusPill,
              pending && styles.statusPending,
              approved && styles.statusApproved,
              !pending && !approved && styles.statusRejected,
            ]}
          >
            <Text style={styles.statusText}>
              {pending ? "Pending" : approved ? "Approved" : "Rejected"}
            </Text>
          </View>
        </View>
        {item.adminComment ? (
          <Text style={styles.cardComment} numberOfLines={2}>
            Admin comment: {item.adminComment}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <Screen>
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={renderHistoryItem}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshHistory} />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <View>
              <Text style={styles.title}>My Expenses</Text>
              <Text style={styles.subtitle}>
                Submitted expenses and statuses
              </Text>
            </View>
            <Pressable
              style={styles.addButton}
              onPress={() => navigation.navigate("AddExpense")}
            >
              <Text style={styles.addButtonText}>+ Add Expense</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.loadingBlock}>
              <Text style={styles.helperText}>No expenses yet.</Text>
            </View>
          ) : null
        }
        ListFooterComponent={<View style={{ height: 24 }} />}
        keyboardShouldPersistTaps="handled"
      />
      {loading ? (
        <View style={[styles.loadingOverlay]}>
          <ActivityIndicator color={colors.brandNavy} />
        </View>
      ) : null}
    </Screen>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontFamily: typography.fontFamilyBold,
    color: colors.text,
  },
  subtitle: {
    marginTop: 4,
    color: colors.muted,
    fontSize: typography.caption,
  },
  addButton: {
    backgroundColor: colors.brandNavy,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addButtonText: {
    color: colors.brandGold,
    fontFamily: typography.fontFamilyMedium,
    fontSize: typography.caption,
  },
  helperText: {
    marginTop: 6,
    color: colors.muted,
    fontSize: typography.caption,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardLabel: {
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
    color: colors.text,
  },
  cardAmount: {
    fontSize: typography.body,
    fontFamily: typography.fontFamilyBold,
    color: colors.brandGold,
  },
  cardText: {
    marginTop: 6,
    color: colors.muted,
    fontSize: typography.caption,
  },
  cardSub: {
    marginTop: 8,
    color: colors.muted,
    fontSize: typography.caption,
  },
  cardComment: {
    marginTop: 6,
    color: colors.text,
    fontSize: typography.caption,
  },
  loadingBlock: {
    marginTop: 12,
    alignItems: "center",
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: {
    color: colors.textInverse,
    fontSize: typography.caption,
    fontFamily: typography.fontFamilyMedium,
  },
  statusPending: {
    backgroundColor: colors.brandGold,
  },
  statusApproved: {
    backgroundColor: colors.success,
  },
  statusRejected: {
    backgroundColor: colors.danger,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
});
