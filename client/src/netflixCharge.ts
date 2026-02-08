import {
  type Address,
  type Hex,
  parseUnits,
  encodeFunctionData,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  concat,
  toHex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';

dotenv.config();

const NETFLIX_PRIVATE_KEY = process.env.NETFLIX_PRIVATE_KEY as `0x${string}`;
const RELAYER_URL = process.env.RELAYER_URL || 'http://localhost:3000';
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '71');
const TESTNET_TOKEN = '0xfBeF97434ffd0587E5a1c88Efd5F7BDC405bA6Fa' as Address;

const GRANTEE_EXECUTE_TYPEHASH = keccak256(
  toHex(
    'GranteeExecute(address user,bytes32 callsHash,address feeToken,uint256 feeAmount,address feeRecipient,uint256 nonce,uint256 chainId)'
  )
);

function hashCalls(calls: Array<{ target: Address; value: bigint; data: Hex }>): Hex {
  let concatenated = '0x' as Hex;
  for (const call of calls) {
    const callHash = keccak256(
      encodeAbiParameters(parseAbiParameters('address, uint256, bytes32'), [
        call.target,
        call.value,
        keccak256(call.data),
      ])
    );
    concatenated = concat([concatenated, callHash]);
  }
  return keccak256(concatenated);
}

async function main() {
  const userAddress = process.argv[2] as Address;
  if (!userAddress || !userAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
    console.error('Usage: npx tsx src/netflixCharge.ts <userAddress>');
    process.exit(1);
  }

  const netflixAccount = privateKeyToAccount(NETFLIX_PRIVATE_KEY);
  console.log(`Netflix (grantee): ${netflixAccount.address}`);
  console.log(`Charging user: ${userAddress}`);

  // 1. Get relayer address
  const statsRes = await fetch(`${RELAYER_URL}/stats`);
  const stats = (await statsRes.json()) as { relayerAddress: string };
  const relayerAddress = stats.relayerAddress as Address;
  console.log(`Relayer: ${relayerAddress}`);

  // 2. Get grantee nonce
  const nonceRes = await fetch(`${RELAYER_URL}/grantee-nonce/${userAddress}/${netflixAccount.address}`);
  const nonceData = (await nonceRes.json()) as { nonce: string };
  const nonce = BigInt(nonceData.nonce);
  console.log(`Nonce: ${nonce}`);

  // 3. Build charge call: transfer 3 tokens to Netflix
  const chargeAmount = parseUnits('3', 18);
  const transferData = encodeFunctionData({
    abi: [{
      type: 'function',
      name: 'transfer',
      inputs: [
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      outputs: [{ name: '', type: 'bool' }],
      stateMutability: 'nonpayable',
    }],
    functionName: 'transfer',
    args: [netflixAccount.address, chargeAmount],
  });

  const calls = [{ target: TESTNET_TOKEN, value: 0n, data: transferData }];
  const feeAmount = parseUnits('0.1', 18);

  // 4. Sign grantee struct hash
  const callsHash = hashCalls(calls);
  const structHash = keccak256(
    encodeAbiParameters(
      parseAbiParameters('bytes32, address, bytes32, address, uint256, address, uint256, uint256'),
      [
        GRANTEE_EXECUTE_TYPEHASH,
        userAddress,
        callsHash,
        TESTNET_TOKEN,
        feeAmount,
        relayerAddress,
        nonce,
        BigInt(CHAIN_ID),
      ]
    )
  );

  const granteeSignature = await netflixAccount.signMessage({ message: { raw: structHash } });
  console.log(`Signature: ${granteeSignature.slice(0, 20)}...`);

  // 5. Submit to relayer
  console.log(`\nSubmitting to relayer...`);
  const res = await fetch(`${RELAYER_URL}/execute-with-grantee`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userAddress,
      calls: calls.map(c => ({ target: c.target, value: c.value.toString(), data: c.data })),
      feeToken: TESTNET_TOKEN,
      feeAmount: feeAmount.toString(),
      grantee: netflixAccount.address,
      nonce: nonce.toString(),
      granteeSignature,
    }),
  });

  const result = await res.json();
  if (!res.ok) {
    console.error('Failed:', result);
    process.exit(1);
  }

  console.log(`\nCharge successful!`);
  console.log(`TX: ${(result as any).txHash}`);
  console.log(`Explorer: ${(result as any).explorer}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
