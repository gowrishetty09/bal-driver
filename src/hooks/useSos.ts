import { useContext } from 'react';

import { SosContext, SosContextValue } from '../context/SosContext';

export const useSos = (): SosContextValue => {
    const context = useContext(SosContext);
    if (!context) {
        throw new Error('useSos must be used within a SosProvider');
    }
    return context;
};
