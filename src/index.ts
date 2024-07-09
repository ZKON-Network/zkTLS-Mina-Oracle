import { Mina, PublicKey, PrivateKey, Field, Bytes, Hash, verify,Struct} from 'o1js';
import { p256 } from '@noble/curves/p256';
import { hexToBytes, bytesToHex } from '@noble/hashes/utils';
import axios from 'axios';
import https from 'https';
import * as fs from 'fs';

import config from './config';
import {numToUint8Array, concatenateUint8Arrays } from './utils';
//import { ZkonZkProgram } from 'zkon-zkapp';

//Using for testing.
import {ZkonZkProgramTest, P256Data} from './zkProgram';

const Verifier = require("../verifier/index.node");

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

const main = async () => {
    while(true) {

        const Network = Mina.Network({
            mina: 'https://api.minascan.io/node/devnet/v1/graphql',
            archive: 'https://api.minascan.io/archive/devnet/v1/graphql',
        });
        Mina.setActiveInstance(Network);        

        const blockNr = 0 //ToDo Check how to get last block number
        const fromBlock = blockNr;
        const toBlock = (blockNr >= config.MAX_BLOCKS_TO_CHECK) ? (blockNr) - config.MAX_BLOCKS_TO_CHECK: 0;

        // const address:any = config.MINA_ADDRESS;
        // const logs = await Mina.fetchEvents(
        //     PublicKey.fromBase58(address),
        //     Field(0), //ToDo: Resolve with actual tokenID
        //     );
        // console.log('Events found: ', logs.length);
        
        // for (const log of logs) {
            // const requestEvent = provablePure(log.event.data).toFields(log.event.data);
            // const fieldHash1 = requestEvent[1]
            // const fieldHash2 = requestEvent[2]

            // const hash1 = StringCircuitValue.fromBits(fieldHash1.toBits()).toString().replace(/\0/g, '')
            // const hash2 = StringCircuitValue.fromBits(fieldHash2.toBits()).toString().replace(/\0/g, '')
        
            // const ipfsHashFile = hash1.concat(hash2);
            //const ipfsHashFile = "QmbCpnprEGiPZfESXkbXmcXcBEt96TZMpYAxsoEFQNxoEV"; //Mock JSON Request

            // //Fetch JSON from IPFS            
            //const requestObjetct = (await axios.get(`${sanitizedConfig.IPFS_GATEWAY}${ipfsHashFile}`)).data;
            // const requestObjetct = {
            //   method: 'GET',
            //   baseURL: 'https://api.coingecko.com/api/v3/coins/bitcoin',
            //   path: 'market_data,current_price,usd',
            //   zkapp: ''
            // }

            //Egrains demo specific.
            const requestObjetctDemo = {
              method: 'GET',
              baseURL: 'r-api.e-grains.com',
              path: 'v1/esoy/info',
              zkapp: ''
            }
            
            // Make the request to TLS-Notary client to fetch NotaryProof. 
            console.time('Execution of Request to TLSN Client & Proof Generation');

            // ToDo: Endpoint shouldn't be named egrains
            // ToDo: Send the URL and the request type (POST, GET, etc) from the request object
            const res = (await axios.post('https://127.0.0.1:5000/proof',requestObjetctDemo, { httpsAgent: agent })).data;
            const {notary_proof,CM} = res;
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

            // ToDO: This isn't used. It should be send to the zkProgram?
            const msgByteArray = concatenateUint8Arrays(message); //
            const sig = p256.Signature.fromCompact(notary_proof["session"]["signature"]["P256"])
            
            //Construct decommitment from the verified authentic API response.
            class BytesAPI extends Bytes(API_Recv_Dat.length) {}
            let preimageBytes = BytesAPI.fromString(API_Recv_Dat);
            let hash = Hash.SHA2_256.hash(preimageBytes);
            const D = Field(BigInt(`0x${hash.toHex()}`));

            let rawData = jsonObject;
            if (requestObjetctDemo.path){
                const path = requestObjetctDemo.path.split(',');
                for (const element of path) {
                    rawData = rawData[element];
                }
            }

            console.log(rawData);
            const p256data = new P256Data({
              signature: notary_proof["session"]["signature"]["P256"],
              messageHex: bytesToHex(msgByteArray)
            });
            
            const zkonzkP = await ZkonZkProgramTest.compile();
            const proof = await ZkonZkProgramTest.verifySource(
              Field(BigInt(`0x${CM}`)),
              D,
              p256data
            );
            
            await verify(proof.toJSON(), zkonzkP.verificationKey);
            console.timeEnd('Execution of Request to TLSN Client & Proof Generation')

            //Send the transaction to the zkApp 

            // ToDO: Download zkapp from ipfs and execute it:
            /*
            await ZkonResponse.compile();
            console.log('Compiled');
            const zkResponse = new ZkonResponse(zkResponseAddress);
            console.log('');


            // Send request via zkRequest app
            console.log(`Sending request via zkRequest at ${zkResponseAddress.toBase58()}`);  
            let transaction = await Mina.transaction(
                { sender, fee: transactionFee },
                async () => {
                await zkResponse.sendRequest(proof, apiResponse);
                }
            );
            console.log('Generating proof');
            await transaction.prove()
            console.log('Proof generated');
            
            console.log('Signing');
            transaction.sign([senderKey]);
            console.log('');
            console.log(`Sending the transaction for deploying zkRequest to: ${zkResponseAddress.toBase58()}`);
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
            if (useCustomLocalNetwork){
                localData.deployerKey = localData.deployerKey ? localData.deployerKey : senderKey.toBase58();
                localData.deployerAddress = localData.deployerAddress ? localData.deployerAddress : sender;
                localData.zkResponse = zkResponse.toBase58();
                localData.zkResponseAddress = zkResponseAddress;
                fsextra.outputJsonSync(
                "./data/addresses.json",            
                    localData,      
                { spaces: 2 }
                );
            }
            console.log('');*/

        //}
        await sleep(30000); //30 seconds
    }
}

main();