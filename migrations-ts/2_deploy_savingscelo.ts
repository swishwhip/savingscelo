const SavingsCELO = artifacts.require("SavingsCELO");
const SavingsCELOVoterV1 = artifacts.require("SavingsCELOVoterV1");

module.exports = function (deployer) {
	deployer.deploy(SavingsCELO)
} as Truffle.Migration;

export {}