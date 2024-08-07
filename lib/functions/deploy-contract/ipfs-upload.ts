import { NFTStorage, File } from "nft.storage"

const NFT_STORAGE_TOKEN = process.env.NEXT_PUBLIC_NFT_STORAGE_API_KEY || ""
const client = new NFTStorage({ token: NFT_STORAGE_TOKEN })

const ipfsUpload = async (
  sources: { [fileName: string]: { content: string } },
  abi: string,
  bytecode: string,
  standardJsonInput: string
): Promise<string> => {
  const files = []

  for (const key in sources) {
    const contractCode = new File([sources[key].content], `${key}`, {
      type: "text/x-solidity"
    })
    files.push(contractCode)
  }

  const abiFile = new File([abi], "abi.json", { type: "application/json" })
  const bytecodeFile = new File([bytecode], "bytecode.txt", {
    type: "text/plain"
  })
  const standardJsonInputFile = new File([standardJsonInput], "standardJsonInput.json", { type: "application/json" })

  files.push(abiFile, bytecodeFile, standardJsonInputFile)

  //const cid = await client.storeDirectory(files)
  const cid = ""; // don't store to IPFS

  return cid
}

export default ipfsUpload
