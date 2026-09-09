import React, { useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  Platform,
  ScrollView,
} from "react-native";
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
} from "react-native-maps";
import { useTheme } from "../context/ThemeContext";
import type { Coordinates, JobStatus } from "../api/driver";
import type { DriverRoute } from "../services/routeDirections";


// Default center: Hyderabad, India
const DEFAULT_CENTER = { lat: 17.385, lng: 78.4867 };

const MAP_EDGE_PADDING = {
  top: 80,
  right: 50,
  bottom: 80,
  left: 50,
};

interface RideMapViewProps {
  driverLocation: { latitude: number; longitude: number } | null;
  pickupCoords: Coordinates | null | undefined;
  dropCoords: Coordinates | null | undefined;
  status: JobStatus;
  pickupAddress?: string;
  dropAddress?: string;
  onNavigatePress?: () => void;
  fullScreen?: boolean;
  routeDetails?: DriverRoute | null;
  estimatedTime?: string;
  estimatedDistance?: string;
}

// Helper to safely convert to number
const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

// Validate coordinate is valid and not 0,0
const isValidCoord = (lat: number | null, lng: number | null): boolean => {
  if (lat === null || lng === null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  // Avoid 0,0 (null island)
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) return false;
  return true;
};

// Convert Coordinates to {lat, lng} format
const extractLatLng = (coords: Coordinates | null | undefined): { lat: number; lng: number } | null => {
  if (!coords) return null;
  
  const lat = toNumber((coords as any).lat ?? (coords as any).latitude);
  const lng = toNumber((coords as any).lng ?? (coords as any).longitude);
  
  if (isValidCoord(lat, lng)) {
    return { lat: lat!, lng: lng! };
  }
  return null;
};

// Convert driver location {latitude, longitude} to {lat, lng}
const extractDriverLatLng = (loc: { latitude: number; longitude: number } | null): { lat: number; lng: number } | null => {
  if (!loc) return null;
  
  const lat = toNumber(loc.latitude);
  const lng = toNumber(loc.longitude);
  
  if (isValidCoord(lat, lng)) {
    return { lat: lat!, lng: lng! };
  }
  return null;
};

export const RideMapView: React.FC<RideMapViewProps> = ({
  driverLocation,
  pickupCoords,
  dropCoords,
  status,
  pickupAddress,
  dropAddress,
  fullScreen = false,
  routeDetails,
  estimatedTime: propEstimatedTime,
  estimatedDistance: propEstimatedDistance,
}) => {
  const { colors } = useTheme();
  const mapRef = useRef<MapView>(null);
  const routePoints = routeDetails?.points ?? [];
  const hasFittedMapRef = useRef(false);
  const estimatedTime = routeDetails ? Math.ceil(routeDetails.durationSeconds / 60) + " min" : propEstimatedTime;
  const estimatedDistance = routeDetails ? (routeDetails.distanceMeters / 1000).toFixed(1) + " km" : propEstimatedDistance;

  // Extract and validate coordinates
  const driverLatLng = extractDriverLatLng(driverLocation);
  const pickupLatLng = extractLatLng(pickupCoords);
  const dropLatLng = extractLatLng(dropCoords);

  // Determine destination based on status
  const isAfterPickup = status === "PICKED_UP";
  const destinationLatLng = isAfterPickup ? dropLatLng : pickupLatLng;

  // This component only displays GPS fixes and a route supplied by an explicit request.
  useEffect(() => { hasFittedMapRef.current = false; }, [routeDetails]);

  // Fit map to show all points (only once when route is ready)
  useEffect(() => {
    if (!mapRef.current) return;
    
    // Only fit once when we have a valid route
    if (hasFittedMapRef.current) return;

    // Wait until we have route points or at least pickup + drop
    if (routePoints.length === 0 && !(pickupLatLng && dropLatLng)) return;

    const fit: Array<{ latitude: number; longitude: number }> = [];

    if (routePoints.length >= 2) {
      fit.push(...routePoints);
    } else if (pickupLatLng && dropLatLng) {
      // Show pickup and drop if no route yet
      fit.push({ latitude: pickupLatLng.lat, longitude: pickupLatLng.lng });
      fit.push({ latitude: dropLatLng.lat, longitude: dropLatLng.lng });
    }

    if (fit.length < 2) return;

    const timeout = setTimeout(() => {
      mapRef.current?.fitToCoordinates(fit, {
        edgePadding: MAP_EDGE_PADDING,
        animated: false, // No animation to prevent jarring re-fits
      });
      hasFittedMapRef.current = true;
    }, 500);

    return () => clearTimeout(timeout);
  }, [routeDetails, routePoints.length, pickupLatLng?.lat, pickupLatLng?.lng, dropLatLng?.lat, dropLatLng?.lng]);

  // Calculate initial region
  const initialCenter = driverLatLng || pickupLatLng || dropLatLng || DEFAULT_CENTER;

  // Check if we have any valid coordinates to show
  const hasValidCoords = driverLatLng || pickupLatLng || dropLatLng;

  if (!hasValidCoords) {
    return (
      <View style={[styles.container, styles.noMapContainer]}>
        <Text style={[styles.noMapText, { color: colors.muted }]}>
          Waiting for location...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, fullScreen && styles.fullScreenContainer]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        mapType="standard"
        loadingEnabled
        initialRegion={{
          latitude: initialCenter.lat,
          longitude: initialCenter.lng,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={true}
      >
        {/* Driver Marker */}
        {driverLatLng && (
          <Marker
            key="driver-marker"
            identifier="driver-marker"
            coordinate={{
              latitude: driverLatLng.lat,
              longitude: driverLatLng.lng,
            }}
            title="Your Location"
            pinColor="#2196F3"
          />
        )}

        {/* Pickup Marker - show before pickup */}
        {pickupLatLng && !isAfterPickup && (
          <Marker
            key="pickup-marker"
            identifier="pickup-marker"
            coordinate={{
              latitude: pickupLatLng.lat,
              longitude: pickupLatLng.lng,
            }}
            title="Pickup"
            description={pickupAddress}
            pinColor="#4CAF50"
          />
        )}

        {/* Drop Marker - always show */}
        {dropLatLng && (
          <Marker
            key="drop-marker"
            identifier="drop-marker"
            coordinate={{
              latitude: dropLatLng.lat,
              longitude: dropLatLng.lng,
            }}
            title="Drop-off"
            description={dropAddress}
            pinColor="#F44336"
          />
        )}

        {/* Route Polyline */}
        {routePoints.length > 1 && (
          <Polyline
            key="route-polyline"
            coordinates={routePoints}
            strokeColor="#2196F3"
            strokeWidth={4}
            zIndex={1}
          />
        )}
      </MapView>

      {fullScreen && Boolean(routeDetails?.steps.length) && (
        <View style={{position:"absolute",bottom:100,left:12,right:12,maxHeight:180,backgroundColor:colors.card,borderRadius:12,padding:12}}>
          <Text style={{color:colors.text,fontWeight:"700",marginBottom:6}}>Directions</Text>
          <ScrollView>
            {routeDetails!.steps.map((step,index)=><Text key={index} style={{color:colors.text,paddingVertical:6}}>
              {index+1}. {step.instruction} ({step.distanceMeters >= 1000 ? (step.distanceMeters/1000).toFixed(1)+" km" : step.distanceMeters+" m"})
            </Text>)}
          </ScrollView>
        </View>
      )}
      {/* ETA Overlay */}
      {(estimatedTime || estimatedDistance) && (
        <View style={[styles.etaContainer, { backgroundColor: colors.card }]}>
          {estimatedTime && (
            <View style={styles.etaBadge}>
              <Text style={styles.etaIcon}>⏱</Text>
              <Text style={[styles.etaText, { color: colors.text }]}>{estimatedTime}</Text>
            </View>
          )}
          {estimatedDistance && (
            <View style={styles.etaBadge}>
              <Text style={styles.etaIcon}>📍</Text>
              <Text style={[styles.etaText, { color: colors.text }]}>{estimatedDistance}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 250,
    overflow: "hidden",
    marginBottom: 16,
  },
  fullScreenContainer: {
    ...StyleSheet.absoluteFillObject,
    height: "100%",
    marginBottom: 0,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  noMapContainer: {
    height: 150,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  noMapText: {
    fontSize: 14,
  },
  driverMarker: {
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
  },
  driverMarkerIcon: {
    fontSize: 32,
  },
  markerContainer: {
    alignItems: "center",
  },
  markerCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  markerText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  markerPin: {
    width: 4,
    height: 12,
    marginTop: -2,
  },
  etaContainer: {
    position: "absolute",
    top: 12,
    left: 12,
    borderRadius: 8,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  etaBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
  },
  etaIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  etaText: {
    fontSize: 13,
    fontWeight: "500",
  },
});
