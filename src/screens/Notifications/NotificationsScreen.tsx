import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { useNotificationContext } from "../../context/NotificationContext";
import { handleNotificationPress } from "../../utils/notificationHandlers";
import { colors } from "../../theme/colors";

export const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { notifications, markAsRead } = useNotificationContext();

  const sorted = useMemo(
    () => [...notifications].sort((a, b) => b.timestamp - a.timestamp),
    [notifications]
  );

  const formatDate = (timestamp: number) => {
    try {
      return new Date(timestamp).toLocaleString();
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
                {n.title || "Notification"}
              </Text>
              <Text style={styles.body} numberOfLines={2}>
                {n.body}
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

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 24,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: colors.brandNavy,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  emptyText: {
    marginTop: 6,
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 12,
  },
  cardUnread: {
    borderColor: "rgba(189, 146, 80, 0.65)",
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
    color: "#111827",
    marginBottom: 4,
  },
  body: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 6,
  },
  meta: {
    fontSize: 12,
    color: "#6b7280",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#dc2626",
  },
});

export default NotificationsScreen;
