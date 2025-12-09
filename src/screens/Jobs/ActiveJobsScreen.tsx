import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import { Screen } from '../../components/Screen';
import { LocationStatusBanner } from '../../components/LocationStatusBanner';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { ActiveJobsStackParamList } from '../../types/navigation';
import { DriverJob, getDriverJobs } from '../../api/driver';
import { getErrorMessage } from '../../utils/errors';
import { showErrorToast } from '../../utils/toast';
import { subscribeJobRefresh } from '../../utils/events';

type Props = NativeStackScreenProps<ActiveJobsStackParamList, 'ActiveJobs'>;

export const ActiveJobsScreen: React.FC<Props> = ({ navigation }) => {
  const [jobs, setJobs] = useState<DriverJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadJobs = useCallback(async () => {
    try {
      const data = await getDriverJobs('ACTIVE');
      setJobs(data);
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to load active jobs');
      showErrorToast('Active jobs', message);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadJobs();
      const subscription = subscribeJobRefresh(loadJobs);
      return () => {
        subscription.remove();
      };
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
        <Text style={styles.route}>{`${item.pickup?.addressLine ?? '—'} → ${
          item.dropoff?.addressLine ?? '—'
        }`}</Text>
      </View>
      <Text style={styles.eta}>{new Date(item.scheduledTime).toLocaleTimeString()}</Text>
    </Pressable>
  );

  if (isLoading) {
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
        ListEmptyComponent={<Text style={styles.emptyText}>No active jobs assigned.</Text>}
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderColor: colors.border,
    borderWidth: 1,
  },
  jobId: {
    fontSize: typography.subheading,
    fontFamily: typography.fontFamilyMedium,
    color: colors.text,
  },
  passenger: {
    marginTop: 4,
    fontSize: typography.body,
    color: colors.muted,
  },
  route: {
    marginTop: 2,
    fontSize: typography.caption,
    color: colors.muted,
  },
  eta: {
    marginTop: 12,
    fontSize: typography.body,
    color: colors.primary,
    fontFamily: typography.fontFamilyMedium,
  },
});
