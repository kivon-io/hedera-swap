"use client";

import { useEffect, useState, } from "react";
import { HWCConnector } from "@buidlerlabs/hashgraph-react-wallets/connectors";
import { useWallet, useAccountId } from '@buidlerlabs/hashgraph-react-wallets'
 


export default function ConnectHederaWallet() {
  const { isConnected, connect, disconnect } = useWallet(HWCConnector);
  const { data: accountId } = useAccountId({ autoFetch: isConnected }) 
  const [mounted, setMounted] = useState(false);


  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null; // Avoid rendering during SSR

  return (
   
        <div className="p-4 bg-gray-800 rounded-2xl shadow-lg text-center">
          <h2 className="text-lg font-semibold mb-2 text-indigo-400">
            Hedera Wallet (HashPack)
          </h2>
          {!isConnected ? (
            <button
              onClick={() => connect()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg"
            >
              Connect Hedera Wallet
            </button>
          ) : (
            <>
              <p>Connected: {accountId ?? '-'}</p>
              <br />
              <button
                onClick={() => disconnect()}
                className="px-4 py-2 bg-red-500 text-white rounded-lg"
              >
                Disconnect
              </button>
            </>
          )}
        </div>
  );
}
