import React, { useCallback, useState } from "react";
import { Alert, AppState, Pressable, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { apiClient } from "../api/client";
import { useTheme } from "../context/ThemeContext";
import { emitJobRefresh } from "../utils/events";

type Offer = { id: string; pickupLocation: string; dropLocation: string; passengers: number };
export function RideOffersCard() {
  const { colors } = useTheme(); const navigation = useNavigation<any>();
  const [offers, setOffers] = useState<Offer[]>([]); const [accepting, setAccepting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    let alive = true; let loading = false;
    const refresh = async () => {
      if (loading || AppState.currentState !== "active") return;
      loading = true;
      try { const response = await apiClient.get<Offer[]>("/driver/ride-offers"); if (alive) { setOffers(response.data); setError(null); } }
      catch { if (alive) { setOffers([]); setError("Available rides could not be refreshed."); } }
      finally { loading = false; }
    };
    void refresh(); const timer = setInterval(refresh, 10000);
    const listener = AppState.addEventListener("change", state => { if (state === "active") void refresh(); });
    return () => { alive = false; clearInterval(timer); listener.remove(); };
  }, []));
  const accept = async (offer: Offer) => {
    if (accepting) return; setAccepting(offer.id);
    try {
      await apiClient.post(`/driver/ride-offers/${offer.id}/accept`);
      setOffers([]); emitJobRefresh();
      navigation.navigate("RidesTab", { screen: "JobDetails", params: { jobId: offer.id } });
    } catch (error: any) {
      setOffers(current => current.filter(item => item.id !== offer.id));
      const message = error?.response?.data?.message;
      Alert.alert("Unable to accept ride", typeof message === "string" ? message : "This offer may have been accepted already. Refresh your rides to check.");
      emitJobRefresh();
    } finally { setAccepting(null); }
  };
  if (!offers.length) return error ? <Text style={{ color: colors.textMuted, marginBottom: 12 }}>{error}</Text> : null;
  return <View style={{ gap: 12, marginBottom: 16 }}>
    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 20 }}>Available rides</Text>
    {offers.map(offer => <View key={offer.id} style={{ padding: 16, gap: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.brandGold, backgroundColor: colors.card }}>
      <Text style={{ color: colors.text, fontWeight: "600" }}>Pickup: {offer.pickupLocation}</Text>
      <Text style={{ color: colors.textSecondary }}>To: {offer.dropLocation}</Text>
      <Text style={{ color: colors.textMuted }}>{offer.passengers} passenger{offer.passengers === 1 ? "" : "s"} · Paid online · Ready now</Text>
      <Pressable accessibilityRole="button" disabled={!!accepting} onPress={() => accept(offer)} style={{ backgroundColor: colors.buttonPrimary, borderRadius: 12, padding: 14, alignItems: "center", opacity: accepting ? 0.5 : 1 }}>
        <Text style={{ color: colors.buttonPrimaryText, fontWeight: "700" }}>{accepting === offer.id ? "Accepting…" : "Accept ride"}</Text>
      </Pressable>
    </View>)}
  </View>;
}
