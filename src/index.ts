import { Mina, PublicKey, PrivateKey, Field, Bytes, Hash, verify,fetchEvents,fetchAccount} from 'o1js';
import { bytesToHex } from '@noble/hashes/utils';
import axios from 'axios';
import https from 'https';
import * as fs from 'fs';
import { StringCircuitValue } from './String.js';
import {numToUint8Array,concatenateUint8Arrays} from './utils.js';
import * as path from 'path'
import config from './config.js';

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

function breakStringIntoNParts(str:string, n:number) {
    let partLength = Math.ceil(str.length / n);
    let parts = [];

    for (let i = 0; i < str.length; i += partLength) {
        parts.push(str.substring(i, i + partLength));
    }

    // Ensure there are exactly n parts
    while (parts.length < n) {
        parts.push('');
    }

    return parts;
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

            const senderXhash = Field(log.events[0].data[4]);
            const senderYhash = Field(log.events[0].data[5]);
            const hashX = StringCircuitValue.fromField(senderXhash).toString().replace(/\0/g, '')
            const hashY = StringCircuitValue.fromField(senderYhash).toString().replace(/\0/g, '')
            const EventzkRequestAddress = hashX.concat(hashY);
            
            //Fetch JSON from IPFS            
            let requestObjetct = (await axios.get(`${config.IPFS_GATEWAY}${ipfsHashFile}`)).data;
            
            const proofObject ={
                method: 'GET',
                baseURL: requestObjetct.baseURL.slice(0, (requestObjetct.baseURL.indexOf('com')+3)),
                path: requestObjetct.baseURL.slice((requestObjetct.baseURL.indexOf('com')+4))
            }
            
            console.log(requestObjetct);
            
            let zkAppCode = requestObjetct.zkapp;
            const __dirname = import.meta.dirname;
            const dir = __dirname+'/tmp/zkon-zkapps';
            const filename = 'zkapp-'+parseInt((Math.random() * 100000000000000).toString())+'.js';
            if (!fs.existsSync(dir)){
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(dir + '/' + filename, zkAppCode);

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

            const msgByteArray = concatenateUint8Arrays(message);
            
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

            //Checks
            let concatMsg='';
            let concatSig='';

            messageParts.forEach(part=>{
                concatMsg += part.toString();
            })

            signatureParts.forEach(part=>{
                concatSig += part.toString();
            })

            // notary_proof["session"]["signature"]["P256"] ==concatSig ? console.log("true Signature") : console.log("wrong Signature");
            // bytesToHex(msgByteArray) == concatMsg.slice(0,374) ?  console.log("true message") : console.log("wrong message");
            
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

            let fixedMessage:string[]=[]
            messageFields.forEach((part, index)=>{
                    let data:string = part.toBigInt().toString(16);

                    if(data.length !=32 && index != 11){
                        let padding = ``
                        for(let i=0;i<(32 - data.length);i++){
                            padding+='0'
                        }
                        data=padding+data;
                    }

                    if(index == 11 && data.length != 22){
                        data = '0'+data;
                    }

                    fixedMessage.push(data);
            })

            let ofcourseAgain = '';
            fixedMessage.forEach((data,index)=>{
                ofcourseAgain+=data
            })

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

            let fixedSignature:string[]=[]
            p256data.signature.forEach((part, index)=>{
                let data:string = part.toBigInt().toString(16);

                if(data.length !=32){
                    let padding = ``
                    for(let i=0;i<(32 - data.length);i++){
                        padding+='0'
                    }
                    data=padding+data;
                }

                fixedSignature.push(data);
            })

            let reconstructedSig=''
            fixedSignature.forEach(data=>{
                reconstructedSig+=data
            })

            console.log(`${reconstructedSig}`);
        
            // reconstructedSig == notary_proof["session"]["signature"]["P256"].toLowerCase() ? console.log("true Signature") : console.log("wrong Signature");
            // bytesToHex(msgByteArray) == ofcourseAgain ?  console.log("true message") : console.log("wrong message");
            
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

            let zkRequestAddress = PublicKey.fromBase58(EventzkRequestAddress);
    
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

        console.log('');
        }
        await sleep(5000); //5 seconds
    }
}

main();