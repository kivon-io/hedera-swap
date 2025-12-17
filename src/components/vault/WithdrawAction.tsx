"use client"

import { Button } from "../ui/button" 
import { useState } from "react"
import { useSignMessage } from 'wagmi'
import { useAccountId, useAuthSignature, UserRefusedToSignAuthError, useWallet } from '@buidlerlabs/hashgraph-react-wallets'
import { useVault } from "@/providers/VaultProvider"
import axios from "axios"
import { SignableMessage, toHex } from 'viem' // wagmi/viem type
import { useEvmWallet } from "@/hooks/useEvmWallet"

interface WithdrawRequest {
    amount: number | string
    signature: string
    address: string
    nonce: string
    message: string
    type: 'evm' | 'hedera'
    publicKey?: string
}


const API_URL = "http://localhost:8000"

const WithdrawAction = () => {
    const { vault, withdrawalAmount } = useVault()
    const { signMessage } = useSignMessage()
    const { signAuth } = useAuthSignature()


    const { signer, isConnected: hederaConnected } = useWallet()
    const { address: evmAddress, isConnected: evmConnected } = useEvmWallet()
    const { data: hederaAccount } = useAccountId({ autoFetch: hederaConnected })

    const [errMsg, setErrMsg] = useState<string>("") 
    const [successMsg, setSuccessMsg] = useState<string>("") 

    const getNonce = async (address: string) => {
        const res = await axios.post(`${API_URL}/api/getnonce`, {
            address,
        })

        if (!res.data?.nonce) {
            throw new Error('Failed to get nonce')
        }

        return res.data.nonce as string
    }


    const buildMessageStr = (nonce: string): string => `withdrawal request\nnonce:${nonce}`
  
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




    const handleWithdrawal = async () => {
        setErrMsg("")
        setSuccessMsg("")

        if (!withdrawalAmount) {
            setErrMsg("Enter withdrawal amount first")
            return
        }

        try {
            // ======================
            // HEDERA
            // ======================
            if (vault.network_slug === "hedera") {
                if (!hederaConnected || !hederaAccount) {
                    setErrMsg("Hedera wallet not connected")
                    return
                }

                const address = hederaAccount.toString()
                const nonce = await getNonce(address)
                const message = buildMessageStr(nonce)
                const sig = await signAuth(message)
                const messageBase64 = btoa(message)

                console.log("sig")
                console.log(sig)

                const payload: WithdrawRequest = {
                    amount: withdrawalAmount,
                    type: "hedera",
                    address,
                    message,
                    nonce,
                    signature: Buffer.from(sig.signature).toString("hex"),
                    publicKey: sig.publicKey.toString(), // DER encoded
                }

                console.log(payload)
                
                await sendRequest(payload)
                // setSuccessMsg("Withdrawal request sent!")
                return
            }
            // ======================
            // EVM
            // ======================
            if (!evmConnected || !evmAddress) {
                setErrMsg("EVM wallet not connected")
                return
            }

            const nonce = await getNonce(evmAddress)
            const message = buildMessageStr(nonce)
      

            signMessage({ message },  {

                async onSuccess(signature, vars) {
                    console.log("evm signature")
                    console.log(signature)
                    await sendRequest({
                        amount: withdrawalAmount,
                        address: evmAddress,
                        signature,
                        nonce,
                        message,
                        type: "evm",
                    })
                },
                onError(err : unknown) {
                    console.error("sign failed", err)
                }
            })

            // setSuccessMsg("Withdrawal request sent!")

        } catch (err) {
        if (err instanceof UserRefusedToSignAuthError) {
            setErrMsg("User refused to sign the message")
        } else if (err instanceof Error) {
            setErrMsg(err.message)
        } else {
            setErrMsg("Signing failed")
        }
        console.error(err)
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
