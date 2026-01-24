import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  TextInput,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";

import { Screen } from "../../components/Screen";
import { LocationStatusBanner } from "../../components/LocationStatusBanner";
import { useTheme, ThemeColors } from "../../context/ThemeContext";
import { typography } from "../../theme/typography";
import { HistoryJobsStackParamList } from "../../types/navigation";
import { DriverJob } from "../../api/driver";
import { useRealtimeJobs } from "../../hooks/useRealtimeJobs";
import { formatMYR, shortBookingRef } from "../../utils/format";

type Props = NativeStackScreenProps<HistoryJobsStackParamList, "HistoryJobs">;

export const HistoryJobsScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const {
    bookings: jobs,
    isLoading: loading,
    refreshing,
    refresh,
  } = useRealtimeJobs("HISTORY");

  useFocusEffect(
    useCallback(() => {
      // Realtime updates are handled by the socket listeners inside useRealtimeJobs.
      return () => undefined;
    }, [])
  );

  const onRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  const [query, setQuery] = useState("");

  const filteredJobs = useMemo(() => {
    if (!query || query.trim() === "") return jobs;
    const q = query.trim().toLowerCase();
    return jobs.filter((j) => {
      const shortRef = shortBookingRef(j.id).toLowerCase();
      const idMatch = j.id?.toLowerCase().includes(q) || shortRef.includes(q);
      const nameMatch = (j.passengerName ?? "").toLowerCase().includes(q);
      const vehicleMatch = (j.vehicleNumber ?? "").toLowerCase().includes(q);
      return idMatch || nameMatch || vehicleMatch;
    });
  }, [jobs, query]);

  const renderItem = ({ item }: { item: DriverJob }) => {
    const fareValue =
      typeof item.paymentAmount === "number" ? item.paymentAmount : 0;
    const shortRef = shortBookingRef(item.id);
    const pickupTime = item.scheduledTime
      ? new Date(item.scheduledTime).toLocaleString()
      : "—";
    // Drop time not always available in summary list
    const dropTime = "—";
    const statusColor = (status?: string) => {
      switch (status) {
        case "COMPLETED":
          return "#2E7D32";
        case "CANCELLED":
          return "#C62828";
        default:
          return colors.border;
      }
    };

    return (
      <Pressable
        style={[
          styles.card,
          { borderLeftWidth: 6, borderLeftColor: statusColor(item.status) },
        ]}
        onPress={() => navigation.navigate("JobDetails", { jobId: item.id })}
      >
        <View style={styles.cardLeft}>
          <Text style={styles.jobId} numberOfLines={1} ellipsizeMode="tail">
            {shortRef}
          </Text>
          <Text style={styles.passenger} numberOfLines={1} ellipsizeMode="tail">
            {item.passengerName}
          </Text>
          <Text style={styles.subtle} numberOfLines={1} ellipsizeMode="tail">
            {item.vehicleNumber ?? "—"}
          </Text>
          <Text
            style={styles.times}
            numberOfLines={1}
            ellipsizeMode="tail"
          >{`Pickup: ${pickupTime} • Drop: ${dropTime}`}</Text>
        </View>
        <Text
          style={[
            styles.amount,
            item.status === "CANCELLED" && styles.amountCancelled,
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {formatMYR(fareValue)}
        </Text>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <Screen contentContainerStyle={styles.loaderContainer}>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.searchContainer}>
        <TextInput
          placeholder="Search by booking, name or vehicle"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
        {query !== "" && (
          <Pressable style={styles.clearButton} onPress={() => setQuery("")}>
            <Text style={styles.clearButtonText}>✕</Text>
          </Pressable>
        )}
      </View>

      <LocationStatusBanner />
      <FlatList
        style={styles.list}
        contentContainerStyle={
          filteredJobs.length ? styles.listContent : styles.empty
        }
        data={filteredJobs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>Completed rides will show here.</Text>
        }
      />
    </Screen>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderColor: colors.border,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardLeft: {
    flex: 1,
    paddingRight: 8,
  },
  jobId: {
    fontSize: typography.caption,
    color: colors.brandGold,
  },
  passenger: {
    fontSize: typography.body,
    color: colors.muted,
  },
  subtle: {
    fontSize: typography.caption,
    color: colors.muted,
  },
  amount: {
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
    color: colors.accent,
    minWidth: 84,
    textAlign: "right",
  },
  amountCancelled: {
    textDecorationLine: "line-through",
    color: colors.muted,
  },
  times: {
    marginTop: 6,
    fontSize: typography.caption,
    color: colors.muted,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "transparent",
    borderBottomWidth: 1,
    borderBottomColor: colors.brandGold,
  },
  searchInput: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    borderWidth: 0,
    borderColor: colors.border,
    paddingHorizontal: 12,
    backgroundColor: "transparent",
    color: colors.text,
  },
  clearButton: {
    marginLeft: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  clearButtonText: {
    color: colors.muted,
    fontSize: 16,
  },
  loaderContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  emptyText: {
    fontSize: typography.body,
    color: colors.muted,
  },
});
