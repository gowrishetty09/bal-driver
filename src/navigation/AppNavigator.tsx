import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { enableScreens } from 'react-native-screens';
import { Ionicons } from '@expo/vector-icons';

import { Loader } from '../components/Loader';
import { colors } from '../theme/colors';
import { appNavigationTheme } from '../theme';
import { SosButton } from '../components/SosButton';
import { LoginScreen } from '../screens/Auth/LoginScreen';
import { ForgotPasswordEmailScreen } from '../screens/Auth/ForgotPasswordEmailScreen';
import { ForgotPasswordOtpScreen } from '../screens/Auth/ForgotPasswordOtpScreen';
import { ForgotPasswordResetScreen } from '../screens/Auth/ForgotPasswordResetScreen';
import { ActiveJobsScreen } from '../screens/Jobs/ActiveJobsScreen';
import { UpcomingJobsScreen } from '../screens/Jobs/UpcomingJobsScreen';
import { HistoryJobsScreen } from '../screens/Jobs/HistoryJobsScreen';
import { JobDetailsScreen } from '../screens/Jobs/JobDetailsScreen';
import { DriverProfileScreen } from '../screens/Profile/DriverProfileScreen';
import { SupportListScreen } from '../screens/Support/SupportListScreen';
import { SupportTicketDetailsScreen } from '../screens/Support/SupportTicketDetailsScreen';
import { SupportNewTicketScreen } from '../screens/Support/SupportNewTicketScreen';
import { useAuth } from '../hooks/useAuth';
import {
  ActiveJobsStackParamList,
  AuthStackParamList,
  HistoryJobsStackParamList,
  MainTabParamList,
  ProfileStackParamList,
  SupportStackParamList,
  UpcomingJobsStackParamList,
} from '../types/navigation';

enableScreens();

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const ActiveStack = createNativeStackNavigator<ActiveJobsStackParamList>();
const UpcomingStack = createNativeStackNavigator<UpcomingJobsStackParamList>();
const HistoryStack = createNativeStackNavigator<HistoryJobsStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const SupportStack = createNativeStackNavigator<SupportStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

const headerLogo = require('../../assets/horizantal-logo.png');

const HeaderLogo = () => (
  <Image
    source={headerLogo}
    style={styles.headerLogo}
    accessibilityRole="image"
    accessibilityLabel="LIM Driver logo"
  />
);

const HeaderSignOutButton: React.FC<{ onPress: () => void }> = ({ onPress }) => (
  <Pressable onPress={onPress} hitSlop={8}>
    <Text style={styles.headerAction}>Sign out</Text>
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
  headerTitleAlign: 'center' as const,
  headerTintColor: colors.brandGold,
  headerShadowVisible: false,
};

const AuthStackNavigator = () => (
  <AuthStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthStack.Screen name="Login" component={LoginScreen} />
    <AuthStack.Screen name="ForgotPasswordEmail" component={ForgotPasswordEmailScreen} />
    <AuthStack.Screen name="ForgotPasswordOtp" component={ForgotPasswordOtpScreen} />
    <AuthStack.Screen name="ForgotPasswordReset" component={ForgotPasswordResetScreen} />
  </AuthStack.Navigator>
);

const ActiveJobsStackNavigator = () => {
  const { logout } = useAuth();

  return (
    <ActiveStack.Navigator screenOptions={stackScreenOptions}>
      <ActiveStack.Screen
        name="ActiveJobs"
        component={ActiveJobsScreen}
        options={{
          title: 'Active Jobs',
          headerRight: () => <HeaderActions onLogout={logout} />,
        }}
      />
      <ActiveStack.Screen name="JobDetails" component={JobDetailsScreen} options={{ title: 'Job Details' }} />
    </ActiveStack.Navigator>
  );
};

const UpcomingJobsStackNavigator = () => {
  const { logout } = useAuth();

  return (
    <UpcomingStack.Navigator screenOptions={stackScreenOptions}>
      <UpcomingStack.Screen
        name="UpcomingJobs"
        component={UpcomingJobsScreen}
        options={{
          title: 'Upcoming Jobs',
          headerRight: () => <HeaderActions onLogout={logout} />,
        }}
      />
      <UpcomingStack.Screen name="JobDetails" component={JobDetailsScreen} options={{ title: 'Job Details' }} />
    </UpcomingStack.Navigator>
  );
};

const HistoryJobsStackNavigator = () => {
  const { logout } = useAuth();

  return (
    <HistoryStack.Navigator screenOptions={stackScreenOptions}>
      <HistoryStack.Screen
        name="HistoryJobs"
        component={HistoryJobsScreen}
        options={{
          title: 'Rides History',
          headerRight: () => <HeaderActions onLogout={logout} />,
        }}
      />
      <HistoryStack.Screen name="JobDetails" component={JobDetailsScreen} options={{ title: 'Job Details' }} />
    </HistoryStack.Navigator>
  );
};

const ProfileStackNavigator = () => (
  <ProfileStack.Navigator screenOptions={stackScreenOptions}>
    <ProfileStack.Screen
      name="DriverProfile"
      component={DriverProfileScreen}
      options={{ title: 'Profile' }}
    />
  </ProfileStack.Navigator>
);

const SupportStackNavigator = () => {
  const { logout } = useAuth();

  return (
    <SupportStack.Navigator screenOptions={stackScreenOptions}>
      <SupportStack.Screen
        name="SupportTickets"
        component={SupportListScreen}
        options={{
          title: 'Support',
          headerRight: () => <HeaderActions onLogout={logout} />,
        }}
      />
      <SupportStack.Screen
        name="SupportTicketDetails"
        component={SupportTicketDetailsScreen}
        options={{
          title: 'Ticket details',
          headerRight: () => <HeaderActions onLogout={logout} />,
        }}
      />
      <SupportStack.Screen
        name="NewSupportTicket"
        component={SupportNewTicketScreen}
        options={{
          title: 'New ticket',
          headerRight: () => <HeaderActions onLogout={logout} />,
        }}
      />
    </SupportStack.Navigator>
  );
};

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const tabIcons: Record<keyof MainTabParamList, IconName> = {
  ActiveJobsTab: 'car-sport-outline',
  UpcomingJobsTab: 'calendar-outline',
  HistoryJobsTab: 'time-outline',
  SupportTab: 'help-buoy-outline',
  ProfileTab: 'person-circle-outline',
};

const MainTabsNavigator = () => (
  <Tabs.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: colors.brandNavy,
      tabBarInactiveTintColor: colors.brandNavy,
      tabBarStyle: styles.tabBar,
      tabBarLabelStyle: styles.tabBarLabel,
      tabBarIcon: ({ color, size }) => {
        const iconName = tabIcons[route.name as keyof MainTabParamList] ?? 'apps-outline';
        return <Ionicons name={iconName} size={size} color={color} />;
      },
    })}
  >
    <Tabs.Screen
      name="ActiveJobsTab"
      component={ActiveJobsStackNavigator}
      options={{ title: 'Active' }}
    />
    <Tabs.Screen
      name="UpcomingJobsTab"
      component={UpcomingJobsStackNavigator}
      options={{ title: 'Upcoming' }}
    />
    <Tabs.Screen
      name="HistoryJobsTab"
      component={HistoryJobsStackNavigator}
      options={{ title: 'History' }}
    />
    <Tabs.Screen
      name="SupportTab"
      component={SupportStackNavigator}
      options={{ title: 'Support' }}
    />
    <Tabs.Screen
      name="ProfileTab"
      component={ProfileStackNavigator}
      options={{ title: 'Profile' }}
    />
  </Tabs.Navigator>
);

export const AppNavigator = () => {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return <Loader />;
  }

  return (
    <NavigationContainer theme={appNavigationTheme}>
      {isAuthenticated ? <MainTabsNavigator /> : <AuthStackNavigator />}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  headerLogo: {
    height: 32,
    width: 180,
    resizeMode: 'contain',
  },
  headerAction: {
    color: colors.brandGold,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tabBar: {
    backgroundColor: colors.brandGold,
    borderTopColor: colors.brandGold,
  },
  tabBarLabel: {
    fontWeight: '600',
  },
});
