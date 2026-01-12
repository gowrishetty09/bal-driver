import React, { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "../../components/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { SupportStackParamList } from "../../types/navigation";
import { useSupportStore } from "../../store/supportStore";
import { getErrorMessage } from "../../utils/errors";
import { showErrorToast } from "../../utils/toast";

const statusColors: Record<string, string> = {
  OPEN: colors.primary,
  IN_PROGRESS: colors.brandNavy,
  RESOLVED: colors.success,
  CLOSED: colors.muted,
};

const formatDate = (value: string) => new Date(value).toLocaleDateString();

type Props = NativeStackScreenProps<SupportStackParamList, "SupportTickets">;

export const SupportListScreen: React.FC<Props> = ({ navigation }) => {
  const { tickets, isLoadingList, fetchTickets } = useSupportStore();

  const loadTickets = useCallback(async () => {
    try {
      await fetchTickets();
    } catch (error) {
      const message = getErrorMessage(error, "Unable to load tickets");
      showErrorToast("Support", message);
    }
  }, [fetchTickets]);

  useFocusEffect(
    useCallback(() => {
      loadTickets();
    }, [loadTickets])
  );

  const renderItem = ({ item }: { item: (typeof tickets)[number] }) => (
    <Pressable
      style={styles.card}
      onPress={() =>
        navigation.navigate("SupportTicketDetails", { ticketId: item.id })
      }
    >
      <View style={styles.cardHeader}>
        <Text style={styles.subject}>{item.subject}</Text>
        <View
          style={[
            styles.statusPill,
            { backgroundColor: statusColors[item.status] ?? colors.brandNavy },
          ]}
        >
          <Text style={styles.statusLabel}>
            {item.status.replace("_", " ")}
          </Text>
        </View>
      </View>
      <Text style={styles.metaText}>{`${item.category.replace(
        "_",
        " "
      )} • Priority ${item.priority}`}</Text>
      <Text style={styles.timestamp}>{`Created ${formatDate(
        item.createdAt
      )}`}</Text>
    </Pressable>
  );

  const empty = !isLoadingList && tickets.length === 0;

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Support Tickets</Text>
        <View style={styles.headerButtons}>
          <Pressable
            style={styles.feedbackButton}
            onPress={() => navigation.navigate("Feedback", {})}
          >
            <Ionicons name="star-outline" size={18} color={colors.brandGold} />
          </Pressable>
          <Pressable
            style={styles.newTicketButton}
            onPress={() => navigation.navigate("NewSupportTicket")}
          >
            <Text style={styles.newTicketLabel}>New ticket</Text>
          </Pressable>
        </View>
      </View>
      {isLoadingList && tickets.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={
            tickets.length ? styles.listContent : styles.emptyContent
          }
          data={tickets}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={isLoadingList}
              onRefresh={loadTickets}
            />
          }
          ListEmptyComponent={
            empty ? <Text style={styles.emptyText}>No tickets yet.</Text> : null
          }
        />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heading: {
    fontSize: typography.heading,
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
  },
  feedbackButton: {
    backgroundColor: colors.brandNavy,
    padding: 10,
    borderRadius: 12,
  },
  newTicketButton: {
    backgroundColor: colors.brandNavy,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  newTicketLabel: {
    color: colors.brandGold,
    fontFamily: typography.fontFamilyMedium,
  },
  loaderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  emptyContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.body,
  },
  card: {
    backgroundColor: colors.cardbgtransparent,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  subject: {
    fontSize: typography.subheading,
    fontFamily: typography.fontFamilyMedium,
    color: colors.text,
    flex: 1,
    paddingRight: 12,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusLabel: {
    color: "#fff",
    fontSize: typography.caption,
    fontFamily: typography.fontFamilyMedium,
  },
  metaText: {
    marginTop: 8,
    color: colors.muted,
    fontSize: typography.caption,
  },
  timestamp: {
    marginTop: 4,
    fontSize: typography.caption,
    color: colors.muted,
  },
});
