import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, Text, Dimensions, Platform, Linking, Pressable } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import type { Coordinates, JobStatus } from '../api/driver';

const { width, height } = Dimensions.get('window');
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
}

// Light map style for better visibility
const lightMapStyle = [
    {
        featureType: 'poi',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }],
    },
    {
        featureType: 'transit',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }],
    },
];

export const RideMapView: React.FC<RideMapViewProps> = ({
    driverLocation,
    pickupCoords,
    dropCoords,
    status,
    pickupAddress,
    dropAddress,
    onNavigatePress,
    fullScreen = false,
}) => {
    const mapRef = useRef<MapView>(null);

    // Determine which location to navigate to based on status
    const destination = useMemo(() => {
        // Before pickup: navigate to pickup
        // After pickup: navigate to drop
        if (status === 'PICKED_UP' && dropCoords) {
            return { coords: dropCoords, label: 'Drop-off' };
        }
        if (pickupCoords) {
            return { coords: pickupCoords, label: 'Pickup' };
        }
        return null;
    }, [status, pickupCoords, dropCoords]);

    // Calculate route points for the polyline
    const routePoints = useMemo(() => {
        const points: Array<{ latitude: number; longitude: number }> = [];

        if (driverLocation) {
            points.push(driverLocation);
        }

        if (destination?.coords) {
            points.push({
                latitude: destination.coords.lat,
                longitude: destination.coords.lng,
            });
        }

        // If we're past pickup, add drop location
        if (status === 'PICKED_UP' && dropCoords && driverLocation) {
            // Route is: driver -> drop
        } else if (pickupCoords && dropCoords) {
            // Show full route: driver -> pickup -> drop
            if (driverLocation && status !== 'ARRIVED') {
                // Already added driver location above
            }
        }

        return points;
    }, [driverLocation, destination, pickupCoords, dropCoords, status]);

    // Fit map to show all markers
    useEffect(() => {
        if (!mapRef.current) return;

        const markers: Array<{ latitude: number; longitude: number }> = [];

        if (driverLocation) {
            markers.push(driverLocation);
        }
        if (pickupCoords) {
            markers.push({ latitude: pickupCoords.lat, longitude: pickupCoords.lng });
        }
        if (dropCoords) {
            markers.push({ latitude: dropCoords.lat, longitude: dropCoords.lng });
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
                    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
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
            return {
                latitude: pickupCoords.lat,
                longitude: pickupCoords.lng,
                latitudeDelta: LATITUDE_DELTA,
                longitudeDelta: LONGITUDE_DELTA,
            };
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
                onMapReady={() => console.log('[Map] Map is ready')}
                onMapLoaded={() => console.log('[Map] Map tiles loaded')}
            >
                {/* Driver location marker - styled as a car */}
                {driverLocation && (
                    <Marker
                        coordinate={driverLocation}
                        title="Your Location"
                        anchor={{ x: 0.5, y: 0.5 }}
                    >
                        <View style={styles.driverMarker}>
                            <Text style={styles.driverMarkerIcon}>🚗</Text>
                        </View>
                    </Marker>
                )}

                {/* Pickup marker */}
                {pickupCoords && status !== 'PICKED_UP' && (
                    <Marker
                        coordinate={{
                            latitude: pickupCoords.lat,
                            longitude: pickupCoords.lng,
                        }}
                        title="Pickup"
                        description={pickupAddress}
                    >
                        <View style={styles.pickupMarker}>
                            <View style={styles.markerDot} />
                        </View>
                    </Marker>
                )}

                {/* Drop marker */}
                {dropCoords && (
                    <Marker
                        coordinate={{
                            latitude: dropCoords.lat,
                            longitude: dropCoords.lng,
                        }}
                        title="Drop-off"
                        description={dropAddress}
                    >
                        <View style={styles.dropMarker}>
                            <View style={[styles.markerDot, styles.dropDot]} />
                        </View>
                    </Marker>
                )}

                {/* Route polyline */}
                {routePoints.length >= 2 && (
                    <Polyline
                        coordinates={routePoints}
                        strokeColor={colors.primary}
                        strokeWidth={4}
                        lineDashPattern={[1]}
                    />
                )}
            </MapView>

            {/* Navigate button - only show in non-fullscreen mode */}
            {destination && !fullScreen && (
                <View style={styles.navigationOverlay}>
                    <Pressable style={styles.navigateButton} onPress={handleNavigate}>
                        <Text style={styles.navigateButtonText}>
                            Navigate to {destination.label}
                        </Text>
                    </Pressable>
                </View>
            )}

            {/* Status indicator - only show in non-fullscreen mode */}
            {!fullScreen && (
                <View style={styles.statusOverlay}>
                    <Text style={styles.statusText}>
                        {status === 'EN_ROUTE' && 'Heading to pickup'}
                        {status === 'ARRIVED' && 'Waiting at pickup'}
                        {status === 'PICKED_UP' && 'En route to drop-off'}
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        height: 250,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 16,
    },
    fullScreenContainer: {
        ...StyleSheet.absoluteFillObject,
        height: '100%',
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
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    noMapText: {
        color: colors.muted,
        fontSize: typography.body,
    },
    driverMarker: {
        backgroundColor: colors.primary,
        padding: 8,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#fff',
    },
    driverMarkerIcon: {
        fontSize: 20,
    },
    pickupMarker: {
        padding: 8,
    },
    dropMarker: {
        padding: 8,
    },
    markerDot: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: colors.primary,
        borderWidth: 3,
        borderColor: '#fff',
    },
    dropDot: {
        backgroundColor: colors.accent,
    },
    navigationOverlay: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        right: 12,
    },
    navigateButton: {
        backgroundColor: colors.primary,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        alignItems: 'center',
    },
    navigateButtonText: {
        color: '#fff',
        fontSize: typography.body,
        fontFamily: typography.fontFamilyMedium,
    },
    statusOverlay: {
        position: 'absolute',
        top: 12,
        left: 12,
        right: 12,
    },
    statusText: {
        backgroundColor: 'rgba(0,0,0,0.7)',
        color: '#fff',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        fontSize: typography.caption,
        textAlign: 'center',
        overflow: 'hidden',
    },
});
