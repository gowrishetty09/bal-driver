import React, { useEffect } from "react";
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { NavigationContainer, useNavigation, DefaultTheme, Theme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { type NativeStackHeaderProps, createNativeStackNavigator } from "@react-navigation/native-stack";
import { enableScreens } from "react-native-screens";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
import { DeleteAccountScreen } from '../screens/Profile/DeleteAccountScreen';
import { ComplianceScreen } from "../screens/Profile/ComplianceScreen";
import { EmergencyContactsScreen } from "../screens/Profile/EmergencyContactsScreen";
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

// One header for every signed-in screen; the stack owns the back action.
const DriverHeader = ({ navigation, route, options, back }: NativeStackHeaderProps) => {
  const insets = useSafeAreaInsets();
  const openNotifications = () => {
    if (route.name === 'Notifications') return;
    navigation.getParent()?.navigate('HomeTab', { screen: 'Notifications', initial: false });
  };
  return (
    <View style={{ paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right, backgroundColor: '#151e2d' }}>
      <View style={styles.headerRow}>
        <Image source={headerLogo} style={styles.headerLogo} accessibilityLabel="BAL Driver" />
        <View style={styles.headerActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={openNotifications} style={styles.headerIconButton}>
            <Ionicons name="notifications-outline" size={23} color="#E5C58E" />
          </Pressable>
          <SosButton />
        </View>
      </View>
      {back ? <View style={styles.detailRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => navigation.goBack()} style={styles.headerIconButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text accessibilityRole="header" style={styles.detailTitle}>{options.title ?? route.name}</Text>
      </View> : null}
    </View>
  );
};

const driverStackOptions = {
  header: (props: NativeStackHeaderProps) => <DriverHeader {...props} />,
  headerShadowVisible: false,
};

const HomeStackNavigator = () => (
  <HomeStack.Navigator screenOptions={driverStackOptions}>
    <HomeStack.Screen name="HomeDashboard" component={HomeDashboardScreen} options={{ title: 'Home' }} />
    <HomeStack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
  </HomeStack.Navigator>
);

const RidesStackNavigator = () => (
  <RidesStack.Navigator screenOptions={driverStackOptions}>
    <RidesStack.Screen name="Rides" component={RidesScreen} options={{ title: 'Rides' }} />
    <RidesStack.Screen name="JobDetails" component={JobDetailsScreen} options={{ title: 'Job details' }} />
  </RidesStack.Navigator>
);

const ExpensesStackNavigator = () => (
  <ExpensesStack.Navigator screenOptions={driverStackOptions}>
    <ExpensesStack.Screen name="ExpensesList" component={ExpensesListScreen} options={{ title: 'Expenses' }} />
    <ExpensesStack.Screen name="AddExpense" component={AddExpenseScreen} options={{ title: 'Add expense' }} />
  </ExpensesStack.Navigator>
);

const ProfileStackNavigator = () => (
  <ProfileStack.Navigator screenOptions={driverStackOptions}>
    <ProfileStack.Screen name="DriverProfile" component={DriverProfileScreen} options={{ title: 'Profile' }} />
    <ProfileStack.Screen name="DeleteAccount" component={DeleteAccountScreen} options={{ title: 'Delete account' }} />
    <ProfileStack.Screen name="Compliance" component={ComplianceScreen} options={{ title: 'Compliance' }} />
    <ProfileStack.Screen name="EmergencyContacts" component={EmergencyContactsScreen} options={{ title: 'Emergency contacts' }} />
    <ProfileStack.Screen name="Feedback" component={FeedbackScreen} options={{ title: 'Share feedback' }} />
  </ProfileStack.Navigator>
);

const SupportStackNavigator = () => (
  <SupportStack.Navigator screenOptions={driverStackOptions}>
    <SupportStack.Screen name="SupportTickets" component={SupportListScreen} options={{ title: 'Support' }} />
    <SupportStack.Screen name="SupportTicketDetails" component={SupportTicketDetailsScreen} options={{ title: 'Ticket details' }} />
    <SupportStack.Screen name="NewSupportTicket" component={SupportNewTicketScreen} options={{ title: 'New ticket' }} />
    <SupportStack.Screen name="Feedback" component={FeedbackScreen} options={{ title: 'Share feedback' }} />
    <SupportStack.Screen name="Help" component={HelpScreen} options={{ title: 'Help center' }} />
  </SupportStack.Navigator>
);

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
  const insets = useSafeAreaInsets();

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
          paddingBottom: Math.max(insets.bottom, 8),
          height: 72 + insets.bottom,
        },
        tabBarLabelStyle: {
          fontWeight: "600" as const,
          fontSize: 15,
          lineHeight: 20,
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
  headerRow: { minHeight: 72, paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerLogo: { width: 142, height: 42, resizeMode: 'contain', flexShrink: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconButton: { width: 44, height: 44, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.10)' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12 },
  detailTitle: { flex: 1, fontSize: 21, fontWeight: '600', color: '#FFFFFF' },
});
