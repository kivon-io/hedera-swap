"use client";

import { useHederaWallet } from "@/context/HederaWalletContext";

export default function ConnectHederaWallet() {
  const { connected, accountId, connectWallet, disconnectWallet } =
    useHederaWallet();
 
  return (
    <div className="p-4 bg-gray-800 rounded-2xl shadow-lg text-center">
      <h2 className="text-lg font-semibold mb-2 text-emerald-400">
        Hedera Wallet (HashPack / Blade)
      </h2>
      {connected ? (
        <>
          <p className="text-sm text-green-400">Connected: {accountId}</p>
          <button
            onClick={disconnectWallet}
            className="mt-3 bg-red-500 hover:bg-red-600 px-4 py-2 rounded-md text-sm"
          >
            Disconnect
          </button>
        </>
      ) : (
        <button
          onClick={connectWallet}
          className="bg-emerald-500 hover:bg-emerald-600 px-4 py-2 rounded-md text-sm"
        >
          Connect Hedera Wallet
        </button>
      )}
    </div>
  );
}
