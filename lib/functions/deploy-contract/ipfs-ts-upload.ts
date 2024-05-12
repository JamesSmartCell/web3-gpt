import { NFTStorage } from "nft.storage"

const NFT_STORAGE_TOKEN = process.env.NEXT_PUBLIC_NFT_STORAGE_API_KEY || ""
const client = new NFTStorage({ token: NFT_STORAGE_TOKEN })

const ipfsStoreFile = async (content: string): Promise<string> => {
  const cid = await client.storeBlob(new Blob([content]));
  return cid;
}

export default ipfsStoreFile
