import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={colors.brandNavy} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
        keyboardVerticalOffset={0}
      >
        <View style={styles.container}>
          {/* Header Section */}
          <View style={styles.headerSection}>
            <Image
              source={require('../../../assets/driver-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                placeholder=""
                placeholderTextColor="#999999"
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
                placeholder=""
                placeholderTextColor="#999999"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <View style={styles.actionsRow}>
              <Pressable hitSlop={8} onPress={() => navigation.navigate('ForgotPasswordEmail')}>
                <Text style={styles.forgotPassword}>Forgot Password ?</Text>
              </Pressable>

              <Pressable 
                style={styles.loginButton} 
                onPress={handleLogin} 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={colors.brandNavy} size="small" />
                ) : (
                  <Text style={styles.loginButtonLabel}>LOGIN</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const FORM_CARD_COLOR = '#8B7355'; // Brown/gold color for form card

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.brandNavy,
  },
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  driverText: {
    color: colors.brandGold,
    fontSize: 14,
    fontFamily: typography.fontFamilyMedium,
    letterSpacing: 4,
    marginBottom: 8,
  },
  logo: {
    width: 218,
    height: 220,
  },
  formCard: {
    width: '100%',
    backgroundColor: FORM_CARD_COLOR,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.brandGold,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  inputGroup: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 8,
    fontFamily: typography.fontFamilyMedium,
  },
  input: {
    width: '100%',
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
    backgroundColor: 'rgba(255, 255, 255, 0.75)', // Cream/beige color
  },
  actionsRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  forgotPassword: {
    color: colors.brandNavy,
    fontSize: 13,
    fontFamily: typography.fontFamilyMedium,
    textDecorationLine: 'underline',
  },
  loginButton: {
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.brandNavy,
    backgroundColor: '#D4CCC4',
    minWidth: 100,
    alignItems: 'center',
  },
  loginButtonLabel: {
    color: colors.brandNavy,
    fontSize: 14,
    fontFamily: typography.fontFamilyMedium,
    letterSpacing: 1,
  },
});
