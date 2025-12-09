import React, { createContext, useCallback, useMemo, useState } from 'react';

import { SosModal } from '../components/SosModal';

export type SosContextValue = {
  openSos: () => void;
};

export const SosContext = createContext<SosContextValue | null>(null);

export const SosProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [visible, setVisible] = useState(false);

  const openSos = useCallback(() => setVisible(true), []);
  const closeSos = useCallback(() => setVisible(false), []);

  const value = useMemo(() => ({ openSos }), [openSos]);

  return (
    <SosContext.Provider value={value}>
      {children}
      <SosModal visible={visible} onRequestClose={closeSos} />
    </SosContext.Provider>
  );
};
