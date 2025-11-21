import React, { useState, useEffect } from "react";
import { useAssociateTokens } from "@buidlerlabs/hashgraph-react-wallets";
import { checkTokenAssociation } from "@/helpers/token";

const NFT_TOKEN_ID = "0.0.10119645"; // DON'T CHANGE 🔥

interface MintButtonProps {
  hederaAccount: string;
  nonce: string;
  minted: boolean;
  setMinted: (value: boolean) => void;
}

function ipfsToHttp(ipfsUri: string, gateway: string = "https://ipfs.io/ipfs"): string {
  if (!ipfsUri.startsWith("ipfs://")) return ipfsUri;
  const cid = ipfsUri.replace("ipfs://", "");
  return `${gateway}/${cid}`;
}

const MintButton: React.FC<MintButtonProps> = ({ hederaAccount, nonce, minted, setMinted }) => {
  const { associateTokens } = useAssociateTokens();
  const [isMinting, setIsMinting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [image, setImage] = useState(""); 

  useEffect(()=>{
    setImage("")
  }, [])

  const handleReceipt = async () => {
    if (!hederaAccount || !nonce) return;

    try {
      setIsMinting(true);
      setStatusMessage("Checking token association...");

      const isAssociated = await checkTokenAssociation(hederaAccount, NFT_TOKEN_ID);
      if (!isAssociated) {
        setStatusMessage(`Associating NFT token...`);
        await associateTokens([NFT_TOKEN_ID]);
      }

      setStatusMessage("Minting NFT...");
      const response = (await fetch(`/api/mint?nonce=${nonce}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }).then(res => res.json()));

      if (response.data.success) {
        //setStatusMessage("NFT minted successfully!");
        setMinted(true); 
        setImage(response?.data?.nodeResponse?.imageURI)
      } else {
        setStatusMessage("Minting failed. Please try again.");
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(error.message);
        setStatusMessage(`An error occurred: ${error.message}`);
      } else {
        console.error(error);
        setStatusMessage("An unknown error occurred.");
      }
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">

    { image && minted ? (
        <div className="flex justify-center">
        <img
            src={ipfsToHttp(image)}
            alt="Minted NFT"
            className="max-w-full h-auto rounded-lg"
            />
        </div>
        ) : (
        <button
            className="w-full rounded-xl h-12 bg-black hover:bg-black text-white font-semibold transition-all duration-300"
            onClick={handleReceipt}
            disabled={isMinting}
        >
            {isMinting ? "Processing..." : "Mint Invoice"}
        </button>
    )}

      {statusMessage && <p className="text-sm text-gray-700 text-center">{statusMessage}</p>}
    </div>
  );
};

export default MintButton;
