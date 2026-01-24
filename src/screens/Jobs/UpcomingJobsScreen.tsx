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

import { Screen } from "../../components/Screen";
import { LocationStatusBanner } from "../../components/LocationStatusBanner";
import { useTheme, ThemeColors } from "../../context/ThemeContext";
import { typography } from "../../theme/typography";
import { UpcomingJobsStackParamList } from "../../types/navigation";
import { DriverJob } from "../../api/driver";
import { useRealtimeJobs } from "../../hooks/useRealtimeJobs";

type Props = NativeStackScreenProps<UpcomingJobsStackParamList, "UpcomingJobs">;

export const UpcomingJobsScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const {
    bookings: jobs,
    isLoading: loading,
    refreshing,
    refresh,
  } = useRealtimeJobs("UPCOMING");

  useFocusEffect(
    useCallback(() => {
      // Realtime updates are handled by the socket listeners inside useRealtimeJobs.
      return () => undefined;
    }, [])
  );

  const onRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  const renderItem = ({ item }: { item: DriverJob }) => (
    <Pressable
      style={styles.card}
      onPress={() => navigation.navigate("JobDetails", { jobId: item.id })}
    >
      <View>
        <Text style={styles.jobId}>{item.reference}</Text>
        <Text style={styles.passenger}>{item.passengerName}</Text>
        <Text style={styles.route}>{item.pickup?.addressLine ?? "—"}</Text>
        <Text style={styles.subtle}>{item.vehicleNumber ?? "—"}</Text>
      </View>
      <View style={styles.rightContent}>
        <Text style={styles.label}>Pickup</Text>
        <Text style={styles.value}>
          {new Date(item.scheduledTime).toLocaleTimeString()}
        </Text>
      </View>
    </Pressable>
  );

  if (loading) {
    return (
      <Screen contentContainerStyle={styles.loaderContainer}>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }

  return (
    <Screen>
      <LocationStatusBanner />
      <FlatList
        style={styles.list}
        contentContainerStyle={jobs.length ? styles.listContent : styles.empty}
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No upcoming jobs scheduled.</Text>
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
  jobId: {
    fontSize: typography.subheading,
    color: colors.text,
  },
  passenger: {
    fontSize: typography.body,
    color: colors.muted,
  },
  route: {
    fontSize: typography.caption,
    color: colors.muted,
  },
  subtle: {
    fontSize: typography.caption,
    color: colors.muted,
  },
  rightContent: {
    alignItems: "flex-end",
  },
  label: {
    fontSize: typography.caption,
    color: colors.muted,
  },
  value: {
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
    color: colors.text,
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
