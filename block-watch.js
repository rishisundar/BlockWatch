const Web3 = require('web3');

const web3 = new Web3('wss://rpc.ankr.com/eth/ws/');

web3.eth.getBlockNumber((error, blockNumber) => {
    if (error) {
        console.error(error);
    } else {
        console.log('Latest block number:', blockNumber);
    }
});

const filter = {
    topics: [
        web3.utils.sha3('Transfer(address,address,uint256)'),
        web3.utils.sha3('Withdraw(address,uint256)'),
        web3.utils.sha3('Unstake(address,uint256)'),
        web3.utils.sha3('Swap(address,uint256,address,uint256)')
    ]
};


const subscription = web3.eth.subscribe('logs', {
    filter
}, (error, result) => {
    if (!error) {
        if (result.blockNumber !== null) {

            // Decode the log data based on the event signature
            if (result.topics[0] === filter.topics[0]) {
                console.log('Result:', result);

                // Transfer event
                const data = web3.eth.abi.decodeLog(
                    [{
                            type: 'address',
                            name: 'from',
                            indexed: true
                        },
                        {
                            type: 'address',
                            name: 'to',
                            indexed: true
                        },
                        {
                            type: 'uint256',
                            name: 'value'
                        }
                    ],
                    result.data,
                    result.topics.slice(1)
                );
                console.log(`Transfer from ${data.from} to ${data.to}: ${data.value} tokens`);
            } else if (result.topics[0] === filter.topics[1]) {
                console.log('Result:', result);

                // Swap event
                const data = web3.eth.abi.decodeLog(
                    [{
                            type: 'address',
                            name: 'sender',
                            indexed: true
                        },
                        {
                            type: 'address',
                            name: 'recipient',
                            indexed: true
                        },
                        {
                            type: 'uint256',
                            name: 'amount0In'
                        },
                        {
                            type: 'uint256',
                            name: 'amount1In'
                        }
                    ],
                    result.data,
                    result.topics.slice(1)
                );
                console.log(`Swap from ${data.sender} to ${data.recipient}: ${data.amount0In} tokens of token0 and ${data.amount1In} tokens of token1`);
            } else if (result.topics[0] === filter.topics[2]) {
                console.log('Result:', result);

                // Unstake event
                const data = web3.eth.abi.decodeLog(
                    [{
                            type: 'address',
                            name: 'user',
                            indexed: true
                        },
                        {
                            type: 'uint256',
                            name: 'amount'
                        }
                    ],
                    result.data,
                    result.topics.slice(1)
                );
                console.log(`Unstake from ${data.user}: ${data.amount} tokens`);
            } else if (result.topics[0] === filter.topics[3]) {
                console.log('Result:', result);

                // Withdraw event
                const data = web3.eth.abi.decodeLog(
                    [{
                            type: 'address',
                            name: 'token',
                            indexed: true
                        },
                        {
                            type: 'address',
                            name: 'user',
                            indexed: true
                        },
                        {
                            type: 'uint256',
                            name: 'amount'
                        }
                    ],
                    result.data,
                    result.topics.slice(1)
                );
                console.log(`Withdraw from ${data.user}: ${data.amount} tokens of ${data.token}`);
            }
        }
    }
});

// Unsubscribe after 10 seconds
setTimeout(() => {
    subscription.unsubscribe((error, success) => {
        if (success) {
            console.log('Unsubscribed successfully!');
        }
        process.exit()
    });
}, 30000);