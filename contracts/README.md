# eSpace contract guide

This project provides basic template for deploying and verifying contracts on `Conflux eSpace testnet` using hardhat or foundry.

## Hardhat

The hardhat project is a basic template for deploying and verifying contracts on `Conflux eSpace testnet`. It comes with a sample contract, a test for that contract, and a script that deploys that contract.

### Setup

Create `.env` file in the root directory from `.env.example` and update the `PRIVATE_KEY` with your dev private key. Make sure it has some eSpace testnet CFX.

Note: You can get some testnet CFX from [eSpace faucet](https://efaucet.confluxnetwork.org/)

Install dependencies

```shell
yarn
```

### Common hardhat tasks

After installing the dependencies(`npm install` or `yarn`), try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.ts
```

### Deploy in eSpace

```shell
npx hardhat run scripts/deploy.ts --network espaceTestnet
```

### Verify in eSpace

```shell
npx hardhat verify --network espaceTestnet <contract address> <space separated constructor parameters>
```

For example, if you get following message for deploying `Lock` contract:

`Lock with 0.001ETH and unlock timestamp 1735008251 deployed to 0x8771b69CFE2c774Ea93eD65DE042CD20bcbf1319`

You can verify the contract by running (as 1735008251 is the constructor parameter):

```shell
npx hardhat verify --network espaceTestnet 0x8771b69CFE2c774Ea93eD65DE042CD20bcbf1319 1735008251
```

## Foundry

### Setup

Remember to init all submodules

```bash
git submodule update --init --recursive
```

```shell
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Build

```shell
forge build
```

### Test

```shell
forge test
```

### Deploy

```shell
forge script scripts/Deploy.s.sol --rpc-url conflux_testnet --broadcast -g 200
```

The `-g 200` is the gas multiplier, which is used to estimate the gas cost. It is set to 200, whereas 200%, because Conflux eSpace has a different opcode gas cost setting compared to Ethereum, this setting would make sure the deployment is successful.

### Verify

Currently there is an API break with foundry command line verification, please check [verification](https://www.confluxdocs.com/docs/espace/tutorials/VerifyContracts#foundry) for the latest progress.

## Resources

- [confluxdocs: hardhat and foundry](https://www.confluxdocs.com/docs/espace/tutorials/deployContract/hardhatAndFoundry)
- [Conflux eSpace](https://doc.confluxnetwork.org/docs/espace/Overview)
- [Hardhat documentation](https://hardhat.org/docs)
- [Foundry documentation](https://book.getfoundry.sh/index.html)
- [Community Hardhat ignition viem example](https://github.com/SPCFXDA/conflux-devkit-hhv)
- [Community Hardhat ignition ethers.js example](https://github.com/SPCFXDA/conflux-devkit-hhe)
