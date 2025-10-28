import React from 'react';

export type BridgeStatus = {
    step: number
    message: string
    txHash?: string
    error?: string
}

const BridgeStatusTracker: React.FC<{ status: BridgeStatus }> = ({ status }) => {
    const getStatusColor = (step: number) => {
        if (status.step > step) return "text-green-500"
        if (status.step === step && status.error) return "text-red-500"
        if (status.step === step) return "text-yellow-500"
        return "text-gray-500"
    }

    return (
        <div className='p-3 bg-zinc-800 rounded-lg border border-zinc-700 space-y-2 mt-4'>
            <p className='font-semibold text-zinc-400'>Bridge Status:</p>

            <div className={`text-sm ${getStatusColor(1)}`}>
                {status.step > 1
                    ? "✅"
                    : status.step === 1 && status.error
                    ? "❌"
                    : status.step === 1
                    ? "➡️"
                    : "○"}{" "}
                Step 1: Connect & Approval
            </div>

            <div className={`text-sm ${getStatusColor(2)}`}>
                {status.step > 2
                    ? "✅"
                    : status.step === 2 && status.error
                    ? "❌"
                    : status.step === 2
                    ? "⏳"
                    : "○"}{" "}
                Step 2: Deposit to Vault
            </div>

            <div className={`text-sm ${getStatusColor(3)}`}>
                {status.step > 3
                    ? "✅"
                    : status.step === 3 && status.error
                    ? "❌"
                    : status.step === 3
                    ? "⚙️"
                    : "○"}{" "}
                Step 3: Relayer Processing
            </div>

            <div
                className={`text-sm font-medium ${
                    status.error ? "text-red-500" : status.step === 4 ? "text-green-500" : "text-white"
                }`}
            >
                {status.message}
            </div>

            {status.txHash && status.txHash !== "N/A" && status.txHash !== "pending" && (
                <div className='text-xs text-zinc-500 truncate'>
                    Tx: {status.txHash.slice(0, 8)}...{status.txHash.slice(-6)}
                </div>
            )}
            
            {status.error && (
                <div className='text-xs text-red-400 border border-red-500 p-1 rounded'>
                    Error: {status.error}
                </div>
            )}
        </div>
    )
}

export default BridgeStatusTracker;