import React, { useEffect } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { NavigationContainer, useNavigation } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { enableScreens } from "react-native-screens";
import { Ionicons } from "@expo/vector-icons";

import { Loader } from "../components/Loader";
import { colors } from "../theme/colors";
import { appNavigationTheme } from "../theme";
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

const HeaderSignOutButton: React.FC<{ onPress: () => void }> = ({
  onPress,
}) => (
  <Pressable onPress={onPress} hitSlop={8} style={styles.headerIconButton}>
    <Ionicons name="log-out-outline" size={20} color={colors.brandGold} />
  </Pressable>
);

const HeaderActions: React.FC<{ onLogout: () => void }> = ({ onLogout }) => (
  <View style={styles.headerActions}>
    <SosButton />
    <HeaderSignOutButton onPress={onLogout} />
  </View>
);

const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.brandNavy },
  headerTitle: () => <HeaderLogo />,
  headerTitleAlign: "center" as const,
  headerTintColor: colors.brandGold,
  headerShadowVisible: false,
};

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

  return (
    <HomeStack.Navigator screenOptions={stackScreenOptions}>
      <HomeStack.Screen
        name="HomeDashboard"
        component={HomeDashboardScreen}
        options={{
          title: "Home",
          headerRight: () => <HeaderActions onLogout={logout} />,
        }}
      />
    </HomeStack.Navigator>
  );
};

const RidesStackNavigator = () => {
  const { logout } = useAuth();

  return (
    <RidesStack.Navigator screenOptions={stackScreenOptions}>
      <RidesStack.Screen
        name="Rides"
        component={RidesScreen}
        options={{
          title: "Rides",
          headerRight: () => <HeaderActions onLogout={logout} />,
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

  return (
    <ExpensesStack.Navigator screenOptions={stackScreenOptions}>
      <ExpensesStack.Screen
        name="ExpensesList"
        component={ExpensesListScreen}
        options={{
          title: "Expenses",
          headerRight: () => <HeaderActions onLogout={logout} />,
        }}
      />
      <ExpensesStack.Screen
        name="AddExpense"
        component={AddExpenseScreen}
        options={{
          title: "Add Expense",
          headerRight: () => <HeaderActions onLogout={logout} />,
        }}
      />
    </ExpensesStack.Navigator>
  );
};

const ProfileStackNavigator = () => {
  const { logout } = useAuth();

  return (
    <ProfileStack.Navigator screenOptions={stackScreenOptions}>
      <ProfileStack.Screen
        name="DriverProfile"
        component={DriverProfileScreen}
        options={{
          title: "Profile",
          headerRight: () => <HeaderActions onLogout={logout} />,
        }}
      />
      <ProfileStack.Screen
        name="Feedback"
        component={FeedbackScreen}
        options={{
          title: "Share Feedback",
          headerRight: () => <HeaderActions onLogout={logout} />,
        }}
      />
    </ProfileStack.Navigator>
  );
};

const SupportStackNavigator = () => {
  const { logout } = useAuth();

  return (
    <SupportStack.Navigator screenOptions={stackScreenOptions}>
      <SupportStack.Screen
        name="SupportTickets"
        component={SupportListScreen}
        options={{
          title: "Support",
          headerRight: () => <HeaderActions onLogout={logout} />,
        }}
      />
      <SupportStack.Screen
        name="SupportTicketDetails"
        component={SupportTicketDetailsScreen}
        options={{
          title: "Ticket details",
          headerRight: () => <HeaderActions onLogout={logout} />,
        }}
      />
      <SupportStack.Screen
        name="NewSupportTicket"
        component={SupportNewTicketScreen}
        options={{
          title: "New ticket",
          headerRight: () => <HeaderActions onLogout={logout} />,
        }}
      />
      <SupportStack.Screen
        name="Feedback"
        component={FeedbackScreen}
        options={{
          title: "Share Feedback",
          headerRight: () => <HeaderActions onLogout={logout} />,
        }}
      />
      <SupportStack.Screen
        name="Help"
        component={HelpScreen}
        options={{
          title: "Help Center",
          headerRight: () => <HeaderActions onLogout={logout} />,
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

const MainTabsNavigator = () => (
  <Tabs.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: colors.brandNavy,
      tabBarInactiveTintColor: "rgba(21, 30, 45, 0.5)",
      tabBarStyle: styles.tabBar,
      tabBarLabelStyle: styles.tabBarLabel,
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

  if (isInitializing) {
    return <Loader />;
  }

  return (
    <NavigationContainer theme={appNavigationTheme}>
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
  tabBar: {
    backgroundColor: colors.brandGold,
    borderTopColor: colors.brandGold,
    padding: 20,
  },
  tabBarLabel: {
    fontWeight: "600",
  },
});
