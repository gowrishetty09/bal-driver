import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  Platform,
  Linking,
  Pressable,
} from "react-native";
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  Region,
} from "react-native-maps";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";
import type { Coordinates, JobStatus } from "../api/driver";
import { GOOGLE_DIRECTIONS_API_KEY } from "../utils/config";

const { width, height } = Dimensions.get("window");
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.02;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

interface RideMapViewProps {
  driverLocation: { latitude: number; longitude: number } | null;
  pickupCoords: Coordinates | null | undefined;
  dropCoords: Coordinates | null | undefined;
  status: JobStatus;
  pickupAddress?: string;
  dropAddress?: string;
  onNavigatePress?: () => void;
  fullScreen?: boolean;
  showDirections?: boolean;
  estimatedTime?: string;
  estimatedDistance?: string;
}

// Light map style for better visibility
const lightMapStyle = [
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "transit",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
];

const decodePolyline = (encoded: string) => {
  // Returns [{ latitude, longitude }, ...]
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates: Array<{ latitude: number; longitude: number }> = [];

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    result = 0;
    shift = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return coordinates;
};

export const RideMapView: React.FC<RideMapViewProps> = ({
  driverLocation,
  pickupCoords,
  dropCoords,
  status,
  pickupAddress,
  dropAddress,
  onNavigatePress,
  fullScreen = false,
  showDirections = false,
  estimatedTime,
  estimatedDistance,
}) => {
  const readLatLng = (c?: any) => {
    if (!c)
      return {
        lat: undefined as number | undefined,
        lng: undefined as number | undefined,
      };
    const tryNum = (v: any) => {
      if (typeof v === "number") return v;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    const lat = tryNum(
      c.lat ?? c.latitude ?? c.latValue ?? c.latitudeValue ?? c.latitudeValue
    );
    const lng = tryNum(
      c.lng ?? c.longitude ?? c.lngValue ?? c.longitudeValue ?? c.longitudeValue
    );
    return { lat, lng };
  };
  const mapRef = useRef<MapView>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<
    Array<{ latitude: number; longitude: number }>
  >([]);

  // Determine which location to navigate to based on status
  const destination = useMemo(() => {
    // Before pickup: navigate to pickup
    // After pickup: navigate to drop
    if (status === "PICKED_UP" && dropCoords) {
      return { coords: dropCoords, label: "Drop-off" };
    }
    if (pickupCoords) {
      return { coords: pickupCoords, label: "Pickup" };
    }
    return null;
  }, [status, pickupCoords, dropCoords]);

  // Fetch directions from Google Directions API
  const fetchDirections = useCallback(async () => {
    try {
      if (!driverLocation || !destination?.coords) {
        setRouteCoordinates([]);
        return;
      }

      const { lat: dLat, lng: dLng } = readLatLng(destination.coords as any);
      if (typeof dLat !== "number" || typeof dLng !== "number") {
        console.warn(
          "[Map] Destination coords invalid for directions:",
          destination.coords
        );
        setRouteCoordinates([]);
        return;
      }

      // If no key configured, fallback to straight line.
      if (!GOOGLE_DIRECTIONS_API_KEY) {
        setRouteCoordinates([
          driverLocation,
          { latitude: dLat, longitude: dLng },
        ]);
        return;
      }

      const params = new URLSearchParams({
        origin: `${driverLocation.latitude},${driverLocation.longitude}`,
        destination: `${dLat},${dLng}`,
        mode: "driving",
        key: GOOGLE_DIRECTIONS_API_KEY,
      });

      const url = `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data?.status !== "OK" || !data?.routes?.length) {
        console.warn(
          "[Map] Directions API error:",
          data?.status,
          data?.error_message
        );
        setRouteCoordinates([
          driverLocation,
          { latitude: dLat, longitude: dLng },
        ]);
        return;
      }

      const points: string | undefined =
        data.routes?.[0]?.overview_polyline?.points;
      if (!points) {
        setRouteCoordinates([
          driverLocation,
          { latitude: dLat, longitude: dLng },
        ]);
        return;
      }

      const decoded = decodePolyline(points);
      if (decoded.length < 2) {
        setRouteCoordinates([
          driverLocation,
          { latitude: dLat, longitude: dLng },
        ]);
        return;
      }

      setRouteCoordinates(decoded);
    } catch (error) {
      console.warn("[Map] Error in fetchDirections:", error);
      setRouteCoordinates([]);
    }
  }, [driverLocation, destination]);

  // Fetch directions when relevant data changes
  useEffect(() => {
    try {
      if (showDirections) {
        fetchDirections();
      }
    } catch (error) {
      console.warn("[Map] Error fetching directions:", error);
    }
  }, [showDirections, fetchDirections]);

  // Debug: log coords when map has no valid markers (help diagnose missing data)
  useEffect(() => {
    const hasDriver = !!driverLocation;
    const hasPickup = !!pickupCoords;
    const hasDrop = !!dropCoords;
    if (!hasDriver && !hasPickup && !hasDrop) {
      console.warn("[RideMapView] No coordinates provided:", {
        driverLocation,
        pickupCoords,
        dropCoords,
        status,
      });
    }
  }, [driverLocation, pickupCoords, dropCoords, status]);

  // Calculate route points for the polyline (fallback if directions not fetched)
  const routePoints = useMemo(() => {
    if (routeCoordinates.length > 0) {
      return routeCoordinates;
    }

    const points: Array<{ latitude: number; longitude: number }> = [];

    if (driverLocation) {
      points.push(driverLocation);
    }

    if (destination?.coords) {
      const { lat: dLat, lng: dLng } = readLatLng(destination.coords as any);
      if (typeof dLat === "number" && typeof dLng === "number") {
        points.push({ latitude: dLat, longitude: dLng });
      } else {
        console.warn(
          "[Map] routePoints: destination coords invalid",
          destination.coords
        );
      }
    }

    return points;
  }, [driverLocation, destination, routeCoordinates]);

  // Fit map to show all markers
  useEffect(() => {
    if (!mapRef.current) return;

    const markers: Array<{ latitude: number; longitude: number }> = [];

    if (driverLocation) {
      markers.push(driverLocation);
    }
    if (pickupCoords) {
      const { lat: pLat, lng: pLng } = readLatLng(pickupCoords as any);
      if (typeof pLat === "number" && typeof pLng === "number") {
        markers.push({ latitude: pLat, longitude: pLng });
      } else {
        console.warn("[Map] fitBounds: pickupCoords invalid", pickupCoords);
      }
    }
    if (dropCoords) {
      const { lat: dLat, lng: dLng } = readLatLng(dropCoords as any);
      if (typeof dLat === "number" && typeof dLng === "number") {
        markers.push({ latitude: dLat, longitude: dLng });
      } else {
        console.warn("[Map] fitBounds: dropCoords invalid", dropCoords);
      }
    }

    if (markers.length > 1) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(markers, {
          edgePadding: { top: 80, right: 50, bottom: 80, left: 50 },
          animated: true,
        });
      }, 500);
    } else if (markers.length === 1) {
      mapRef.current?.animateToRegion({
        latitude: markers[0].latitude,
        longitude: markers[0].longitude,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
      });
    }
  }, [driverLocation, pickupCoords, dropCoords]);

  const handleNavigate = useCallback(() => {
    if (!destination?.coords) return;

    const { lat, lng } = destination.coords;
    const label = encodeURIComponent(destination.label);

    // Open in Google Maps for navigation
    const url = Platform.select({
      ios: `maps://app?daddr=${lat},${lng}&dirflg=d`,
      android: `google.navigation:q=${lat},${lng}`,
    });

    if (url) {
      Linking.canOpenURL(url).then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          // Fallback to web Google Maps
          Linking.openURL(
            `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
          );
        }
      });
    }

    onNavigatePress?.();
  }, [destination, onNavigatePress]);

  // Get initial region
  const initialRegion: Region = useMemo(() => {
    if (driverLocation) {
      return {
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
      };
    }
    if (pickupCoords) {
      const { lat: pLat, lng: pLng } = readLatLng(pickupCoords as any);
      if (typeof pLat === "number" && typeof pLng === "number") {
        return {
          latitude: pLat,
          longitude: pLng,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        };
      }
      console.warn("[Map] initialRegion: pickupCoords invalid", pickupCoords);
    }
    // Default to a generic location if nothing available
    return {
      latitude: 12.9716,
      longitude: 77.5946,
      latitudeDelta: LATITUDE_DELTA,
      longitudeDelta: LONGITUDE_DELTA,
    };
  }, [driverLocation, pickupCoords]);

  const hasValidCoords = driverLocation || pickupCoords || dropCoords;

  if (!hasValidCoords) {
    return (
      <View style={styles.noMapContainer}>
        <Text style={styles.noMapText}>Location coordinates not available</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, fullScreen && styles.fullScreenContainer]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={true}
        rotateEnabled={true}
        zoomEnabled={true}
        pitchEnabled={true}
        onMapReady={() => console.log("[Map] Map is ready")}
        onMapLoaded={() => console.log("[Map] Map tiles loaded")}
      >
        {/* Driver location marker - styled as a car */}
        {driverLocation && (
          <Marker
            coordinate={driverLocation}
            title="Your Location"
            anchor={{ x: 0.5, y: 0.5 }}
            flat={true}
          >
            <View style={styles.driverMarkerContainer}>
              <View style={styles.driverMarker}>
                <Text style={styles.driverMarkerIcon}>🚗</Text>
              </View>
            </View>
          </Marker>
        )}

        {/* Pickup marker */}
        {pickupCoords &&
          status !== "PICKED_UP" &&
          (() => {
            const { lat: pLat, lng: pLng } = readLatLng(pickupCoords as any);
            if (typeof pLat !== "number" || typeof pLng !== "number")
              return null;
            return (
              <Marker
                coordinate={{
                  latitude: pLat,
                  longitude: pLng,
                }}
                title="Pickup"
                description={pickupAddress}
              >
                <View style={styles.pickupMarkerContainer}>
                  <View style={styles.pickupMarker}>
                    <Text style={styles.markerLabel}>P</Text>
                  </View>
                  <View style={styles.markerPin} />
                </View>
              </Marker>
            );
          })()}

        {/* Drop marker */}
        {dropCoords &&
          (() => {
            const { lat: dLat, lng: dLng } = readLatLng(dropCoords as any);
            if (typeof dLat !== "number" || typeof dLng !== "number")
              return null;
            return (
              <Marker
                coordinate={{
                  latitude: dLat,
                  longitude: dLng,
                }}
                title="Drop-off"
                description={dropAddress}
              >
                <View style={styles.dropMarkerContainer}>
                  <View style={styles.dropMarkerStyle}>
                    <Text style={styles.markerLabel}>D</Text>
                  </View>
                  <View style={[styles.markerPin, styles.dropPin]} />
                </View>
              </Marker>
            );
          })()}

        {/* Route polyline */}
        {routePoints.length >= 2 && (
          <Polyline
            coordinates={routePoints}
            strokeColor={colors.primary}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        )}
      </MapView>

      {/* ETA and Distance badge - top left */}
      {(estimatedTime || estimatedDistance) && (
        <View style={styles.etaContainer}>
          {estimatedTime && (
            <View style={styles.etaBadge}>
              <Text style={styles.etaIcon}>⏱</Text>
              <Text style={styles.etaText}>{estimatedTime}</Text>
            </View>
          )}
          {estimatedDistance && (
            <View style={styles.etaBadge}>
              <Text style={styles.etaIcon}>📍</Text>
              <Text style={styles.etaText}>{estimatedDistance}</Text>
            </View>
          )}
        </View>
      )}

      {/* Status indicator - top center */}
      <View style={styles.statusOverlay}>
        <Text style={styles.statusText}>
          {status === "EN_ROUTE" && "🚗 Heading to pickup"}
          {status === "ARRIVED" && "📍 Waiting at pickup"}
          {status === "PICKED_UP" && "🛣️ En route to drop-off"}
        </Text>
      </View>

      {/* Navigate button - only show in non-fullscreen mode */}
      {destination && !fullScreen && (
        <View style={styles.navigationOverlay}>
          <Pressable style={styles.navigateButton} onPress={handleNavigate}>
            <Text style={styles.navigateButtonText}>
              🧭 Navigate to {destination.label}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 250,
    borderRadius: 0,
    overflow: "hidden",
    marginBottom: 16,
  },
  fullScreenContainer: {
    ...StyleSheet.absoluteFillObject,
    height: "100%",
    borderRadius: 0,
    marginBottom: 0,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  noMapContainer: {
    height: 150,
    borderRadius: 16,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  noMapText: {
    color: colors.muted,
    fontSize: typography.body,
  },
  driverMarkerContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  driverMarker: {
    elevation: 5,
  },
  driverMarkerIcon: {
    fontSize: 24,
  },
  pickupMarkerContainer: {
    alignItems: "center",
  },
  pickupMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
  },
  dropMarkerContainer: {
    alignItems: "center",
  },
  dropMarkerStyle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
  },
  markerLabel: {
    color: "#000000ff",
    fontSize: 14,
    fontWeight: "bold",
  },
  markerPin: {
    width: 3,
    height: 10,
    backgroundColor: colors.primary,
    marginTop: -2,
  },
  dropPin: {
    backgroundColor: colors.accent,
  },
  markerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: "#fff",
  },
  dropDot: {
    backgroundColor: colors.accent,
  },
  etaContainer: {
    position: "absolute",
    top: 50,
    left: 12,
    flexDirection: "column",
    gap: 8,
  },
  etaBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  etaIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  etaText: {
    fontSize: typography.caption,
    color: colors.text,
    fontFamily: typography.fontFamilyMedium,
  },
  navigationOverlay: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
  },
  navigateButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  navigateButtonText: {
    color: "#fff",
    fontSize: typography.body,
    fontFamily: typography.fontFamilyMedium,
  },
  statusOverlay: {
    position: "absolute",
    top: 12,
    left: 60,
    right: 60,
  },
  statusText: {
    backgroundColor: "rgba(0,0,0,0.75)",
    color: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    fontSize: typography.caption,
    textAlign: "center",
    overflow: "hidden",
  },
});
