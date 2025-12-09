import { useContext } from 'react';

import { LocationContext } from '../context/LocationContext';

export const useLocationService = () => {
    const ctx = useContext(LocationContext);
    if (!ctx) {
        throw new Error('useLocationService must be used within a LocationProvider');
    }

    return ctx;
};
