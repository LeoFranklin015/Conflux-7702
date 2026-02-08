// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SimpleSmartAccountV3Simple
 * @notice Ultra-simplified subscription model
 *
 * Flow:
 * 1. User grants permission to Netflix with spending limits
 * 2. Netflix signs transaction intent
 * 3. Relayer submits to user's delegated EOA
 * 4. Contract checks limits and executes
 *
 * Simplifications:
 * - No contract/method whitelist (just trust the grantee)
 * - Just spending limits (monthly + per-tx)
 * - Minimal storage operations
 */
contract SimpleSmartAccountV3Simple {
    // Errors
    error InvalidSignature();
    error InvalidNonce();
    error ExecutionFailed(uint256 index);
    error InsufficientFeePayment();
    error GranteeNotAuthorized();
    error MonthlyLimitExceeded(uint256 spent, uint256 limit);
    error PerTxLimitExceeded(uint256 amount, uint256 limit);

    // Events
    event GranteeAuthorized(
        address indexed user,
        address indexed grantee,
        uint256 monthlyLimit,
        uint256 perTxLimit
    );
    event GranteeRevoked(address indexed user, address indexed grantee);
    event ExecutedWithFee(
        address indexed user,
        address indexed grantee,
        uint256 nonce,
        address feeToken,
        uint256 feeAmount
    );

    // Ultra-simple permission structure
    struct GranteePermissions {
        bool authorized;
        uint256 monthlyLimit;
        uint256 perTxLimit;
        uint256 monthlySpent;
        uint256 lastResetMonth;
    }

    // Storage
    mapping(address => mapping(address => GranteePermissions)) public granteePermissions;
    mapping(address => mapping(address => uint256)) public granteeNonces;
    mapping(address => uint256) public nonces;

    // Type hash for grantee signature
    bytes32 private constant GRANTEE_EXECUTE_TYPEHASH = keccak256(
        "GranteeExecute(address user,bytes32 callsHash,address feeToken,uint256 feeAmount,address feeRecipient,uint256 nonce,uint256 chainId)"
    );

    struct Call {
        address target;
        uint256 value;
        bytes data;
    }

    // ========== PERMISSION MANAGEMENT ==========

    /**
     * @notice Grant permission to a grantee
     * @param grantee Who can execute (e.g., Netflix)
     * @param monthlyLimit Monthly spending cap (0 = unlimited)
     * @param perTxLimit Per-transaction cap (0 = unlimited)
     */
    function grantPermission(
        address grantee,
        uint256 monthlyLimit,
        uint256 perTxLimit
    ) external {
        address user = address(this);

        granteePermissions[user][grantee] = GranteePermissions({
            authorized: true,
            monthlyLimit: monthlyLimit,
            perTxLimit: perTxLimit,
            monthlySpent: 0,
            lastResetMonth: _getCurrentMonth()
        });

        emit GranteeAuthorized(user, grantee, monthlyLimit, perTxLimit);
    }

    /**
     * @notice Revoke grantee's permission
     */
    function revokePermission(address grantee) external {
        address user = address(this);
        delete granteePermissions[user][grantee];
        emit GranteeRevoked(user, grantee);
    }

    // ========== EXECUTION ==========

    /**
     * @notice Execute with grantee signature
     */
    function executeWithGrantee(
        Call[] calldata calls,
        address feeToken,
        uint256 feeAmount,
        address feeRecipient,
        address grantee,
        uint256 nonce,
        bytes calldata granteeSignature
    ) external {
        address user = address(this);

        // Verify nonce
        if (granteeNonces[user][grantee] != nonce) revert InvalidNonce();

        // Verify grantee signature
        bytes32 callsHash = _hashCalls(calls);
        bytes32 structHash = keccak256(
            abi.encode(
                GRANTEE_EXECUTE_TYPEHASH,
                user,
                callsHash,
                feeToken,
                feeAmount,
                feeRecipient,
                nonce,
                block.chainid
            )
        );
        _verifyGranteeSignature(grantee, structHash, granteeSignature);

        // Increment nonce
        granteeNonces[user][grantee]++;

        // Check authorization
        GranteePermissions storage perms = granteePermissions[user][grantee];
        if (!perms.authorized) revert GranteeNotAuthorized();

        // Check spending limits
        _checkSpendingLimits(perms, feeAmount);

        // Execute calls
        for (uint256 i = 0; i < calls.length; i++) {
            (bool success,) = calls[i].target.call{value: calls[i].value}(calls[i].data);
            if (!success) revert ExecutionFailed(i);
        }

        // Pay fee
        if (feeAmount > 0) {
            (bool success, bytes memory result) = feeToken.call(
                abi.encodeWithSignature("transfer(address,uint256)", feeRecipient, feeAmount)
            );
            if (!success || (result.length > 0 && !abi.decode(result, (bool)))) {
                revert InsufficientFeePayment();
            }
        }

        emit ExecutedWithFee(user, grantee, nonce, feeToken, feeAmount);
    }

    // ========== VIEW FUNCTIONS ==========

    function getGranteeNonce(address user, address grantee) external view returns (uint256) {
        return granteeNonces[user][grantee];
    }

    function getNonce(address account) external view returns (uint256) {
        return nonces[account];
    }

    function isGranteeAuthorized(address user, address grantee) external view returns (bool) {
        return granteePermissions[user][grantee].authorized;
    }

    function getGranteeSpending(address user, address grantee)
        external
        view
        returns (uint256 monthlySpent, uint256 monthlyLimit, uint256 perTxLimit)
    {
        GranteePermissions storage perms = granteePermissions[user][grantee];
        return (perms.monthlySpent, perms.monthlyLimit, perms.perTxLimit);
    }

    // ========== INTERNAL ==========

    function _checkSpendingLimits(GranteePermissions storage perms, uint256 amount) internal {
        uint256 currentMonth = _getCurrentMonth();

        // Reset if new month
        if (perms.lastResetMonth != currentMonth) {
            perms.monthlySpent = 0;
            perms.lastResetMonth = currentMonth;
        }

        // Check per-tx limit
        if (perms.perTxLimit > 0 && amount > perms.perTxLimit) {
            revert PerTxLimitExceeded(amount, perms.perTxLimit);
        }

        // Check monthly limit
        if (perms.monthlyLimit > 0) {
            uint256 newSpent = perms.monthlySpent + amount;
            if (newSpent > perms.monthlyLimit) {
                revert MonthlyLimitExceeded(newSpent, perms.monthlyLimit);
            }
            perms.monthlySpent = newSpent;
        }
    }

    function _getCurrentMonth() internal view returns (uint256) {
        return block.timestamp / 30 days;
    }

    function _hashCalls(Call[] calldata calls) internal pure returns (bytes32) {
        bytes memory concatenated;
        for (uint256 i = 0; i < calls.length; i++) {
            bytes32 callHash = keccak256(
                abi.encode(calls[i].target, calls[i].value, keccak256(calls[i].data))
            );
            concatenated = bytes.concat(concatenated, callHash);
        }
        return keccak256(concatenated);
    }

    function _verifyGranteeSignature(address grantee, bytes32 structHash, bytes calldata signature)
        internal
        pure
    {
        bytes32 messageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", structHash));
        address recovered = _recoverSigner(messageHash, signature);
        if (recovered != grantee) revert InvalidSignature();
    }

    function _recoverSigner(bytes32 messageHash, bytes calldata signature)
        internal
        pure
        returns (address)
    {
        require(signature.length == 65, "Invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }

        if (v < 27) v += 27;
        require(v == 27 || v == 28, "Invalid signature v value");

        return ecrecover(messageHash, v, r, s);
    }
}
