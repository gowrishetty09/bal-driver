import { GOOGLE_PLACES_API_KEY } from '../utils/config';

export type PlacePrediction = {
    description: string;
    placeId: string;
};

export type PlaceDetails = {
    description: string;
    latitude: number;
    longitude: number;
    placeId: string;
};

const AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

const ensureApiKey = () => {
    if (!GOOGLE_PLACES_API_KEY) {
        throw new Error('Google Places API key is missing. Set googlePlacesApiKey in app config.');
    }
    return GOOGLE_PLACES_API_KEY;
};

export const fetchPlacePredictions = async (query: string): Promise<PlacePrediction[]> => {
    if (!query.trim()) {
        return [];
    }
    const key = ensureApiKey();
    const params = new URLSearchParams({
        input: query,
        key,
    });

    const response = await fetch(`${AUTOCOMPLETE_URL}?${params.toString()}`);
    const data = await response.json();
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.log('Places autocomplete error', data);
        throw new Error(data.error_message ?? 'Unable to fetch places');
    }
    return (data.predictions ?? []).map((prediction: any) => ({
        description: prediction.description,
        placeId: prediction.place_id,
    }));
};

export const fetchPlaceDetails = async (placeId: string): Promise<PlaceDetails> => {
    const key = ensureApiKey();
    const params = new URLSearchParams({
        place_id: placeId,
        key,
        fields: 'formatted_address,geometry/location'
    });
    const response = await fetch(`${DETAILS_URL}?${params.toString()}`);
    const data = await response.json();
    if (data.status !== 'OK') {
        console.log('Places details error', data);
        throw new Error(data.error_message ?? 'Unable to fetch place details');
    }

    const result = data.result;
    return {
        description: result.formatted_address,
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        placeId,
    };
};
