"use client";

import ConnectEvmWallet from "@/components/ConnectEvmWallet"; 
import ConnectHederaWallet from "@/components/ConnectHederaWallet";
import BridgeForm from "@/components/BridgeForm";

export default function Page() {
  return (
      <main className="flex flex-col items-center justify-center p-8 space-y-8">
        {/* <h1 className="text-3xl font-semibold text-white">
          🌉 MultiChain Bridge
        </h1> */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
          <ConnectEvmWallet />
          <ConnectHederaWallet />
        </div>
        {/* <WalletStatus /> */}
        <BridgeForm />
      </main>
  );
}
