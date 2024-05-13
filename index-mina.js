const { Mina, PublicKey, UInt32 } = require('o1js');

require('dotenv').config();
const axios = require('axios');

const sleep = async (ms) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

const main = async () => {
    while(true) {

        const Network = Mina.Network({
            mina: 'https://api.minascan.io/node/devnet/v1/graphql',
            archive: 'https://api.minascan.io/archive/devnet/v1/graphql',
        });
        Mina.setActiveInstance(Network);        
        
        const blockNr = UInt32.from(0) //ToDo Check how to get last block number
        const fromBlock = UInt32.from(blockNr)
        const toBlock = blockNr >= process.env.MAX_BLOCKS_TO_CHECK ? UInt32.from(blockNr) - process.env.MAX_BLOCKS_TO_CHECK : 0;

        const logs = await Mina.fetchEvents(PublicKey.fromBase58(process.env.MINA_ADDRESS));
        
        console.log('Events found: ', logs.length);
        
        for (const log of logs) {
            const requestEvent = provablePure(log.event.data).toFields(log.event.data);
            const fieldHash1 = requestEvent[1]
            const fieldHash2 = requestEvent[2]

            const hash1 = StringCircuitValue.fromBits(fieldHash1.toBits()).toString().replace(/\0/g, '')
            const hash2 = StringCircuitValue.fromBits(fieldHash2.toBits()).toString().replace(/\0/g, '')
        
            // const ipfsHashFile = hash1.concat(hash2);
            const ipfsHashFile = "QmbCpnprEGiPZfESXkbXmcXcBEt96TZMpYAxsoEFQNxoEV"; //Mock JSON Request

            //Fetch JSON from IPFS            
            const requestObjetct = (await axios.create().request(process.env.IPFS_GATEWAY + ipfsHashFile)).data;
            
            //Fetch original request
            const res = (await axios.create().request({
                method: requestObjetct.method ? requestObjetct.method : 'get',
                url: requestObjetct.baseUrl ? requestObjetct.baseUrl : ''
            })).data;

            let rawData = res;
            if (requestObjetct.path){
                const path = requestObjetct.path.split(',');
                for (const element of path) {
                    rawData = rawData[element];
                }
            }

            //Send the transaction to the callbackFunction
        }
        await sleep(10000);
    }
}

main();