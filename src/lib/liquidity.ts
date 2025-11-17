import { Hbar, TransferTransaction, type Signer } from "@hashgraph/sdk"

// ---------------------------
// HEDERA HBAR Deposit
// ---------------------------
export async function hederaDeposit({
  signer,
  accountId,
  amount,
  depositAddress,
}: {
  signer: Signer
  accountId: string
  amount: number
  depositAddress: string
}) {
  const hbarAmt = new Hbar(amount)

  const tx = new TransferTransaction()
    .addHbarTransfer(accountId, hbarAmt.negated())
    .addHbarTransfer(depositAddress, hbarAmt)

  const frozen = await tx.freezeWithSigner(signer)
  const result = await frozen.executeWithSigner(signer)

  return {
    txId: result.transactionId.toString(),
  }
}
