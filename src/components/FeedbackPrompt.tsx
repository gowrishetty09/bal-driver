import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme, ThemeColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { DriverJob, getDriverJobs } from '../api/driver';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export type FeedbackPromptProps = {
  visible: boolean;
  onClose: () => void;
  bookingId?: string;
  title?: string;
  onNavigateToJob?: (jobId: string) => void;
  onNavigateHome?: () => void;
};

export const FeedbackPrompt: React.FC<FeedbackPromptProps> = ({
  visible,
  onClose,
  bookingId,
  title = 'Ride Completed Successfully!',
  onNavigateToJob,
  onNavigateHome,
}) => {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [upcomingRides, setUpcomingRides] = useState<DriverJob[]>([]);
  const [loading, setLoading] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Fetch upcoming rides when visible
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 9,
      }).start();

      // Fetch upcoming rides
      const fetchUpcomingRides = async () => {
        setLoading(true);
        try {
          const rides = await getDriverJobs('UPCOMING');
          setUpcomingRides(rides);
        } catch (error) {
          console.warn('Unable to fetch upcoming rides', error);
          setUpcomingRides([]);
        } finally {
          setLoading(false);
        }
      };
      fetchUpcomingRides();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleOkay = useCallback(() => {
    onClose();
    if (onNavigateHome) {
      onNavigateHome();
    }
  }, [onClose, onNavigateHome]);

  const handleRidePress = useCallback((jobId: string) => {
    onClose();
    if (onNavigateToJob) {
      onNavigateToJob(jobId);
    }
  }, [onClose, onNavigateToJob]);

  const formatDateTime = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const day = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `${day} at ${time}`;
  }, []);

  const renderRideItem = useCallback(({ item }: { item: DriverJob }) => (
    <Pressable
      style={styles.rideItem}
      onPress={() => handleRidePress(item.id)}
    >
      <View style={styles.rideItemLeft}>
        <Ionicons name="car-outline" size={24} color={colors.brandNavy} />
      </View>
      <View style={styles.rideItemContent}>
        <Text style={styles.rideReference}>#{item.reference}</Text>
        <Text style={styles.ridePassenger}>{item.passengerName}</Text>
        <Text style={styles.rideTime}>
          <Ionicons name="time-outline" size={14} color={colors.muted} />{' '}
          {formatDateTime(item.scheduledTime)}
        </Text>
        {item.pickup?.addressLine && (
          <Text style={styles.rideAddress} numberOfLines={1}>
            <Ionicons name="location-outline" size={14} color={colors.muted} />{' '}
            {item.pickup.addressLine}
          </Text>
        )}
      </View>
      <View style={styles.rideItemRight}>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </View>
    </Pressable>
  ), [colors, styles, handleRidePress, formatDateTime]);

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdropPress} onPress={handleClose} />
        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Success Icon */}
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={64} color={colors.success} />
          </View>

          {/* Content */}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            Great job! Your ride has been completed successfully.
          </Text>

          {/* Upcoming Rides Section */}
          <View style={styles.upcomingSection}>
            <Text style={styles.upcomingTitle}>Upcoming Rides</Text>
            {loading ? (
              <ActivityIndicator color={colors.brandNavy} style={styles.loader} />
            ) : upcomingRides.length > 0 ? (
              <FlatList
                data={upcomingRides.slice(0, 5)}
                keyExtractor={(item) => item.id}
                renderItem={renderRideItem}
                style={styles.ridesList}
                scrollEnabled={upcomingRides.length > 3}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={styles.noRidesContainer}>
                <Ionicons name="calendar-outline" size={32} color={colors.muted} />
                <Text style={styles.noRidesText}>No upcoming rides scheduled</Text>
              </View>
            )}
          </View>

          {/* Okay Button */}
          <Pressable style={styles.okayButton} onPress={handleOkay}>
            <Text style={styles.okayLabel}>Okay</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdropPress: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 40,
    maxHeight: SCREEN_HEIGHT * 0.8,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  successIcon: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: typography.heading,
    fontFamily: typography.fontFamilyBold,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.body,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  upcomingSection: {
    marginVertical: 16,
  },
  upcomingTitle: {
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
    color: colors.text,
    marginBottom: 12,
  },
  loader: {
    marginVertical: 24,
  },
  ridesList: {
    maxHeight: 240,
  },
  rideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rideItemLeft: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rideItemContent: {
    flex: 1,
  },
  rideReference: {
    fontSize: typography.caption,
    color: colors.brandNavy,
    fontFamily: typography.fontFamilyMedium,
  },
  ridePassenger: {
    fontSize: typography.body,
    color: colors.text,
    fontFamily: typography.fontFamilyMedium,
    marginTop: 2,
  },
  rideTime: {
    fontSize: typography.caption,
    color: colors.muted,
    marginTop: 4,
  },
  rideAddress: {
    fontSize: typography.caption,
    color: colors.muted,
    marginTop: 2,
  },
  rideItemRight: {
    marginLeft: 8,
  },
  noRidesContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  noRidesText: {
    fontSize: typography.body,
    color: colors.muted,
    marginTop: 8,
  },
  okayButton: {
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: colors.brandNavy,
    alignItems: 'center',
    marginTop: 8,
  },
  okayLabel: {
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
    color: colors.brandGold,
  },
});
