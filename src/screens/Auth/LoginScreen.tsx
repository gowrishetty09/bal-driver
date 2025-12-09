import React, { useState } from 'react';
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
import { useAuth } from '../../hooks/useAuth';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { showErrorToast, showSuccessToast } from '../../utils/toast';
import { getErrorMessage } from '../../utils/errors';
import { AuthStackParamList } from '../../types/navigation';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const [email, setEmail] = useState('driver@example.com');
  const [password, setPassword] = useState('demo123');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter both email and password');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      showSuccessToast('Welcome back', 'You are now signed in');
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to sign in. Please try again.');
      showErrorToast('Login failed', message);
      Alert.alert('Login failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
      keyboardVerticalOffset={64}
    >
      <Screen contentContainerStyle={styles.container} edges={['top','bottom']}>
        <Text style={styles.title}>Driver Console</Text>
        <Text style={styles.subtitle}>Enter your credentials to access current and upcoming rides.</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="driver@fleet.com"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="•••••••"
            placeholderTextColor={colors.muted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <View style={styles.actionsRow}>
          <Pressable hitSlop={8} onPress={() => navigation.navigate('ForgotPasswordEmail')}>
            <Text style={styles.forgotPassword}>Forgot password?</Text>
          </Pressable>
        </View>

        <Pressable style={styles.button} onPress={handleLogin} disabled={isSubmitting}>
          {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonLabel}>Sign In</Text>}
        </Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: typography.heading,
    fontFamily: typography.fontFamilyBold,
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: typography.body,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 32,
  },
  inputGroup: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    fontSize: typography.caption,
    color: colors.muted,
    marginBottom: 6,
  },
  input: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: typography.body,
    color: colors.text,
    backgroundColor: '#fff',
  },
  button: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    marginTop: 8,
  },
  actionsRow: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  forgotPassword: {
    color: colors.brandNavy,
    fontSize: typography.caption,
    fontFamily: typography.fontFamilyMedium,
    textDecorationLine: 'underline',
  },
  buttonLabel: {
    color: '#fff',
    fontSize: typography.subheading,
    fontFamily: typography.fontFamilyMedium,
  },
});
