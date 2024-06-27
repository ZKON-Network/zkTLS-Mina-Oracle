# Compiling the Verifier module

Navigate to `/verifier`, and run `npm build`. This is an essential step for the entire flow to compile. 

# How to run?

`npm run watch` to run index.ts in watch mode. 
**warning** 
Disable the SSL Check agent before actual production use.

# ToDo

- [ ] Check how to get last block number. Removed UInt32 parsing to resolve type mismatch. 
- [ ] Resolve Mina.fetchEvents() with actual tokenId field.
- [ ] Fetch JSON from IPSF seems unresponsive. Investigate.
- [ ] Add TLSN Client URL in .env file. 
- [ ] Send the transaction to the callbackFunction
- [ ] Adjust sleep( seconds*1000 ) value accordingly. 