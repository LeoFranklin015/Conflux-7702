import express, { type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { RelayerService, type ExecuteWithFeeIntent, type ExecuteIntent, type ExecuteWithGranteeIntent } from './relayer.service.js';
import { DatabaseService } from './db.service.js';
import { RELAYER_CONFIG, ACTIVE_NETWORK, SMART_ACCOUNT_ADDRESS } from './config.js';
import type { Address, Hex } from 'viem';

const app = express();
const relayer = new RelayerService();
const db = new DatabaseService();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    network: ACTIVE_NETWORK.name,
    chainId: ACTIVE_NETWORK.chainId,
  });
});

/**
 * GET /stats
 * Get relayer statistics
 */
app.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await relayer.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      error: 'Failed to fetch relayer stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /nonce/:address
 * Get current nonce for a user address
 */
app.get('/nonce/:address', async (req: Request, res: Response) => {
  try {
    const userAddress = req.params.address as Address;

    // Basic address validation
    if (!userAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid address format' });
    }

    const nonce = await relayer.getNonce(userAddress);

    res.json({
      address: userAddress,
      nonce: nonce.toString(),
    });
  } catch (error) {
    console.error('Error fetching nonce:', error);
    res.status(500).json({
      error: 'Failed to fetch nonce',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /store-authorization
 * Store EIP-7702 authorization signature for later use
 * This allows users to "onboard" without making a transaction
 */
app.post('/store-authorization', async (req: Request, res: Response) => {
  try {
    const { userAddress, contractAddress, chainId, nonce, r, s, yParity } =
      req.body;

    // Validate input
    if (
      !userAddress ||
      !contractAddress ||
      chainId === undefined ||
      nonce === undefined ||
      !r ||
      !s ||
      yParity === undefined
    ) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: [
          'userAddress',
          'contractAddress',
          'chainId',
          'nonce',
          'r',
          's',
          'yParity',
        ],
      });
    }

    // Validate addresses
    if (
      !userAddress.match(/^0x[a-fA-F0-9]{40}$/) ||
      !contractAddress.match(/^0x[a-fA-F0-9]{40}$/)
    ) {
      return res.status(400).json({ error: 'Invalid address format' });
    }

    // Store authorization
    db.storeAuthorization({
      userAddress: userAddress as Address,
      contractAddress: contractAddress as Address,
      chainId: Number(chainId),
      nonce: BigInt(nonce),
      r: r as Hex,
      s: s as Hex,
      yParity: Number(yParity),
    });

    res.json({
      success: true,
      message: 'Authorization stored successfully',
      userAddress,
    });
  } catch (error) {
    console.error('Error storing authorization:', error);
    res.status(500).json({
      error: 'Failed to store authorization',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /authorization/:address
 * Get stored authorization for a user
 */
app.get('/authorization/:address', async (req: Request, res: Response) => {
  try {
    const userAddress = req.params.address as Address;

    if (!userAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid address format' });
    }

    const auth = db.getUnusedAuthorization(
      userAddress,
      SMART_ACCOUNT_ADDRESS,
      ACTIVE_NETWORK.chainId
    );

    if (!auth) {
      return res.json({
        hasAuthorization: false,
        hasDelegation: db.hasDelegation(
          userAddress,
          SMART_ACCOUNT_ADDRESS,
          ACTIVE_NETWORK.chainId
        ),
      });
    }

    res.json({
      hasAuthorization: true,
      authorization: {
        userAddress: auth.userAddress,
        contractAddress: auth.contractAddress,
        chainId: auth.chainId,
        nonce: auth.nonce.toString(),
        r: auth.r,
        s: auth.s,
        yParity: auth.yParity,
        createdAt: auth.createdAt,
      },
    });
  } catch (error) {
    console.error('Error fetching authorization:', error);
    res.status(500).json({
      error: 'Failed to fetch authorization',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /execute
 * Execute user intent without fee (for testing)
 */
app.post('/execute', async (req: Request, res: Response) => {
  try {
    const { userAddress, calls, nonce, signature } = req.body;

    // Validate input
    if (!userAddress || !calls || nonce === undefined || !signature) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['userAddress', 'calls', 'nonce', 'signature'],
      });
    }

    // Parse calls
    const parsedCalls = calls.map((call: any) => ({
      target: call.target as Address,
      value: BigInt(call.value || 0),
      data: call.data as Hex,
    }));

    const intent: ExecuteIntent = {
      userAddress: userAddress as Address,
      calls: parsedCalls,
      nonce: BigInt(nonce),
      signature: signature as Hex,
    };

    // Submit transaction
    const txHash = await relayer.executeIntent(intent);

    res.json({
      success: true,
      txHash,
      explorer: `${ACTIVE_NETWORK.explorer}/tx/${txHash}`,
    });
  } catch (error) {
    console.error('Error executing intent:', error);
    res.status(500).json({
      error: 'Failed to execute intent',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /execute-with-fee
 * Execute user intent with fee payment (main relayer endpoint)
 */
app.post('/execute-with-fee', async (req: Request, res: Response) => {
  try {
    const {
      userAddress,
      calls,
      feeToken,
      feeAmount,
      nonce,
      signature,
      authorization,
    } = req.body;

    // Validate input
    if (
      !userAddress ||
      !calls ||
      !feeToken ||
      feeAmount === undefined ||
      nonce === undefined ||
      !signature
    ) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: [
          'userAddress',
          'calls',
          'feeToken',
          'feeAmount',
          'nonce',
          'signature',
        ],
      });
    }

    // Parse calls
    const parsedCalls = calls.map((call: any) => ({
      target: call.target as Address,
      value: BigInt(call.value || 0),
      data: call.data as Hex,
    }));

    // Check user has sufficient token balance
    const hasBalance = await relayer.checkTokenBalance(
      userAddress as Address,
      feeToken as Address,
      BigInt(feeAmount)
    );

    if (!hasBalance) {
      return res.status(400).json({
        error: 'Insufficient token balance',
        message: `User does not have enough tokens to pay fee`,
      });
    }

    // Check if we need to use stored authorization
    let authToUse = authorization;
    let storedAuthId: number | undefined;

    if (!authToUse) {
      // No authorization provided, check if we have one stored
      const storedAuth = db.getUnusedAuthorization(
        userAddress as Address,
        SMART_ACCOUNT_ADDRESS,
        ACTIVE_NETWORK.chainId
      );

      if (storedAuth) {
        console.log(`Using stored authorization for ${userAddress}`);
        authToUse = {
          contractAddress: storedAuth.contractAddress,
          chainId: storedAuth.chainId,
          nonce: storedAuth.nonce.toString(),
          r: storedAuth.r,
          s: storedAuth.s,
          yParity: storedAuth.yParity,
        };
        storedAuthId = storedAuth.id;
      }
    }

    const intent: ExecuteWithFeeIntent = {
      userAddress: userAddress as Address,
      calls: parsedCalls,
      feeToken: feeToken as Address,
      feeAmount: BigInt(feeAmount),
      nonce: BigInt(nonce),
      signature: signature as Hex,
      authorization: authToUse
        ? {
            contractAddress: authToUse.contractAddress as Address,
            chainId: authToUse.chainId,
            nonce: BigInt(authToUse.nonce),
            r: authToUse.r as Hex,
            s: authToUse.s as Hex,
            yParity: authToUse.yParity,
          }
        : undefined,
    };

    // Submit transaction
    const txHash = await relayer.executeIntentWithFee(intent);

    // Wait for confirmation (optional - could be done async)
    const receipt = await relayer.waitForTransaction(txHash);

    // Mark stored authorization as used if we used one
    if (storedAuthId !== undefined) {
      db.markAuthorizationAsUsed(storedAuthId);
    }

    res.json({
      success: true,
      txHash,
      blockNumber: receipt.blockNumber.toString(),
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status,
      explorer: `${ACTIVE_NETWORK.explorer}/tx/${txHash}`,
      usedStoredAuthorization: storedAuthId !== undefined,
    });
  } catch (error) {
    console.error('Error executing intent with fee:', error);
    res.status(500).json({
      error: 'Failed to execute intent with fee',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /grantee-nonce/:userAddress/:granteeAddress
 * Get grantee nonce for a user-grantee pair
 */
app.get('/grantee-nonce/:userAddress/:granteeAddress', async (req: Request, res: Response) => {
  try {
    const userAddress = req.params.userAddress as Address;
    const granteeAddress = req.params.granteeAddress as Address;

    if (!userAddress.match(/^0x[a-fA-F0-9]{40}$/) || !granteeAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid address format' });
    }

    const nonce = await relayer.getGranteeNonce(userAddress, granteeAddress);

    res.json({
      userAddress,
      granteeAddress,
      nonce: nonce.toString(),
    });
  } catch (error) {
    console.error('Error fetching grantee nonce:', error);
    res.status(500).json({
      error: 'Failed to fetch grantee nonce',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /grantee-info/:userAddress/:granteeAddress
 * Get grantee authorization and spending info
 */
app.get('/grantee-info/:userAddress/:granteeAddress', async (req: Request, res: Response) => {
  try {
    const userAddress = req.params.userAddress as Address;
    const granteeAddress = req.params.granteeAddress as Address;

    if (!userAddress.match(/^0x[a-fA-F0-9]{40}$/) || !granteeAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid address format' });
    }

    const isAuthorized = await relayer.isGranteeAuthorized(userAddress, granteeAddress);
    const spending = await relayer.getGranteeSpending(userAddress, granteeAddress);

    res.json({
      userAddress,
      granteeAddress,
      isAuthorized,
      monthlySpent: spending.monthlySpent.toString(),
      monthlyLimit: spending.monthlyLimit.toString(),
      perTxLimit: spending.perTxLimit.toString(),
    });
  } catch (error) {
    console.error('Error fetching grantee info:', error);
    res.status(500).json({
      error: 'Failed to fetch grantee info',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /execute-with-grantee
 * Execute with grantee signature (subscription auto-billing)
 */
app.post('/execute-with-grantee', async (req: Request, res: Response) => {
  try {
    const {
      userAddress,
      calls,
      feeToken,
      feeAmount,
      grantee,
      nonce,
      granteeSignature,
    } = req.body;

    if (!userAddress || !calls || !feeToken || feeAmount === undefined ||
        !grantee || nonce === undefined || !granteeSignature) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['userAddress', 'calls', 'feeToken', 'feeAmount', 'grantee', 'nonce', 'granteeSignature'],
      });
    }

    const parsedCalls = calls.map((call: any) => ({
      target: call.target as Address,
      value: BigInt(call.value || 0),
      data: call.data as Hex,
    }));

    const intent: ExecuteWithGranteeIntent = {
      userAddress: userAddress as Address,
      calls: parsedCalls,
      feeToken: feeToken as Address,
      feeAmount: BigInt(feeAmount),
      grantee: grantee as Address,
      nonce: BigInt(nonce),
      granteeSignature: granteeSignature as Hex,
    };

    const txHash = await relayer.executeWithGrantee(intent);
    const receipt = await relayer.waitForTransaction(txHash);

    res.json({
      success: true,
      txHash,
      blockNumber: receipt.blockNumber.toString(),
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status,
      explorer: `${ACTIVE_NETWORK.explorer}/tx/${txHash}`,
    });
  } catch (error) {
    console.error('Error executing with grantee:', error);
    res.status(500).json({
      error: 'Failed to execute with grantee',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /estimate-fee
 * Estimate fee for a transaction
 */
app.post('/estimate-fee', async (req: Request, res: Response) => {
  try {
    const { calls } = req.body;

    if (!calls || !Array.isArray(calls)) {
      return res.status(400).json({
        error: 'Missing or invalid calls array',
      });
    }

    // Parse calls
    const parsedCalls = calls.map((call: any) => ({
      target: call.target as Address,
      value: BigInt(call.value || 0),
      data: call.data as Hex,
    }));

    // TODO: Estimate gas for the transaction
    // For now, return a reasonable estimate
    const estimatedGas = 200000n; // Base estimate
    const gasPrice = 50000000000n; // 50 Gwei

    const feeAmount = await relayer.estimateFeeCost(estimatedGas, gasPrice);

    res.json({
      estimatedGas: estimatedGas.toString(),
      gasPrice: gasPrice.toString(),
      feeAmount: feeAmount.toString(),
      feeAmountFormatted: (Number(feeAmount) / 1e6).toFixed(6), // 6 decimals for USDT/USDC
    });
  } catch (error) {
    console.error('Error estimating fee:', error);
    res.status(500).json({
      error: 'Failed to estimate fee',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// Start server
const PORT = RELAYER_CONFIG.port;

app.listen(PORT, () => {
  console.log(`\n🚀 Relayer server started`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Network: ${ACTIVE_NETWORK.name}`);
  console.log(`   Chain ID: ${ACTIVE_NETWORK.chainId}`);
  console.log(`\n📡 API Endpoints:`);
  console.log(`   GET  /health - Health check`);
  console.log(`   GET  /stats - Relayer statistics`);
  console.log(`   GET  /nonce/:address - Get user nonce`);
  console.log(`   GET  /authorization/:address - Get stored authorization`);
  console.log(`   GET  /grantee-nonce/:user/:grantee - Get grantee nonce`);
  console.log(`   GET  /grantee-info/:user/:grantee - Get grantee info`);
  console.log(`   POST /store-authorization - Store EIP-7702 authorization`);
  console.log(`   POST /execute - Execute intent (no fee)`);
  console.log(`   POST /execute-with-fee - Execute intent with fee`);
  console.log(`   POST /execute-with-grantee - Execute with grantee signature`);
  console.log(`   POST /estimate-fee - Estimate transaction fee`);
  console.log(`\n✅ Ready to relay transactions!\n`);
});

export default app;
