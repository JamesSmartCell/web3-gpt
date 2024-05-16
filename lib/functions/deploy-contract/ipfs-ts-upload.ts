import { NFTStorage } from "nft.storage"

const NFT_STORAGE_TOKEN = process.env.NEXT_PUBLIC_NFT_STORAGE_API_KEY || ""
const client = new NFTStorage({ token: NFT_STORAGE_TOKEN })

const ipfsStoreFile = async (content: string): Promise<string> => {
  try {
  const cid = await client.storeBlob(new Blob([content]));
  console.log(`CID:  ${cid}`);
  return cid;
  } catch (error) {
    console.error('Error uploading file to IPFS:', error);
    return "";
  }
}

export default ipfsStoreFile
