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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Screen } from '../../components/Screen';
import { useTheme, ThemeColors } from '../../context/ThemeContext';
import { typography } from '../../theme/typography';
import { showErrorToast, showSuccessToast } from '../../utils/toast';
import { getErrorMessage } from '../../utils/errors';
import { requestDriverPasswordReset } from '../../api/passwordReset';
import { AuthStackParamList } from '../../types/navigation';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'ForgotPasswordEmail'>;

export const ForgotPasswordEmailScreen: React.FC = () => {
    const navigation = useNavigation<NavigationProp>();
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isEmailValid = useMemo(() => emailRegex.test(email.trim()), [email]);

    const handleSubmit = async () => {
        if (!isEmailValid) {
            Alert.alert('Invalid email', 'Please enter a valid email address used for your driver account.');
            return;
        }

        setIsSubmitting(true);
        try {
            const normalizedEmail = email.trim().toLowerCase();
            const response = await requestDriverPasswordReset({ email: normalizedEmail });
            const message = response.message ??
                'If the email belongs to an active driver account, a 6-digit code has been sent.';
            showSuccessToast('OTP sent', message);
            navigation.navigate('ForgotPasswordOtp', { email: normalizedEmail });
        } catch (error) {
            const description = getErrorMessage(error, 'Unable to start password reset. Please try again.');
            showErrorToast('Request failed', description);
            Alert.alert('Request failed', description);
        } finally {
            setIsSubmitting(false);
        }
    };

    const goBack = () => navigation.goBack();

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
            keyboardVerticalOffset={32}
        >
            <Screen scrollable contentContainerStyle={styles.screen} edges={['top','bottom']}>
                <View style={styles.hero}>
                    <Text style={styles.heroEyebrow}>Reset access</Text>
                    <Text style={styles.heroTitle}>Let us help you get back on the road</Text>
                    <Text style={styles.heroSubtitle}>
                        Enter the email linked to your driver profile. We will send a one-time code to verify your
                        identity.
                    </Text>
                </View>

                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>Where should we send the code?</Text>
                        <Text style={styles.cardSubtitle}>Use the same email you use to sign in.</Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Driver email</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="driver@limfleet.com"
                            placeholderTextColor={colors.muted}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    <Pressable
                        style={[styles.primaryButton, (!isEmailValid || isSubmitting) && styles.buttonDisabled]}
                        onPress={handleSubmit}
                        disabled={!isEmailValid || isSubmitting}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.primaryButtonLabel}>Send OTP</Text>
                        )}
                    </Pressable>

                    <Pressable onPress={goBack} style={styles.secondaryAction}>
                        <Text style={styles.secondaryActionLabel}>Back to sign in</Text>
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
        opacity: 0.5,
    },
    primaryButtonLabel: {
        color: colors.brandNavy,
        fontSize: typography.subheading,
        fontFamily: typography.fontFamilyMedium,
    },
    secondaryAction: {
        alignItems: 'center',
        paddingVertical: 6,
    },
    secondaryActionLabel: {
        color: colors.primary,
        fontSize: typography.body,
        textDecorationLine: 'underline',
    },
});
