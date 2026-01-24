import React from "react";
import { RefreshControl, ScrollView, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../context/ThemeContext";

export type ScreenProps = {
  children: React.ReactNode;
  scrollable?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  edges?: ("top" | "bottom" | "left" | "right")[];
  refreshing?: boolean;
  onRefresh?: () => void;
};

export const Screen: React.FC<ScreenProps> = ({
  children,
  scrollable,
  contentContainerStyle,
  edges = [],
  refreshing,
  onRefresh,
}) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.gradient, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.container} edges={edges}>
        {scrollable ? (
          <ScrollView
            contentContainerStyle={[styles.content, contentContainerStyle]}
            style={styles.container}
            contentInsetAdjustmentBehavior="never"
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing ?? false}
                  onRefresh={onRefresh}
                  colors={[colors.primary]}
                  tintColor={colors.primary}
                />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        ) : (
          <>{children}</>
        )}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  content: {
    flexGrow: 1,
  },
});
