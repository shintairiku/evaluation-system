import { useEffect, useState } from 'react';

/**
 * Hook para gerenciar hidração SSR/CSR
 * Centraliza a lógica de montagem para evitar duplicação
 */
export function useHydration() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return isMounted;
}