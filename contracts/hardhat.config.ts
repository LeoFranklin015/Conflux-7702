import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-foundry";
import  "dotenv/config";

const config: HardhatUserConfig = {
  solidity: "0.8.19",
  networks: {
    espaceTestnet: {
      url: process.env.ESPACE_TESTNET_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
  },
  sourcify: {
    enabled: false,
  },
  etherscan: {
    apiKey: {
      espaceTestnet: 'espace',
    },
    customChains: [
      {
        network: 'espaceTestnet',
        chainId: 71,
        urls: {
          apiURL: 'https://evmapi-testnet.confluxscan.org/api/',
          browserURL: 'https://evmtestnet.confluxscan.org/',
        },
      },
    ],
  },
};

export default config;
