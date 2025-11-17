import { Address } from "viem";

export type TokenConfig = {
  address: Address;
  decimals: number;
  symbol: string;
  name: string;
};

// Updated token addresses from degenRobot/devrel-trading-bot
export const TOKENS = {
  MockUSD: {
    address: "0x044b54e85D3ba9ae376Aeb00eBD09F21421f7f50" as `0x${string}`,
    decimals: 18,
    symbol: "MockUSD",
    name: "Mock USD",
  },
  MockToken: {
    address: "0x6166a6e02b4CF0e1E0397082De1B4fc9CC9D6ceD" as `0x${string}`,
    decimals: 18,
    symbol: "MockToken",
    name: "Mock Token",
  },
} as const;

// UniswapV2 contract addresses
export const UNISWAP_CONTRACTS = {
  factory: "0xf6A86076ce8e9A2ff628CD3a728FcC5876FA70C6" as `0x${string}`,
  router: "0x6c10B45251F5D3e650bcfA9606c662E695Af97ea" as `0x${string}`,
  pair: "0xf8da515e51e5B1293c2430d406aE41E6e5B9C992" as `0x${string}`,
};
