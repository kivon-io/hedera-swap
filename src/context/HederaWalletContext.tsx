"use client";

import { createContext, useContext } from "react";
import { useHederaWalletConnect } from "@/hooks/useHederaWalletConnect";

const HederaWalletContext = createContext<any>(null);

export const HederaWalletProvider = ({ children }: { children: React.ReactNode }) => {
  const wallet = useHederaWalletConnect();
  return (
    <HederaWalletContext.Provider value={wallet}>
      {children}
    </HederaWalletContext.Provider>
  );
};

export const useHederaWallet = () => useContext(HederaWalletContext);
