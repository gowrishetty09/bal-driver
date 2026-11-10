import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useLocationService } from '../hooks/useLocationService';
import { useTheme } from '../context/ThemeContext';

export function RideReadinessCard() {
  const { outsideDriver, readyForRides, readinessBusy, readinessError, setRideReadiness, isSharingLocation } = useLocationService();
  const { colors } = useTheme();
  if (outsideDriver === false) return null;
  if (outsideDriver === null) return <Text style={{ color: colors.textMuted, marginBottom: 12 }}>{readinessError ?? 'Checking ride availability…'}</Text>;
  return <View style={{ padding: 18, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: readyForRides ? '#23945D' : colors.brandGold, gap: 12, marginBottom: 16 }}>
    <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>{readyForRides ? 'Ready for rides' : 'You are offline'}</Text>
    <Text style={{ color: colors.textSecondary, fontSize: 16 }}>{readyForRides
      ? isSharingLocation ? 'Listening for nearby paid rides. Accept a booking when it suits you.' : 'Refreshing your location. Nearby matching pauses when your GPS is stale.'
      : 'Start to share your location and receive nearby ride requests.'}</Text>
    {readinessError ? <Text accessibilityRole="alert" style={{ color: colors.textSecondary }}>{readinessError}</Text> : null}
    <Pressable accessibilityRole="button" accessibilityLabel={readyForRides ? 'Stop receiving new rides' : 'Start receiving nearby rides'} disabled={readinessBusy}
      onPress={() => void setRideReadiness(!readyForRides)}
      style={{ padding: 15, borderRadius: 12, alignItems: 'center', backgroundColor: readyForRides ? '#8D3030' : colors.buttonPrimary, opacity: readinessBusy ? 0.6 : 1 }}>
      {readinessBusy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>{readyForRides ? 'Stop' : 'Start · Ready for rides'}</Text>}
    </Pressable>
    {readyForRides ? <Text style={{ color: colors.textMuted, fontSize: 13 }}>Stopping prevents new offers. Any accepted ride continues normally.</Text> : null}
  </View>;
}
