import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '../../components/Screen';
import { useAuth } from '../../hooks/useAuth';
import { useLocationService } from '../../hooks/useLocationService';
import { changeDriverPassword } from '../../api/passwordReset';
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
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

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

  const resetPasswordForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleChangePassword = async () => {
    if (!currentPassword.trim()) {
      showErrorToast('Error', 'Please enter your current password.');
      return;
    }
    if (!newPassword.trim()) {
      showErrorToast('Error', 'Please enter a new password.');
      return;
    }
    if (newPassword.length < 6) {
      showErrorToast('Error', 'New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showErrorToast('Error', 'New passwords do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await changeDriverPassword({ currentPassword, newPassword });
      showSuccessToast('Success', 'Your password has been changed.');
      setShowPasswordModal(false);
      resetPasswordForm();
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to change password');
      showErrorToast('Error', message);
    } finally {
      setIsChangingPassword(false);
    }
  };

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
        <Text style={styles.sectionTitle}>Profile Actions</Text>
        <Pressable 
          style={styles.secondaryButton} 
          onPress={() => setShowPasswordModal(true)}
        >
          <Text style={styles.secondaryButtonLabel}>Change Password</Text>
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

      {/* Change Password Modal */}
      <Modal
        visible={showPasswordModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowPasswordModal(false);
          resetPasswordForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Password</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Current Password"
              placeholderTextColor={colors.muted}
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
              autoCapitalize="none"
            />
            
            <TextInput
              style={styles.modalInput}
              placeholder="New Password"
              placeholderTextColor={colors.muted}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              autoCapitalize="none"
            />
            
            <TextInput
              style={styles.modalInput}
              placeholder="Confirm New Password"
              placeholderTextColor={colors.muted}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              autoCapitalize="none"
            />
            
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowPasswordModal(false);
                  resetPasswordForm();
                }}
                disabled={isChangingPassword}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              
              <Pressable
                style={[styles.modalSubmitButton, isChangingPassword && styles.disabledButton]}
                onPress={handleChangePassword}
                disabled={isChangingPassword}
              >
                {isChangingPassword ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSubmitText}>Change Password</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: typography.heading,
    fontFamily: typography.fontFamilyBold,
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: typography.body,
    color: colors.text,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  modalCancelText: {
    color: colors.muted,
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
  },
  modalSubmitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  modalSubmitText: {
    color: '#fff',
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
  },
});
