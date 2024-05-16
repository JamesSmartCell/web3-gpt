import axios from 'axios';
import { API_KEYS, API_URLS } from "@/lib/viem-utils"
import { DEFAULT_GLOBAL_CONFIG } from "@/lib/constants"

const removeQuotes = (input: string): string => {
    return input.replace(/^"|"$/g, '');
  };

const etherscanVerify = async (
    standardJsonInput: string,
    encodedConstructorArgs: string,
    contractName: string,
    contractAddress: string,
    chainId: number): Promise<string> => {

  const apiUrl = API_URLS[chainId]
  const apiKey = removeQuotes(API_KEYS[chainId]);

  try {
    const params = new URLSearchParams();
    params.append('apikey', apiKey);
    params.append('module', 'contract');
    params.append('action', 'verifysourcecode');
    params.append('contractaddress', contractAddress);
    params.append('sourceCode', standardJsonInput);
    params.append('contractname', `${contractName}`);
    params.append('codeformat', 'solidity-standard-json-input');
    params.append('compilerversion', DEFAULT_GLOBAL_CONFIG.compilerVersion);
    params.append("evmversion", "paris");
    params.append('optimizationUsed', "1");
    params.append('runs', "200");

    if (encodedConstructorArgs) {
      params.append("constructorArguements", encodedConstructorArgs)
    }
    const response = await axios.post(apiUrl, params);

    return response.data.result;

  } catch (error) {
    console.error('Error uploading file to IPFS:', error);
    return "";
  }
}

export default etherscanVerify
