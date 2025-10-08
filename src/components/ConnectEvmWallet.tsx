"use client";

import { useEvmWallet } from "@/hooks/useEvmWallet";

export default function ConnectEvmWallet() {
  const { address, isConnected, connect, disconnectWallet } = useEvmWallet();

  return (
    <div className="p-4 bg-gray-800 rounded-2xl shadow-lg text-center">
      <h2 className="text-lg font-semibold mb-2 text-indigo-400">
        EVM Wallet (RainbowKit)
      </h2>
      {isConnected ? (
        <>
          <p className="text-sm text-green-400">Connected: {address}</p>
          <button
            onClick={disconnectWallet}
            className="mt-3 bg-red-500 hover:bg-red-600 px-4 py-2 rounded-md text-sm"
          >
            Disconnect
          </button>
        </>
      ) : (
        <button
          onClick={connect}
          className="bg-indigo-500 hover:bg-indigo-600 px-4 py-2 rounded-md text-sm"
        >
          Connect EVM Wallet
        </button>
      )}
    </div>
  );
}
