"use client"

import { usePathname, useRouter } from "next/navigation"
import { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types"
import type { ChatRequest, FunctionCallHandler } from "ai"
import { useChat, type Message } from "ai/react"
import toast from "react-hot-toast"

import { cn } from "@/lib/utils"
import { ChatList } from "@/components/chat-list"
import { ChatPanel } from "@/components/chat-panel"
import { ChatScrollAnchor } from "@/components/chat-scroll-anchor"
import { nanoid } from "@/lib/utils"
import { functionSchemas } from "@/lib/functions/schemas"
import { Landing } from "@/components/landing"
import { useGlobalStore } from "@/app/state/global-store"
import { useW3GPTDeploy } from "@/lib/hooks/use-w3gpt-deploy"
import { useAccount, useChains } from "wagmi"
import { use, useEffect } from "react"

export interface ChatProps extends React.ComponentProps<"div"> {
  initialMessages?: Message[]
  id?: string
  showLanding?: boolean
  avatarUrl?: string | null | undefined
}

export function Chat({ id, initialMessages, className, showLanding = false, avatarUrl }: ChatProps) {
  const router = useRouter()
  const path = usePathname()
  const isChatPage = path.includes("chat")
  const {
    setIsGenerating,
    setIsDeploying,
    setDeployContractConfig,
    verifyContractConfig,
    lastDeploymentData,
    tokenScriptViewerUrl,
    setLastDeploymentData
  } = useGlobalStore()
  const supportedChains = useChains()
  const { chain } = useAccount()
  const isSupportedChain = !!(chain && supportedChains.find((c) => c.id === chain.id))
  const activeChainId = isSupportedChain ? chain.id : 5003
  const { deploy } = useW3GPTDeploy({ chainId: activeChainId })

  useEffect(() => {
    if (lastDeploymentData) {
      console.log("new deployment detected ", lastDeploymentData)
      append({
        id: nanoid(),
        role: "system",
        content: `The user has successfully deployed a contract manually here are the details: \n\n${JSON.stringify(lastDeploymentData, null, 2)}`
      })
    }
  }, [lastDeploymentData])

  useEffect(() => {
    if (tokenScriptViewerUrl) {
      append({
        id: nanoid(),
        role: "system",
        content: `The user has set the scriptURI and dpeloyed the TokenScript here are the details for you to share with the user: \n\n${JSON.stringify(tokenScriptViewerUrl, null, 2)}`
      })
    }
  }, [tokenScriptViewerUrl])
      

  useEffect(() => {
    let isMounted = true

    async function verifyContract() {
      if (!verifyContractConfig?.deployHash || lastDeploymentData?.verificationStatus === "success") {
        return
      }

      try {
        const response = await fetch("/api/verify-contract", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(verifyContractConfig)
        })

        const data = await response.json()

        if (typeof data === "string" && data.startsWith("0x") && isMounted) {
          toast.success("Contract verified successfully!")
          lastDeploymentData &&
            setLastDeploymentData({
              ...lastDeploymentData,
              verificationStatus: "success"
            })
        } else {
          setTimeout(verifyContract, 15000) // Retry after 15 seconds
        }
      } catch (error) {
        console.error("Verification failed", error)
        setTimeout(verifyContract, 15000) // Retry after 15 seconds
      }
    }

    verifyContract()

    return () => {
      isMounted = false
    }
  }, [lastDeploymentData, verifyContractConfig, setLastDeploymentData])

  const functionCallHandler: FunctionCallHandler = async (chatMessages, functionCall) => {
    if (functionCall.name === "deploy_contract") {
      setIsDeploying(true)
      const { chainId, contractName, sourceCode, constructorArgs } = JSON.parse(functionCall.arguments || "{}")

      setDeployContractConfig({
        chainId: chainId || activeChainId,
        contractName,
        sourceCode,
        constructorArgs
      })
      console.log("Deploying contract")
      const verifiedContractAddress = await deploy({
        chainId: chainId || activeChainId,
        contractName,
        sourceCode,
        constructorArgs
      })

      const functionResponse: ChatRequest = {
        messages: [
          ...chatMessages,
          {
            id: nanoid(),
            name: "deploy_contract",
            role: "function",
            content: JSON.stringify({ verifiedContractAddress })
          }
        ],
        functions: functionSchemas
      }
      return functionResponse
    }
    if (functionCall.name === "text_to_image") {
      const response = await fetch("/api/text-to-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: functionCall.arguments })
      })
      if (!response.ok) {
        throw new Error(response.statusText)
      }
      const { imageUrl, metadataUrl } = await response.json()

      const functionResponse: ChatRequest = {
        messages: [
          ...chatMessages,
          {
            id: nanoid(),
            name: "text-to-image",
            role: "function",
            content: JSON.stringify({ imageUrl, metadataUrl })
          }
        ],
        functions: functionSchemas
      }
      return functionResponse
    }
  }

  const { messages, append, reload, stop, isLoading, input, setInput } = useChat({
    experimental_onFunctionCall: functionCallHandler,
    initialMessages,
    id,
    body: {
      id
    },
    onResponse(response) {
      setIsGenerating(true)
      if (!isChatPage) {
        router.prefetch(`/chat/${id}`, {
          kind: PrefetchKind.FULL
        })
      }
      if (response.status === 401) {
        toast.error(response.statusText)
      }
    },
    onFinish() {
      setIsGenerating(false)
      if (!isChatPage) {
        history.pushState({}, "", `/chat/${id}`)
        history.go(1)
      }
    }
  })


  return (
    <>
      <div className={cn("px-4 pb-[200px] pt-4 md:pt-10", className)}>
        {showLanding && <Landing disableAnimations={isChatPage} />}
        <ChatList isLoading={isLoading} messages={messages} avatarUrl={avatarUrl} />
        <ChatScrollAnchor trackVisibility={isLoading} />
      </div>
      <ChatPanel
        id={id}
        stop={stop}
        isLoading={isLoading}
        append={append}
        reload={reload}
        messages={messages}
        input={input}
        setInput={setInput}
      />
    </>
  )
}
