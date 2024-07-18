import { Mina, PublicKey, PrivateKey, Field, Bytes, Hash, verify,Struct, provablePure, fetchEvents, AccountUpdate, fetchAccount} from 'o1js';
import { p256 } from '@noble/curves/p256';
import { hexToBytes, bytesToHex } from '@noble/hashes/utils';
import axios from 'axios';
import https from 'https';
import * as fs from 'fs';
import { StringCircuitValue } from './String.js';
import {numToUint8Array,concatenateUint8Arrays} from './utils.js';
import * as path from 'path'
import config from './config.js';

//import {ZkonZkProgram, P256Data, PublicArgumets} from 'zkon-zkapp';
import {ZkonZkProgramTest, P256Data, PublicArgumets} from './zkProgram.js';

import { createRequire } from "node:module"
const Verifier = createRequire(import.meta.url)("../verifier/index.node")

// SSL Check disabled.
const agent = new https.Agent({
    rejectUnauthorized: false
});

const sleep = async (ms:any) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

const pemData = fs.readFileSync('./notary.pub', 'utf-8');

const transactionFee = 100_000_000;
const useCustomLocalNetwork = process.env.USE_CUSTOM_LOCAL_NETWORK === 'true';  
console.log(useCustomLocalNetwork
    ? 'http://localhost:8080/graphql'
    : 'https://api.minascan.io/node/devnet/v1/graphql');
const network = Mina.Network({
  mina: useCustomLocalNetwork
    ? 'http://localhost:8080/graphql'
    : 'https://api.minascan.io/node/devnet/v1/graphql',
  lightnetAccountManager: 'http://localhost:8181',
  // archive: useCustomLocalNetwork
  // ? '' : 'https://api.minascan.io/archive/devnet/v1/graphql',
});
Mina.setActiveInstance(network);

// const senderKey = PrivateKey.fromBase58(process.env.MINA_PRIVATE_KEY!);
// const sender = senderKey.toPublicKey();

const getZkAppInstance = async (filePath: string) => {
    try {
        (global as any).self = global;
        const zkApp = await import(path.resolve(filePath));
        console.log(zkApp);
        if (zkApp && typeof zkApp.default === 'function') {
            return zkApp.default;
        } else {
            throw new Error('The zkApp does not export a default function.');
        }
    } catch (error) {
        throw new Error(`Error executing zkApp: ${(error as any).message}`);
    }
}

const main = async () => {
    while(true) {

        const Network = Mina.Network({
            mina: 'https://api.minascan.io/node/devnet/v1/graphql',
            archive: 'https://api.minascan.io/archive/devnet/v1/graphql',
        });
        Mina.setActiveInstance(Network);        

        const blockNr = 0 //ToDo: Check how to get last block number
        const fromBlock = blockNr;
        const toBlock = (blockNr >= config.MAX_BLOCKS_TO_CHECK) ? (blockNr) - config.MAX_BLOCKS_TO_CHECK: 0;

        const address:any = config.MINA_ADDRESS;
        console.log(address);
        const logs = await fetchEvents({
            publicKey: address,
          });
        console.log('Events found: ', logs.length);
        for (const log of logs) {
            const fieldHash1 = Field(log.events[0].data[2]);
            const fieldHash2 = Field(log.events[0].data[3]);
            const hash1 = StringCircuitValue.fromField(fieldHash1).toString().replace(/\0/g, '')
            const hash2 = StringCircuitValue.fromField(fieldHash2).toString().replace(/\0/g, '')
        
            const ipfsHashFile = hash1.concat(hash2);
            //const ipfsHashFile = "QmbCpnprEGiPZfESXkbXmcXcBEt96TZMpYAxsoEFQNxoEV"; //Mock JSON Request
            //Fetch JSON from IPFS            
            let requestObjetct = (await axios.get(`${config.IPFS_GATEWAY}${ipfsHashFile}`)).data;
            
            requestObjetct.baseURL = "r-api.e-grains.com/v1/esoy/info"; // ToDo: Remove
            requestObjetct.path = "data,availableSupply"; // ToDO: Remove
            const proofObject ={
                method: 'GET',
                baseURL: requestObjetct.baseURL.slice(0, (requestObjetct.baseURL.indexOf('com')+3)),
                path: requestObjetct.baseURL.slice((requestObjetct.baseURL.indexOf('com')+4))
            }

            let zkAppCode = requestObjetct.zkapp;
            const __dirname = import.meta.dirname;
            const dir = __dirname+'/tmp/zkon-zkapps';
            const filename = 'zkapp-'+parseInt((Math.random() * 100000000000000).toString())+'.js';
            if (!fs.existsSync(dir)){
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(dir + '/' + filename, zkAppCode);
            // const zkapp = await getZkAppInstance(dir+'/'+filename);
            /*const zkapp = await getZkAppInstance(dir+'/zkonrequest.js');
            // const zkapp = await getZkAppInstance(dir+'/bundle.cjs');
            await fetchAccount({publicKey: config.MINA_ADDRESS});
            await fetchAccount({publicKey: config.ZK_REQUESTS_ADDRESS});
            // await zkapp.compile();
            const zkappInstance = new zkapp(config.ZK_REQUESTS_ADDRESS);
            console.log(zkappInstance)*/
            // console.log(zkapp);
            /*let senderKey = PrivateKey.fromBase58(config.MINA_PRIVATE_KEY!);
            let sender = senderKey.toPublicKey();

            const proof = null; // ToDO 
            let transaction = await Mina.transaction(
                { sender , fee: transactionFee },
                async () => {
                    // await zkappInstance.receiveZkonResponse(Field(1), proof);
                }
                );*/

            /* Suggestion: Can we structure the IPFS as follows? 
            IPFS={
                method: ...,
                baseURL: api.coingecko.com
                apiEndpoitn: /api/v3/coins/bitcoin
                zkapp: 
            }
            */
            
            console.time('Execution of Request to TLSN Client & Proof Generation');
            //const res = (await axios.post('https://127.0.0.1:5000/proof',proofObject, { httpsAgent: agent })).data;
            //const {notary_proof,CM} = res;

            const {notary_proof,CM} = JSON.parse('{"notary_proof":{"session":{"header":{"encoder_seed":[190,34,198,91,116,79,58,47,109,176,195,30,95,183,18,61,201,252,181,36,200,126,98,216,106,176,215,129,156,167,32,9],"merkle_root":[245,211,119,252,21,143,114,104,90,118,9,156,124,32,175,236,167,73,178,6,200,92,126,18,49,28,60,208,119,131,89,130],"sent_len":256,"recv_len":960,"handshake_summary":{"time":1721299849,"server_public_key":{"group":"secp256r1","key":[4,94,234,237,29,101,198,179,48,62,134,150,249,193,189,131,221,202,234,4,125,205,142,72,9,240,14,32,82,74,220,200,26,7,123,148,135,58,223,249,150,252,30,139,13,147,22,132,139,197,134,128,132,133,192,115,56,57,51,40,180,18,219,97,152]},"handshake_commitment":[122,37,112,246,36,95,247,23,234,21,43,2,161,161,188,50,126,172,146,211,69,228,40,55,222,237,67,45,172,131,235,165]}},"signature":{"P256":"E158B0250E5F1070A07378F8AE847CD7E46FB5C5553A4FA3EA2861E28D267F72A3572292F38B6455F6993E433793065ABDC366503B45515A0DBDB2E3D73C2392"},"session_info":{"server_name":{"Dns":"r-api.e-grains.com"},"handshake_decommitment":{"nonce":[123,25,164,91,44,248,31,134,48,52,118,45,160,174,229,115,245,42,223,197,216,154,32,50,178,241,10,226,152,177,17,18],"data":{"server_cert_details":{"cert_chain":[[48,130,4,243,48,130,3,219,160,3,2,1,2,2,18,3,86,24,36,58,70,89,221,164,227,84,51,227,46,70,210,114,36,48,13,6,9,42,134,72,134,247,13,1,1,11,5,0,48,51,49,11,48,9,6,3,85,4,6,19,2,85,83,49,22,48,20,6,3,85,4,10,19,13,76,101,116,39,115,32,69,110,99,114,121,112,116,49,12,48,10,6,3,85,4,3,19,3,82,49,48,48,30,23,13,50,52,48,55,48,54,49,57,53,55,53,55,90,23,13,50,52,49,48,48,52,49,57,53,55,53,54,90,48,29,49,27,48,25,6,3,85,4,3,19,18,114,45,97,112,105,46,101,45,103,114,97,105,110,115,46,99,111,109,48,130,1,34,48,13,6,9,42,134,72,134,247,13,1,1,1,5,0,3,130,1,15,0,48,130,1,10,2,130,1,1,0,180,175,138,72,176,221,39,134,139,218,105,224,189,161,183,218,33,193,234,189,127,1,93,220,110,252,19,120,56,243,171,100,103,43,152,114,6,182,167,107,129,54,237,247,202,102,91,97,152,59,18,166,101,72,221,225,95,182,215,34,159,43,208,16,254,59,90,4,18,158,71,107,114,29,76,222,32,213,149,154,201,31,160,91,220,107,198,217,151,176,158,129,7,249,87,207,120,155,179,245,63,61,22,227,115,186,14,230,74,54,22,239,67,36,219,70,79,227,81,18,89,93,159,185,92,61,6,59,173,77,213,61,197,86,100,101,16,33,15,20,161,130,172,237,72,23,166,61,129,28,23,144,98,92,151,58,16,236,215,227,151,214,115,235,150,158,79,117,62,170,77,146,227,19,76,168,58,147,94,77,16,104,58,219,99,119,14,25,15,154,211,246,234,247,46,204,152,183,181,148,132,169,49,184,11,146,255,71,68,108,28,113,61,237,2,192,8,108,8,44,244,133,245,65,126,249,0,192,116,82,238,23,128,174,160,162,26,71,138,77,160,219,64,71,136,205,153,52,243,69,79,236,207,42,136,15,2,3,1,0,1,163,130,2,21,48,130,2,17,48,14,6,3,85,29,15,1,1,255,4,4,3,2,5,160,48,29,6,3,85,29,37,4,22,48,20,6,8,43,6,1,5,5,7,3,1,6,8,43,6,1,5,5,7,3,2,48,12,6,3,85,29,19,1,1,255,4,2,48,0,48,29,6,3,85,29,14,4,22,4,20,6,117,81,35,168,108,49,135,64,128,157,231,126,73,98,143,253,135,52,244,48,31,6,3,85,29,35,4,24,48,22,128,20,187,188,195,71,165,228,188,169,198,195,164,114,12,16,141,162,53,225,200,232,48,87,6,8,43,6,1,5,5,7,1,1,4,75,48,73,48,34,6,8,43,6,1,5,5,7,48,1,134,22,104,116,116,112,58,47,47,114,49,48,46,111,46,108,101,110,99,114,46,111,114,103,48,35,6,8,43,6,1,5,5,7,48,2,134,23,104,116,116,112,58,47,47,114,49,48,46,105,46,108,101,110,99,114,46,111,114,103,47,48,29,6,3,85,29,17,4,22,48,20,130,18,114,45,97,112,105,46,101,45,103,114,97,105,110,115,46,99,111,109,48,19,6,3,85,29,32,4,12,48,10,48,8,6,6,103,129,12,1,2,1,48,130,1,3,6,10,43,6,1,4,1,214,121,2,4,2,4,129,244,4,129,241,0,239,0,117,0,63,23,75,79,215,34,71,88,148,29,101,28,132,190,13,18,237,144,55,127,31,133,106,235,193,191,40,133,236,248,100,110,0,0,1,144,137,214,219,253,0,0,4,3,0,70,48,68,2,32,115,201,246,86,82,203,183,208,99,65,155,53,144,196,234,59,238,245,27,181,237,15,148,4,224,24,206,205,29,213,244,208,2,32,100,236,86,172,75,101,160,222,98,164,167,38,73,176,33,63,127,13,207,245,93,212,18,11,253,26,173,244,197,1,243,224,0,118,0,118,255,136,63,10,182,251,149,81,194,97,204,245,135,186,52,180,164,205,187,41,220,104,66,10,159,230,103,76,90,58,116,0,0,1,144,137,214,220,73,0,0,4,3,0,71,48,69,2,33,0,169,150,179,72,251,52,143,51,222,67,98,217,229,180,127,161,161,227,224,7,68,80,193,10,71,213,91,203,202,42,109,188,2,32,92,140,107,235,73,242,48,75,241,209,241,101,31,0,107,11,92,71,71,187,81,133,245,218,191,205,173,74,13,70,111,98,48,13,6,9,42,134,72,134,247,13,1,1,11,5,0,3,130,1,1,0,43,142,224,215,2,208,202,91,188,109,22,229,35,148,177,244,120,74,210,197,27,213,176,50,185,124,215,172,174,99,228,250,80,179,200,231,58,102,176,182,97,177,120,75,57,250,77,12,220,115,62,199,165,21,193,34,114,41,158,168,100,58,81,200,133,220,8,161,50,228,134,241,88,163,2,37,12,123,78,60,119,83,202,193,204,159,147,42,125,213,197,251,184,22,127,94,73,224,67,178,50,64,170,79,159,248,212,98,143,142,106,150,70,119,59,164,75,244,254,209,229,199,175,150,17,252,168,87,227,7,143,63,137,164,213,15,180,185,147,145,244,195,218,207,137,160,153,29,194,120,161,95,198,202,34,6,139,52,108,131,46,80,5,98,202,61,144,196,28,18,105,185,129,163,206,11,243,196,131,168,138,144,158,250,26,101,110,42,83,193,198,181,145,185,55,180,149,155,243,154,161,194,39,181,163,101,81,220,145,16,222,157,145,244,195,249,207,142,253,174,209,90,177,144,207,107,47,209,112,127,96,161,194,133,36,163,195,104,206,158,64,242,109,168,180,201,36,208,119,221,146,42,174,83,188,182],[48,130,5,5,48,130,2,237,160,3,2,1,2,2,16,75,168,82,147,247,154,47,162,115,6,75,168,4,141,117,208,48,13,6,9,42,134,72,134,247,13,1,1,11,5,0,48,79,49,11,48,9,6,3,85,4,6,19,2,85,83,49,41,48,39,6,3,85,4,10,19,32,73,110,116,101,114,110,101,116,32,83,101,99,117,114,105,116,121,32,82,101,115,101,97,114,99,104,32,71,114,111,117,112,49,21,48,19,6,3,85,4,3,19,12,73,83,82,71,32,82,111,111,116,32,88,49,48,30,23,13,50,52,48,51,49,51,48,48,48,48,48,48,90,23,13,50,55,48,51,49,50,50,51,53,57,53,57,90,48,51,49,11,48,9,6,3,85,4,6,19,2,85,83,49,22,48,20,6,3,85,4,10,19,13,76,101,116,39,115,32,69,110,99,114,121,112,116,49,12,48,10,6,3,85,4,3,19,3,82,49,48,48,130,1,34,48,13,6,9,42,134,72,134,247,13,1,1,1,5,0,3,130,1,15,0,48,130,1,10,2,130,1,1,0,207,87,229,230,196,84,18,237,180,71,254,201,39,88,118,70,80,40,140,29,62,136,223,5,157,213,181,24,41,189,221,181,90,191,250,246,206,163,190,175,0,33,75,98,90,90,60,1,47,197,88,3,246,137,255,142,17,67,235,193,181,224,20,7,150,143,111,31,215,231,186,129,57,9,117,101,183,194,175,24,91,55,38,40,231,163,244,7,43,109,26,255,171,88,188,149,174,64,255,233,203,87,196,181,91,127,120,13,24,97,188,23,231,84,198,187,73,145,205,110,24,209,128,133,238,166,101,54,188,116,234,188,80,76,234,252,33,243,56,22,147,148,186,176,211,107,56,6,205,22,18,122,202,82,117,200,173,118,178,194,156,93,152,69,92,111,97,123,198,45,238,60,19,82,134,1,217,87,230,56,28,223,141,181,31,146,145,154,231,74,28,204,69,168,114,85,240,176,230,163,7,236,253,167,27,102,158,63,72,139,113,132,113,88,201,58,250,239,94,242,91,68,43,60,116,231,143,178,71,193,7,106,205,154,183,13,150,247,18,129,38,81,84,10,236,97,246,247,245,226,242,138,200,149,13,141,2,3,1,0,1,163,129,248,48,129,245,48,14,6,3,85,29,15,1,1,255,4,4,3,2,1,134,48,29,6,3,85,29,37,4,22,48,20,6,8,43,6,1,5,5,7,3,2,6,8,43,6,1,5,5,7,3,1,48,18,6,3,85,29,19,1,1,255,4,8,48,6,1,1,255,2,1,0,48,29,6,3,85,29,14,4,22,4,20,187,188,195,71,165,228,188,169,198,195,164,114,12,16,141,162,53,225,200,232,48,31,6,3,85,29,35,4,24,48,22,128,20,121,180,89,230,123,182,229,228,1,115,128,8,136,200,26,88,246,233,155,110,48,50,6,8,43,6,1,5,5,7,1,1,4,38,48,36,48,34,6,8,43,6,1,5,5,7,48,2,134,22,104,116,116,112,58,47,47,120,49,46,105,46,108,101,110,99,114,46,111,114,103,47,48,19,6,3,85,29,32,4,12,48,10,48,8,6,6,103,129,12,1,2,1,48,39,6,3,85,29,31,4,32,48,30,48,28,160,26,160,24,134,22,104,116,116,112,58,47,47,120,49,46,99,46,108,101,110,99,114,46,111,114,103,47,48,13,6,9,42,134,72,134,247,13,1,1,11,5,0,3,130,2,1,0,146,177,231,65,55,235,121,157,129,230,205,226,37,225,58,32,233,144,68,149,163,129,92,207,195,93,253,189,160,112,213,177,150,40,34,11,210,242,40,207,12,231,212,230,67,140,36,34,29,193,66,146,209,9,175,159,75,244,200,112,79,32,22,177,90,221,1,246,31,248,31,97,107,20,39,176,114,141,99,174,238,226,206,75,207,55,221,187,163,212,205,231,173,80,173,189,191,227,236,62,98,54,112,153,49,167,232,141,221,234,98,226,18,174,245,156,212,61,44,12,170,208,156,121,190,234,61,92,68,110,150,49,99,90,125,214,126,79,36,160,75,5,127,94,111,210,212,234,95,51,75,19,214,87,182,202,222,81,184,93,163,9,130,116,253,199,120,158,179,185,172,22,218,74,43,150,195,182,139,98,143,249,116,25,162,158,3,222,233,111,155,176,15,210,160,90,246,133,92,194,4,183,200,213,78,50,196,191,4,93,188,41,246,247,129,143,12,93,60,83,201,64,144,139,251,182,8,101,185,164,33,213,9,229,19,132,132,55,130,206,16,40,252,118,194,6,37,122,70,82,77,218,83,114,164,39,63,98,112,172,190,105,72,0,251,103,15,219,91,161,232,215,3,33,45,215,201,246,153,66,57,131,67,223,119,10,18,8,241,37,214,186,148,25,84,24,136,165,197,142,225,26,153,147,121,107,236,28,249,49,64,176,204,50,0,223,159,94,231,180,146,171,144,130,145,141,13,224,30,149,186,89,59,46,75,95,194,183,70,53,82,57,6,192,189,170,172,82,193,34,160,68,151,153,247,12,160,33,167,161,108,113,71,22,23,1,104,192,202,166,38,101,4,124,179,174,201,231,148,85,194,111,155,60,28,169,249,46,197,32,26,240,118,224,190,236,24,214,79,216,37,251,118,17,232,191,230,33,15,232,232,204,181,182,167,213,184,247,159,65,207,97,34,70,106,131,182,104,151,46,124,234,78,149,219,35,235,46,200,43,40,132,164,96,233,73,244,68,46,59,249,202,98,87,1,226,93,144,22,249,201,252,122,35,72,142,166,213,129,114,241,40,250,93,206,251,237,78,115,143,148,46,210,65,148,152,153,219,167,175,112,95,245,190,251,2,32,191,102,39,108,180,173,250,117,18,11,43,62,206,3,158]],"ocsp_response":[],"scts":null},"server_kx_details":{"kx_params":[3,0,23,65,4,94,234,237,29,101,198,179,48,62,134,150,249,193,189,131,221,202,234,4,125,205,142,72,9,240,14,32,82,74,220,200,26,7,123,148,135,58,223,249,150,252,30,139,13,147,22,132,139,197,134,128,132,133,192,115,56,57,51,40,180,18,219,97,152],"kx_sig":{"scheme":"RSA_PSS_SHA512","sig":[42,166,188,28,158,112,170,199,99,73,94,50,29,23,96,164,150,52,5,9,1,48,162,177,154,152,163,109,180,213,58,200,174,209,181,88,204,62,74,189,55,22,209,110,47,53,236,26,255,114,183,138,114,171,20,115,37,25,213,203,126,4,220,51,70,148,7,98,200,208,159,172,231,83,30,123,83,199,251,14,154,23,90,125,201,8,143,102,9,16,102,11,220,147,96,44,32,11,121,113,126,234,82,46,221,222,219,169,242,33,112,120,98,93,121,161,65,115,208,230,48,36,76,222,16,23,53,157,203,92,189,116,174,97,89,202,29,171,198,139,36,40,87,101,27,108,202,156,121,15,108,213,14,48,78,148,154,38,97,52,189,201,212,233,212,22,232,22,207,186,149,247,244,214,65,128,109,130,119,151,103,97,181,63,239,24,22,157,32,179,108,230,98,24,32,112,94,16,102,212,48,218,2,114,160,91,210,111,217,110,161,76,31,75,80,247,36,123,238,188,134,8,71,30,248,117,125,136,45,187,5,58,168,145,122,110,87,155,140,105,49,188,154,211,30,228,126,102,83,195,210,126,211,125,221,201]}},"client_random":[75,10,249,198,8,68,80,21,192,161,75,250,161,198,22,139,209,255,112,133,114,147,50,94,102,124,27,233,96,39,43,202],"server_random":[240,184,46,39,95,153,203,86,174,193,228,99,218,62,213,80,123,177,175,16,254,52,215,38,68,79,87,78,71,82,68,1]}}}},"substrings":{"openings":{"0":[{"kind":"Blake3","ranges":[{"start":0,"end":256}],"direction":"Sent"},{"Blake3":{"data":[71,69,84,32,104,116,116,112,115,58,47,47,114,45,97,112,105,46,101,45,103,114,97,105,110,115,46,99,111,109,47,118,49,47,101,115,111,121,47,105,110,102,111,32,72,84,84,80,47,49,46,49,13,10,104,111,115,116,58,32,114,45,97,112,105,46,101,45,103,114,97,105,110,115,46,99,111,109,13,10,97,99,99,101,112,116,58,32,42,47,42,13,10,97,99,99,101,112,116,45,101,110,99,111,100,105,110,103,58,32,105,100,101,110,116,105,116,121,13,10,99,111,110,110,101,99,116,105,111,110,58,32,99,108,111,115,101,13,10,117,115,101,114,45,97,103,101,110,116,58,32,77,111,122,105,108,108,97,47,53,46,48,32,40,88,49,49,59,32,76,105,110,117,120,32,120,56,54,95,54,52,41,32,65,112,112,108,101,87,101,98,75,105,116,47,53,51,55,46,51,54,32,40,75,72,84,77,76,44,32,108,105,107,101,32,71,101,99,107,111,41,32,67,104,114,111,109,101,47,49,49,52,46,48,46,48,46,48,32,83,97,102,97,114,105,47,53,51,55,46,51,54,13,10,13,10],"nonce":[167,165,69,25,250,197,178,168,222,163,17,77,38,180,194,42,121,245,68,252,79,5,250,3,94,15,73,196,151,94,215,187]}}],"1":[{"kind":"Blake3","ranges":[{"start":0,"end":960}],"direction":"Received"},{"Blake3":{"data":[72,84,84,80,47,49,46,49,32,50,48,48,32,79,75,13,10,83,101,114,118,101,114,58,32,69,78,79,82,32,110,103,105,110,120,47,49,46,50,53,46,49,13,10,68,97,116,101,58,32,84,104,117,44,32,49,56,32,74,117,108,32,50,48,50,52,32,49,48,58,53,48,58,53,49,32,71,77,84,13,10,67,111,110,116,101,110,116,45,84,121,112,101,58,32,97,112,112,108,105,99,97,116,105,111,110,47,106,115,111,110,13,10,84,114,97,110,115,102,101,114,45,69,110,99,111,100,105,110,103,58,32,99,104,117,110,107,101,100,13,10,67,111,110,110,101,99,116,105,111,110,58,32,99,108,111,115,101,13,10,86,97,114,121,58,32,65,99,99,101,112,116,45,69,110,99,111,100,105,110,103,13,10,67,97,99,104,101,45,67,111,110,116,114,111,108,58,32,110,111,45,115,116,111,114,101,13,10,80,114,97,103,109,97,58,32,110,111,45,99,97,99,104,101,13,10,97,99,99,101,115,115,45,99,111,110,116,114,111,108,45,97,108,108,111,119,45,111,114,105,103,105,110,58,32,42,13,10,97,99,99,101,115,115,45,99,111,110,116,114,111,108,45,97,108,108,111,119,45,104,101,97,100,101,114,115,58,32,79,114,105,103,105,110,44,32,88,45,82,101,113,117,101,115,116,101,100,45,87,105,116,104,44,32,67,111,110,116,101,110,116,45,84,121,112,101,44,32,65,99,99,101,112,116,44,32,88,45,85,115,101,114,45,73,100,44,32,88,45,65,117,116,104,45,84,111,107,101,110,13,10,86,97,114,121,58,32,65,99,99,101,112,116,45,69,110,99,111,100,105,110,103,13,10,83,116,114,105,99,116,45,84,114,97,110,115,112,111,114,116,45,83,101,99,117,114,105,116,121,58,32,109,97,120,45,97,103,101,61,51,49,53,51,54,48,48,48,59,13,10,13,10,50,48,52,13,10,123,10,32,32,34,115,116,97,116,117,115,34,58,32,34,115,117,99,99,101,115,115,34,44,10,32,32,34,100,97,116,97,34,58,32,123,10,32,32,32,32,34,115,121,109,98,111,108,34,58,32,34,101,115,111,121,34,44,10,32,32,32,32,34,110,97,109,101,34,58,32,34,101,115,111,121,34,44,10,32,32,32,32,34,119,101,98,115,105,116,101,34,58,32,34,104,116,116,112,115,58,47,47,101,45,103,114,97,105,110,115,46,99,111,109,47,34,44,10,32,32,32,32,34,116,119,105,116,116,101,114,34,58,32,34,104,116,116,112,115,58,47,47,120,46,99,111,109,47,101,95,103,114,97,105,110,115,63,115,61,49,49,38,116,61,106,108,70,48,66,103,48,51,111,87,122,101,71,121,85,65,117,103,113,77,86,119,34,44,10,32,32,32,32,34,108,97,115,116,85,112,100,97,116,101,100,65,116,34,58,32,49,55,50,48,55,48,53,48,50,49,56,56,48,44,10,32,32,32,32,34,97,118,97,105,108,97,98,108,101,83,117,112,112,108,121,34,58,32,55,53,57,57,54,51,51,44,10,32,32,32,32,34,99,105,114,99,117,108,97,116,105,110,103,83,117,112,112,108,121,34,58,32,51,54,55,44,10,32,32,32,32,34,116,111,107,101,110,82,101,115,101,114,118,101,115,34,58,32,51,54,55,44,10,32,32,32,32,34,116,111,116,97,108,83,117,112,112,108,121,34,58,32,55,54,48,48,48,48,48,44,10,32,32,32,32,34,110,101,116,119,111,114,107,115,34,58,32,91,10,32,32,32,32,32,32,34,76,73,78,69,65,34,44,10,32,32,32,32,32,32,34,65,86,65,76,65,78,67,72,69,34,44,10,32,32,32,32,32,32,34,80,79,76,89,71,79,78,34,10,32,32,32,32,93,44,10,32,32,32,32,34,105,99,111,110,34,58,32,34,104,116,116,112,115,58,47,47,119,101,98,46,112,97,110,101,108,46,105,98,108,102,120,46,102,105,110,97,110,99,101,47,99,111,105,110,47,105,109,103,47,101,115,111,121,46,115,118,103,34,10,32,32,125,44,10,32,32,34,116,105,109,101,115,116,97,109,112,34,58,32,49,55,50,49,50,57,57,56,53,49,53,55,48,10,125,13,10,48,13,10,13,10],"nonce":[151,201,134,184,85,238,100,234,90,193,115,24,68,90,159,100,193,177,36,88,202,253,56,221,252,19,43,154,87,129,250,1]}}]},"inclusion_proof":{"proof":[],"total_leaves":2}}},"CM":"576308522f190f60ce8deb20267e42235e66199dffe338593f515235734e2566","api_response":{"data":{"availableSupply":7599633,"circulatingSupply":367,"icon":"https://web.panel.iblfx.finance/coin/img/esoy.svg","lastUpdatedAt":1720705021880,"name":"esoy","networks":["LINEA","AVALANCHE","POLYGON"],"symbol":"esoy","tokenReserves":367,"totalSupply":7600000,"twitter":"https://x.com/e_grains?s=11&t=jlF0Bg03oWzeGyUAugqMVw","website":"https://e-grains.com/"},"status":"success","timestamp":1721299851570}}');
            const result = Verifier.verify(JSON.stringify(notary_proof), pemData);
            let recieved = result['recv'];
            let jsonData = recieved.substring(recieved.indexOf('{'), (recieved.lastIndexOf('}')+1));
            let cleanedJsonString = jsonData.replace(/\\n/g, '').replace(/\\"/g, '"');
            let jsonObject = JSON.parse(cleanedJsonString);
            const API_Recv_Dat  = JSON.stringify(jsonObject);
            const json_notary = JSON.parse(JSON.stringify(notary_proof["session"]["header"]));

            const message = {
                "encoder_seed":json_notary["encoder_seed"],
                "merkle_root":json_notary["merkle_root"],
                "sent_len":numToUint8Array(json_notary["sent_len"]),
                "recv_len":numToUint8Array(json_notary["recv_len"]),
                "time":numToUint8Array(json_notary["handshake_summary"]["time"]),
                "group":[0,65],
                "key":json_notary["handshake_summary"]["server_public_key"]["key"],
                "handshake_commitment":json_notary["handshake_summary"]["handshake_commitment"]
              };

            const msgByteArray = concatenateUint8Arrays(message);
            
            //Construct decommitment from the verified authentic API response.
            class BytesAPI extends Bytes(API_Recv_Dat.length) {}
            let preimageBytes = BytesAPI.fromString(API_Recv_Dat);
            let hash = Hash.SHA2_256.hash(preimageBytes);
            const D = Field(BigInt(`0x${hash.toHex()}`));

            let rawData = jsonObject;
            console.log(rawData);
            if (requestObjetct.path){
                const path = requestObjetct.path.split(',');
                for (const element of path) {
                    rawData = rawData[element];
                }
            }

            const p256data = new P256Data({
              signature: notary_proof["session"]["signature"]["P256"],
              messageHex: bytesToHex(msgByteArray)
            });

            const publicArguments = new PublicArgumets({
                commitment: Field(BigInt(`0x${CM}`)),
                dataField: Field(rawData)
            })

            const zkonzkP = await ZkonZkProgramTest.compile();
            console.log(rawData, CM, hash.toHex(), p256data);

            const proof = await ZkonZkProgramTest.verifySource(
              publicArguments,
              D,
              p256data
            );
            
            await verify(proof.toJSON(), zkonzkP.verificationKey);
            console.timeEnd('Execution of Request to TLSN Client & Proof Generation')

            console.log(`Proof's publicInput argument: ${proof.publicInput.dataField.toBigInt()}`) //proof.publicInput.dataField -> has the data of the path. 
            //Send the transaction to the zkApp 

            // ToDO: Download zkapp from ipfs and execute it:
            
            let senderKey = PrivateKey.fromBase58(config.MINA_PRIVATE_KEY!);
            let sender = senderKey.toPublicKey();

            let zkRequestAddress = PublicKey.fromBase58(config.ZK_REQUESTS_ADDRESS);
    
            let zkApp = await getZkAppInstance(dir+'/zkonrequest.js');
            // await zkApp.compile();
            console.log('Compiled');

            await fetchAccount({publicKey: config.MINA_ADDRESS});
            await fetchAccount({publicKey: config.ZK_REQUESTS_ADDRESS});
            console.log('Accounts fetched!');
            const zkRequest = new zkApp(zkRequestAddress);
            console.log(await zkRequest.receiveZkonResponse(Field(1),proof));


            // Send request via zkRequest app
            console.log(`Sending request via zkRequest at ${zkRequestAddress.toBase58()}`);  
            let transaction = await Mina.transaction(
                { sender, fee: transactionFee },
                async () => {
                await zkRequest.receiveZkonResponse(Field(1),proof);
                }
            );
            console.log('Generating proof');
            await transaction.prove()
            console.log('Proof generated');
            
            console.log('Signing');
            transaction.sign([senderKey]);
            console.log('');
            console.log(`Sending the transaction for deploying zkRequest to: ${zkRequestAddress.toBase58()}`);
            let pendingTx = await transaction.send();
            if (pendingTx.status === 'pending') {
                console.log(`Success! Deploy transaction sent.
            Your smart contract will be deployed
            as soon as the transaction is included in a block.
            Txn hash: ${pendingTx.hash}
            Block explorer hash: https://minascan.io/devnet/tx/${pendingTx.hash}`);
            }
            console.log('Waiting for transaction inclusion in a block.');
            await pendingTx.wait({ maxAttempts: 90 });
            // if (useCustomLocalNetwork){
            //     localData.deployerKey = localData.deployerKey ? localData.deployerKey : senderKey.toBase58();
            //     localData.deployerAddress = localData.deployerAddress ? localData.deployerAddress : sender;
            //     localData.zkResponse = zkResponse.toBase58();
            //     localData.zkResponseAddress = zkResponseAddress;
            //     fsextra.outputJsonSync(
            //     "./data/addresses.json",            
            //         localData,      
            //     { spaces: 2 }
            //     );
            // }
        console.log('');
        
        }
        await sleep(30000); //30 seconds
    }
}

main();