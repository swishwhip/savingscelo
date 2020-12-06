import { CeloTransactionObject } from "@celo/contractkit"
import BigNumber from "bignumber.js"
import { TransactionReceipt } from "web3-core"

export async function sendTX(
	name: string,
	tx: CeloTransactionObject<unknown>): Promise<TransactionReceipt> {
	console.info(`Sending TX: ${name} ...`)
	const result = await tx.send()
	const hash = await result.getHash()
	console.info(`Waiting TX: ${hash} ...`)
	const receipt = await result.waitReceipt()
	console.info(`DONE`)
	return receipt
}

export function fmtValue(v: BigNumber.Value, toFixed?: number): string {
	return new BigNumber(v).div(1e18).toFixed(toFixed || 18)
}