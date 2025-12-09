import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import { Screen } from '../../components/Screen';
import { LocationStatusBanner } from '../../components/LocationStatusBanner';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { HistoryJobsStackParamList } from '../../types/navigation';
import { DriverJob, getDriverJobs } from '../../api/driver';
import { getErrorMessage } from '../../utils/errors';
import { showErrorToast } from '../../utils/toast';
import { subscribeJobRefresh } from '../../utils/events';

type Props = NativeStackScreenProps<HistoryJobsStackParamList, 'HistoryJobs'>;

export const HistoryJobsScreen: React.FC<Props> = ({ navigation }) => {
  const [jobs, setJobs] = useState<DriverJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadJobs = useCallback(async () => {
    try {
      const data = await getDriverJobs('HISTORY');
      setJobs(data);
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to load history');
      showErrorToast('History', message);
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

  const renderItem = ({ item }: { item: DriverJob }) => {
    const fareValue = typeof item.fareAmount === 'number' ? item.fareAmount : 0;
    return (
      <Pressable style={styles.card} onPress={() => navigation.navigate('JobDetails', { jobId: item.id })}>
        <View>
          <Text style={styles.jobId}>{item.reference}</Text>
          <Text style={styles.passenger}>{item.passengerName}</Text>
        </View>
        <Text style={styles.amount}>{`₹${fareValue.toFixed(0)}`}</Text>
      </Pressable>
    );
  };

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
        ListEmptyComponent={<Text style={styles.emptyText}>Completed rides will show here.</Text>}
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
  amount: {
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
    color: colors.accent,
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
