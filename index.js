require('dotenv').config()
const ethers = require('ethers');
const cbor = require('cbor-x');
const axios = require('axios');

const sleep = async (ms) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

const hexConcat = (items) => {
    let result = "0x";
    items.forEach((item) => {
        result += ethers.hexlify(item).substring(2);
    });
    return result;
}

const main = async () => {
    while(true) {

        const provider = new ethers.JsonRpcProvider(process.env.NODE_URI);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        const signer = wallet.connect(provider);

        const block = await provider.getBlockNumber();

        const logs = await provider.getLogs({
            address: process.env.CONTRACT_ADDRESS,
            fromBlock: block - parseInt(process.env.MAX_BLOCKS_TO_CHECK),
            toBlock: block,
            topics: [ethers.id('Requested(bytes32,bytes)')],
        });

        const encoder = new cbor.Encoder();
        const abiCoder = new ethers.ethers.AbiCoder();

        console.log('Events found', logs.length);

        for (const log of logs) {
            const rawRequest = log.data;
            const requestData = abiCoder.decode(
                ['bytes32','address','bytes4','uint256','uint256','bytes'],
                abiCoder.decode(
                    ['bytes'],
                    rawRequest
                )[0]
            );
            
            const request = encoder.decodeMultiple(ethers.getBytes(requestData[5]));
            const requestMapping = {};
            for (let i = 0; i < request.length; i += 2) {
                requestMapping[request[i]] = request[i+1];
            }

            const res = (await axios.create().request({
                method: requestMapping['get'] ? 'get' : 'post',
                baseURL: requestMapping['get'] ? requestMapping['get'] : requestMapping['post'],
            })).data;

            const path = requestMapping['path'].split(',');
            let rawData = res;
            for (const element of path) {
                rawData = rawData[element];
            }

            let response = rawData;
            if (requestMapping['times']) {
                response = ethers.formatUnits(ethers.parseUnits(response.toString()) * requestMapping['times'], 18, 0).split(".")[0];
            }

            const nonce = await provider.getTransactionCount(signer.address);

            try {
                const { hash } = await signer.sendTransaction({
                    from: signer.address,
                    to: requestData[1],
                    nonce,
                    // gasPrice: gasPrice.toString(),
                    // gasLimit: 1000000,
                    value: 0,
                    data: hexConcat([
                        requestData[2], 
                        (new ethers.AbiCoder()).encode(
                            ['bytes32','uint256','uint256','uint[2]','uint[2]','uint[2]','uint[2]'],
                            [log.topics[1], '0', response, [0,0], [0,0], [0,0], [0,0]]
                        )
                    ]),
                });
                await provider.waitForTransaction(hash);
                console.log('Tx answered!');
            } catch (e){
                //
            }
        }
        await sleep(10000);
    }
}

main();