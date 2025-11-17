import { keccak256, parseEther, toHex } from "viem";
import { TOKENS, UNISWAP_CONTRACTS } from "./tokens";

// Define permission items with IDs for checkbox control
export const PERMISSION_ITEMS = {
  calls: [
    {
      id: "transfer-mockusd",
      label: "Transfer MockUSD",
      call: {
        to: TOKENS.MockUSD.address,
        signature: keccak256(toHex("transfer(address,uint256)")).slice(0, 10),
      },
    },
    {
      id: "transfer-mocktoken",
      label: "Transfer MockToken",
      call: {
        to: TOKENS.MockToken.address,
        signature: keccak256(toHex("transfer(address,uint256)")).slice(0, 10),
      },
    },
    {
      id: "approve-mockusd",
      label: "Approve MockUSD",
      call: {
        to: TOKENS.MockUSD.address,
        signature: keccak256(toHex("approve(address,uint256)")).slice(0, 10),
      },
    },
    {
      id: "approve-mocktoken",
      label: "Approve MockToken",
      call: {
        to: TOKENS.MockToken.address,
        signature: keccak256(toHex("approve(address,uint256)")).slice(0, 10),
      },
    },
    {
      id: "mint-mocktoken",
      label: "Mint MockToken",
      call: {
        to: TOKENS.MockToken.address,
        signature: keccak256(toHex("mintOnce()")).slice(0, 10),
      },
    },
    {
      id: "mint-mockusd",
      label: "Mint MockUSD",
      call: {
        to: TOKENS.MockUSD.address,
        signature: keccak256(toHex("mintOnce()")).slice(0, 10),
      },
    },
    {
      id: "swap-tokens",
      label: "Swap Tokens (Uniswap)",
      call: {
        to: UNISWAP_CONTRACTS.router,
        signature: keccak256(
          toHex(
            "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)"
          )
        ).slice(0, 10),
      },
    },
  ],
  spend: [
    {
      id: "spend-mockusd",
      label: "Spend MockUSD (50/minute)",
      spend: {
        limit: parseEther("50"),
        period: "minute" as const,
        token: TOKENS.MockUSD.address,
      },
    },
    {
      id: "spend-mocktoken",
      label: "Spend MockToken (50/minute)",
      spend: {
        limit: parseEther("50"),
        period: "minute" as const,
        token: TOKENS.MockToken.address,
      },
    },
  ],
};

// Default selections (all enabled)
export const DEFAULT_SELECTIONS = {
  calls: PERMISSION_ITEMS.calls.map(item => item.id),
  spend: PERMISSION_ITEMS.spend.map(item => item.id),
};

// Helper function to build permissions based on selections
export function buildPermissionsFromSelections(selections: {
  calls: string[];
  spend: string[];
}) {
  const calls = PERMISSION_ITEMS.calls
    .filter(item => selections.calls.includes(item.id))
    .map(item => item.call);

  const spend = PERMISSION_ITEMS.spend
    .filter(item => selections.spend.includes(item.id))
    .map(item => item.spend);

  return {
    calls,
    spend,
  };
}