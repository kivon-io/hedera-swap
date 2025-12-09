"use client"

import { Button } from "../ui/button" 
import { useState } from "react"
import { useSignMessage } from 'wagmi'
import { useAccountId, useAuthSignature, UserRefusedToSignAuthError, useWallet } from '@buidlerlabs/hashgraph-react-wallets'
import { useVault } from "@/providers/VaultProvider"
import axios from "axios"
import { SignableMessage, toHex } from 'viem' // wagmi/viem type
import { useEvmWallet } from "@/hooks/useEvmWallet"
import { API_URL } from "@/config/bridge"

interface WithdrawRequest {
  amount: number | string
  signature: string
  address: string
}

const WithdrawAction = () => {
    const { vault, withdrawalAmount } = useVault()
    const { signMessage } = useSignMessage()
    const { signAuth } = useAuthSignature()


    const { signer, isConnected: hederaConnected } = useWallet()
    const { address: evmAddress, isConnected: evmConnected } = useEvmWallet()
    const { data: hederaAccount } = useAccountId({ autoFetch: hederaConnected })

    const [errMsg, setErrMsg] = useState<string>("") 
    const [successMsg, setSuccessMsg] = useState<string>("") 
  
    const sendRequest = async (request: WithdrawRequest) => {
        try {
            const res = await axios.post(`${API_URL}/api/withdraw`, request)
            if(res.data.error){
                setErrMsg(res.data.error)
            } else {
                setSuccessMsg("Withdrawal request sent!")
            }
        } catch (error: unknown) {
            if (error instanceof Error) {
                setErrMsg(error.message)
            } else {
                setErrMsg("Something went wrong")
            }
        }
    }
    const message: SignableMessage = 'withdrawal request'

    const handleWithdrawal = async () => {
        setErrMsg("")
        setSuccessMsg("")
        if(!withdrawalAmount){
            setErrMsg("Enter withdrawal amount first")
            return
        }

        try {
            let signature: string

            if(vault.network_slug === "hedera"){

            if(!hederaAccount || !hederaConnected){
                setErrMsg("Wallet not connected")
                return
            }
                const sig = await signAuth(message)
                console.log(sig)
                signature =  toHex(sig.signature); 
                console.log("Hedera Auth Signature:", signature)
                sendRequest({
                    amount: withdrawalAmount,
                    signature,
                    address: hederaAccount.toString()
                })
            } else {
                if(!evmConnected || !evmAddress){
                    setErrMsg("EVM Wallet not connected")
                    return
                }
                // Wagmi EVM signing
                signMessage({ message },  {
                    onSuccess(signature, vars) {
                        console.log("signature:", signature)
                        sendRequest({
                            amount: withdrawalAmount,
                            signature,
                            address: evmAddress
                        })
                    },
                    onError(err : unknown) {
                        console.error("sign failed", err)
                    }
                });
            }

        } catch (error: unknown) {
            if (error instanceof UserRefusedToSignAuthError){
                setErrMsg("User refused to sign the authentication message.")
            } else if (error instanceof Error) {
                setErrMsg(error.message)
            } else {
                setErrMsg("Failed to sign message")
            }
            console.error(error)
        }
    }

    return (
        <>
            { errMsg  && <div>{errMsg}</div> }
            { successMsg  && <div>{successMsg}</div> }

            <Button onClick={handleWithdrawal} className='w-full rounded-xl h-12' size={"lg"}>
                Withdraw
            </Button>
        </>
    )
}

export default WithdrawAction
