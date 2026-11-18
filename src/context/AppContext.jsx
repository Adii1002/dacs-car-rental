import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../api';
import { DEFAULT_SETTINGS } from '../../shared/pricing';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  useEffect(() => {
    api('/settings').then(setSettings).catch(() => {});
  }, []);

  useEffect(() => {
    if (settings?.businessName) document.title = `${settings.businessName} | Self-Drive Cars in ${settings.city || 'Pune'}`;
  }, [settings]);

  const toast = useCallback((message, type = 'success') => {
    const id = ++idRef.current;
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  return (
    <AppContext.Provider value={{ settings, setSettings, toast }}>
      {children}
      <div className="toast-stack" role="status">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>{t.message}</div>
        ))}
      </div>
    </AppContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  return useContext(AppContext);
}
