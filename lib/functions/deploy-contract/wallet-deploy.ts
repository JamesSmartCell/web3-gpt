import type { VerifyContractParams } from "@/lib/functions/types"
import handleImports from "@/lib/functions/deploy-contract/handle-imports"
import { getExplorerUrl } from "@/lib/viem-utils"
import { encodeDeployData } from "viem"
import { useAccount, usePublicClient, useWalletClient } from "wagmi"
import toast from "react-hot-toast"
import { useGlobalStore } from "@/app/state/global-store"
import { track } from "@vercel/analytics"
import etherscanVerify from "./etherscan-verify"

export function useDeployWithWallet() {
  const { chain: viemChain } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient({
    chainId: viemChain?.id || 5003
  })
  const { setLastDeploymentData, setVerifyContractConfig } = useGlobalStore()

  async function deploy({
    contractName,
    sourceCode,
    constructorArgs
  }: {
    contractName: string
    sourceCode: string
    constructorArgs: Array<string>
  }) {
    if (!viemChain || !walletClient) {
      throw new Error("Wallet not available")
    }
    const fileName = `${contractName.replace(/[\/\\:*?"<>|.\s]+$/g, "_")}.sol`

    // Prepare the sources object for the Solidity compiler
    //const handleImportsResult = await handleImports(sourceCode)
    const handleImportsResult = await toast.promise(
      handleImports(sourceCode),
      {
        loading: "Preparing Compilation...",
        success: "Compilation prepared",
        error: "Failed to prepare compilation"
      }
    )

    const sources = {
      [fileName]: {
        content: handleImportsResult?.sourceCode
      },
      ...handleImportsResult?.sources
    }
    const sourcesKeys = Object.keys(sources)

    // Loop over each source
    for (const sourceKey of sourcesKeys) {
      let sourceCode = sources[sourceKey].content

      // Find all import statements in the source code
      const importStatements = sourceCode.match(/import\s+["'][^"']+["'];/g) || []

      // Loop over each import statement
      for (const importStatement of importStatements) {
        // Extract the file name from the import statement
        const importPathMatch = importStatement.match(/["']([^"']+)["']/)

        // If no import path is found, continue to the next statement
        if (!importPathMatch) continue

        // Extract the file name from the path
        const importPath = importPathMatch[1]
        const fileName = importPath.split("/").pop() || importPath

        // Check if the file is already in the sources object
        // if (sources[fileName]) continue;

        // Replace the import statement with the new import statement
        sourceCode = sourceCode.replace(importStatement, `import "${fileName}";`)
      }

      // Update the source content in your sources object
      sources[sourceKey].content = sourceCode
    }

    // Compile the contract
    const standardJsonInput = JSON.stringify({
      language: "Solidity",
      sources,
      settings: {
        evmVersion: "paris",
        outputSelection: {
          "*": {
            "*": ["*"]
          }
        },
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    })

    //console.log(`JSON: ${JSON.stringify(standardJsonInput)} : ${contractName}`);

    const compileContractResponse = await toast.promise(
      fetch("/api/compile-contract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          standardJsonInput,
          contractName
        })
      }),
      {
        loading: "Compiling contract...",
        success: "Compliation successful!",
        error: "Compilation Failed. Please try the Regenerate button in the chat below"
      }
    )

    /*let compileToast = toast.loading("Compiling token contract...");

    const compileContractResponse = await fetch("/api/compile-contract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        standardJsonInput,
        contractName
      })
    })*/

    const compileResult = await compileContractResponse.json()
    const { abi, bytecode } = compileResult;

    //toast.remove(compileToast);

    const parsedConstructorArgs = constructorArgs.map((arg) => {
      if (arg.startsWith("[") && arg.endsWith("]")) {
        // Check if the string doesn't have double or single quotes after '[' and before ']'
        if (arg.match(/(?<=\[)(?=[^"'])(.*)(?<=[^"'])(?=\])/g)) {
          // Split the string by commas and remove the brackets
          const elements = arg.slice(1, -1).split(",")

          // Trim each element to remove extra spaces and return as an array
          return elements.map((item) => item.trim())
        }
      }

      // Try parsing as JSON, or return the original argument
      try {
        return JSON.parse(arg)
      } catch {
        toast.error("Compilation Failed. Please try the Regenerate button in the chat below");
        return arg
      }
    })

    const deployData = encodeDeployData({
      abi: abi,
      bytecode: bytecode,
      args: parsedConstructorArgs
    })

    const [account] = await walletClient.getAddresses()

  
    const deployHash = await toast.promise(
      walletClient.deployContract({
        abi: abi,
        bytecode: bytecode,
        account: account,
        args: parsedConstructorArgs
      }),
      {
        loading: "Sending deploy transaction...",
        success: "Deploy transaction submitted!",
        error: "Failed to deploy contract"
      }
    )

    /*const ipfsUploadResponse = await fetch("/api/ipfs-upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sources,
        abi,
        bytecode,
        standardJsonInput
      })
    })*/

    //const ipfsCid = await ipfsUploadResponse.json()
    const ipfsUrl = `https://nftstorage.link/ipfs/`

    const encodedConstructorArgs = deployData.slice(bytecode.length)

    const verifyContractConfig: VerifyContractParams = {
      deployHash,
      standardJsonInput,
      encodedConstructorArgs,
      fileName,
      contractName,
      viemChain
    }

    setVerifyContractConfig(verifyContractConfig)

  
    const txHashExplorerUrl = `${getExplorerUrl(viemChain)}/tx/${deployHash}`

    track("deployed_contract", {
      contractName,
      explorerUrl: txHashExplorerUrl
    })

    try {
      const transactionReceipt =
        publicClient &&
        (await toast.promise(
          publicClient.waitForTransactionReceipt({
            hash: verifyContractConfig?.deployHash
          }),
          {
            loading: "Waiting for confirmations...",
            success: "Transaction confirmed!",
            error: "Failed to receive enough confirmations"
          }
        ))
      const address = transactionReceipt?.contractAddress || undefined

      const deploymentData = {
        address,
        transactionHash: deployHash,
        ipfsUrl,
        explorerUrl: txHashExplorerUrl,
        verificationStatus: "pending",
        standardJsonInput,
        abi,
        sourceCode
      }

      //manually verify here, since we can't use the in-line chat method when deploying from wallet
      const verifyContractResponse = await etherscanVerify(standardJsonInput, encodedConstructorArgs, contractName, address!, viemChain.id);
      console.log("verifyContractResponse", verifyContractResponse);

      setLastDeploymentData(deploymentData)
      console.log("deploymentData form wallet-deploy", deploymentData)
      return deploymentData
    } catch (error) {
      console.log(error)
      const deploymentData = {
        transactionHash: deployHash,
        explorerUrl: txHashExplorerUrl,
        ipfsUrl,
        verificationStatus: "pending",
        standardJsonInput,
        abi,
        sourceCode
      }
      setLastDeploymentData(deploymentData)
      return deploymentData
    }
  }

  return { deploy }
}
