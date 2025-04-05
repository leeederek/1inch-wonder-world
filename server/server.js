const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const { OpenAI } = require('openai');
const { SDK, NetworkEnum, HashLock, PrivateKeyProviderConnector } = require('@1inch/cross-chain-sdk');
const { verifyCloudProof } = require('@worldcoin/minikit-js');
const { Web3 } = require('web3');
const { solidityPackedKeccak256, randomBytes, Contract, Wallet, JsonRpcProvider } = require('ethers');

dotenv.config();

const INCH_API_URL = 'https://fusion.1inch.io';
const INCH_API_KEY = process.env.INCH_API_KEY;

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL =
  process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1"

const openai = new OpenAI({
  apiKey: OPENROUTER_API_KEY,
  baseURL: OPENROUTER_BASE_URL,
  defaultHeaders: {
    "HTTP-Referer": "https://github.com/OpenRouterTeam/openrouter-examples",
  },
  // dangerouslyAllowBrowser: true, // Enable this if you used OAuth to fetch a user-scoped `apiKey` above. See https://openrouter.ai/docs#oauth to learn how.
})

const app = express();
app.use(cors());
app.use(express.json());

// Load environment variables
const process = dotenv.config().parsed;

// Helper function for random bytes
function getRandomBytes32() {
    return '0x' + Buffer.from(randomBytes(32)).toString('hex');
}

// Configuration
const config = {
    makerPrivateKey: process?.WALLET_KEY,
    makerAddress: process?.WALLET_ADDRESS,
    nodeUrl: process?.RPC_URL,
    devPortalApiKey: process?.DEV_PORTAL_KEY
};

// Validate environment variables
if (!config.makerPrivateKey || !config.makerAddress || !config.nodeUrl || !config.devPortalApiKey) {
    throw new Error("Missing required environment variables. Please check your .env file.");
}

// Initialize SDK and providers
const web3Instance = new Web3(config.nodeUrl);
const blockchainProvider = new PrivateKeyProviderConnector(config.makerPrivateKey, web3Instance);

const sdk = new SDK({
    url: 'http://localhost:8888/fusion-plus',
    authKey: config.devPortalApiKey,
    blockchainProvider
});

const approveABI = [{
    "constant": false,
    "inputs": [
        { "name": "spender", "type": "address" },
        { "name": "amount", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "name": "", "type": "bool" }],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
}];

// Add this helper function to handle BigInt serialization
const JSONBigInt = {
  stringify: (obj) => {
    return JSON.stringify(obj, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );
  }
};

// Test endpoint
app.get('/api/getquote', async (req, res) => {
    try {
        console.log('Starting 1inch cross-chain test...');

        const params = {
            srcChainId: NetworkEnum.ETHEREUM,
            dstChainId: NetworkEnum.GNOSIS,
            srcTokenAddress: "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI on Ethereum
            dstTokenAddress: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", // Native token on Gnosis
            amount: "1000000000000000000000" // 1000 DAI (with 18 decimals)
        };

        console.log('Requesting quote with params:', params);
        const quote = await sdk.getQuote(params);
        console.log('Quote received:', quote);

        // Use custom stringify function to handle BigInt
        const response = {
            message: 'Cross-chain quote successful',
            params: params,
            quote: quote
        };

        res.setHeader('Content-Type', 'application/json');
        res.send(JSONBigInt.stringify(response));
    } catch (error) {
        console.error('Cross-chain test error:', error);
        res.status(500).json({
            error: 'Cross-chain test failed',
            details: error.message
        });
    }
});

// 1inch Fusion+ test endpoint
app.post('/api/fusion/test', async (req, res) => {
    console.log('Fusion test endpoint hit'); // Add this log
    try {
        console.log('Starting Fusion+ test...');
        console.log('API URL:', INCH_API_URL);
        console.log('API Key exists:', !!INCH_API_KEY);

        const testParams = {
            src: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',  // ETH
            dst: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',  // USDC
            amount: '1000000000000000000', // 1 ETH in wei
            chainId: 1
        };

        console.log('Test parameters:', testParams);

        const quoteResponse = await axios({
            method: 'get',
            url: `${INCH_API_URL}/quote`,
            headers: {
                'Authorization': `Bearer ${INCH_API_KEY}`,
                'Accept': 'application/json'
            },
            params: testParams
        });

        console.log('Quote response received:', quoteResponse.data);
        res.json({
            message: 'Fusion+ test successful',
            quoteData: quoteResponse.data
        });
    } catch (error) {
        console.error('Fusion+ test error:', error);
        res.status(500).json({
            error: 'Fusion+ test failed',
            details: error.message
        });
    }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
      console.log('1. Received request from frontend with message:', message);
      
      console.log('2. Making OpenRouter request...');
      

      // Streaming responses
      const stream = await openai.chat.completions.create({
        model: "openai/gpt-4",
      messages: [{ role: "user", content: message }],
        stream: true,
      })
      for await (const part of stream) {
        const content = part.choices[0]?.delta?.content || "";
        // Send the content to the frontend
        console.log(content);
        res.write(content);  
      }
      res.end();

    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ 
        error: 'Something went wrong',
        details: error.message 
      });
    }
  });
  
// Add 1inch API endpoints
app.post('/api/fusion/quote', async (req, res) => {
  try {
    const {
      src,           // Source token address
      dst,           // Destination token address
      amount,        // Amount in wei
      chainId        // Chain ID (e.g., 1 for Ethereum mainnet)
    } = req.body;

    const response = await axios.get(`${INCH_API_URL}/${chainId}/quote`, {
      headers: {
        'Authorization': `Bearer ${INCH_API_KEY}`,
        'Accept': 'application/json'
      },
      params: {
        src,
        dst,
        amount
      }
    });

    console.log('Fusion+ quote response:', response.data);
    res.json(response.data);
  } catch (error) {
    console.error('Fusion+ quote error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to get quote',
      details: error.response?.data || error.message
    });
  }
});

app.post('/api/fusion/swap', async (req, res) => {
  try {
    const {
      src,           // Source token address
      dst,           // Destination token address
      amount,        // Amount in wei
      from,          // User's wallet address
      slippage,      // Slippage tolerance (e.g., 1 for 1%)
      chainId        // Chain ID
    } = req.body;

    const response = await axios.post(`${INCH_API_URL}/${chainId}/swap`, {
      src,
      dst,
      amount,
      from,
      slippage
    }, {
      headers: {
        'Authorization': `Bearer ${INCH_API_KEY}`,
        'Accept': 'application/json'
      }
    });

    console.log('Fusion+ swap response:', response.data);
    res.json(response.data);
  } catch (error) {
    console.error('Fusion+ swap error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to create swap',
      details: error.response?.data || error.message
    });
  }
});

// Add the verify endpoint
app.post('/api/verify', async (req, res) => {
  try {
    const { payload, action, signal } = req.body;
    
    // Get app_id from environment variables
    const app_id = process.env.APP_ID;
    
    if (!app_id || !app_id.startsWith('app_')) {
      throw new Error('Invalid or missing APP_ID in environment variables');
    }

    // Verify the proof
    const verifyRes = await verifyCloudProof(payload, app_id, action, signal);

    if (verifyRes.success) {
      // Verification succeeded
      // Here you can add additional logic like:
      // - Update user status in database
      // - Create session tokens
      // - etc.
      
      console.log('Verification successful:', verifyRes);
      res.json({ 
        verifyRes, 
        status: 200,
        message: 'Verification successful' 
      });
    } else {
      // Verification failed
      console.log('Verification failed:', verifyRes);
      res.status(400).json({ 
        verifyRes, 
        status: 400,
        message: 'Verification failed' 
      });
    }
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ 
      error: 'Verification error',
      message: error.message,
      status: 500
    });
  }
});

// Add this new endpoint to handle the swap
app.post('/api/swap', async (req, res) => {
    try {
        const {
            srcChainId = NetworkEnum.ETHEREUM,
            dstChainId = NetworkEnum.GNOSIS,
            srcTokenAddress = "0x6b175474e89094c44da98b954eedeac495271d0f",
            dstTokenAddress = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
            amount = "8000000000000000000"
        } = req.body;

        // Initialize provider and approve tokens
        const provider = new JsonRpcProvider(config.nodeUrl);
        const tkn = new Contract(srcTokenAddress, approveABI, new Wallet(config.makerPrivateKey, provider));
        
        await tkn.approve(
            '0x111111125421ca6dc452d289314280a0f8842a65', // aggregation router v6
            (2n**256n - 1n) // unlimited allowance
        );

        const params = {
            srcChainId,
            dstChainId,
            srcTokenAddress,
            dstTokenAddress,
            amount,
            enableEstimate: true,
            walletAddress: config.makerAddress
        };

        const quote = await sdk.getQuote(params);
        const secretsCount = quote.getPreset().secretsCount;
        const secrets = Array.from({ length: secretsCount }).map(() => getRandomBytes32());
        const secretHashes = secrets.map(x => HashLock.hashSecret(x));

        const hashLock = secretsCount === 1
            ? HashLock.forSingleFill(secrets[0])
            : HashLock.forMultipleFills(
                secretHashes.map((secretHash, i) =>
                    solidityPackedKeccak256(['uint64', 'bytes32'], [i, secretHash.toString()])
                )
            );

        const quoteResponse = await sdk.placeOrder(quote, {
            walletAddress: config.makerAddress,
            hashLock,
            secretHashes
        });

        // Start monitoring the order
        monitorOrder(quoteResponse.orderHash, secrets, sdk);

        res.json({
            success: true,
            orderHash: quoteResponse.orderHash,
            message: "Order placed successfully"
        });

    } catch (error) {
        console.error("Swap error:", error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Helper function to monitor order status
function monitorOrder(orderHash, secrets, sdk) {
    const intervalId = setInterval(async () => {
        try {
            const order = await sdk.getOrderStatus(orderHash);
            if (order.status === 'executed') {
                console.log(`Order ${orderHash} is complete`);
                clearInterval(intervalId);
                return;
            }

            const fillsObject = await sdk.getReadyToAcceptSecretFills(orderHash);
            if (fillsObject.fills.length > 0) {
                for (const fill of fillsObject.fills) {
                    try {
                        await sdk.submitSecret(orderHash, secrets[fill.idx]);
                        console.log(`Secret submitted for fill index ${fill.idx}`);
                    } catch (error) {
                        console.error(`Error submitting secret: ${error.message}`);
                    }
                }
            }
        } catch (error) {
            console.error(`Monitoring error: ${error.message}`);
        }
    }, 5000);

    // Clear interval after 30 minutes to prevent infinite running
    setTimeout(() => clearInterval(intervalId), 30 * 60 * 1000);
}

const startServer = async (initialPort) => {
  let currentPort = initialPort;
  
  const tryPort = (port) => {
    return new Promise((resolve, reject) => {
      const server = app.listen(port)
        .once('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            resolve(false);
          } else {
            reject(err);
          }
        })
        .once('listening', () => {
          resolve(server);
        });
    });
  };

  while (currentPort < initialPort + 100) { // Try up to 100 ports
    try {
      const server = await tryPort(currentPort);
      if (server) {
        console.log(`Server running on port ${currentPort}`);
        // Store the active port so the frontend can use it
        app.locals.port = currentPort;
        return server;
      }
      console.log(`Port ${currentPort} in use, trying ${currentPort + 1}...`);
      currentPort++;
    } catch (err) {
      console.error('Error starting server:', err);
      process.exit(1);
    }
  }
  
  console.error('Could not find an available port');
  process.exit(1);
};

const PORT = process.env.PORT || 5000;
startServer(PORT);