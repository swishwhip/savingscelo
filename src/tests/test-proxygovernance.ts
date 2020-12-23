import { toWei } from "web3-utils"
import { newKit } from "@celo/contractkit"
import { increaseTime, Provider } from "celo-devchain"
import { SavingsKit } from "../savingskit";
import { SavingsCELOInstance } from "../../types/truffle-contracts/SavingsCELO";
import { createAccounts } from "./utils";
import { toTransactionObject } from "@celo/contractkit/lib/wrappers/BaseWrapper"
import { ProposalBuilder } from '@celo/contractkit/lib/governance'
import { VoteValue } from '@celo/contractkit/lib/wrappers/Governance'

const SavingsCELO = artifacts.require("SavingsCELO");

const kit = newKit("http://127.0.0.1:7545")
after(() => {
	kit.stop()
})
contract('SavingsCELO', (accounts) => {
	const owner = accounts[0]
	let owner2: string
	let proxyVoter: string

	let savingsCELO: SavingsCELOInstance
	let savingsKit: SavingsKit

	before(async () => {
		savingsCELO = await SavingsCELO.new()
		savingsKit = new SavingsKit(kit, savingsCELO.address)
	})

	it(`create accounts`, async () => {
		[
			owner2,
			proxyVoter,
		] = await createAccounts(
			kit, owner, [
				toWei('1', 'ether'),
				toWei('2001', 'ether'),
			])
	})

	it(`change owner`, async () => {
		await toTransactionObject(kit,
			savingsKit.contract.methods.changeOwner(owner2))
			.sendAndWaitForReceipt({from: owner} as any)

		try {
			await toTransactionObject(kit,
				savingsKit.contract.methods.changeOwner(owner2))
				.sendAndWaitForReceipt({from: owner} as any)
			assert.fail("must fail since owner2 is the new owner")
		} catch {}

		try {
			await toTransactionObject(kit,
				savingsKit.contract.methods.authorizeVoterProxy(proxyVoter))
				.sendAndWaitForReceipt({from: owner} as any)
			assert.fail("must fail since owner2 is the new owner")
		} catch {}

		await toTransactionObject(kit,
			savingsKit.contract.methods.authorizeVoterProxy(proxyVoter))
			.sendAndWaitForReceipt({from: owner2} as any)
	})

	it(`proxy governance voting`, async () => {
		const approveTX = await savingsKit.infiniteApprove(proxyVoter)
		if (approveTX) {
			await approveTX.sendAndWaitForReceipt({from: proxyVoter} as any)
		}
		await savingsKit
			.deposit(toWei('1000', 'ether'))
			.sendAndWaitForReceipt({from: proxyVoter} as any)

		const cfg = await kit.getNetworkConfig()
    	const governance = await kit.contracts.getGovernance()
		const proposal = await new ProposalBuilder(kit).build()
		await governance
			.propose(proposal, 'URL')
			.sendAndWaitForReceipt({
				from: owner,
				value: cfg.governance.minDeposit.toFixed(0)} as any)

		const queue = await governance.getQueue()
		assert.lengthOf(queue, 1)
		const proposalID = queue[0].proposalID
		await toTransactionObject(kit,
			savingsKit.contract.methods.proxyGovernanceUpvote(
				proposalID.toFixed(0),
				0, 0))
			.sendAndWaitForReceipt({from: proxyVoter} as any)
		const queue2 = await governance.getQueue()
		assert.lengthOf(queue2, 1)
		assert.isTrue(queue2[0].upvotes.eq(toWei('1000', 'ether')), `upvotes: ${queue2[0].upvotes}`)

		await toTransactionObject(kit,
			savingsKit.contract.methods.proxyGovernanceRevokeUpvote(0, 0))
			.sendAndWaitForReceipt({from: proxyVoter} as any)
		const queue3 = await governance.getQueue()
		assert.lengthOf(queue3, 1)
		assert.isTrue(queue3[0].upvotes.eq(0), `upvotes: ${queue3[0].upvotes}`)

		await increaseTime(kit.web3.currentProvider as Provider, cfg.governance.dequeueFrequency.toNumber())
		await governance
			.dequeueProposalsIfReady()
			.sendAndWaitForReceipt({from: owner} as any)
		const multiSigAddress = await governance.getApprover()
		const governanceApproverMultiSig = await kit.contracts.getMultiSig(multiSigAddress)
		const govTX = await governance.approve(proposalID)
		await (await governanceApproverMultiSig
			.submitOrConfirmTransaction(governance.address, govTX.txo))
			.sendAndWaitForReceipt({from: owner} as any)
		await increaseTime(kit.web3.currentProvider as Provider, cfg.governance.stageDurations.Approval.toNumber())

		// await toTransactionObject(kit,
		// 	savingsKit.contract.methods.proxyGovernanceVote(
		// 		proposalID.toFixed(0),
		// 		0,
		// 		Object.keys(VoteValue).indexOf(VoteValue.Yes)))
		// 	.sendAndWaitForReceipt({from: proxyVoter} as any)
		// let pVotes = await governance.getVotes(proposalID)
		// assert.isTrue(pVotes.Yes.eq(toWei('1000', 'ether')))
		// await toTransactionObject(kit,
		// 	savingsKit.contract.methods.proxyGovernanceVote(
		// 		proposalID.toFixed(0),
		// 		0,
		// 		Object.keys(VoteValue).indexOf(VoteValue.No)))
		// 	.sendAndWaitForReceipt({from: proxyVoter} as any)
		// assert.isTrue(pVotes.No.eq(toWei('1000', 'ether')))
		// await toTransactionObject(kit,
		// 	savingsKit.contract.methods.proxyGovernanceVote(
		// 		proposalID.toFixed(0),
		// 		0,
		// 		Object.keys(VoteValue).indexOf(VoteValue.Abstain)))
		// 	.sendAndWaitForReceipt({from: proxyVoter} as any)
		// assert.isTrue(pVotes.Abstain.eq(toWei('1000', 'ether')))

		await increaseTime(kit.web3.currentProvider as Provider, cfg.governance.stageDurations.Referendum.toNumber())
		await (await governance
			.execute(proposalID))
			.sendAndWaitForReceipt({from: owner} as any)
	})
})

export {}