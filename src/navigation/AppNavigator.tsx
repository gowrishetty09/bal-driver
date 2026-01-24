import React, { useEffect } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { NavigationContainer, useNavigation, DefaultTheme, Theme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { enableScreens } from "react-native-screens";
import { Ionicons } from "@expo/vector-icons";

import { Loader } from "../components/Loader";
import { useTheme } from "../context/ThemeContext";
import { SosButton } from "../components/SosButton";
import { LoginScreen } from "../screens/Auth/LoginScreen";
import { ForgotPasswordEmailScreen } from "../screens/Auth/ForgotPasswordEmailScreen";
import { ForgotPasswordOtpScreen } from "../screens/Auth/ForgotPasswordOtpScreen";
import { ForgotPasswordResetScreen } from "../screens/Auth/ForgotPasswordResetScreen";
import { HomeDashboardScreen } from "../screens/Home/HomeDashboardScreen";
import { RidesScreen } from "../screens/Jobs/RidesScreen";
import { JobDetailsScreen } from "../screens/Jobs/JobDetailsScreen";
import { AddExpenseScreen } from "../screens/Expenses/ExpensesScreen";
import { ExpensesListScreen } from "../screens/Expenses/ExpensesListScreen";
import { DriverProfileScreen } from "../screens/Profile/DriverProfileScreen";
import { SupportListScreen } from "../screens/Support/SupportListScreen";
import { SupportTicketDetailsScreen } from "../screens/Support/SupportTicketDetailsScreen";
import { SupportNewTicketScreen } from "../screens/Support/SupportNewTicketScreen";
import { FeedbackScreen } from "../screens/Feedback/FeedbackScreen";
import { HelpScreen } from "../screens/Help/HelpScreen";
import { useAuth } from "../hooks/useAuth";
import { useNotificationContext } from "../context/NotificationContext";
import { NotificationsScreen } from "../screens/Notifications/NotificationsScreen";
import {
  AuthStackParamList,
  FeedbackStackParamList,
  ExpensesStackParamList,
  HomeStackParamList,
  MainTabParamList,
  ProfileStackParamList,
  RidesStackParamList,
  SupportStackParamList,
} from "../types/navigation";

enableScreens();

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const RidesStack = createNativeStackNavigator<RidesStackParamList>();
const ExpensesStack = createNativeStackNavigator<ExpensesStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const SupportStack = createNativeStackNavigator<SupportStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

const headerLogo = require("../../assets/horizantal-logo.png");

const HeaderLogo = () => (
  <Image
    source={headerLogo}
    style={styles.headerLogo}
    accessibilityRole="image"
    accessibilityLabel="LIM Driver logo"
  />
);

const HeaderSignOutButton: React.FC<{ onPress: () => void; iconColor: string }> = ({
  onPress,
  iconColor,
}) => (
  <Pressable onPress={onPress} hitSlop={8} style={styles.headerIconButton}>
    <Ionicons name="log-out-outline" size={20} color={iconColor} />
  </Pressable>
);

const HeaderActions: React.FC<{ onLogout: () => void; onNotifications?: () => void; iconColor: string }> = ({
  onLogout,
  onNotifications,
  iconColor,
}) => (
  <View style={styles.headerActions}>
    {onNotifications ? (
      <Pressable onPress={onNotifications} hitSlop={8} style={styles.headerIconButton}>
        <Ionicons name="notifications-outline" size={20} color={iconColor} />
      </Pressable>
    ) : null}
    <SosButton />
    <HeaderSignOutButton onPress={onLogout} iconColor={iconColor} />
  </View>
);

const AuthStackNavigator = () => (
  <AuthStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthStack.Screen name="Login" component={LoginScreen} />
    <AuthStack.Screen
      name="ForgotPasswordEmail"
      component={ForgotPasswordEmailScreen}
    />
    <AuthStack.Screen
      name="ForgotPasswordOtp"
      component={ForgotPasswordOtpScreen}
    />
    <AuthStack.Screen
      name="ForgotPasswordReset"
      component={ForgotPasswordResetScreen}
    />
  </AuthStack.Navigator>
);

const HomeStackNavigator = () => {
  const { logout } = useAuth();
  const { colors } = useTheme();

  const stackScreenOptions = {
    headerStyle: { backgroundColor: colors.headerBackground },
    headerTitle: () => <HeaderLogo />,
    headerTitleAlign: "center" as const,
    headerTintColor: colors.headerIcon,
    headerShadowVisible: false,
  };

  return (
    <HomeStack.Navigator screenOptions={stackScreenOptions}>
      <HomeStack.Screen
        name="HomeDashboard"
        component={HomeDashboardScreen}
        options={({ navigation }) => ({
          title: "Home",
          headerRight: () => (
            <HeaderActions
              onLogout={logout}
              onNotifications={() => navigation.navigate("Notifications")}
              iconColor={colors.headerIcon}
            />
          ),
        })}
      />
      <HomeStack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: "Notifications" }}
      />
    </HomeStack.Navigator>
  );
};

const RidesStackNavigator = () => {
  const { logout } = useAuth();
  const { colors } = useTheme();

  const stackScreenOptions = {
    headerStyle: { backgroundColor: colors.headerBackground },
    headerTitle: () => <HeaderLogo />,
    headerTitleAlign: "center" as const,
    headerTintColor: colors.headerIcon,
    headerShadowVisible: false,
  };

  return (
    <RidesStack.Navigator screenOptions={stackScreenOptions}>
      <RidesStack.Screen
        name="Rides"
        component={RidesScreen}
        options={{
          title: "Rides",
          headerRight: () => <HeaderActions onLogout={logout} iconColor={colors.headerIcon} />,
        }}
      />
      <RidesStack.Screen
        name="JobDetails"
        component={JobDetailsScreen}
        options={{ title: "Job Details" }}
      />
    </RidesStack.Navigator>
  );
};

const ExpensesStackNavigator = () => {
  const { logout } = useAuth();
  const { colors } = useTheme();

  const stackScreenOptions = {
    headerStyle: { backgroundColor: colors.headerBackground },
    headerTitle: () => <HeaderLogo />,
    headerTitleAlign: "center" as const,
    headerTintColor: colors.headerIcon,
    headerShadowVisible: false,
  };

  return (
    <ExpensesStack.Navigator screenOptions={stackScreenOptions}>
      <ExpensesStack.Screen
        name="ExpensesList"
        component={ExpensesListScreen}
        options={{
          title: "Expenses",
          headerRight: () => <HeaderActions onLogout={logout} iconColor={colors.headerIcon} />,
        }}
      />
      <ExpensesStack.Screen
        name="AddExpense"
        component={AddExpenseScreen}
        options={{
          title: "Add Expense",
          headerRight: () => <HeaderActions onLogout={logout} iconColor={colors.headerIcon} />,
        }}
      />
    </ExpensesStack.Navigator>
  );
};

const ProfileStackNavigator = () => {
  const { logout } = useAuth();
  const { colors } = useTheme();

  const stackScreenOptions = {
    headerStyle: { backgroundColor: colors.headerBackground },
    headerTitle: () => <HeaderLogo />,
    headerTitleAlign: "center" as const,
    headerTintColor: colors.headerIcon,
    headerShadowVisible: false,
  };

  return (
    <ProfileStack.Navigator screenOptions={stackScreenOptions}>
      <ProfileStack.Screen
        name="DriverProfile"
        component={DriverProfileScreen}
        options={{
          title: "Profile",
          headerRight: () => <HeaderActions onLogout={logout} iconColor={colors.headerIcon} />,
        }}
      />
      <ProfileStack.Screen
        name="Feedback"
        component={FeedbackScreen}
        options={{
          title: "Share Feedback",
          headerRight: () => <HeaderActions onLogout={logout} iconColor={colors.headerIcon} />,
        }}
      />
    </ProfileStack.Navigator>
  );
};

const SupportStackNavigator = () => {
  const { logout } = useAuth();
  const { colors } = useTheme();

  const stackScreenOptions = {
    headerStyle: { backgroundColor: colors.headerBackground },
    headerTitle: () => <HeaderLogo />,
    headerTitleAlign: "center" as const,
    headerTintColor: colors.headerIcon,
    headerShadowVisible: false,
  };

  return (
    <SupportStack.Navigator screenOptions={stackScreenOptions}>
      <SupportStack.Screen
        name="SupportTickets"
        component={SupportListScreen}
        options={{
          title: "Support",
          headerRight: () => <HeaderActions onLogout={logout} iconColor={colors.headerIcon} />,
        }}
      />
      <SupportStack.Screen
        name="SupportTicketDetails"
        component={SupportTicketDetailsScreen}
        options={{
          title: "Ticket details",
          headerRight: () => <HeaderActions onLogout={logout} iconColor={colors.headerIcon} />,
        }}
      />
      <SupportStack.Screen
        name="NewSupportTicket"
        component={SupportNewTicketScreen}
        options={{
          title: "New ticket",
          headerRight: () => <HeaderActions onLogout={logout} iconColor={colors.headerIcon} />,
        }}
      />
      <SupportStack.Screen
        name="Feedback"
        component={FeedbackScreen}
        options={{
          title: "Share Feedback",
          headerRight: () => <HeaderActions onLogout={logout} iconColor={colors.headerIcon} />,
        }}
      />
      <SupportStack.Screen
        name="Help"
        component={HelpScreen}
        options={{
          title: "Help Center",
          headerRight: () => <HeaderActions onLogout={logout} iconColor={colors.headerIcon} />,
        }}
      />
    </SupportStack.Navigator>
  );
};

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const tabIcons: Record<keyof MainTabParamList, IconName> = {
  HomeTab: "home-outline",
  RidesTab: "car-sport-outline",
  ExpensesTab: "cash-outline",
  SupportTab: "help-buoy-outline",
  ProfileTab: "person-circle-outline",
};

const MainTabsNavigator = () => {
  const { colors, isDark } = useTheme();

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopColor: colors.border,
          paddingTop: 8,
          paddingBottom: 8,
          height: 60,
        },
        tabBarLabelStyle: {
          fontWeight: "600" as const,
          fontSize: 11,
        },
        tabBarIcon: ({ color, size }) => {
          const iconName =
            tabIcons[route.name as keyof MainTabParamList] ?? "apps-outline";
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{ title: "Home" }}
      />
      <Tabs.Screen
        name="RidesTab"
        component={RidesStackNavigator}
        options={{ title: "Rides" }}
      />
      <Tabs.Screen
        name="ExpensesTab"
        component={ExpensesStackNavigator}
        options={{ title: "Expenses" }}
      />
      <Tabs.Screen
        name="SupportTab"
        component={SupportStackNavigator}
        options={{ title: "Support" }}
      />
      <Tabs.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{ title: "Profile" }}
      />
    </Tabs.Navigator>
  );
};

/**
 * Component to handle pending navigation from push notifications
 * Must be rendered inside NavigationContainer
 */
const NotificationNavigationHandler: React.FC = () => {
  const navigation = useNavigation();
  const { pendingNavigation, clearPendingNavigation } =
    useNotificationContext();

  useEffect(() => {
    if (pendingNavigation) {
      console.log("Handling pending navigation:", pendingNavigation);
      // @ts-ignore - navigation params vary by screen
      navigation.navigate(pendingNavigation.screen, pendingNavigation.params);
      clearPendingNavigation();
    }
  }, [pendingNavigation, navigation, clearPendingNavigation]);

  return null;
};

export const AppNavigator = () => {
  const { isAuthenticated, isInitializing } = useAuth();
  const { colors, isDark } = useTheme();

  if (isInitializing) {
    return <Loader />;
  }

  // Create dynamic navigation theme based on current theme
  const navigationTheme: Theme = {
    dark: isDark,
    colors: {
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      notification: colors.notification,
    },
    fonts: DefaultTheme.fonts,
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      {isAuthenticated ? (
        <>
          <NotificationNavigationHandler />
          <MainTabsNavigator />
        </>
      ) : (
        <AuthStackNavigator />
      )}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  headerLogo: {
    height: 32,
    width: 180,
    resizeMode: "contain",
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
