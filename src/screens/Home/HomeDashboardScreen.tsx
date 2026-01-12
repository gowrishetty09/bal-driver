import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { Screen } from "../../components/Screen";
import { LocationStatusBanner } from "../../components/LocationStatusBanner";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useAuth } from "../../hooks/useAuth";
import { useRealtimeJobs } from "../../hooks/useRealtimeJobs";
import type { DriverJob } from "../../api/driver";

type JobType = "ACTIVE" | "UPCOMING" | "HISTORY";

const safeNumber = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const formatCurrencyMYR = (amount: number) => {
  try {
    return `RM ${amount.toFixed(2)}`;
  } catch {
    return "RM 0.00";
  }
};

const dayKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const buildLastNDays = (n: number) => {
  const days: Date[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const dt = new Date();
    dt.setHours(0, 0, 0, 0);
    dt.setDate(dt.getDate() - i);
    days.push(dt);
  }
  return days;
};

const getJobTime = (job: DriverJob) => {
  const t = Date.parse(job.scheduledTime ?? "");
  return Number.isFinite(t) ? t : 0;
};

const getJobAmount = (job: DriverJob) =>
  safeNumber(job.finalPrice ?? job.paymentAmount ?? 0);

export const HomeDashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const active = useRealtimeJobs("ACTIVE");
  const upcoming = useRealtimeJobs("UPCOMING");
  const history = useRealtimeJobs("HISTORY");

  const isLoading =
    active.isLoading || upcoming.isLoading || history.isLoading;

  const stats = useMemo(() => {
    const activeCount = active.bookings.length;
    const upcomingCount = upcoming.bookings.length;
    const historyCount = history.bookings.length;

    const totalRides = activeCount + upcomingCount + historyCount;

    const earnings = history.bookings.reduce(
      (sum, job) => sum + getJobAmount(job),
      0
    );

    // Rating is not currently present in DriverUser; keep placeholder until backend provides it.
    const rating = (user as any)?.rating;

    return {
      activeCount,
      upcomingCount,
      historyCount,
      totalRides,
      earnings,
      rating: typeof rating === "number" ? rating.toFixed(1) : "—",
    };
  }, [active.bookings, upcoming.bookings, history.bookings, user]);

  const recentJobs = useMemo(() => {
    const all = [...active.bookings, ...upcoming.bookings, ...history.bookings];
    return all
      .slice()
      .sort((a, b) => getJobTime(b) - getJobTime(a))
      .slice(0, 2);
  }, [active.bookings, upcoming.bookings, history.bookings]);

  const weeklyCounts = useMemo(() => {
    const days = buildLastNDays(7);
    const byDay = new Map<string, number>();
    days.forEach((d) => byDay.set(dayKey(d), 0));

    history.bookings.forEach((job) => {
      const t = Date.parse(job.scheduledTime ?? "");
      if (!Number.isFinite(t)) return;
      const key = dayKey(new Date(t));
      if (!byDay.has(key)) return;
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    });

    const data = days.map((d) => ({
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
      value: byDay.get(dayKey(d)) ?? 0,
    }));

    const max = Math.max(1, ...data.map((x) => x.value));
    return { data, max };
  }, [history.bookings]);

  const goToRides = (initialType?: JobType) => {
    navigation.navigate("RidesTab", {
      screen: "Rides",
      params: initialType ? { initialType } : undefined,
    });
  };

  return (
    <Screen scrollable contentContainerStyle={styles.container} edges={["top"]}>
      <LocationStatusBanner />

      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Home</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {user?.name ? `Welcome, ${user.name}` : "Your dashboard"}
          </Text>
        </View>
        <Pressable style={styles.viewAllPill} onPress={() => goToRides()}>
          <Ionicons name="car-outline" size={16} color={colors.brandNavy} />
          <Text style={styles.viewAllPillText}>Rides</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Loading dashboard…</Text>
        </View>
      ) : null}

      <View style={styles.cardsGrid}>
        <StatCard
          title="Total Rides"
          value={String(stats.totalRides)}
          icon="layers-outline"
          accent={colors.brandGold}
        />
        <StatCard
          title="Earnings"
          value={formatCurrencyMYR(stats.earnings)}
          icon="cash-outline"
          accent={colors.accent}
        />
        <StatCard
          title="Active"
          value={String(stats.activeCount) || "0"}
          icon="navigate-circle-outline"
          accent={colors.primary}
          onPress={() => goToRides("ACTIVE")}
        />
        <StatCard
          title="Rating"
          value={stats.rating}
          icon="star-outline"
          accent={colors.textgold}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Weekly rides</Text>
          <Pressable onPress={() => goToRides("HISTORY")}>
            <Text style={styles.sectionAction}>View history</Text>
          </Pressable>
        </View>

        <View style={styles.chartCard}>
          <View style={styles.chartRow}>
            {weeklyCounts.data.map((d) => {
              const heightPct = (d.value / weeklyCounts.max) * 100;
              return (
                <View key={d.label} style={styles.chartCol}>
                  <View style={styles.chartBarWrap}>
                    <View
                      style={[
                        styles.chartBar,
                        { height: `${Math.max(6, heightPct)}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.chartLabel}>{d.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent rides</Text>
          <Pressable onPress={() => goToRides()}>
            <Text style={styles.sectionAction}>View all</Text>
          </Pressable>
        </View>

        {recentJobs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No rides yet.</Text>
            <Pressable style={styles.primaryButton} onPress={() => goToRides()}>
              <Text style={styles.primaryButtonText}>Go to rides</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.recentList}>
            {recentJobs.map((job) => (
              <Pressable
                key={job.id}
                style={({ pressed }) => [
                  styles.recentItem,
                  pressed && styles.recentItemPressed,
                ]}
                onPress={() =>
                  navigation.navigate("RidesTab", {
                    screen: "JobDetails",
                    params: { jobId: job.id },
                  })
                }
              >
                <View style={styles.recentLeft}>
                  <Text style={styles.recentRef} numberOfLines={1}>
                    #{job.id.slice(-8)}
                  </Text>
                  <Text style={styles.recentRoute} numberOfLines={1}>
                    {(job.pickup?.addressLine ?? "—") + " → " +
                      (job.dropoff?.addressLine ?? "—")}
                  </Text>
                </View>
                <View style={styles.recentRight}>
                  <Text style={styles.recentStatus}>{job.status}</Text>
                  <Text style={styles.recentTime}>
                    {job.scheduledTime
                      ? new Date(job.scheduledTime).toLocaleString()
                      : "—"}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={styles.quickRow}>
        <Pressable style={styles.quickButton} onPress={() => goToRides("UPCOMING")}>
          <Ionicons name="calendar-outline" size={18} color={colors.brandNavy} />
          <Text style={styles.quickButtonText}>Upcoming</Text>
        </Pressable>
        <Pressable style={styles.quickButton} onPress={() => goToRides("HISTORY")}>
          <Ionicons name="time-outline" size={18} color={colors.brandNavy} />
          <Text style={styles.quickButtonText}>History</Text>
        </Pressable>
      </View>

      {/* Bottom padding for tab bar */}
      <View style={{ height: 24 }} />
    </Screen>
  );
};

const StatCard: React.FC<{
  title: string;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  accent: string;
  onPress?: () => void;
}> = ({ title, value, icon, accent, onPress }) => {
  const content = (
    <View style={[styles.statCard, { borderColor: accent }]}>
      <View style={styles.statTop}>
        <View style={[styles.statIconWrap, { backgroundColor: accent }]}> 
          <Ionicons name={icon} size={18} color={colors.brandNavy} />
        </View>
        <Text style={styles.statTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      style={({ pressed }) => [pressed && { opacity: 0.92 }]}
      onPress={onPress}
    >
      {content}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  headerRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerTitle: {
    fontSize: typography.heading,
    fontFamily: typography.fontFamilyBold,
    color: colors.text,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: typography.caption,
    color: colors.muted,
  },
  viewAllPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brandGold,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  viewAllPillText: {
    color: colors.brandNavy,
    fontSize: typography.caption,
    fontFamily: typography.fontFamilyMedium,
  },
  loadingRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    color: colors.muted,
    fontSize: typography.caption,
  },
  cardsGrid: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    width: "48%",
    backgroundColor: colors.cardbgtransparent,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  statTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  statTitle: {
    flex: 1,
    fontSize: typography.caption,
    color: colors.muted,
    textAlign: "right",
  },
  statValue: {
    marginTop: 10,
    fontSize: typography.subheading,
    fontFamily: typography.fontFamilyBold,
    color: colors.text,
  },
  section: {
    marginTop: 18,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: typography.subheading,
    fontFamily: typography.fontFamilyBold,
    color: colors.text,
  },
  sectionAction: {
    fontSize: typography.caption,
    color: colors.textgold,
    fontFamily: typography.fontFamilyMedium,
  },
  chartCard: {
    backgroundColor: colors.cardbgtransparent,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
  },
  chartCol: {
    flex: 1,
    alignItems: "center",
  },
  chartBarWrap: {
    height: 90,
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  chartBar: {
    width: "100%",
    backgroundColor: colors.brandGold,
    borderRadius: 10,
  },
  chartLabel: {
    marginTop: 8,
    fontSize: 10,
    color: colors.muted,
  },
  emptyCard: {
    backgroundColor: colors.cardbgtransparent,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.body,
  },
  primaryButton: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
  },
  recentList: {
    gap: 10,
  },
  recentItem: {
    backgroundColor: colors.cardbgtransparent,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  recentItemPressed: {
    transform: [{ scale: 0.99 }],
  },
  recentLeft: {
    flex: 1,
  },
  recentRight: {
    alignItems: "flex-end",
  },
  recentRef: {
    fontSize: typography.caption,
    color: colors.textgold,
    fontFamily: typography.fontFamilyBold,
  },
  recentRoute: {
    marginTop: 4,
    fontSize: typography.caption,
    color: colors.muted,
  },
  recentStatus: {
    fontSize: typography.caption,
    color: colors.text,
    fontFamily: typography.fontFamilyMedium,
  },
  recentTime: {
    marginTop: 4,
    fontSize: 10,
    color: colors.muted,
  },
  quickRow: {
    marginTop: 18,
    flexDirection: "row",
    gap: 12,
  },
  quickButton: {
    flex: 1,
    backgroundColor: colors.brandGold,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  quickButtonText: {
    color: colors.brandNavy,
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
  },
});
