import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { Screen } from "../../components/Screen";
import { LocationStatusBanner } from "../../components/LocationStatusBanner";
import { useTheme, ThemeColors } from "../../context/ThemeContext";
import { typography } from "../../theme/typography";
import type { DriverJob, JobType } from "../../api/driver";
import { useRealtimeJobs } from "../../hooks/useRealtimeJobs";
import type { RidesStackParamList } from "../../types/navigation";
import { shortBookingRef } from "../../utils/format";

type Props = NativeStackScreenProps<RidesStackParamList, "Rides">;

type RideFilter = JobType;

const FILTERS: Array<{ key: RideFilter; label: string }> = [
  { key: "ACTIVE", label: "Active" },
  { key: "UPCOMING", label: "Upcoming" },
  { key: "HISTORY", label: "History" },
];

const getStatusColor = (status: string | undefined, colors: ThemeColors) => {
  switch (status) {
    case "COMPLETED":
      return colors.success;
    case "CANCELLED":
      return colors.danger;
    case "PICKED_UP":
      return colors.primary;
    case "ARRIVED":
      return colors.brandGold;
    case "EN_ROUTE":
      return colors.accent;
    default:
      return colors.border;
  }
};

export const RidesScreen: React.FC<Props> = ({ navigation, route }) => {
  const initialType = route.params?.initialType;
  const [filter, setFilter] = useState<RideFilter>(initialType ?? "ACTIVE");
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { bookings, isLoading, refreshing, refresh } = useRealtimeJobs(filter);

  const [query, setQuery] = useState("");

  const onRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  const showSearch = filter === "HISTORY";

  const filtered = useMemo(() => {
    if (!showSearch) return bookings;
    if (!query || query.trim() === "") return bookings;
    const q = query.trim().toLowerCase();
    return bookings.filter((j) => {
      const shortRef = shortBookingRef(j.id).toLowerCase();
      const idMatch = j.id?.toLowerCase().includes(q) || shortRef.includes(q);
      const nameMatch = (j.passengerName ?? "").toLowerCase().includes(q);
      const vehicleMatch = (j.vehicleNumber ?? "").toLowerCase().includes(q);
      return idMatch || nameMatch || vehicleMatch;
    });
  }, [bookings, query, showSearch]);

  const renderItem = ({ item }: { item: DriverJob }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => navigation.navigate("JobDetails", { jobId: item.id })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.jobRef} numberOfLines={1}>
            {shortBookingRef(item.id)}
          </Text>
          <Text style={styles.subtle} numberOfLines={1}>
            {item.vehicleNumber ?? "—"}
          </Text>
        </View>
        <View
          style={[
            styles.statusPill,
            { borderColor: getStatusColor(item.status, colors) },
          ]}
        >
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <Text style={styles.passenger} numberOfLines={1}>
        {item.passengerName || "Customer"}
      </Text>

      <Text style={styles.route} numberOfLines={2}>
        {(item.pickup?.addressLine ?? "—") + " → " +
          (item.dropoff?.addressLine ?? "—")}
      </Text>

      <View style={styles.cardFooter}>
        <Text style={styles.time}>
          {item.scheduledTime
            ? new Date(item.scheduledTime).toLocaleString()
            : "—"}
        </Text>
        <Text style={styles.tapHint}>Tap to view →</Text>
      </View>
    </Pressable>
  );

  return (
    <Screen>
      <LocationStatusBanner />

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const selected = f.key === filter;
          return (
            <Pressable
              key={f.key}
              style={[styles.filterPill, selected && styles.filterPillSelected]}
              onPress={() => setFilter(f.key)}
            >
              <Text
                style={[
                  styles.filterText,
                  selected && styles.filterTextSelected,
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {showSearch ? (
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
      ) : null}

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={filtered.length ? styles.listContent : styles.empty}
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {filter === "ACTIVE"
                ? "No active rides assigned."
                : filter === "UPCOMING"
                  ? "No upcoming rides scheduled."
                  : "Completed rides will show here."}
            </Text>
          }
        />
      )}
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
  loaderContainer: {
    flex: 1,
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
    textAlign: "center",
  },
  filterRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterPill: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSecondary,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
  },
  filterPillSelected: {
    backgroundColor: colors.brandGold,
    borderColor: colors.brandGold,
  },
  filterText: {
    fontSize: typography.caption,
    fontFamily: typography.fontFamilyMedium,
    color: colors.text,
  },
  filterTextSelected: {
    color: colors.brandNavy,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "transparent",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    backgroundColor: colors.card,
  },
  clearButtonText: {
    color: colors.muted,
    fontSize: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderColor: colors.border,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardPressed: {
    backgroundColor: colors.cardSecondary,
    transform: [{ scale: 0.98 }],
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 10,
  },
  cardHeaderLeft: {
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: colors.cardSecondary,
  },
  statusText: {
    fontSize: 10,
    color: colors.text,
    fontFamily: typography.fontFamilyMedium,
  },
  jobRef: {
    fontSize: typography.subheading,
    fontFamily: typography.fontFamilyBold,
    color: colors.text,
  },
  subtle: {
    fontSize: typography.caption,
    color: colors.muted,
  },
  passenger: {
    marginTop: 4,
    fontSize: typography.body,
    color: colors.muted,
  },
  route: {
    marginTop: 2,
    fontSize: typography.caption,
    color: colors.muted,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  time: {
    fontSize: 10,
    color: colors.highlight,
    fontFamily: typography.fontFamilyMedium,
  },
  tapHint: {
    fontSize: typography.caption,
    color: colors.muted,
  },
});
