import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/Screen';
import { AppText as Text } from '../../components/AppText';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { getErrorMessage } from '../../utils/errors';

export const DeleteAccountScreen = () => {
  const { deleteAccount } = useAuth();
  const { colors } = useTheme();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const submit = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true); setError(null);
    try { await deleteAccount(password); }
    catch (failure) { setError(getErrorMessage(failure, 'Unable to delete your account. Please try again.')); }
    finally { submitting.current = false; setBusy(false); }
  };
  const confirm = () => Alert.alert('Permanently delete your account?',
    'This cannot be undone. You will be signed out and will no longer receive rides.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete account', style: 'destructive', onPress: () => { void submit(); } }]);
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Screen scrollable contentContainerStyle={{ padding: 24, gap: 20 }}>
      <Ionicons name="person-remove-outline" size={38} color={colors.error} />
      <Text style={{ fontSize: 26, fontWeight: '700', color: colors.text }}>Delete your driver account</Text>
      <Text style={{ fontSize: 18, lineHeight: 27, color: colors.textSecondary }}>
        This permanently removes your profile details, contact information, saved location, emergency contacts, and driver identity documents. Your login and all sessions will be revoked.
      </Text>
      <View style={{ padding: 18, borderRadius: 16, backgroundColor: colors.card, gap: 12 }}>
        <Text style={{ fontSize: 17, lineHeight: 25, color: colors.textSecondary }}>Historical ride and accounting records remain linked to an anonymous “Deleted driver” record. Vehicle records remain with the fleet.</Text>
        <Text style={{ fontSize: 17, lineHeight: 25, color: colors.textSecondary }}>Finish any active ride or have dispatch reassign your assigned rides before continuing.</Text>
      </View>
      <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }}>Confirm your password</Text>
      <TextInput accessibilityLabel="Current password" placeholder="Current password" placeholderTextColor={colors.textMuted}
        secureTextEntry autoCapitalize="none" autoCorrect={false} textContentType="password" value={password}
        onChangeText={setPassword} editable={!busy}
        style={{ fontSize: 18, minHeight: 54, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, color: colors.text }} />
      {error ? <Text accessibilityRole="alert" style={{ color: colors.error, fontSize: 16 }}>{error}</Text> : null}
      <Pressable accessibilityRole="button" disabled={busy || !password} onPress={confirm}
        style={{ minHeight: 54, padding: 16, alignItems: 'center', borderRadius: 14, backgroundColor: '#A52A32', opacity: busy || !password ? 0.5 : 1 }}>
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>Delete account permanently</Text>}
      </Pressable>
    </Screen>
  </KeyboardAvoidingView>;
};
