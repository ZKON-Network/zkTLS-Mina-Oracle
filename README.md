![Render - zkTLS Mina Oracle Integration](https://github.com/user-attachments/assets/6d0ed147-fa0c-4ba0-b501-633d7f968cea)

# TrueData zkOracle - zkTLS Mina Integration | ZKON

ZKON is a decentralized Oracle Network that provides secure, verifiable data feeds through Zero-Knowledge Proofs (ZKPs), zkTLS, and cryptographic attestations.

At heart of ZKON's On-chain Infrastructure lies the zkTLS-Mina-Oracle, which enables secure transfer of data through MPC-TLS and cryptographic attestations to it leveraging O1js's ZkPrograms.

## Overview

<img width="1352" alt="zkOracle - Schema 04" src="https://github.com/user-attachments/assets/f2990203-6237-483d-94c2-c05f40e93df3">

The Oracle's working can be broken down into 5 key parts:
1. Fetch IPFS from the emitted event.
2. The ZkTLS Coordinator fetches data according to IFPS Object
3. Verify the Commitment proof recieved from the ZkTLS Coordinator
4. Verify the ECDSA Signature on the ZkProgram.
5. Send the proof back to the blockchain in a transaction. The proof's public arugment is the dataField.

## Getting Started

### Compiling the verifier module.

Navigate to `/verifier`, and run `npm build`. This is an essential step for the entire flow to compile. 

### Running the oracle

Set-up the `.env` files as per `.env.example`
`PROOF_CLIENT_ADDR=` is the address of the zkTLS-Coordinator, which is provided by Zkon.

Follow the commands below to start-up the Oracle.
```
npm run prepare
npm run build
npm run serve
```

>[!CAUTION]
>Disable the SSL Check agent before actual production use.

## Deep-dive into the working of the Oracle

A user emits an event on the MINA dev/test net, the event has field hash element which is used to reconstruct the IPFS Hash of the request body to be used in the entire process.

The ZKON Oracle working can be broken down into 5 main parts.
1. Fetch IPFS from the emitted event.
2. The ZkTLS Coordinator fetches data according to IFPS Object
3. Verify the Commitment proof recieved from the ZkTLS Coordinator
4. Verify the ECDSA Signature on the ZkProgram.
5. Send the proof back to the blockchain in a transaction. The proof's public arugment is the dataField.

The Oracle's first Transaction is fetching the event which has the IPFS Hash for the particular event. The Oracle checks for unfullfiled transaction ever 30 seconds, and once it finds a transaction which is unfulfiled it continues with its flow, as explained below.

### Structure of the IPFS Object

The IPFS object structure can be defined as follows 

1. "`method`": "The HTTP Method according to which data is fetched."
2. "`baseURL`": “URL of the data feed. Eg: api.binance.com/api/v3/avgPrice?symbol=BTCUSDT
3. "`path`": “JSON key within the response, which is to be fetched”.
Suppose,for `"baseURL": "api.binance.com/api/v3/avgPrice?symbol=BTCUSDT"`, the API returns:
`Response = { "mins": 5, "price": "62959.73420364","closeTime": "1728327827320"}`
 Say you want the proof to include the `price` key of the API-Response. Then populate `"path":"price"`
For nested responses, the path can be seperated with commas. 
Example: ``"path":"state,city"``
4. "`zkApp`" - the compiled ZkApp - add detailed information about this step. 

### Steps After the IPFS Json is Fecthed

Using this IPFS Json Object, the Oracle now creates a payload using which the Coordinator ZKTLS server fetches data from the dataFeed URL using ZkTLS.

The ZkTLS Coordinator responds to the oracle with 
1. TLSNotary Commitment Proof.
2. The plaintext response (deprecated in use)
3. The SHA256 Commitment to the data-source response.

The Commitment Proof is verified using Notary supplied binary which can run the TLSN-Verifier in javascript. If the commitment proof supplied is invalid or tampered with in transit, the proof will be invalidated, and the oracle will throw an exception. This is verified using the public key of the particular Notary. 

So a **malicious notary should not be able to take down the network or send incorrect/invalid data**. 

Details in this very step are better explained in the working of the [coordinator.](#ZkTLS-Coordinator-Server) 

This commitment proof is verified by a relevant TLSNotary exposed verification function.

### ZkProgram 

The ZkProgram essentially performs 2 checks, 
1. Commitment to the plain-text of the data-source response.(optional, but redundant)
2. ECDSA Signature verification. 

#### **ECDSA Signature Verification**

The **commitment proof** is now used to construct the data necessary for ECDSA signature verification. The **session header** of the commitment proof is signed against the key of the Notary in ECDSA over Secp256k1. 

Message for the ECDSA signature verification is the above sereilized session header from the commitment proof and the public key is the public key of the participant notary. 

The ZkProgram checks for the a valid signature and a valid message hash.

#### **Commitment to the plain-text of the data-source response**

TLSNotary's commitment proof has the property to derive the plain-text response object from the data-source upon successful verification of the commitment proof. 

The ZkTLS Coordinator responds to the oracle with 
1. TLSNotary Commitment Proof.
2. The plaintext response _(deprecated in use)_
3. The SHA256 Commitment to the data-source response.

The actual response body can be derived from 1, and then the decommitment to this can be constructed by SHA256(Response Body). This step is a additional(and potentially redundant) step which ensures the ZkTLS Coordinator does not send the Oracle response which has been tampered with. 

## Proposed Upgrades to Oracle

* This two transaction approach will be simplified in V2 where there will only be a single transaction overall, where a signle transaction is needede to fetch.
* V2 will have an overhauled zkProgram which has more self contained checks regarding the Server session info, and key-exchange parameters. This is WIP, and is our most important priority.
