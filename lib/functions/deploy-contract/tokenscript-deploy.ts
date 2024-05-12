import type { VerifyContractParams } from "@/lib/functions/types"
import handleImports from "@/lib/functions/deploy-contract/handle-imports"
import { getExplorerUrl } from "@/lib/viem-utils"
import { encodeFunctionData } from "viem"
import { useAccount, usePublicClient, useWalletClient } from "wagmi"
import toast from "react-hot-toast"
import { useGlobalStore } from "@/app/state/global-store"
import { track } from "@vercel/analytics"
import { parseAbiItem } from "viem";
import ipfsStoreFile from "./ipfs-ts-upload"

export function useWriteToIPFS() {
  const { chain: viemChain } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient({
    chainId: viemChain?.id || 5003
  })
  const { setLastDeploymentData, setVerifyContractConfig, lastDeploymentData } = useGlobalStore()

  async function deploy({
    tokenScriptSource
  }: {
    tokenScriptSource: string
  }) {
    if (!viemChain || !walletClient) {
      throw new Error("Wallet not available")
    }

    const tokenAddress = lastDeploymentData?.address;
    const ipfsCid = await ipfsStoreFile(tokenScriptSource);

    const ipfsRoute = [`ipfs://${ipfsCid}`];

    //now set the IPFS route
    const setScriptURIAbi = parseAbiItem('function setScriptURI(string[] memory newScriptURI)');
    let txHash;
    try {
      // Encode the transaction data
      const data = encodeFunctionData({
        abi: [setScriptURIAbi],
        functionName: 'setScriptURI',
        args: [ipfsRoute]
      });

      

      // Send the transaction
    txHash = await walletClient.sendTransaction({
      to: tokenAddress,
      data,
      /*gas: '2000000', // Adjust the gas limit as needed
      gasPrice: '50000000000' // Adjust the gas price as needed*/
    });
  } catch (error) {
    console.log(error)
    return error
  }


    try {
      const transactionReceipt =
        publicClient &&
        (await toast.promise(
          publicClient.waitForTransactionReceipt({
            hash: txHash
          }),
          {
            loading: "Waiting for confirmations...",
            success: "Transaction confirmed!",
            error: "Failed to receive enough confirmations"
          }
        ))

        //now we can generate the viewer URL

        const chainId = await walletClient.getChainId();
        
      return `https://viewer-staging.tokenscript.org/?chain=${chainId}&contract=${tokenAddress}`;
    } catch (error) {
      console.log(error)
    
      return "unable to generate viewer url";
  }
}

  return { deploy }
}
