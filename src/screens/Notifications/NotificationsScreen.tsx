import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { useNotificationContext } from "../../context/NotificationContext";
import { handleNotificationPress } from "../../utils/notificationHandlers";
import { useTheme, ThemeColors } from "../../context/ThemeContext";
import { DriverNotification } from "../../hooks/useNotificationService";

const fallbackTitle = (notification: DriverNotification) => {
  switch (notification.notificationType) {
    case "NEW_RIDE":
      return "New ride assigned";
    case "RIDE_CANCELLED":
      return "Ride cancelled";
    case "PICKUP_ALERT":
      return "Pickup alert";
    case "RIDE_UPDATE":
      return "Ride update";
    case "ADMIN_REASSIGNMENT":
      return "Ride assignment updated";
    case "SOS_MESSAGE":
      return "SOS alert";
    default:
      return "Notification";
  }
};

const fallbackBody = (notification: DriverNotification) => {
  if (notification.body?.trim()) {
    return notification.body;
  }

  const reference = notification.data?.jobReference ?? notification.data?.reference ?? notification.data?.bookingRef;
  const bookingId = notification.data?.jobId ?? notification.data?.bookingId ?? notification.data?.rideId ?? notification.data?.entityId;
  const rideLabel = reference || bookingId;

  if (notification.notificationType === "NEW_RIDE") {
    return rideLabel ? `Tap to view and confirm ride ${rideLabel}.` : "Tap to view and confirm the assigned ride.";
  }

  return rideLabel ? `Tap to view ride ${rideLabel}.` : "Tap to view details.";
};

export const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { notifications, markAsRead } = useNotificationContext();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const sorted = useMemo(
    () => [...notifications].sort((a, b) => b.timestamp - a.timestamp),
    [notifications]
  );

  const formatDate = (timestamp: number) => {
    try {
      return new Date(timestamp).toLocaleString("en-MY", { hour12: false });
    } catch {
      return "";
    }
  };

  if (!sorted.length) {
    return (
      <View style={styles.empty}>
        <Ionicons name="notifications-outline" size={32} color={colors.brandGold} />
        <Text style={styles.emptyTitle}>No notifications yet</Text>
        <Text style={styles.emptyText}>New ride and update alerts will appear here.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {sorted.map((n) => (
        <Pressable
          key={n.id}
          style={[styles.card, !n.read && styles.cardUnread]}
          onPress={() => {
            markAsRead(n.id);
            const nav = handleNotificationPress(n.data);
            if (nav) {
              navigation.navigate(nav.screen as never, nav.params as never);
            }
          }}
        >
          <View style={styles.row}>
            <View style={styles.left}>
              <Text style={styles.title} numberOfLines={1}>
                {n.title && n.title !== "Notification" ? n.title : fallbackTitle(n)}
              </Text>
              <Text style={styles.body} numberOfLines={2}>
                {fallbackBody(n)}
              </Text>
              <Text style={styles.meta}>{formatDate(n.timestamp)}</Text>
            </View>
            {!n.read ? <View style={styles.dot} /> : null}
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 24,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: colors.background,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  emptyText: {
    marginTop: 6,
    color: colors.textSecondary,
    textAlign: "center",
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  cardUnread: {
    borderColor: colors.brandGold,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  left: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  body: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  meta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.error,
  },
});

export default NotificationsScreen;
