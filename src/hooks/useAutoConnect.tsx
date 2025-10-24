'use client'

import { useEffect, useCallback } from 'react';
import { useAccount, useConfig, useConnect, useDisconnect } from 'wagmi';

// Use a unique key for the last used connector ID in localStorage
const LAST_CONNECTOR_ID_KEY = 'wagmi.lastConnectedConnectorId'; 

/**
 * Custom hook to manage auto-reconnection using simple localStorage 
 * to track explicit disconnects.
 */
export function useAutoConnect() {
  const config = useConfig();
  const { isConnected, connector: activeConnector } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  // --- Storage Handlers (Using window.localStorage directly) ---

  // Function to save the connector ID
  const saveConnectorId = useCallback((connectorId: string | undefined) => {
    if (connectorId && typeof window !== 'undefined') {
      window.localStorage.setItem(LAST_CONNECTOR_ID_KEY, connectorId);
    }
  }, []);

  // Function to clear the connector ID (when user manually disconnects)
  const clearConnectorId = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(LAST_CONNECTOR_ID_KEY);
    }
  }, []);

  // --- Core Auto-Connect Logic (onMount) ---

  useEffect(() => {
    // 1. Skip if already connected or if `connect` hasn't loaded yet
    if (isConnected) return;
    if (!connect) return; 
    // Ensure we're in the browser before accessing window.localStorage
    if (typeof window === 'undefined') return;
    // 2. Check simple localStorage key for a previously saved connector ID
    const lastUsedConnectorId = window.localStorage.getItem(LAST_CONNECTOR_ID_KEY);

    if (lastUsedConnectorId) {
      // 3. Find the actual connector object from Wagmi's config
      const lastUsedConnector = config.connectors.find(
        (connector) => connector.name == lastUsedConnectorId
      );

      if (lastUsedConnector) {
        // Use the `connect` mutation for a specific connector
        connect({ connector: lastUsedConnector });
      } else {
         // If we can't find the connector (e.g., app config changed), clear the saved ID
         clearConnectorId();
      }
    }
  // Run on mount and if isConnected state changes (e.g., after a refresh where it's false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  // --- State Tracking Logic (onConnect/onDisconnect) ---
  
  // Track successful connections to save the connector ID
  useEffect(() => {
    if (isConnected && activeConnector) {
      saveConnectorId(activeConnector.name);
    }
  }, [isConnected, activeConnector, saveConnectorId]);


  const guardedDisconnect = useCallback(() => {
    clearConnectorId();
    disconnect();
  }, [disconnect, clearConnectorId]);

  return { 
    guardedDisconnect,
    isConnected,
    activeConnector,
  };
}