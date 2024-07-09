# Compiling the Verifier module

Navigate to `/verifier`, and run `npm build`. This is an essential step for the entire flow to compile. 

# How to run?

`npm run watch` to run index.ts in watch mode. 
Disable the SSL Check agent before actual production use.

# Env files

Env files are read after sanity type checks. Please modify the structure of structure of the env interface in `configs.ts`

# How commitment scheme works currently?

Suppose an API has response, 
```
response={
    "demo":"data",
    "demoField":"dataField",
    .
    .
    .
    "demoField-n":"dataField-n"
}
```
The TLS Notary client calculates the SHA256 commitment of this response. Say the `Commitment(response) == SHA256(String(response))`

Assume, SHA256(responseDataSource) = abc..z
From the MPC Prover Client, we get:

```
response_from_proofEndpoint={
    "notary_proof":Equivalent of the proof.json,
    "CM":SHA256(responseDataSource),
    "api_response":{actual dataSource Response}
}
```

What happens inside the Oracle post recieving this response?
1. The notary_proof is verified to be correct. 
2. From this verified proof, the actual datasource response is fetched.
3. Decommitment is constructed of the same response.
4. From the notary_proof, the signature data is taken, and a byte array is constructed to handle the message of the P256 Signature. 
5. To the zkProgram, we send:
- The original commitment, SHA256(responseDataSource)
- The constructed decommitment from the proof.json 
- P256 Data i.e the Signature & data byte array.
6. The Proof is computed only
- if the signature is correct & verified
- the commitment from the \proof endpoint matches the decommitment constructed.

# ToDo

- [x] Change the TLSNotary-Cleint Endpoint.
- [x] Make the TLSNotary client accept the requestObject
- [x] Accomodate zkProgram changes
- [x] Fix the commiment scheme, to make a uniform proof irrespective of data-source Endpoint.
- [x] Change TLSNotary Client to accomodate generic data-source URLs. 
