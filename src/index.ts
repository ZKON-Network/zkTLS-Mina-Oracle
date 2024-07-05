import { Mina, PublicKey,PrivateKey,Lightnet,fetchAccount, UInt32,Field,  ZkProgram, Bytes, Hash, state, Bool, verify, Struct, Provable} from 'o1js';
import { p256, secp256r1 } from '@noble/curves/p256';
import { hexToBytes, bytesToHex } from '@noble/hashes/utils';
import axios from 'axios';
import https from 'https';
import * as fs from 'fs';
import * as fsextra from 'fs-extra';

import config from './config';
import {numToUint8Array, concatenateUint8Arrays, Commitments} from './utils';
import { ZkonResponse } from '../build/src/ZkonRequests.js'

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

//ToDo: Move to utils file.
class ApiResponseData extends Struct({
    lastUpdatedAt:Field,
    availableSupply:Field,
    circulatingSupply:Field,
    totalSupply:Field,
  }){}
  
  class ApiResponse extends Struct ({
    data: ApiResponseData,
    timestamp: Field
  }){}

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

let senderKey: PrivateKey;
let sender: PublicKey;
let localData: any;
let zkCoordinatorAddress: PublicKey;
let zkResponseAddress: PublicKey;

  // Fee payer setup
  if (useCustomLocalNetwork){
    localData = fsextra.readJsonSync('./data/addresses.json');
    let deployerKey;
    if (!!localData){
      if (!!localData.deployerKey){
        deployerKey = PrivateKey.fromBase58(localData.deployerKey)
      }else{
        deployerKey = (await Lightnet.acquireKeyPair()).privateKey
      }
    }
    senderKey = deployerKey!;
    sender = senderKey.toPublicKey();

    zkCoordinatorAddress = localData.coordinatorAddress ? PublicKey.fromBase58(localData.coordinatorAddress) : (await Lightnet.acquireKeyPair()).publicKey;    
    zkResponseAddress = localData.zkResponseAddress ? PublicKey.fromBase58(localData.zkResponseAddress) : (await Lightnet.acquireKeyPair()).publicKey;    
    try {
      await fetchAccount({ publicKey: sender })
    } catch (error) {
      senderKey = (await Lightnet.acquireKeyPair()).privateKey
      sender = senderKey.toPublicKey();
    }
  }else{
    //ToDo: the env object in this project is of a defined type. Modify. 
    senderKey = PrivateKey.fromBase58(process.env.DEPLOYER_KEY);
    sender = senderKey.toPublicKey();
  }

const main = async () => {
    while(true) {

        const Network = Mina.Network({
            mina: 'https://api.minascan.io/node/devnet/v1/graphql',
            archive: 'https://api.minascan.io/archive/devnet/v1/graphql',
        });
        Mina.setActiveInstance(Network);        

        const blockNr:number = 0 //ToDo Check how to get last block number
        const fromBlock = blockNr;
        const toBlock = (blockNr >= config.MAX_BLOCKS_TO_CHECK) ? (blockNr) - config.MAX_BLOCKS_TO_CHECK: 0;

        const address:any = config.MINA_ADDRESS;
        const logs = await Mina.fetchEvents(
            PublicKey.fromBase58(address),
            Field(0), //ToDo: Resolve with actual tokenID
            );
        console.log('Events found: ', logs.length);
        
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

            // Make the request to TLS-Notary client to fetch NotaryProof. 
            console.time('Execution of Request to TLSN Client & Proof Generation');
            const res = (await axios.post('https://127.0.0.1:5000/egrains',{}, { httpsAgent: agent })).data;
            const {notary_proof,CM,API_RES} = res;
            
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

            const msgByteArray = concatenateUint8Arrays(message); //
            const sig = p256.Signature.fromCompact(notary_proof["session"]["signature"]["P256"])
              
            //Construct decommitment from the verified authentic API response.
            class Bytes500 extends Bytes(408) {}
            let preimageBytes = Bytes500.fromString(API_Recv_Dat);
            let hash = Hash.SHA2_256.hash(preimageBytes);
            const D = Field(BigInt(`0x${hash.toHex()}`));

            // Decommitment from verified API Response.
            class Bytes7 extends Bytes(7){}
            let hash_supply = Hash.SHA2_256.hash(Bytes7.fromString(JSON.stringify(jsonObject['data']['availableSupply'])));
            const api_timestamp:string = jsonObject['timestamp'];
            class Bytes13 extends Bytes(13){}
            let hash_timestamp = Hash.SHA2_256.hash(Bytes13.fromString(api_timestamp));

            const apiData = new ApiResponseData({
                lastUpdatedAt:Field(jsonObject['data']['lastUpdatedAt']),
                availableSupply:Field(jsonObject['data']['availableSupply']),
                circulatingSupply:Field(jsonObject['data']['circulatingSupply']),
                totalSupply:Field(jsonObject['data']['totalSupply'])
            })

            const apiResponse = new ApiResponse({
                data: apiData,
                timestamp:Field(jsonObject['timestamp'])
            });

            // Construct decommitment
            const decommitment = new Commitments ({
                availableSupply: Field(BigInt(`0x${hash_supply.toHex()}`)),
                timestamp: Field(BigInt(`0x${hash_timestamp.toHex()}`))
            })
            
            // Parse the sent commitment
            const commitment = new Commitments({
                availableSupply: Field(BigInt(`0x${API_RES["F1"]}`)),
                timestamp: Field(BigInt(`0x${API_RES["F2"]}`))
            });

            const eGrains = ZkProgram({
                name:'egrains-proof',
                publicInput: Commitments,
            
                methods:{
                  verifySource:{
                    privateInputs: [Commitments,Field,Field], 
                    async method (
                      commitment: Commitments,
                      decommitment: Commitments,
                      C: Field,
                      D: Field
                    ){
                        //P256 Signature Verification
                        const assert = Bool(true);
                        const public_key_notary = hexToBytes('0206fdfa148e1916ccc96b40d0149df05825ef54b16b711ccc1b991a4de1c6a12c');
                        assert.assertEquals(p256.verify(sig, 
                        msgByteArray, 
                        public_key_notary, 
                        {prehash:true}));
                      
                        // Individual Commitment Verification
                        D.assertEquals(C);
                
                        // Committmenet verification of availableSupply & timestamp
                        commitment.availableSupply.assertEquals(decommitment.availableSupply);
                        commitment.timestamp.assertEquals(decommitment.timestamp);
                    }
                  }
                }
            });

            const eGrainszkP = await eGrains.compile();
            const proof = await eGrains.verifySource(
                decommitment, 
                commitment, 
                Field(BigInt(`0x${CM}`)), 
                D);
            
            const json_proof = proof.toJSON();
            const ok = await verify(proof.toJSON(), eGrainszkP.verificationKey);
            console.timeEnd('Execution of Request to TLSN Client & Proof Generation')

            //Send the transaction to the zkApp 
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
            console.log('');

        //}
        await sleep(30000); //30 seconds
    }
}

main();