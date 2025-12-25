import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import { Screen } from '../../components/Screen';
import { LocationStatusBanner } from '../../components/LocationStatusBanner';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { UpcomingJobsStackParamList } from '../../types/navigation';
import { DriverJob, getDriverJobs } from '../../api/driver';
import { getErrorMessage } from '../../utils/errors';
import { showErrorToast } from '../../utils/toast';
import { subscribeJobRefresh } from '../../utils/events';

type Props = NativeStackScreenProps<UpcomingJobsStackParamList, 'UpcomingJobs'>;

export const UpcomingJobsScreen: React.FC<Props> = ({ navigation }) => {
  const [jobs, setJobs] = useState<DriverJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadJobs = useCallback(async () => {
    try {
      const data = await getDriverJobs('UPCOMING');
      setJobs(data);
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to load upcoming jobs');
      showErrorToast('Upcoming jobs', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadJobs();
      const subscription = subscribeJobRefresh(loadJobs);
      return () => subscription.remove();
    }, [loadJobs])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadJobs();
  }, [loadJobs]);

  const renderItem = ({ item }: { item: DriverJob }) => (
    <Pressable style={styles.card} onPress={() => navigation.navigate('JobDetails', { jobId: item.id })}>
      <View>
        <Text style={styles.jobId}>{item.reference}</Text>
        <Text style={styles.passenger}>{item.passengerName}</Text>
        <Text style={styles.route}>{item.pickup?.addressLine ?? '—'}</Text>
        <Text style={styles.subtle}>{item.vehicleNumber ?? '—'}</Text>
      </View>
      <View style={styles.rightContent}>
        <Text style={styles.label}>Pickup</Text>
        <Text style={styles.value}>{new Date(item.scheduledTime).toLocaleTimeString()}</Text>
      </View>
    </Pressable>
  );

  if (loading) {
    return (
      <Screen contentContainerStyle={styles.loaderContainer}>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }

  return (
    <Screen>
      <LocationStatusBanner />
      <FlatList
        style={styles.list}
        contentContainerStyle={jobs.length ? styles.listContent : styles.empty}
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.emptyText}>No upcoming jobs scheduled.</Text>}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderColor: colors.border,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jobId: {
    fontSize: typography.subheading,
    color: colors.text,
  },
  passenger: {
    fontSize: typography.body,
    color: colors.muted,
  },
  route: {
    fontSize: typography.caption,
    color: colors.muted,
  },
  subtle: {
    fontSize: typography.caption,
    color: colors.muted,
  },
  rightContent: {
    alignItems: 'flex-end',
  },
  label: {
    fontSize: typography.caption,
    color: colors.muted,
  },
  value: {
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
    color: colors.text,
  },
  loaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  emptyText: {
    fontSize: typography.body,
    color: colors.muted,
  },
});
