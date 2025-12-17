"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AccountId, ContractId } from "@hashgraph/sdk"
import {
  useWallet, 
  useAccountId, 
  useWriteContract as UseHederaWriteContract,
} from "@buidlerlabs/hashgraph-react-wallets";
import { useAccount, useChainId, useWriteContract } from "wagmi"

import BRIDGE_ABI from "@/Abi/bridge.json"
import HEDERA_BRIDGE_ABI from "@/Abi/hedera_abi.json"
import { CHAIN_IDS, CONTRACT_ADDRESSES, NetworkOption, getChainNameById } from "@/config/networks"
import { type Address } from "viem"
import { API_URL } from "@/config/bridge"



export default function AdminPage() {

  const [poolAddressEvm, setPoolAddressEvm] = useState("");
  const [adminAddressEvm, setAdminAddressEvm] = useState("");

  const [poolAddressHedera, setPoolAddressHedera] = useState("");
  const [adminAddressHedera, setAdminAddressHedera] = useState("");

  const [pk, setPK] = useState(""); 

  const [fees, setFees] = useState({ fee_pct: 0, lp_fee_pct: 0 });
  const [profit, setProfit] = useState(0);

  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  const { signer, isConnected: isHederaConnected } = useWallet();
  const { data: accountId }  = useAccountId();

  const isHederaWalletReady = isHederaConnected && signer && accountId;

  const { writeContract: evmWriteContract, writeContractAsync: evmWriteContractAsync } = useWriteContract()
  const { writeContract: hederaWriteContract } = UseHederaWriteContract()

  const evmchainId = useChainId()
  const evmChainName = getChainNameById(evmchainId); 
  const evmBridgeContractAddress = evmChainName ? CONTRACT_ADDRESSES[evmChainName] : '';  
  const hederaBridgeContractAddress =  CONTRACT_ADDRESSES['hedera'];  

  


  // ✅ Fetch fees
  async function fetchFees() {
    try {
      const res = await fetch("/api/fee");
      const data = await res.json();
      setFees({
        fee_pct: data.data.fee_pct ?? 0,
        lp_fee_pct: data.data.lp_fee_pct ?? 0,
      });
      setProfit(data.data.total_fee ?? 0);
    } catch (err) {
      console.error("Error fetching fees:", err);
    }
  }



  useEffect(() => {
    fetchFees();
  }, []);


  const handleAddPoolAddressEvm = ()=>{
      if(!evmBridgeContractAddress || !poolAddressEvm) return;
      evmWriteContract(
      {
        address: evmBridgeContractAddress as Address,
        abi: BRIDGE_ABI,
        functionName: "setPoolAddress",
        args: [poolAddressEvm]
      },
      {
        onSuccess: (hash) => {
        
        },
        onError: (e: unknown) => {
          console.log(e)
        },
      }
    )
  }


  const handleAddAdminAddressEvm = ()=>{
      if(!evmBridgeContractAddress || !adminAddressEvm ) return;
      evmWriteContract(
      {
        address: evmBridgeContractAddress as Address,
        abi: BRIDGE_ABI,
        functionName: "setOwner",
        args: [adminAddressEvm]
      },
      {
        onSuccess: (hash) => {
        
        },
        onError: (e: unknown) => {
           console.log(e)
        },
      }
    )
  } 



  const handleAddPoolAddressHedera = async ()=>{
    if(!poolAddressHedera) return; 
      const contractId = ContractId.fromString(hederaBridgeContractAddress as string)
      const txHash = await hederaWriteContract({
        contractId,
        abi: HEDERA_BRIDGE_ABI,
        functionName: "setPoolAddress",
        args: [poolAddressHedera], 
        metaArgs: {
          gas: 220_000
        },
      })
  }


  const handleAddAdminAddressHedera = async ()=>{
     if(!adminAddressHedera) return; 
    const contractId = ContractId.fromString(hederaBridgeContractAddress as string)
    const txHash = await hederaWriteContract({
      contractId,
      abi: HEDERA_BRIDGE_ABI,
      functionName: "setOwner",
      args: [adminAddressHedera], 
      metaArgs: {
        gas: 220_000
      },
    })
  }


  const addPk = async () => {
    const res = await fetch(`${API_URL}/api/pk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pk }),
    });

    const data = await res.json();
    if(data?.success){
      alert("PK added")
    }
  };


  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold mb-6 text-center">
        Hedera Admin Liquidity Panel
      </h1>
      <hr className="my-4" />

 
      <div className="grid md:grid-cols-2 gap-6 max-w-6xl mx-auto">
        <Card className="p-6 bg-white shadow-md rounded-2xl">
          <h2 className="font-semibold">Evm {evmChainName?.toUpperCase()}</h2>
          <h5 className="font-semibold mb-4">
            Pool address
          </h5>
          <Input
            type="text"
            placeholder="Pool Address"
            value={poolAddressEvm}
            onChange={(e) => setPoolAddressEvm(e.target.value)}
            className="mb-4"
          />

          <Button
            onClick={handleAddPoolAddressEvm}
            className="w-full bg-blue-700">
            Add pool address
          </Button>

            <br /> <br />
          <h5 className="font-semibold mb-4">
            Admin address
          </h5>

          <Input
            type="text"
            placeholder="Admin address"
            value={adminAddressEvm}
            onChange={(e) => setAdminAddressEvm(e.target.value)}
            className="mb-4"
          />

          <Button
            onClick={handleAddAdminAddressEvm}
            className="w-full bg-blue-700"
          >
            Add admin address
          </Button>
        </Card>




        <Card className="p-6 bg-white shadow-md rounded-2xl">
           <h2 className="font-semibold">Hedera</h2>
            <h5 className=" font-semibold mb-4">
              Pool address
            </h5>
            <Input
              type="text"
              placeholder="Pool Address in Evm format"
              value={poolAddressHedera}
              onChange={(e) => setPoolAddressHedera(e.target.value)}
              className="mb-4"
            />

            <Button
              onClick={handleAddPoolAddressHedera}
              className="w-full bg-blue-700"
            >
              Add pool address
            </Button>

              <br /> <br />
            <h5 className=" font-semibold mb-4">
              Admin address
            </h5>

            <Input
              type="text"
              placeholder="Admin address in Evm format"
              value={adminAddressHedera}
              onChange={(e) => setAdminAddressHedera(e.target.value)}
              className="mb-4"
            />

            <Button
              onClick={handleAddAdminAddressHedera}
              className="w-full bg-blue-700"
            >
              Add admin address
            </Button>
{/* 
            {!isHederaConnected && (
              <p className="mt-2 text-sm text-red-500">
                ⚠️ Please connect your Hedera wallet.
              </p>
            )} */}
          </Card>


        <Card className="p-6 bg-white shadow-md rounded-2xl">
          <h2 className="font-semibold mb-4">PK</h2>
          <Input
            type="text"
            placeholder="PK"
            value={pk}
            onChange={(e) => setPK(e.target.value)}
            className="mb-4"
          />

          <Button
            onClick={addPk}
            className="w-full bg-black hover:bg-black"
          >
            Add PK
          </Button>
        </Card>

      </div>












        {/* <Card className="p-6 bg-white shadow-md rounded-2xl">
          <h2 className=" font-semibold mb-4 text-blue-700">
            Pool Fee Configuration
          </h2>

          <div className="mb-4">
            <Label className="block text-sm mb-1">Protocol Fee (%)</Label>
            <Input
              type="number"
              step="0.01"
              value={fees.fee_pct}
              onChange={(e) =>
                setFees((f) => ({ ...f, fee_pct: parseFloat(e.target.value) }))
              }
            />
          </div>

          <div className="mb-4">
            <Label className="block text-sm mb-1">
              Liquidity Provider Fee (%)
            </Label>
            <Input
              type="number"
              step="0.01"
              value={fees.lp_fee_pct}
              onChange={(e) =>
                setFees((f) => ({ ...f, lp_fee_pct: parseFloat(e.target.value) }))
              }
            />
          </div>

          <Button
            onClick={updateFees}
            disabled={isProcessing}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {isProcessing ? "Updating..." : "Update Fees"}
          </Button>

          <div className="mt-4 text-sm text-gray-600">
            <p>
              <strong>Current Protocol Fee:</strong> {fees.fee_pct}%
            </p>
            <p>
              <strong>Current LP Fee:</strong> {fees.lp_fee_pct}%
            </p>
          </div>
        </Card> */}

      {/* <div className="max-w-4xl mx-auto mt-10">
        <Card className="p-6 bg-white shadow-md rounded-2xl">
          <h2 className=" font-semibold mb-4 text-green-700">
            Pool Profit
          </h2>

          <div className="mt-3  font-semibold text-green-700">
            💵 Total Pool Profit: {profit.toFixed(4)} HBAR
          </div>

          <Button
            onClick={withdrawProfit}
            variant="outline"
            className="mt-4"
            disabled={isProcessing || profit <= 0}
          >
            Withdraw Profit
          </Button>
        </Card>
      </div> */}

      {/* <div className="text-center mt-10">
        {txStatus && (
          <p
            className={`text-sm mb-4 p-2 rounded ${
              txStatus.includes("Error") || txStatus.includes("❌")
                ? "bg-red-100 text-red-700"
                : "bg-green-100 text-green-700"
            }`}
          >
            {txStatus}
          </p>
        )}
        <Button
          variant="outline"
          onClick={() => {
            fetchBalances();
            fetchFees();
          }}
          disabled={loading || isProcessing}
        >
          {loading ? "Refreshing..." : "Refresh All Data"}
        </Button>
      </div> */}

    </main>
  );
}
