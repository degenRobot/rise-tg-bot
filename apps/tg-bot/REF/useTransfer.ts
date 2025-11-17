import { MintableERC20ABI } from "@/abi/erc20";
import { useMemo, useState } from "react";
import { Address, encodeFunctionData } from "viem";
import { TransactionCall, useTransaction } from "./useTransaction";

export type TransferProps = {
  address: Address;
  recipient: Address;
  parsedAmount: bigint;
};

export function useTransfer() {
  console.log("Transfer Hook...");
  const { execute } = useTransaction();

  const [isPending, setIsPending] = useState<boolean>(false);
  const [result, setResult] = useState<any | null>(null);

  async function onTransfer(props: TransferProps) {
    const { address, recipient, parsedAmount } = props;

    setResult(null);
    setIsPending(true);
    const calls: TransactionCall[] = [];

    calls.push({
      to: address, // tokenAddress
      data: encodeFunctionData({
        abi: MintableERC20ABI,
        functionName: "transfer",
        args: [recipient, parsedAmount],
      }),
    });

    const response = await execute({
      calls,
      requiredPermissions: { calls: [address.toLowerCase()] },
    });

    setIsPending(false);
    setResult(response);

    console.log("transfer-hook-response:: ", response);
    return response;
  }

  // 0x8F8faa9eBB54DEda91a62B4FC33550B19B9d33bf - metamask
  // 0x0e18ace8b124aad65e81c439bfecad5abe9eafc4 - riselabs
  // 0xE1C19095790FCe54bC2747B68664D1184288Ebb7 - personal

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

  return {
    onTransfer,
    isPending,
    errorMessage,
    isSuccess,
    error,
    data,
  };
}
