"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"
import { AccountId, ContractId } from "@hashgraph/sdk"
import {
  useWallet, 
  useAccountId, 
  useWriteContract as UseHederaWriteContract,
  useReadContract
} from "@buidlerlabs/hashgraph-react-wallets";
import { HWCConnector } from "@buidlerlabs/hashgraph-react-wallets/connectors"
import { useAccount, useChainId, useWriteContract, useSignMessage, useReadContract as UseReadContract } from "wagmi"
import BRIDGE_ABI from "@/Abi/bridge.json"
import HEDERA_BRIDGE_ABI from "@/Abi/hedera_abi.json"
import { CHAIN_IDS, CONTRACT_ADDRESSES, NetworkOption, getChainNameById } from "@/config/networks"
import { type Address } from "viem"
import { API_URL } from "@/config/bridge"


export default function AdminPage() {

  const { readContract } = useReadContract({ connector: HWCConnector });

  const [poolAddressEvm, setPoolAddressEvm] = useState("");
  const [adminAddressEvm, setAdminAddressEvm] = useState("");

  const [poolAddressHedera, setPoolAddressHedera] = useState("");
  const [adminAddressHedera, setAdminAddressHedera] = useState("");
  const [PKSet, setPKSet] = useState(false);

  const [pk, setPK] = useState(""); 

  const [fees, setFees] = useState({ fee_pct: 0, lp_fee_pct: 0 });
  const [profit, setProfit] = useState(0);

  const [loading, setLoading] = useState(false);
  const [feeIsProcessing, setFeeIsProcessing] = useState(false);
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

  const { address: evmAddress, isConnected: evmConnected } = useAccount()
  const { signMessage } = useSignMessage()



    const { data: evmPoolAddress } = UseReadContract({
      abi: BRIDGE_ABI,
      address: evmBridgeContractAddress as `0x${string}`,
      functionName: 'poolAddress',
    });

    const { data: evmAdminAddress } = UseReadContract({
      abi: BRIDGE_ABI,
      address: evmBridgeContractAddress as `0x${string}`,
      functionName: 'owner',
    });


    const fetchStats = async () => {
      try {
        const [PoolAddressHedera, AdminAddressHedera] = await Promise.all([
          readContract({
            address: `0x${ContractId.fromString(hederaBridgeContractAddress).toEvmAddress()}`,
            abi: HEDERA_BRIDGE_ABI,
            functionName: 'poolAddress'
          }),
          readContract({
            address: `0x${ContractId.fromString(hederaBridgeContractAddress).toEvmAddress()}`,
            abi: HEDERA_BRIDGE_ABI,
            functionName: 'owner'
          })
        ]);
        setPoolAddressHedera(PoolAddressHedera as string); 
        setAdminAddressHedera(AdminAddressHedera as string); 
      } catch (e) {
        console.error(e);
      }
  };



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

  async function fetchPk() {
      try {
        const res = await fetch("/api/pk");
        const data = await res.json();
        if(data.has_pk){
          setPKSet(true)
        }
      } catch (err) {
        console.error("Error fetching fees:", err);
      }
  }



  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchFees();
    fetchPk(); 
  }, []);

  useEffect(() => {
  if (evmPoolAddress) {
    setPoolAddressEvm(evmPoolAddress as string);
  }
  if (evmAdminAddress) {
    setAdminAddressEvm(evmAdminAddress as string);
  }
}, [evmPoolAddress, evmAdminAddress]);



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
           alert("done")
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
            alert("done")
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
    if(!evmAddress) {
        alert('connect evm address'); 
        return;
    }   
    // 1. Get nonce
    const nonceRes = await fetch(`${API_URL}/api/getpknonce`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address:evmAddress }),
    });

    const { nonce } = await nonceRes.json();
    // 2. Build message
    const message = `Authorize pool PK storage\naddress: ${evmAddress.toLowerCase()}\nnonce: ${nonce}`;

    // 3. Sign message with wallet
    signMessage({ message },  {
      async onSuccess(signature, vars) {
        // 4. Send PK
        const res = await fetch(`${API_URL}/api/pk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address:evmAddress,
            pk,
            nonce,
            message,
            signature,
          }),
        });
        const data = await res.json();
        if (data?.success) alert("PK added");
        if (data?.error) alert(data.error)
      },
      onError(err : unknown) {
          console.error("sign failed", err)
      }
    })
  };


  async function updateFees() {
  if (!evmAddress) {
    alert("Connect your wallet first");
    return;
  }

  setFeeIsProcessing(true);

  try {
    // 1. Get nonce from server
    const nonceRes = await fetch(`${API_URL}/api/getfeenonce`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: evmAddress }),
    });

    const { nonce } = await nonceRes.json();

    // 2. Build message
    const message = `Authorize fee update\naddress: ${evmAddress.toLowerCase()}\nnonce: ${nonce}`;

    // 3. Sign message
    signMessage({ message }, {
      async onSuccess(signature) {
        // 4. Send fees with signature
        const res = await fetch(`${API_URL}/api/fee`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: evmAddress,
            fees,
            nonce,
            message,
            signature,
          }),
        });

        const data = await res.json();
        if (data?.success) {
          setTxStatus("✅ Fees updated successfully!");
        } else if (data?.error) {
          setTxStatus(`❌ ${data.error}`);
        }
      },
      onError(err: unknown) {
        console.error("Signing failed", err);
        setTxStatus("❌ Signature failed");
      },
    });
  } catch (err: unknown) {
    let errorMessage = "An unexpected error occurred";
    if (err instanceof Error) errorMessage = err.message;
    console.error("Fee update error:", errorMessage);
    setTxStatus(`❌ ${errorMessage}`);
  } finally {
    setFeeIsProcessing(false);
    setTimeout(() => setTxStatus(null), 6000);
  }
}



  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold mb-6 text-center">
        Hedera Admin Liquidity Panel
      </h1>
      <hr className="my-4" />

 
      <div className="grid md:grid-cols-2 gap-6 max-w-6xl mx-auto">
        <Card className="p-6 bg-white shadow-md rounded-2xl">
          <h2 className="font-semibold">Evm {evmChainName?.toUpperCase()}</h2>
          <br />
          <Label className="block text-sm mb-1">
            Pool address
          </Label>
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
          <Label className="block text-sm mb-1">
            Admin address
          </Label>

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
           <br />
            <Label className="block text-sm mb-1">
              Pool address
            </Label>
            
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
            <Label className="block text-sm mb-1">
              Admin address
            </Label>
          
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
            className="w-full bg-black hover:bg-black">
            Add PK
          </Button>
          { PKSet ? "Aready set ✅" : "Not set ❌"}
        </Card>


        <Card className="p-6 bg-white shadow-md rounded-2xl">
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
            disabled={feeIsProcessing}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {feeIsProcessing ? "Updating..." : "Update Fees"}
          </Button>

          <div className="mt-4 text-sm text-gray-600">
            <p>
              <strong>Current Protocol Fee:</strong> {fees.fee_pct}%
            </p>
            <p>
              <strong>Current LP Fee:</strong> {fees.lp_fee_pct}%
            </p>
          </div>
        </Card>

      </div>
   

    

    </main>
  );
}
