import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '../../components/Screen';
import { useTheme, ThemeColors } from '../../context/ThemeContext';
import { typography } from '../../theme/typography';
import { showErrorToast, showSuccessToast } from '../../utils/toast';
import { getErrorMessage } from '../../utils/errors';
import { confirmDriverPasswordReset } from '../../api/passwordReset';
import { AuthStackParamList } from '../../types/navigation';

const MIN_PASSWORD_LENGTH = 8;

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPasswordReset'>;

export const ForgotPasswordResetScreen: React.FC<Props> = ({ route, navigation }) => {
    const { email, resetToken, expiresAt } = route.params;
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const canSubmit = useMemo(() => {
        if (!newPassword || !confirmPassword) return false;
        if (newPassword.length < MIN_PASSWORD_LENGTH) return false;
        return newPassword === confirmPassword;
    }, [newPassword, confirmPassword]);

    const handleReset = async () => {
        if (!canSubmit) {
            Alert.alert(
                'Update password',
                `Ensure both fields match and contain at least ${MIN_PASSWORD_LENGTH} characters.`
            );
            return;
        }

        setIsSubmitting(true);
        try {
            await confirmDriverPasswordReset({ email, resetToken, newPassword });
            showSuccessToast('Password updated', 'Sign in with your new password.');
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        } catch (error) {
            const message = getErrorMessage(error, 'Unable to update password. Please try again.');
            showErrorToast('Reset failed', message);
            Alert.alert('Reset failed', message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
            keyboardVerticalOffset={32}
        >
            <Screen scrollable contentContainerStyle={styles.screen} edges={['top','bottom']}>
                <View style={styles.hero}>
                    <Text style={styles.heroEyebrow}>Create a new password</Text>
                    <Text style={styles.heroTitle}>Choose something unique you have not used before</Text>
                    {expiresAt ? (
                        <Text style={styles.heroSubtitle}>Reset link remains active until {new Date(expiresAt).toLocaleTimeString()}.</Text>
                    ) : (
                        <Text style={styles.heroSubtitle}>For your safety this step expires quickly. Complete it now.</Text>
                    )}
                </View>

                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>New password</Text>
                        <Text style={styles.cardSubtitle}>
                            Use at least {MIN_PASSWORD_LENGTH} characters. Mix letters, numbers, and symbols if possible.
                        </Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>New password</Text>
                        <TextInput
                            style={styles.input}
                            secureTextEntry
                            value={newPassword}
                            onChangeText={setNewPassword}
                            placeholder="••••••••"
                            placeholderTextColor={colors.muted}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Confirm password</Text>
                        <TextInput
                            style={styles.input}
                            secureTextEntry
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            placeholder="••••••••"
                            placeholderTextColor={colors.muted}
                        />
                    </View>

                    <Pressable
                        style={[styles.primaryButton, (!canSubmit || isSubmitting) && styles.buttonDisabled]}
                        onPress={handleReset}
                        disabled={!canSubmit || isSubmitting}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color={colors.brandNavy} />
                        ) : (
                            <Text style={styles.primaryButtonLabel}>Update password</Text>
                        )}
                    </Pressable>

                    <Pressable onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}>
                        <Text style={styles.secondaryActionLabel}>Return to sign in</Text>
                    </Pressable>
                </View>
            </Screen>
        </KeyboardAvoidingView>
    );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    screen: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
        gap: 24,
    },
    hero: {
        backgroundColor: colors.brandNavy,
        borderRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
    },
    heroEyebrow: {
        color: colors.brandGold,
        fontSize: typography.caption,
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    heroTitle: {
        color: '#fff',
        fontSize: 26,
        fontFamily: typography.fontFamilyBold,
        marginBottom: 12,
        lineHeight: 32,
    },
    heroSubtitle: {
        color: '#E7ECFF',
        fontSize: typography.body,
        lineHeight: 22,
    },
    card: {
        backgroundColor: colors.card,
        borderRadius: 24,
        padding: 24,
        shadowColor: '#1F2A44',
        shadowOpacity: 0.08,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 4,
        gap: 20,
    },
    cardHeader: {
        gap: 6,
    },
    cardTitle: {
        fontSize: typography.subheading,
        fontFamily: typography.fontFamilyBold,
        color: colors.text,
    },
    cardSubtitle: {
        color: colors.muted,
        fontSize: typography.body,
        lineHeight: 20,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: typography.caption,
        color: colors.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    input: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 18,
        paddingVertical: 14,
        fontSize: typography.body,
        backgroundColor: colors.inputBackground,
        color: colors.text,
    },
    primaryButton: {
        backgroundColor: colors.brandGold,
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.4,
    },
    primaryButtonLabel: {
        color: colors.brandNavy,
        fontSize: typography.subheading,
        fontFamily: typography.fontFamilyMedium,
    },
    secondaryActionLabel: {
        marginTop: 8,
        textAlign: 'center',
        color: colors.primary,
        textDecorationLine: 'underline',
        fontSize: typography.body,
    },
});
