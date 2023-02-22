const Web3 = require('web3');
require('dotenv').config()
const axios = require('axios');
const BigNumber = require('bignumber.js');

const web3 = new Web3(`${process.env.RPC_NODE_URL}`);
console.clear();
web3.eth.getBlockNumber((error, blockNumber) => {
    if (error) {
        console.error(error);
    } else {
        console.log('Latest block number:', blockNumber);
    }
});

const DEFILLAMA_COIN_PRICE_API_ENDPOINT_PREFIX = 'https://coins.llama.fi/prices/current/';
const DEFILLAMA_COIN_PRICE_INFO_SEARCH_WIDTH = '1h'; //Defaults to 6h
const LARGE_VALUE_LIMIT_USD = new BigNumber('1000');

const filter = {
    topics: [
        web3.utils.sha3('Transfer(address,address,uint256)'),
        web3.utils.sha3('Withdraw(address,uint256)'),
        web3.utils.sha3('Unstake(address,uint256)'),
        web3.utils.sha3('Swap(address,uint256,address,uint256)')
    ]
};


async function getPriceFromDefillama(address) {
    let pricingInfo = null;
    const defiLlamaRequestURLSuffix = `ethereum:${address}`;
    const requestURL = DEFILLAMA_COIN_PRICE_API_ENDPOINT_PREFIX.concat(defiLlamaRequestURLSuffix);
    const response = await axios.get(requestURL, {
        params: {
            searchWidth: DEFILLAMA_COIN_PRICE_INFO_SEARCH_WIDTH,
        },
    });
    if (response.status !== 200) {
        logger.error(
            `DefiLlama request failed with status code ${response.status}. ${response.statusText}`
        );
    } else {
        const coinPrice = response?.data?.coins[defiLlamaRequestURLSuffix];
        if (coinPrice) {
            pricingInfo = {
                usdPrice: coinPrice.price,
                decimals: coinPrice.decimals,
                symbol: coinPrice.symbol
            }
        }
    }
    return pricingInfo;
}


const subscription = web3.eth.subscribe('logs', {
    filter
}, async (error, result) => {
    if (!error) {
        if (result && result.blockNumber !== null) {
            try {
                if (result.topics[0] === filter.topics[0]) {

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
                    const tokenInfo = await getPriceFromDefillama(result.address);
                    if (tokenInfo) {
                        const rawTokenValue = new BigNumber(data.value);
                        const actualTokenValue = rawTokenValue.dividedBy(Math.pow(10, tokenInfo.decimals));
                        const transferValueUSD = actualTokenValue.times(tokenInfo.usdPrice);
                        if (transferValueUSD.isGreaterThanOrEqualTo(LARGE_VALUE_LIMIT_USD)) {
                            console.log(`\nBEGINNING OF ALERT\n\nLarge Transfer Log:\n${JSON.stringify(result, null, 2)}\n`);
                            console.log(`Large transfer from ${data.from} to ${data.to}: ${actualTokenValue.toFixed(2)} ${tokenInfo.symbol} tokens ($${transferValueUSD.toFixed(2)})\ntxHash: ${result.transactionHash}\n`);
                            console.log('END OF ALERT\n');
                        }
                    }
                } else if (result.topics[0] === filter.topics[1]) {
                    console.log('Swap Log:', result);

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
                    console.log(`Swap from ${data.sender} to ${data.recipient}: ${data.amount0In} tokens of token0 and ${data.amount1In} tokens of token1.\n`);
                } else if (result.topics[0] === filter.topics[2]) {
                    console.log('Unstake Log:', result);

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
                    console.log(`Unstake from ${data.user}: ${data.amount} tokens.\n`);
                } else if (result.topics[0] === filter.topics[3]) {
                    console.log('Withdraw Log:', result);

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
                    console.log(`Withdraw from ${data.user}: ${data.amount} tokens of ${data.token}.\n`);
                }
            } catch (err) {
                // console.error('Unable to decode log.\n');
            }
        }
    }
});

// Unsubscribe after 30 seconds
setTimeout(() => {
    subscription.unsubscribe((error, success) => {
        if (success) {
            console.log('Unsubscribed successfully!');
        }
        process.exit()
    });
}, 30000);
