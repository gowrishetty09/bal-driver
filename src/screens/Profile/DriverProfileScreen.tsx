import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '../../components/Screen';
import { useAuth } from '../../hooks/useAuth';
import { useLocationService } from '../../hooks/useLocationService';
import { PlacesAutocompleteInput } from '../../components/PlacesAutocompleteInput';
import { fetchPlaceDetails, PlaceDetails } from '../../services/googlePlaces';
import { updateDriverLocation } from '../../api/driverLocation';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { getErrorMessage } from '../../utils/errors';
import { showErrorToast, showSuccessToast } from '../../utils/toast';
import { ProfileStackParamList } from '../../types/navigation';

const friendlyTime = (timestamp?: string | null) => {
  if (!timestamp) {
    return 'No updates yet';
  }

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return 'No updates yet';
  }

  const diffMs = Date.now() - parsed.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) {
    return 'Just now';
  }
  if (minutes === 1) {
    return '1 minute ago';
  }
  if (minutes < 60) {
    return `${minutes} minutes ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  return new Date(timestamp).toLocaleString();
};

export const DriverProfileScreen: React.FC = () => {
  const { user, logout, updateUserProfile } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const { permissionStatus, requestPermission, isSharingLocation, lastSentAt, lastKnownCoordinates } =
    useLocationService();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isResolvingPlace, setIsResolvingPlace] = useState(false);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const initialLocation: PlaceDetails | null = user?.homeBaseLocation
    ? {
        description: user.homeBaseLocation.address,
        latitude: user.homeBaseLocation.latitude,
        longitude: user.homeBaseLocation.longitude,
        placeId: user.homeBaseLocation.placeId ?? user.homeBaseLocation.address,
      }
    : null;
  const [selectedLocation, setSelectedLocation] = useState<PlaceDetails | null>(initialLocation);

  const effectiveCoords = useMemo(() => {
    if (lastKnownCoordinates) {
      return lastKnownCoordinates;
    }
    if (user?.lastLocation) {
      return {
        latitude: user.lastLocation.latitude,
        longitude: user.lastLocation.longitude,
      };
    }
    return null;
  }, [lastKnownCoordinates, user?.lastLocation]);

  const lastUpdatedLabel = friendlyTime(lastSentAt ?? user?.lastLocation?.updatedAt);
  const locationDisabled = permissionStatus !== 'granted';

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleEditProfile = () => {
    showSuccessToast('Profile', 'Your profile is up to date.');
  };

  const handlePlaceSelect = async (prediction: { placeId: string; description: string }) => {
    setIsResolvingPlace(true);
    try {
      const details = await fetchPlaceDetails(prediction.placeId);
      setSelectedLocation(details);
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to resolve address');
      showErrorToast('Location search', message);
    } finally {
      setIsResolvingPlace(false);
    }
  };

  const handleSaveLocation = async () => {
    if (!selectedLocation) {
      return;
    }
    setIsSavingLocation(true);
    try {
      const payload = {
        address: selectedLocation.description,
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        placeId: selectedLocation.placeId,
      };
      const response = await updateDriverLocation(payload);
      await updateUserProfile((prev) => (prev ? { ...prev, homeBaseLocation: { ...payload, updatedAt: response.updatedAt } } : prev));
      showSuccessToast('Location saved', 'Dispatch will see your updated base location.');
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to save location');
      showErrorToast('Location update', message);
    } finally {
      setIsSavingLocation(false);
    }
  };

  const savedLocationLabel = selectedLocation?.description ?? 'Not set yet';
  const locationUpdatedAt = user?.homeBaseLocation?.updatedAt
    ? friendlyTime(user.homeBaseLocation.updatedAt)
    : 'Never';

  return (
    <Screen scrollable contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>{user?.name ?? 'Driver'}</Text>
        <Text style={styles.subtitle}>{user?.email}</Text>
        <Text style={styles.subtitle}>{user?.phone ?? 'Phone unavailable'}</Text>
        <View style={styles.badgesRow}>
          {user?.vehicleNumber ? <Text style={styles.badge}>{user.vehicleNumber}</Text> : null}
          {user?.status ? <Text style={styles.badge}>{user.status}</Text> : null}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Location Sharing</Text>
        <Text style={styles.sectionSubtitle}>
          {locationDisabled
            ? 'Location sharing is disabled; dispatch cannot see your live location.'
            : isSharingLocation
            ? 'Sharing live location with dispatch.'
            : 'Location sharing will resume shortly.'}
        </Text>
        <Text style={styles.metaText}>{`Last update: ${lastUpdatedLabel}`}</Text>
        {effectiveCoords && typeof effectiveCoords.latitude === 'number' && typeof effectiveCoords.longitude === 'number' ? (
          <Text style={styles.metaText}>
            {`Lat ${effectiveCoords.latitude.toFixed(4)}, Lng ${effectiveCoords.longitude.toFixed(4)}`}
          </Text>
        ) : null}

        {locationDisabled && (
          <Pressable style={styles.secondaryButton} onPress={requestPermission}>
            <Text style={styles.secondaryButtonLabel}>Enable location sharing</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Base Location</Text>
        <Text style={styles.sectionSubtitle}>Search and save your preferred pickup/home location.</Text>
        <PlacesAutocompleteInput
          placeholder="Search location"
          initialValue={selectedLocation?.description}
          onSelect={handlePlaceSelect}
        />
        {isResolvingPlace && <Text style={styles.metaText}>Resolving address…</Text>}
        <View style={styles.savedLocationRow}>
          <Text style={styles.metaText}>{savedLocationLabel}</Text>
          <Text style={styles.metaText}>{`Last saved: ${locationUpdatedAt}`}</Text>
        </View>
        <Pressable
          style={[styles.secondaryButton, styles.saveButton, (!selectedLocation || isSavingLocation || isResolvingPlace) && styles.disabledButton]}
          onPress={handleSaveLocation}
          disabled={!selectedLocation || isSavingLocation || isResolvingPlace}
        >
          {isSavingLocation ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.secondaryButtonLabel}>Save location</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Profile Actions</Text>
        <Pressable style={styles.secondaryButton} onPress={handleEditProfile}>
          <Text style={styles.secondaryButtonLabel}>Update profile</Text>
        </Pressable>
        <Pressable style={styles.logoutButton} onPress={handleLogout} disabled={isLoggingOut}>
          {isLoggingOut ? <ActivityIndicator color="#fff" /> : <Text style={styles.logoutLabel}>Logout</Text>}
        </Pressable>
      </View>

      {/* Feedback & Help Card */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Feedback & Help</Text>
        <Text style={styles.sectionSubtitle}>Help us improve your experience</Text>
        
        <Pressable 
          style={styles.feedbackButton} 
          onPress={() => navigation.navigate('Feedback', {})}
        >
          <Ionicons name="star-outline" size={20} color={colors.brandGold} />
          <Text style={styles.feedbackButtonLabel}>Give Feedback</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.brandGold} style={styles.chevron} />
        </Pressable>
        
        <Pressable 
          style={styles.feedbackButton} 
          onPress={() => navigation.navigate('Feedback', { isReportIssue: true, preSelectedCategory: 'APP_EXPERIENCE' })}
        >
          <Ionicons name="warning-outline" size={20} color={colors.danger} />
          <Text style={[styles.feedbackButtonLabel, styles.reportIssueLabel]}>Report an Issue</Text>
          <Ionicons name="chevron-forward" size={20} color="#fff" style={styles.chevron} />
        </Pressable>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  title: {
    fontSize: typography.heading,
    fontFamily: typography.fontFamilyBold,
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.body,
    color: colors.muted,
    marginTop: 4,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: typography.caption,
  },
  sectionTitle: {
    fontSize: typography.subheading,
    fontFamily: typography.fontFamilyMedium,
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: typography.body,
    color: colors.muted,
    marginTop: 6,
  },
  metaText: {
    fontSize: typography.caption,
    color: colors.muted,
    marginTop: 4,
  },
  secondaryButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  saveButton: {
    marginTop: 12,
  },
  secondaryButtonLabel: {
    color: colors.primary,
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
  },
  disabledButton: {
    opacity: 0.5,
  },
  logoutButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.danger,
    alignItems: 'center',
  },
  logoutLabel: {
    color: '#fff',
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
  },
  savedLocationRow: {
    marginTop: 12,
    gap: 4,
  },
  feedbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.brandNavy,
    gap: 12,
  },
  feedbackButtonLabel: {
    flex: 1,
    color: colors.brandGold,
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
  },
  reportIssueLabel: {
    color: '#fff',
  },
  chevron: {
    marginLeft: 'auto',
  },
});
