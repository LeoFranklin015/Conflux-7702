// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SimpleSmartAccount
 * @notice EIP-7702 delegation contract for gas sponsorship on Conflux eSpace
 * @dev Allows users to execute transactions and pay fees in USDT/USDC instead of CFX
 *
 * Key features:
 * - Batch execution of arbitrary calls
 * - Fee payment in ERC20 tokens (USDT/USDC)
 * - Replay protection via nonces
 * - Personal sign signature verification
 *
 * Under 7702 delegation, this contract runs in the user's EOA context,
 * so `address(this)` == user's EOA and token transfers work without approve.
 */
contract SimpleSmartAccount {
    // Errors
    error InvalidSignature();
    error InvalidNonce();
    error ExecutionFailed(uint256 index);
    error InsufficientFeePayment();

    // Events
    event Executed(address indexed account, uint256 nonce);
    event ExecutedWithFee(
        address indexed account,
        uint256 nonce,
        address feeToken,
        uint256 feeAmount,
        address feeRecipient
    );

    // Storage
    mapping(address => uint256) public nonces;

    // Type hashes for EIP-712 style signing
    bytes32 private constant EXECUTE_TYPEHASH = keccak256(
        "Execute(bytes32 callsHash,uint256 nonce,uint256 chainId)"
    );

    bytes32 private constant EXECUTE_WITH_FEE_TYPEHASH = keccak256(
        "ExecuteWithFee(bytes32 callsHash,address feeToken,uint256 feeAmount,address feeRecipient,uint256 nonce,uint256 chainId)"
    );

    // Structs
    struct Call {
        address target;
        uint256 value;
        bytes data;
    }

    /**
     * @notice Execute batched calls without fee payment
     * @param calls Array of calls to execute
     * @param nonce Replay protection nonce
     * @param signature User's signature over the execution parameters
     */
    function execute(
        Call[] calldata calls,
        uint256 nonce,
        bytes calldata signature
    ) external {
        address account = address(this); // Under 7702, this is the user's EOA

        // Verify nonce
        if (nonces[account] != nonce) revert InvalidNonce();

        // Hash the calls array
        bytes32 callsHash = _hashCalls(calls);

        // Verify signature
        bytes32 structHash = keccak256(
            abi.encode(
                EXECUTE_TYPEHASH,
                callsHash,
                nonce,
                block.chainid
            )
        );
        _verifySignature(account, structHash, signature);

        // Increment nonce
        nonces[account]++;

        // Execute calls
        _executeCalls(calls);

        emit Executed(account, nonce);
    }

    /**
     * @notice Execute batched calls and pay fee in ERC20 tokens
     * @param calls Array of calls to execute
     * @param feeToken Address of ERC20 token for fee payment (USDT/USDC)
     * @param feeAmount Amount of tokens to pay as fee
     * @param feeRecipient Address to receive the fee (relayer)
     * @param nonce Replay protection nonce
     * @param signature User's signature over the execution parameters
     */
    function executeWithFee(
        Call[] calldata calls,
        address feeToken,
        uint256 feeAmount,
        address feeRecipient,
        uint256 nonce,
        bytes calldata signature
    ) external {
        address account = address(this); // Under 7702, this is the user's EOA

        // Verify nonce
        if (nonces[account] != nonce) revert InvalidNonce();

        // Hash the calls array
        bytes32 callsHash = _hashCalls(calls);

        // Verify signature
        bytes32 structHash = keccak256(
            abi.encode(
                EXECUTE_WITH_FEE_TYPEHASH,
                callsHash,
                feeToken,
                feeAmount,
                feeRecipient,
                nonce,
                block.chainid
            )
        );
        _verifySignature(account, structHash, signature);

        // Increment nonce
        nonces[account]++;

        // Execute calls
        _executeCalls(calls);

        // Pay fee in ERC20 tokens
        // Under 7702 delegation, address(this) is the user's EOA
        // so transfer() sends from the user's balance without needing approve
        if (feeAmount > 0) {
            (bool success, bytes memory result) = feeToken.call(
                abi.encodeWithSignature(
                    "transfer(address,uint256)",
                    feeRecipient,
                    feeAmount
                )
            );

            // Check both success and return value for ERC20 compliance
            if (!success) revert InsufficientFeePayment();
            if (result.length > 0) {
                // Some tokens return bool, some don't
                if (!abi.decode(result, (bool))) revert InsufficientFeePayment();
            }
        }

        emit ExecutedWithFee(account, nonce, feeToken, feeAmount, feeRecipient);
    }

    /**
     * @notice Get the current nonce for an account
     * @param account The account to query
     * @return The current nonce
     */
    function getNonce(address account) external view returns (uint256) {
        return nonces[account];
    }

    /**
     * @dev Hash an array of calls
     * Each call is hashed as: keccak256(abi.encode(target, value, keccak256(data)))
     * Then all hashes are concatenated and hashed together
     */
    function _hashCalls(Call[] calldata calls) private pure returns (bytes32) {
        bytes memory concatenated;

        for (uint256 i = 0; i < calls.length; i++) {
            bytes32 callHash = keccak256(
                abi.encode(
                    calls[i].target,
                    calls[i].value,
                    keccak256(calls[i].data)
                )
            );
            concatenated = abi.encodePacked(concatenated, callHash);
        }

        return keccak256(concatenated);
    }

    /**
     * @dev Execute an array of calls
     * Reverts if any call fails
     */
    function _executeCalls(Call[] calldata calls) private {
        for (uint256 i = 0; i < calls.length; i++) {
            (bool success, ) = calls[i].target.call{value: calls[i].value}(
                calls[i].data
            );
            if (!success) revert ExecutionFailed(i);
        }
    }

    /**
     * @dev Verify personal sign signature
     * Uses `\x19Ethereum Signed Message:\n32` + structHash
     */
    function _verifySignature(
        address account,
        bytes32 structHash,
        bytes calldata signature
    ) private pure {
        // Personal sign message format
        bytes32 messageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", structHash)
        );

        // Extract signature components
        require(signature.length == 65, "Invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }

        // Recover signer
        address signer = ecrecover(messageHash, v, r, s);

        if (signer != account) revert InvalidSignature();
    }

    /**
     * @notice Allow contract to receive ETH/CFX
     */
    receive() external payable {}
}
