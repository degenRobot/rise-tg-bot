import { MintableERC20ABI } from "@/abi/erc20";
import { UniswapV2RouterABI } from "@/abi/swap";
import { TokenConfig, UNISWAP_CONTRACTS } from "@/config/tokens";
import { useMemo, useState } from "react";
import { Address, encodeFunctionData, parseUnits } from "viem";
import { TransactionCall, useTransaction } from "./useTransaction";

export type SwapProps = {
  amountIn: bigint;
  amountOutMin: bigint;
  toAddress: Address;
  deadline: bigint;
  accountAddress: Address;
  from: TokenConfig;
  shouldApprove?: boolean;
};

export type ApproveSwapProps = {
  from: TokenConfig;
};

export function useSwap() {
  const { execute } = useTransaction();

  const [isPending, setIsPending] = useState<boolean>(false);
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [result, setResult] = useState<any | null>(null);

  async function onApprove(props: ApproveSwapProps) {
    const { from } = props;

    // TOOD: Let the user know that the spending limit is just 50
    const maxAmount = parseUnits("50", from.decimals);

    setResult(null);
    setIsApproved(false);
    setIsPending(true);
    const calls: TransactionCall[] = [];

    calls.push({
      to: from.address,
      data: encodeFunctionData({
        abi: MintableERC20ABI,
        functionName: "approve",
        args: [UNISWAP_CONTRACTS.router, maxAmount],
      }),
    });

    const response = await execute({
      calls,
      requiredPermissions: {
        calls: [from.address.toLowerCase()],
      },
    });

    if (response.success) {
      setIsApproved(true);
    }

    setIsPending(false);
    setResult(response);

    console.log("approve-hook-response:: ", response);
    return response;
  }

  async function onSwap(props: SwapProps) {
    const {
      accountAddress,
      amountIn,
      amountOutMin,
      from,
      toAddress,
      deadline,
      shouldApprove,
    } = props;

    setResult(null);
    setIsPending(true);
    const calls: TransactionCall[] = [];

    // TOOD: Let the user know that the spending limit is just 50
    const maxAmount = parseUnits("50", from.decimals);

    if (shouldApprove) {
      calls.push({
        to: from.address,
        data: encodeFunctionData({
          abi: MintableERC20ABI,
          functionName: "approve",
          args: [UNISWAP_CONTRACTS.router, maxAmount],
        }),
      });
    }

    calls.push({
      to: UNISWAP_CONTRACTS.router,
      data: encodeFunctionData({
        abi: UniswapV2RouterABI,
        functionName: "swapExactTokensForTokens",
        args: [
          amountIn,
          amountOutMin,
          [from.address, toAddress],
          accountAddress,
          deadline,
        ],
      }),
    });

    const response = await execute({
      calls,
      requiredPermissions: {
        calls: [UNISWAP_CONTRACTS.router.toLowerCase()],
      },
    });

    setIsPending(false);
    setResult(response);

    console.log("swap-hook-response:: ", response);
    return response;
  }

  const isSuccess = useMemo(() => {
    return !!result?.success;
  }, [result?.success]);

  const error = useMemo(() => {
    return result?.error;
  }, [result?.error]);

  const errorMessage = useMemo(() => {
    return (
      result?.error?.shortMessage ??
      result?.error?.cause?.shortMessage ??
      result?.error?.message
    );
  }, [result?.error]);

  const data = useMemo(() => {
    return result?.data;
  }, [result?.data]);

  function reset() {
    setResult(null);
  }

  return {
    onSwap,
    onApprove,
    isPending,
    errorMessage,
    isSuccess,
    error,
    data,
    reset,
    isApproved,
  };
}
