import { Mina, PublicKey, PrivateKey, Field, Bytes, Hash, verify,Struct, provablePure, fetchEvents, AccountUpdate, fetchAccount, CircuitString} from 'o1js';
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
import {ZkonZkProgramTest, P256Data, PublicArgumets} from './zkProgram';

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
            
            const proofObject ={
                method: 'GET',
                baseURL: 'r-api.e-grains.com',
                path: 'v1/esoy/info'
            }

            // let zkAppCode = requestObjetct.zkapp;
            // try{
            //     const __dirname = import.meta.dirname;
            //     const dir = __dirname+'/tmp/zkon-zkapps';
            //     const filename = 'zkapp-'+parseInt((Math.random() * 100000000000000).toString())+'.js';
            //     if (!fs.existsSync(dir)){
            //         fs.mkdirSync(dir, { recursive: true });
            //     }
            //     fs.writeFileSync(dir + '/' + filename, zkAppCode);
            //     // const zkapp = await getZkAppInstance(dir+'/'+filename);
            //     const zkapp = await getZkAppInstance(dir+'/zkonrequest.js');
            //     // const zkapp = await getZkAppInstance(dir+'/bundle.cjs');
            //     await fetchAccount({publicKey: config.MINA_ADDRESS});
            //     await fetchAccount({publicKey: config.ZK_REQUESTS_ADDRESS});
            //     const zkappInstance = new zkapp(config.ZK_REQUESTS_ADDRESS);
            //     console.log(zkappInstance)
            //     // console.log(zkapp);
            //     let senderKey = PrivateKey.fromBase58(config.MINA_PRIVATE_KEY!);
            //     let sender = senderKey.toPublicKey();

            //     const proof = null; // ToDO 
            //     let transaction = await Mina.transaction(
            //         { sender , fee: transactionFee },
            //         async () => {
            //           await zkappInstance.receiveZkonResponse(Field(1), proof);
            //         }
            //       );
            // }catch(err){
            //     console.error(err);
            // }

            /* Suggestion: Can we structure the IPFS as follows? 
            IPFS={
                method: ...,
                baseURL: api.coingecko.com
                apiEndpoitn: /api/v3/coins/bitcoin
                zkapp: 
            }
            */

            // // Experiment Block
            // // P256 Signature: 50DD6F9B0A2D5192A09F055C656DEC685890E47D640C6AB448CA720EA7C0256745B9F509484268080B28240E2181A47CA08AAEC65FF5D2A3C4A9D27C89818800
            // class BytesSignature extends Bytes(128) {}
            // let bytes = BytesSignature.fromHex('135EBD86EB50DA1129D3CCDDA2013681F13DA94146956954C295F21A4FDB7D0CFE4AD6C664F4E4A1C1EAABAE7A213D056C17294AC8482CC1829471EEBE36B311');
            // // console.log('135EBD86EB50DA1129D3CCDDA2013681F13DA94146956954C295F21A4FDB7D0CFE4AD6C664F4E4A1C1EAABAE7A213D056C17294AC8482CC1829471EEBE36B311')
            // // console.log(bytes.toHex().slice(0,128));

            // //MSG: 7ac9297d217251340f2ccccfe752f86b15360627da939b044fb1ce9d7e92cf6fed7f7514fb7cc53e099b91146ba5bbf792ee60efa4e2233b959b2b303eff49210001000000000000c003000000000000441e9e66000000000041045fecd538b0e87c0b4f3978a8cae2aa58a321bbee4df7ec85336a504b2d89287dd8e7c3199df0bfc3a866999553aeef794cdf260af27fc86e9ba2f7d0118b9e997e15255dc9990fd6af4edaa1624199b72e8a405bb8815e66249717f8efe2f49e
            // class BytesMessage extends Bytes(502) {}
            // let bytes1 = BytesMessage.fromHex('7ac9297d217251340f2ccccfe752f86b15360627da939b044fb1ce9d7e92cf6fed7f7514fb7cc53e099b91146ba5bbf792ee60efa4e2233b959b2b303eff49210001000000000000c003000000000000441e9e66000000000041045fecd538b0e87c0b4f3978a8cae2aa58a321bbee4df7ec85336a504b2d89287dd8e7c3199df0bfc3a866999553aeef794cdf260af27fc86e9ba2f7d0118b9e997e15255dc9990fd6af4edaa1624199b72e8a405bb8815e66249717f8efe2f49e');
            // console.log('7ac9297d217251340f2ccccfe752f86b15360627da939b044fb1ce9d7e92cf6fed7f7514fb7cc53e099b91146ba5bbf792ee60efa4e2233b959b2b303eff49210001000000000000c003000000000000441e9e66000000000041045fecd538b0e87c0b4f3978a8cae2aa58a321bbee4df7ec85336a504b2d89287dd8e7c3199df0bfc3a866999553aeef794cdf260af27fc86e9ba2f7d0118b9e997e15255dc9990fd6af4edaa1624199b72e8a405bb8815e66249717f8efe2f49e\n')
            // console.log(bytes1.toHex().slice(0,502));
        
            //console.time('Execution of Request to TLSN Client & Proof Generation');
            const res = (await axios.post('https://127.0.0.1:5000/proof',proofObject, { httpsAgent: agent })).data;
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

            // class BytesSignature extends Bytes(128) {}
            // let bytes = BytesSignature.fromHex(notary_proof["session"]["signature"]["P256"]);
            // console.log(notary_proof["session"]["signature"]["P256"]);
            // console.log(bytes.toHex().slice(0,128));

            // class BytesMessage extends Bytes(374) {}
            // let bytes1 = BytesMessage.fromHex(bytesToHex(msgByteArray));
            // console.log(bytesToHex(msgByteArray));
            // let stuff:string = bytesToHex(msgByteArray);
            // console.log(stuff.length)
            // console.log(bytes1.toHex().slice(0,374));

             // notary_proof["session"]["signature"]["P256"].toLowerCase() == bytes.toHex().slice(0,128) ? console.log("true Signature") : console.log("wrong Signature");
            // bytesToHex(msgByteArray) == bytes1.toHex().slice(0,374) ?  console.log("true message") : console.log("wrong message");

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

            notary_proof["session"]["signature"]["P256"] ==concatSig ? console.log("true Signature") : console.log("wrong Signature");
            bytesToHex(msgByteArray) == concatMsg.slice(0,374) ?  console.log("true message") : console.log("wrong message");
            console.log(`Original Signature: ${notary_proof["session"]["signature"]["P256"]}`);
            
            const p256data = new P256Data({
              signature: [
                signatureParts[0],
                signatureParts[1],
                signatureParts[2],
                signatureParts[3]
            ],
              messageHex: [
                messageParts[0],
                messageParts[1],
                messageParts[2],
                messageParts[3],
                messageParts[4],
                messageParts[5],
                messageParts[6],
                messageParts[7],
                messageParts[8],
                messageParts[9],
                messageParts[10],
                messageParts[11]
            ]
            });

            let reconstructedSig=''
            p256data.signature.forEach(part=>{
                reconstructedSig += part.toString();
            })
            console.log(`Reconstructed Signature: ${reconstructedSig}`);

            const publicArguments = new PublicArgumets({
                commitment: Field(BigInt(`0x${CM}`)),
                dataField: Field(rawData)
            });

            // const public_key_notary = hexToBytes('0206fdfa148e1916ccc96b40d0149df05825ef54b16b711ccc1b991a4de1c6a12c');
            // const messageActual = hexToBytes(concatMsg);
            // const signatureActual = p256.Signature.fromCompact(concatSig)
            // const resultECDSA = p256.verify(signatureActual, 
            //     messageActual, 
            //     public_key_notary, 
            //     {prehash:true})
            
            // console.log(resultECDSA);
            
            const zkonzkP = await ZkonZkProgramTest.compile();
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
            /*
            let senderKey = PrivateKey.fromBase58(config.MINA_PRIVATE_KEY!);
            let sender = senderKey.toPublicKey();

            let zkRequestAddress = PublicKey.fromBase58(config.ZK_REQUESTS_ADDRESS);
    
            let zkApp = eval(requestObjetct.zkapp);
            await zkApp.compile();
            console.log('Compiled');
            const zkRequest = new zkApp(zkRequestAddress);
            console.log('');


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
        */
        }
        await sleep(30000); //30 seconds
    }
}

main();