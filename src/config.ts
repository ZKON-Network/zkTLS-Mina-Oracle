import * as dotenv from 'dotenv';
dotenv.config();

interface ENV {
    CONTRACT_ADDRESS: string | undefined;
    MINA_ADDRESS: string| undefined;
    NODE_URI: string| undefined;
    MAX_BLOCKS_TO_CHECK: number| undefined;
    PRIVATE_KEY: string| undefined;
    IPFS_GATEWAY: string| undefined;
    USE_CUSTOM_LOCAL_NETWORK:string| undefined;
}

interface Config {
    CONTRACT_ADDRESS: string;
    MINA_ADDRESS: string;
    NODE_URI: string;
    MAX_BLOCKS_TO_CHECK: number;
    PRIVATE_KEY: string;
    IPFS_GATEWAY: string;
    USE_CUSTOM_LOCAL_NETWORK:string;
}

const getConfig = (): ENV => {
    return {
        CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS,
        MINA_ADDRESS: process.env.MINA_ADDRESS,
        NODE_URI: process.env.NODE_URI,
        MAX_BLOCKS_TO_CHECK: process.env.MAX_BLOCKS_TO_CHECK? Number(process.env.MAX_BLOCKS_TO_CHECK) : undefined,
        PRIVATE_KEY:process.env.PRIVATE_KEY,
        IPFS_GATEWAY: process.env.IPFS_GATEWAY,
        USE_CUSTOM_LOCAL_NETWORK: process.env.USE_CUSTOM_LOCAL_NETWORK
    };
  };
  
const getSanitzedConfig = (config: ENV): Config => {
    for (const [key, value] of Object.entries(config)) {
      if (value === undefined) {
        throw new Error(`Missing key ${key} in config.env`);
      }
    }
    return config as Config;
};

const config = getConfig();
const sanitizedConfig = getSanitzedConfig(config);

export default sanitizedConfig;