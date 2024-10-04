import { Mina, PublicKey, PrivateKey, Field, Bytes, Hash, verify,fetchEvents,fetchAccount,Provable, Crypto, createEcdsaV2, createForeignCurveV2, Circuit} from 'o1js';
import { bytesToHex } from '@noble/hashes/utils';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha2';
import axios from 'axios';
import https from 'https';
import * as fs from 'fs';
import { StringCircuitValue } from './String.js';
import {numToUint8Array,concatenateUint8Arrays} from './utils.js';
import * as path from 'path'
import config from './config.js';
import {URL} from 'url';
import { hashMessage } from 'ethers';

// import {ZkonZkProgram} from 'zkon-zkapp'; Fix after zkon-zkapp ZkProgram is deployed. 
import { ZkonZkProgram , PublicArgumets, ECDSAHelper } from './zkProgram.js'

import { createRequire } from "node:module"
const Verifier = createRequire(import.meta.url)("../verifier/index.node")

class Secp256k1 extends createForeignCurveV2(Crypto.CurveParams.Secp256k1) {}
class Ecdsa extends createEcdsaV2(Secp256k1) {}
class Scalar extends Secp256k1.Scalar {}

// SSL Check disabled.
const agent = new https.Agent({
    rejectUnauthorized: false
});

const sleep = async (ms:any) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

const pemData = fs.readFileSync('./k256.pem', 'utf-8');

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

const checkZkAppEventEmitted = async (
  zkAppAddress: PublicKey,
  requestId: string,
  fieldHash1: Field,
  fieldHash2: Field
): Promise<boolean> => {
  const Network = Mina.Network({
    mina: "https://api.minascan.io/node/devnet/v1/graphql",
    archive: "https://api.minascan.io/archive/devnet/v1/graphql",
  });
  Mina.setActiveInstance(Network);

  const zkAppEvents = await fetchEvents({
    publicKey: zkAppAddress.toBase58(),
  });

  return zkAppEvents.some(
    (e) =>
    //ToDo check eventType 
      e.events[0].data[0] === requestId.toString() &&
      e.events[0].data[1] === fieldHash1.toString() &&
      e.events[0].data[2] === fieldHash2.toString()            
  );
};

const main = async () => {
    while(true) {

        const Network = Mina.Network({
            mina: 'https://api.minascan.io/node/devnet/v1/graphql',
            archive: 'https://api.minascan.io/archive/devnet/v1/graphql',
        });
        Mina.setActiveInstance(Network);        

        const address:any = config.MINA_ADDRESS;
        console.log(address);
        const logs = await fetchEvents({
            publicKey: address,
          });
        console.log('Events found: ', logs.length);
        for (const log of logs) {
            if (log.events[0].data.length != 6){
                console.log("Not request event")
                continue;
            }
            let requestId = log.events[0].data[1];

            const fieldHash1 = Field(log.events[0].data[2]);
            const fieldHash2 = Field(log.events[0].data[3]);
            const hash1 = StringCircuitValue.fromField(fieldHash1).toString().replace(/\0/g, '')
            const hash2 = StringCircuitValue.fromField(fieldHash2).toString().replace(/\0/g, '')
            const ipfsHashFile = hash1.concat(hash2);

            const senderXhash: Field = Field(log.events[0].data[4]);
            const senderYhash: Field = Field(log.events[0].data[5]);
            let zkRequestAddress = PublicKey.fromFields([senderXhash,senderYhash])
            
            const eventEmittedByZkApp = await checkZkAppEventEmitted(zkRequestAddress, requestId, fieldHash1, fieldHash2);

            const requestFullfilled = logs.some(
              (e) =>
                e.events[0].data.length == 2 && //Assuming that events with 2 fields and field[0] == 0, are the "fullfilled" event
                e.events[0].data[0] === "0" &&
                e.events[0].data[1] === requestId.toString()
            );

            if (!eventEmittedByZkApp){
                console.log('Event not emmited by the zkApp')
                continue;
            }
            
            if (requestFullfilled){
                console.log('Request already fullfilled')
                continue;
            }
            
            //Fetch JSON from IPFS        
            let requestObject;
            try {    
                requestObject = (await axios.get(`${config.IPFS_GATEWAY}${ipfsHashFile}`)).data;
            } catch (e) {
                console.error(e);
                continue;
            }
            const url = new URL(requestObject.baseURL);
            const proofObject ={
                method: 'GET',
                baseURL: url.host,
                path: url.pathname!.slice(1) + (url.search ? url.search : '')
            }

            console.log(proofObject.path);
            
            let zkAppCode = requestObject.zkapp;
            const __dirname = import.meta.dirname;
            const dir = __dirname+'/tmp/zkon-zkapps';
            const filename = 'zkapp-'+parseInt((Math.random() * 100000000000000).toString())+'.js';
            if (!fs.existsSync(dir)){
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(dir + '/' + filename, zkAppCode);

            console.time('Execution of Request to Proof Client & Proof Generation');
            let res;
            try {
                res = (await axios.post(`https://${config.PROOF_CLIENT_ADDR}`,proofObject, { httpsAgent: agent })).data;
            } catch(e) {
                console.error(e);
                continue;
            }
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

            console.log(rawData);
            if (requestObject.path){

                let path = requestObject.path.split(',');

                // ToDo Remove support for "." in the path
                if (path.length == 1 && requestObject.path.indexOf('.') != -1) {
                    path = requestObject.path.split('.');
                }

                for (const element of path) {
                    rawData = rawData[element]*1e8;
                }
            }
            if (rawData==null || rawData == undefined) {
                console.error('Error reading from json using the path');
                continue;
            }
            
            const publicArguments = new PublicArgumets({
                commitment: Field(BigInt(`0x${CM}`)),
                dataField: Field(rawData)
            });

            const messagePreHashed = bytesToHex(sha256(msgByteArray))
            const {r,s} = secp256k1.Signature.fromCompact(notary_proof["session"]["signature"]["P256"]);
            const signatureP = Ecdsa.from({r:r,s:s})
            const publicKeyE = Secp256k1.fromEthers('0283bbaa97bcdddb1b83029ef3bf80b6d98ac5a396a18ce8e72e59d3ad0cf2e767')

            const ecdsaData = new ECDSAHelper({
                messageHash: new Scalar(BigInt('0x'+messagePreHashed)),
                signature: signatureP,
                publicKey: publicKeyE
            }) 

            const isValid = signatureP.verifySignedHashV2(
                new Scalar(BigInt('0x'+messagePreHashed)),
                publicKeyE
            )
            Provable.log('is valid: ', isValid);
    
            let zkon = await ZkonZkProgram.analyzeMethods();
            console.log(zkon);
            
            console.time("ZK Proof Generated in")
            const zkonzkP = await ZkonZkProgram.compile();
            const proof = await ZkonZkProgram.verifySource(
                publicArguments,
                D,
                ecdsaData
            );
            console.timeEnd("ZK Proof Generated in")
            
            console.time("Proof verified in")
            const resultZk = await verify(proof.toJSON(), zkonzkP.verificationKey);
            console.timeEnd("Proof verified in")
            console.timeEnd('Execution of Request to Proof Client & Proof Generation')
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
            await fetchAccount({publicKey: zkRequestAddress.toBase58()});
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
        await sleep(60000); //60 seconds
    }
}

main();