import { RideOffersCard } from "../../components/RideOffersCard";
import { RideReadinessCard } from "../../components/RideReadinessCard";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { Screen } from "../../components/Screen";
import { LocationStatusBanner } from "../../components/LocationStatusBanner";
import { AssignmentAlertCard } from "../../components/AssignmentAlertCard";
import { useTheme, ThemeColors } from "../../context/ThemeContext";
import { typography } from "../../theme/typography";
import { useAuth } from "../../hooks/useAuth";
import { useRealtimeJobs } from "../../hooks/useRealtimeJobs";
import type { DriverJob } from "../../api/driver";
import { formatBookingRef } from "../../utils/format";

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

const buildWeekDays = () => {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Show 3 days before + today + 3 days after (7 days centered on today)
  // This ensures upcoming bookings for tomorrow/next few days are visible
  for (let i = -3; i <= 3; i++) {
    const dt = new Date(today);
    dt.setDate(today.getDate() + i);
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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const active = useRealtimeJobs("ACTIVE");
  const upcoming = useRealtimeJobs("UPCOMING");
  const history = useRealtimeJobs("HISTORY");

  const isLoading = active.isLoading || upcoming.isLoading || history.isLoading;

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // Trigger refresh on all job types
    try {
      await Promise.all([active.refresh?.(), upcoming.refresh?.(), history.refresh?.()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [active, upcoming, history]);

  const stats = useMemo(() => {
    const activeCount = active.bookings.length;
    const upcomingCount = upcoming.bookings.length;
    const historyCount = history.bookings.length;

    const totalRides = activeCount + upcomingCount + historyCount;

    const earnings = history.bookings.reduce(
      (sum, job) => sum + getJobAmount(job),
      0,
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
    // Deduplicate by job ID
    const uniqueJobs = Array.from(
      new Map(all.map((job) => [job.id, job])).values(),
    );
    return uniqueJobs.sort((a, b) => getJobTime(b) - getJobTime(a)).slice(0, 3);
  }, [active.bookings, upcoming.bookings, history.bookings]);

  const nextUpcomingJobs = useMemo(
    () =>
      [...upcoming.bookings]
        .sort((a, b) => getJobTime(a) - getJobTime(b))
        .slice(0, 3),
    [upcoming.bookings],
  );

  const pendingAssignment = useMemo(
    () =>
      active.bookings.find(
        (job) => job.status === "ASSIGNED" && !job.assignmentAcknowledgedAt,
      ) ??
      upcoming.bookings.find(
        (job) => job.status === "ASSIGNED" && !job.assignmentAcknowledgedAt,
      ) ??
      null,
    [active.bookings, upcoming.bookings],
  );

  const weeklyCounts = useMemo(() => {
    const days = buildWeekDays();
    const byDay = new Map<string, number>();
    days.forEach((d) => byDay.set(dayKey(d), 0));

    // Include all bookings (active, upcoming, and history) in the weekly count
    const allBookings = [
      ...active.bookings,
      ...upcoming.bookings,
      ...history.bookings,
    ];
    allBookings.forEach((job) => {
      const t = Date.parse(job.scheduledTime ?? "");
      if (!Number.isFinite(t)) return;
      const key = dayKey(new Date(t));
      if (!byDay.has(key)) return;
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    });

    const data = days.map((d) => ({
      key: dayKey(d),
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
      value: byDay.get(dayKey(d)) ?? 0,
    }));

    const max = Math.max(1, ...data.map((x) => x.value));
    return { data, max };
  }, [active.bookings, upcoming.bookings, history.bookings]);

  const goToRides = (initialType?: JobType) => {
    navigation.navigate("RidesTab", {
      screen: "Rides",
      params: initialType ? { initialType } : undefined,
    });
  };

  return (
    <Screen
      scrollable
      contentContainerStyle={styles.container}
      edges={["left", "right"]}
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerSubtitle}>YOUR DRIVER DASHBOARD</Text>
          <Text style={styles.headerTitle}>{user?.name ? 'Hello, ' + user.name.split(' ')[0] : 'Welcome back'}</Text>
          <Text style={styles.welcomeDetail}>Your day on the road, at a glance.</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="View your rides" style={styles.viewAllPill} onPress={() => goToRides()}>
          <Ionicons name="arrow-forward" size={22} color={colors.brandNavy} />
        </Pressable>
      </View>
      <LocationStatusBanner />
      <RideReadinessCard />
      <RideOffersCard />

      {pendingAssignment ? (
        <AssignmentAlertCard
          job={pendingAssignment}
          onAcknowledge={() => {
            void handleRefresh();
          }}
          onOpenDetails={(job) =>
            navigation.navigate("RidesTab", {
              screen: "JobDetails",
              params: { jobId: job.id },
            })
          }
        />
      ) : null}

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
          colors={colors}
          styles={styles}
        />
        <StatCard
          title="Active"
          value={String(stats.activeCount) || "0"}
          icon="navigate-circle-outline"
          accent={colors.brandGold}
          onPress={() => goToRides("ACTIVE")}
          colors={colors}
          styles={styles}
        />
        <StatCard
          title="Upcoming"
          value={String(stats.upcomingCount) || "0"}
          icon="time-outline"
          accent={colors.brandGold}
          onPress={() => goToRides("UPCOMING")}
          colors={colors}
          styles={styles}
        />
        <StatCard
          title="Rating"
          value={stats.rating}
          icon="star-outline"
          accent={colors.highlight}
          colors={colors}
          styles={styles}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming rides</Text>
          <Pressable onPress={() => goToRides("UPCOMING")}>
            <Text style={styles.sectionAction}>View all</Text>
          </Pressable>
        </View>

        {nextUpcomingJobs.length === 0 ? (
          <View style={styles.compactEmpty}>
            <Ionicons name="calendar-outline" size={25} color={colors.brandGold} />
            <View style={{ flex: 1 }}><Text style={styles.emptyTitle}>Your schedule is clear</Text><Text style={styles.emptyText}>New assigned rides will appear here.</Text></View>
          </View>
        ) : (
          <View style={styles.compactList}>
            {nextUpcomingJobs.map((job) => (
              <Pressable
                key={job.id}
                style={({ pressed }) => [
                  styles.compactRide,
                  pressed && styles.recentItemPressed,
                ]}
                onPress={() =>
                  navigation.navigate("RidesTab", {
                    screen: "JobDetails",
                    params: { jobId: job.id },
                  })
                }
              >
                <View style={styles.compactRideText}>
                  <Text style={styles.recentRef} numberOfLines={1}>
                    {formatBookingRef(job.reference || job.id)}
                  </Text>
                  <Text style={styles.recentRoute} numberOfLines={1}>
                    {(job.pickup?.addressLine ?? "Pickup") +
                      " -> " +
                      (job.dropoff?.addressLine ?? "Drop")}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your week</Text>
          <Pressable onPress={() => goToRides("HISTORY")}>
            <Text style={styles.sectionAction}>View history</Text>
          </Pressable>
        </View>

        <View style={styles.chartCard}>
          <View style={styles.chartRow}>
            {weeklyCounts.data.map((d) => {
              const heightPct = (d.value / weeklyCounts.max) * 100;
              const isToday = d.key === dayKey(new Date());
              return (
                <View key={d.key} style={styles.chartCol}>
                  <Text style={styles.chartValue}>{d.value}</Text>
                  <View style={styles.chartBarWrap}>
                    <View
                      style={[
                        styles.chartBar,
                        { height: `${heightPct}%` },
                        isToday && styles.chartBarToday,
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.chartLabel,
                      isToday && styles.chartLabelToday,
                    ]}
                  >
                    {d.label}
                  </Text>
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
                <View style={styles.rideCardTop}>
                  <Text style={styles.recentRef}>{formatBookingRef(job.reference || job.id)}</Text>
                  <View style={styles.statusBadge}><Text style={styles.recentStatus}>{job.status.replace(/_/g, ' ')}</Text></View>
                </View>
                <View style={styles.routeLine}>
                  <View style={[styles.routeDot, { backgroundColor: colors.brandGold }]} />
                  <Text style={styles.recentRoute} numberOfLines={2}>{job.pickup?.addressLine ?? 'Pickup location'}</Text>
                </View>
                <View style={styles.routeLine}>
                  <View style={[styles.routeDot, { backgroundColor: colors.textSecondary }]} />
                  <Text style={styles.recentRoute} numberOfLines={2}>{job.dropoff?.addressLine ?? 'Drop-off location'}</Text>
                </View>
                <View style={styles.rideCardFooter}>
                  <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.recentTime}>{job.scheduledTime ? new Date(job.scheduledTime).toLocaleString('en-MY', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'Time to be confirmed'}</Text>
                  <Ionicons name="arrow-forward" size={19} color={colors.textSecondary} />
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={styles.quickRow}>
        <Pressable
          style={styles.quickButton}
          onPress={() => goToRides("UPCOMING")}
        >
          <Ionicons
            name="calendar-outline"
            size={18}
            color={colors.brandNavy}
          />
          <Text style={styles.quickButtonText}>Upcoming</Text>
        </Pressable>
        <Pressable
          style={styles.quickButton}
          onPress={() => goToRides("HISTORY")}
        >
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
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}> = ({ title, value, icon, accent, onPress, colors, styles }) => {
  const { width, fontScale } = useWindowDimensions();
  const cardWidth = width < 360 || fontScale > 1.2 ? { width: "100%" as const } : null;
  const content = (
    <View style={styles.statCard}>
      <View style={styles.statInline}>
        <View style={[styles.statIconWrap, { backgroundColor: accent }]}>
          <Ionicons name={icon} size={18} color={colors.brandNavy} />
        </View>
        <View style={styles.statTextBlock}>
          <Text style={styles.statTitle}>
            {title}
          </Text>
          <Text style={styles.statValue}>
            {value}
          </Text>
        </View>
      </View>
    </View>
  );

  if (!onPress) return <View style={[styles.statCardShell, cardWidth]}>{content}</View>;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.statCardShell,
        cardWidth,
        pressed && { opacity: 0.92 },
      ]}
      onPress={onPress}
    >
      {content}
    </Pressable>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    welcomeDetail: { marginTop: 6, fontSize: 16, color: colors.textSecondary, lineHeight: 23 },
    emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: 4 },
    rideCardTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    statusBadge: { backgroundColor: colors.cardSecondary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    routeLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    routeDot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
    rideCardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.divider },
    container: {
      paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20,
    },
    headerRow: {
      marginBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    },
    headerTitle: {
      fontSize: 28, fontWeight: '700', color: colors.text,
    },
    headerSubtitle: {
      marginBottom: 6, fontSize: 12, letterSpacing: 1.5, fontWeight: '700', color: colors.textSecondary,
    },
    viewAllPill: {
      width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandGold,
    },
    viewAllPillText: {
      color: colors.brandNavy,
      fontSize: typography.caption,
      fontWeight: '600', fontFamily: typography.fontFamilyMedium,
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
      marginTop: 12,
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: 10,
    },
    statCardShell: {
      width: "48.5%",
      minWidth: 150,
    },
    statCard: {
      minHeight: 142, backgroundColor: colors.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.border,
    },
    statInline: {
      flexDirection: "column",
      alignItems: "flex-start",
      gap: 10,
    },
    statIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
    },
    statTextBlock: {
      alignSelf: "stretch",
      minWidth: 0,
    },
    statTitle: {
      fontSize: typography.caption,
      color: colors.muted,
    },
    statValue: {
      marginTop: 4, fontSize: 30, fontWeight: '700', color: colors.text,
    },
    section: {
      marginTop: 26,
    },
    sectionHeader: {
      flexDirection: "row",
      flexWrap: "wrap",
      columnGap: 12,
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: typography.subheading,
      fontWeight: '700', fontFamily: typography.fontFamilyBold,
      color: colors.text,
    },
    sectionAction: {
      fontSize: 15, fontWeight: '600', color: colors.textSecondary, paddingVertical: 12,
    },
    chartCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 12,
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
      height: 72,
      width: "100%",
      backgroundColor: colors.cardSecondary,
      borderRadius: 10,
      overflow: "hidden",
      justifyContent: "flex-end",
    },
    chartBar: {
      width: "100%",
      backgroundColor: colors.brandGold,
      borderRadius: 10,
    },
    chartBarToday: {
      backgroundColor: colors.primary,
    },
    chartValue: {
      fontSize: 14,
      fontWeight: '700', fontFamily: typography.fontFamilyBold,
      color: colors.text,
      marginBottom: 4,
    },
    chartLabel: {
      marginTop: 8,
      fontSize: 14,
      color: colors.muted,
    },
    chartLabelToday: {
      color: colors.primary,
      fontWeight: '700', fontFamily: typography.fontFamilyBold,
    },
    emptyCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyText: {
      color: colors.muted,
      fontSize: typography.body,
    },
    compactEmpty: {
      flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    },
    compactList: {
      gap: 8,
    },
    compactRide: {
      backgroundColor: colors.card,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    compactRideText: {
      flex: 1,
      minWidth: 0,
    },
    primaryButton: {
      marginTop: 12,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
    },
    primaryButtonText: {
      color: colors.textInverse,
      fontSize: typography.body,
      fontWeight: '600', fontFamily: typography.fontFamilyMedium,
    },
    recentList: {
      gap: 10,
    },
    recentItem: {
      backgroundColor: colors.card, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: colors.border, gap: 12,
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
      color: colors.highlight,
      fontWeight: '700', fontFamily: typography.fontFamilyBold,
    },
    recentRoute: {
      flex: 1, fontSize: 16, lineHeight: 23, color: colors.text,
    },
    recentStatus: {
      fontSize: 12, fontWeight: '600', color: colors.textSecondary,
    },
    recentTime: {
      flex: 1, fontSize: 14, color: colors.textSecondary,
    },
    quickRow: {
      marginTop: 14,
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
      fontWeight: '600', fontFamily: typography.fontFamilyMedium,
    },
  });
