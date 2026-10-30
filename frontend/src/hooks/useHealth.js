import { useState, useCallback } from 'react';
import api from '../services/api.js';

export function useHealth() {
  const [status, setStatus] = useState(null);

  const fetchHealth = useCallback(async () => {
    try {
      const { data } = await api.get('/health');
      setStatus(data);
      return data;
    } catch {
      setStatus(null);
      return null;
    }
  }, []);

  return { status, fetchHealth };
}
