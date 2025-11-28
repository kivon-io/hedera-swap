import { createAuthenticationAdapter } from "@rainbow-me/rainbowkit"
import { createSiweMessage } from "viem/siwe"

// create an authentication adapter for user to sign message with their wallet
const authenticationAdapter = createAuthenticationAdapter({
  getNonce: async () => {
    const response = await fetch("/api/user/nonce")
    const data = await response.json()
    return data.nonce
  },
  createMessage: ({ nonce, address, chainId }) => {
    return createSiweMessage({
      domain: window.location.host,
      address,
      statement: "Sign message to authenticate with the app",
      uri: window.location.origin,
      version: "1",
      chainId,
      nonce,
    })
  },
  verify: async ({ message, signature }) => {
    const response = await fetch("/api/user/verify", {
      method: "POST",
      body: JSON.stringify({ message, signature }),
    })
    return Boolean(response.ok)
  },
  signOut: async () => {
    return void 0
  },
})

export default authenticationAdapter
