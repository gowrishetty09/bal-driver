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
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { showErrorToast, showSuccessToast } from '../../utils/toast';
import { getErrorMessage } from '../../utils/errors';
import {
    requestDriverPasswordReset,
    verifyDriverPasswordOtp,
    DriverPasswordResetVerifyResponse,
} from '../../api/passwordReset';
import { AuthStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPasswordOtp'>;

const formatEmail = (email: string) => {
    const [username, domain] = email.split('@');
    if (!domain) return email;
    const masked = username.length <= 2 ? `${username[0]}***` : `${username.slice(0, 2)}***`;
    return `${masked}@${domain}`;
};

export const ForgotPasswordOtpScreen: React.FC<Props> = ({ route, navigation }) => {
    const { email } = route.params;
    const [otp, setOtp] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isResending, setIsResending] = useState(false);

    const canSubmit = useMemo(() => otp.trim().length === 6, [otp]);

    const handleSubmit = async () => {
        if (!canSubmit) {
            Alert.alert('Invalid code', 'Enter the 6-digit code from your email.');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = { email, otp: otp.trim() };
            const response: DriverPasswordResetVerifyResponse = await verifyDriverPasswordOtp(payload);
            showSuccessToast('OTP verified', 'Choose a new password to finish.');
            navigation.navigate('ForgotPasswordReset', {
                email,
                resetToken: response.resetToken,
                expiresAt: response.expiresAt,
            });
        } catch (error) {
            const message = getErrorMessage(error, 'OTP is invalid or expired. Please try again.');
            showErrorToast('Verification failed', message);
            Alert.alert('Verification failed', message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResend = async () => {
        setIsResending(true);
        try {
            const response = await requestDriverPasswordReset({ email });
            const message = response.message ?? 'We just sent you a fresh code.';
            showSuccessToast('OTP resent', message);
        } catch (error) {
            const message = getErrorMessage(error, 'Unable to resend code. Please try again shortly.');
            showErrorToast('Resend failed', message);
            Alert.alert('Resend failed', message);
        } finally {
            setIsResending(false);
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
                    <Text style={styles.heroEyebrow}>Check your inbox</Text>
                    <Text style={styles.heroTitle}>We sent a code to {formatEmail(email)}</Text>
                    <Text style={styles.heroSubtitle}>
                        Enter the six digits to verify it's you. The code expires in 10 minutes.
                    </Text>
                </View>

                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>6-digit code</Text>
                        <Text style={styles.cardSubtitle}>Enter the digits exactly as shown in the email.</Text>
                    </View>

                    <TextInput
                        style={styles.otpInput}
                        keyboardType="number-pad"
                        maxLength={6}
                        value={otp}
                        onChangeText={(value) => setOtp(value.replace(/[^0-9]/g, ''))}
                        placeholder="123456"
                        placeholderTextColor={colors.muted}
                    />

                    <Pressable
                        style={[styles.primaryButton, (!canSubmit || isSubmitting) && styles.buttonDisabled]}
                        onPress={handleSubmit}
                        disabled={!canSubmit || isSubmitting}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color="#151E2D" />
                        ) : (
                            <Text style={styles.primaryButtonLabel}>Verify code</Text>
                        )}
                    </Pressable>

                    <View style={styles.resendRow}>
                        <Text style={styles.resendHint}>Did not receive anything?</Text>
                        <Pressable onPress={handleResend} disabled={isResending}>
                            {isResending ? (
                                <ActivityIndicator color={colors.brandGold} size="small" />
                            ) : (
                                <Text style={styles.resendAction}>Resend code</Text>
                            )}
                        </Pressable>
                    </View>

                    <Pressable onPress={() => navigation.goBack()} style={styles.secondaryAction}>
                        <Text style={styles.secondaryActionLabel}>Back</Text>
                    </Pressable>
                </View>
            </Screen>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
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
        backgroundColor: '#fff',
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
    },
    otpInput: {
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.brandGold,
        textAlign: 'center',
        fontSize: 28,
        letterSpacing: 12,
        paddingVertical: 16,
        color: colors.text,
        backgroundColor: colors.background,
    },
    primaryButton: {
        backgroundColor: colors.brandGold,
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    primaryButtonLabel: {
        color: colors.brandNavy,
        fontSize: typography.subheading,
        fontFamily: typography.fontFamilyMedium,
    },
    resendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    resendHint: {
        color: colors.muted,
        fontSize: typography.caption,
    },
    resendAction: {
        color: colors.brandGold,
        fontSize: typography.body,
        fontFamily: typography.fontFamilyMedium,
    },
    secondaryAction: {
        alignItems: 'center',
    },
    secondaryActionLabel: {
        color: colors.brandNavy,
        textDecorationLine: 'underline',
        fontSize: typography.body,
    },
});
