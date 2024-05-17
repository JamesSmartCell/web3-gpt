import axios from 'axios';
import FormData from 'form-data';
import { Readable } from 'stream';

const stringToBlob = (input: string): Blob => {
  const buffer = Buffer.from(input, 'utf-8');
  return new Blob([buffer], { type: 'text/plain' });
};

const ipfsStoreFilePin = async (content: string) => {
  const apiKey = process.env.NEXT_PUBLIC_PINATA_API_KEY || "";
  const secretApiKey = process.env.NEXT_PUBLIC_PINATA_SECRET_API_KEY || "";
  const secretApiBearer = process.env.NEXT_PUBLIC_PINATA_SECRET_API_BEARER || "";

  const url = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

  try {
    const data = new FormData();
    const buffer = Buffer.from(content, 'utf-8');
    const blob = stringToBlob(content);

    //TypeError: Failed to execute 'append' on 'FormData': parameter 2 is not of type 'Blob'.
  
    data.append('file', blob, {
      filename: 'content.txt',
      contentType: 'text/plain',
      knownLength: buffer.length
    });
  
    try {
      const response = await axios.post(url, data, {
        headers: {
          'Content-Type': `multipart/form-data;`,
          pinata_api_key: apiKey,
          pinata_secret_api_key: secretApiKey,
        },
      });
    
      return response.data.IpfsHash;
  } catch (error) {
    console.error('Error writing to temporary file:', error);
  }
} catch (error) {
  console.error('Error uploading file to IPFS:', error);  
}
}
  

export default ipfsStoreFilePin;
