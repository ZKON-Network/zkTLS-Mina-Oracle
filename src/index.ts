import { Mina, PublicKey, PrivateKey, Field, Bytes, Hash, verify,fetchEvents,fetchAccount, createForeignCurveV2,createEcdsaV2, EcdsaSignatureV2} from 'o1js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import axios from 'axios';
import https from 'https';
import * as fs from 'fs';
import { StringCircuitValue } from './String.js';
import {numToUint8Array,concatenateUint8Arrays, breakStringIntoNParts, bytesToFields} from './utils.js';
import * as path from 'path'
import config from './config.js';

import { secp256k1 } from '@noble/curves/secp256k1';

import {ZkonZkProgram} from 'zkon-zkapp';
import {P256Data, PublicArgumets} from './zkProgram.js';

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

//const pemData = fs.readFileSync('./notary.pub', 'utf-8');
const pemData = fs.readFileSync('./public_key_k256.pem', 'utf-8');

const transactionFee = 100_000_000;
const useCustomLocalNetwork = process.env.USE_CUSTOM_LOCAL_NETWORK === 'true';  
console.log(useCustomLocalNetwork
    ? 'http://localhost:8080/graphql'
    : 'https://api.minascan.io/node/devnet/v1/graphql');

const network = Mina.Network({
  mina: useCustomLocalNetwork
    ? 'http://localhost:8080/graphql'
    : 'https://api.minascan.io/node/devnet/v1/graphql',
  lightnetAccountManager: 'http://localhost:8181'
});
Mina.setActiveInstance(network);

const getZkAppInstance = async (filePath: string) => {
    try {
        (global as any).self = global;
        const zkApp = await import(path.resolve(filePath));
        console.log(zkApp);
        if (zkApp && zkApp.default) {
            return zkApp;
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

        const blockNr = 0
        const fromBlock = blockNr;
        const toBlock = (blockNr >= config.MAX_BLOCKS_TO_CHECK) ? (blockNr) - config.MAX_BLOCKS_TO_CHECK: 0;

        const address:any = config.MINA_ADDRESS;
        console.log(address);
        const logs = await fetchEvents({
            publicKey: address,
          });
        console.log('Events found: ', logs.length);
        for (const log of logs) {
            let requestId = log.events[0].data[1];

            const fieldHash1 = Field(log.events[0].data[2]);
            const fieldHash2 = Field(log.events[0].data[3]);
            const hash1 = StringCircuitValue.fromField(fieldHash1).toString().replace(/\0/g, '')
            const hash2 = StringCircuitValue.fromField(fieldHash2).toString().replace(/\0/g, '')
            const ipfsHashFile = hash1.concat(hash2);

            const senderXhash: Field = Field(log.events[0].data[4]);
            const senderYhash: Field = Field(log.events[0].data[5]);
            let zkRequestAddress = PublicKey.fromFields([senderXhash,senderYhash])
            
            //Fetch JSON from IPFS            
            let requestObjetct = (await axios.get(`${config.IPFS_GATEWAY}${ipfsHashFile}`)).data;
            
            const proofObject ={
                method: 'GET',
                baseURL: requestObjetct.baseURL.slice(0, (requestObjetct.baseURL.indexOf('com')+3)),
                path: requestObjetct.baseURL.slice((requestObjetct.baseURL.indexOf('com')+4))
            }
            
            //console.log(requestObjetct);
            
            /*
            let zkAppCode = requestObjetct.zkapp;
            const __dirname = import.meta.dirname;
            const dir = __dirname+'/tmp/zkon-zkapps';
            const filename = 'zkapp-'+parseInt((Math.random() * 100000000000000).toString())+'.js';
            if (!fs.existsSync(dir)){
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(dir + '/' + filename, zkAppCode);
            */
            console.time('Execution of Request to TLSN Client & Proof Generation');
            const res = (await axios.post(`https://${config.PROOF_CLIENT_ADDR}`,proofObject, { httpsAgent: agent })).data;
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

            //console.log(message)
            const msgByteArray = concatenateUint8Arrays(message);
            console.log(bytesToHex(msgByteArray));
            console.log(notary_proof["session"]["signature"]["P256"])

            //Experiment: ECDSA Signature verification of ECDSA-SECP256K1 Signature.

            const secp256k1Params = {
                name: 'secp256k1',
                modulus:  (1n << 256n) - (1n << 32n) - 0b1111010001n,
                order: (1n << 256n) - 0x14551231950b75fc4402da1732fc9bebfn,
                a: 0n,
                b: 7n,
                generator: {
                  x: 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n,
                  y: 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n,
                },
              };

            class SECP256K1 extends createForeignCurveV2(secp256k1Params) {}
            class Ecdsa extends createEcdsaV2(SECP256K1) {}

            const fieldArrayMessage = bytesToFields(msgByteArray);

            //ECDSA Signature Verification: Using Pure JS
            const public_key_256 = hexToBytes('0283bbaa97bcdddb1b83029ef3bf80b6d98ac5a396a18ce8e72e59d3ad0cf2e767')
            const signatue_SECP256K1 = secp256k1.Signature.fromCompact(notary_proof["session"]["signature"]["P256"]);
            console.log(signatue_SECP256K1.r)
            console.log(signatue_SECP256K1.s)
            //console.log(public_key_256.)
            const resultECDSA = secp256k1.verify(signatue_SECP256K1,
                msgByteArray,
                public_key_256,
                {prehash:true}
                )

            console.log(resultECDSA)
            
            /* 
                Test Parameters
                Public Key: 0283bbaa97bcdddb1b83029ef3bf80b6d98ac5a396a18ce8e72e59d3ad0cf2e767
                SECP256K1 ECDSA Signature: 13BF0E0B95144FA15E946F0E63CB01CEE728AA2A473120B82B40A6F39C12B7CC4BD609565CF4F2A530C4C686171939BE4B7268424EEDB063158AA60BCF114DF0
                Message Array: 6d332f53ec46730a3e6b82f60c0a79ca8a979c09e56ca2d43a2aa3dcfb94b7674d579783baee910e9b0c9f743fc5dc98955a5701bdbb6be58b77d17e158352ee0001000000000000c00300000000000080b9a866000000000041044185fc175854a9ee6dbf81590b90f29479f5280b2f3edf8f073d09228f5875927b1fec8e4f26fad46c31b1ce488233bdcc3c78ebe82197acae0e543f64dbb217805fb81a1d19feb6288f970671d9bc27e731aefbc066df00d1c4b9ec55ddb45b
                r: 8931508849162888135033223828139195624012587407285915851720748463589474613196n
                s: 34301633359669584391987402615146688447352716663178192030494368825097711603184n
            */

            const proveableSignature = new EcdsaSignatureV2({
                r:8931508849162888135033223828139195624012587407285915851720748463589474613196n,
                s:34301633359669584391987402615146688447352716663178192030494368825097711603184n
            })

            



            /*
            //Construct decommitment from the verified authentic API response.
            class BytesAPI extends Bytes(API_Recv_Dat.length) {}
            let preimageBytes = BytesAPI.fromString(API_Recv_Dat);
            let hash = Hash.SHA2_256.hash(preimageBytes);
            const D = Field(BigInt(`0x${hash.toHex()}`));

            let rawData = jsonObject;
            if (requestObjetct.path){
                const path = requestObjetct.path.split(',');
                for (const element of path) {
                    rawData = rawData[element];
                }
            }

            let signaturePartsString = breakStringIntoNParts(notary_proof["session"]["signature"]["P256"],4);
            let messagePartsString = breakStringIntoNParts(bytesToHex(msgByteArray),12);

            let messageParts: StringCircuitValue[] = [];
            let signatureParts: StringCircuitValue[] = [];

            signaturePartsString.forEach(part => {
                signatureParts.push(new StringCircuitValue(part));
            });

            messagePartsString.forEach(part => {
                messageParts.push(new StringCircuitValue(part));
            });
            
            const publicArguments = new PublicArgumets({
                commitment: Field(BigInt(`0x${CM}`)),
                dataField: Field(rawData)
            });

            const signatureFields : Field[] = [];
            const messageFields: Field[] = [];

            signatureParts.forEach(part=>{
                signatureFields.push(Field(BigInt(`0x${part}`)))
            });

            messageParts.forEach(part=>{
                messageFields.push(Field(BigInt(`0x${part}`)))
            });

            const p256data = new P256Data({
                signature: [
                    signatureFields[0],
                    signatureFields[1],
                    signatureFields[2],
                    signatureFields[3]
              ],
                messageHex: [
                    messageFields[0],
                    messageFields[1],
                    messageFields[2],
                    messageFields[3],
                    messageFields[4],
                    messageFields[5],
                    messageFields[6],
                    messageFields[7],
                    messageFields[8],
                    messageFields[9],
                    messageFields[10],
                    messageFields[11]
              ]
            });
        
            const zkonzkP = await ZkonZkProgram.compile();
            const proof = await ZkonZkProgram.verifySource(
                publicArguments,
                D,
                p256data
            );
            
            const resultZk = await verify(proof.toJSON(), zkonzkP.verificationKey);
            console.timeEnd('Execution of Request to TLSN Client & Proof Generation')
            console.log('Proof verified?', resultZk);
            console.log(`Proof's publicInput argument: ${proof.publicInput.dataField.toBigInt()}`) //proof.publicInput.dataField -> has the data of the path. 

            //Send the transaction to the zkApp 
            let senderKey = PrivateKey.fromBase58(config.MINA_PRIVATE_KEY!);
            let sender = senderKey.toPublicKey();
    
            let zkAppObj = await getZkAppInstance(dir+'/'+filename);
            let zkProgramObj = await getZkAppInstance(dir+'/zkProgram.js');
            let coordinatorObj = await getZkAppInstance(dir+'/ZkonRequestCoordinator.js');
            const zkApp = zkAppObj.default;
            console.log(zkAppObj);
            console.log(zkAppObj.ZkonProof);
            await zkProgramObj.default.compile();
            console.log('Zk Program Compiled');
            await coordinatorObj.default.compile();
            console.log('Zk Coordinator Compiled');
            await zkApp.compile();
            console.log('ZkApp Compiled');

            await fetchAccount({publicKey: config.MINA_ADDRESS});
            await fetchAccount({publicKey: config.ZK_REQUESTS_ADDRESS});
            console.log('Accounts fetched!');
            const zkRequest = new zkApp(zkRequestAddress);

            // Send request via zkRequest app
            console.log(`Sending request via zkRequest at ${zkRequestAddress.toBase58()}`);  
            let transaction = await Mina.transaction(
                { sender, fee: transactionFee },
                async () => {
                await zkRequest.receiveZkonResponse(Field(requestId), proof);
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
        
        console.log('');*/
        }
        await sleep(5000); //5 seconds
    }
}

main();