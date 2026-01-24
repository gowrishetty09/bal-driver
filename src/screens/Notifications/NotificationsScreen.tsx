import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { useNotificationContext } from "../../context/NotificationContext";
import { handleNotificationPress } from "../../utils/notificationHandlers";
import { useTheme, ThemeColors } from "../../context/ThemeContext";

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
