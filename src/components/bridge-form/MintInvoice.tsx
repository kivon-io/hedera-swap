import { checkTokenAssociation } from "@/helpers/token"
import { useAssociateTokens } from "@buidlerlabs/hashgraph-react-wallets"
import Image from "next/image"
import React, { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "../ui/button"

const NFT_TOKEN_ID = "0.0.10146137" // DON'T CHANGE 🔥

interface MintButtonProps {
  hederaAccount: string
  nonce: string
  minted: boolean
  setMinted: (value: boolean) => void
}

function ipfsToHttp(
  ipfsUri: string,
  gateway: string = process.env.NEXT_PUBLIC_PINATA_GATEWAY_URL!
): string {
  if (!ipfsUri.startsWith("ipfs://")) return ipfsUri
  const cid = ipfsUri.replace("ipfs://", "")

  return `${gateway}/${cid}`
}

const MintButton: React.FC<MintButtonProps> = ({ hederaAccount, nonce, minted, setMinted }) => {
  const { associateTokens } = useAssociateTokens()
  const [isMinting, setIsMinting] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")
  const [image, setImage] = useState("")
  useEffect(() => {
    setImage("")
  }, [])

  const handleReceipt = async () => {
    if (!hederaAccount || !nonce) return

    try {
      setIsMinting(true)
      setStatusMessage("Checking token association...")
      toast.loading("Checking token association...")
      const isAssociated = await checkTokenAssociation(hederaAccount, NFT_TOKEN_ID)
      if (!isAssociated) {
        setStatusMessage(`Associating NFT token...`)
        toast.loading("Associating NFT token...")
        await associateTokens([NFT_TOKEN_ID])
        toast.success("NFT token associated successfully!")
      }

      setStatusMessage("Minting NFT...")
      toast.loading("Minting NFT...")
      const response = await fetch(`/api/mint?nonce=${nonce}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }).then((res) => res.json())

      if (response.data.success) {
        //setStatusMessage("NFT minted successfully!");
        setMinted(true)
        setImage(response?.data?.nodeResponse?.imageURI)
      } else {
        setStatusMessage("Minting failed. Please try again.")
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(error.message)
        setStatusMessage(`An error occurred: ${error.message}`)
        toast.error(`An error occurred: ${error.message}`)
      } else {
        console.error(error)
        toast.error("An unknown error occurred.")
        setStatusMessage("An unknown error occurred.")
      }
    } finally {
      setIsMinting(false)
      toast.dismiss()
    }
  }

  return (
    <div className='flex flex-col gap-2 w-full items-center'>
      {image && minted ? (
        <div className='flex justify-center relative h-[250px] w-full'>
          {image && (
            <Image
              src={ipfsToHttp(image)}
              alt='Minted NFT'
              className='max-w-full h-auto rounded-lg object-contain object-center'
              fill
            />
          )}
        </div>
      ) : (
        <Button
          className='w-full uppercase font-bold italic bg-linear-to-r from-black to-zinc-600 hover:from-zinc-600 hover:to-black text-white hover:text-white border-0 transition-all duration-300 flex items-center justify-center rounded-xl'
          onClick={handleReceipt}
          disabled={isMinting}
          size='lg'
        >
          {isMinting ? "Processing..." : "Mint Invoice"}
        </Button>
      )}
    </div>
  )
}

export default MintButton
