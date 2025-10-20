// "use client";

// import { useEvmWallet } from "@/hooks/useEvmWallet";
// import { useHederaWallet } from "@/context/HederaWalletContext";

// export default function WalletStatus() {
//   const { isConnected: evmConnected } = useEvmWallet();
//   const { connected: hederaConnected } = useHederaWallet();

//   return (
//     <div className="p-4 bg-gray-900 rounded-xl shadow-lg text-center max-w-md w-full">
//       <p>
//         EVM Wallet:{" "}
//         <span className={evmConnected ? "text-green-400" : "text-red-400"}>
//           {evmConnected ? "Connected" : "Not Connected"}
//         </span>
//       </p>
//       <p>
//         Hedera Wallet:{" "}
//         <span className={hederaConnected ? "text-green-400" : "text-red-400"}>
//           {hederaConnected ? "Connected" : "Not Connected"}
//         </span>
//       </p>
//     </div>
//   );
// }
