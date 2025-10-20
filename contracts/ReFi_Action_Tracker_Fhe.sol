pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract ReFiActionTrackerFhe is SepoliaConfig {
    using FHE for euint32;
    using FHE for ebool;

    address public owner;
    mapping(address => bool) public providers;
    bool public paused;
    uint256 public cooldownSeconds;
    mapping(address => uint256) public lastSubmissionTime;
    mapping(address => uint256) public lastDecryptionRequestTime;

    uint256 public currentBatchId;
    mapping(uint256 => bool) public batchClosed;

    struct DecryptionContext {
        uint256 batchId;
        bytes32 stateHash;
        bool processed;
    }
    mapping(uint256 => DecryptionContext) public decryptionContexts;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ProviderAdded(address indexed provider);
    event ProviderRemoved(address indexed provider);
    event Paused();
    event Unpaused();
    event CooldownSecondsChanged(uint256 oldCooldownSeconds, uint256 newCooldownSeconds);
    event BatchOpened(uint256 batchId);
    event BatchClosed(uint256 batchId);
    event ActionSubmitted(address indexed user, uint256 indexed batchId, euint32 encryptedPoints);
    event DecryptionRequested(uint256 indexed requestId, uint256 indexed batchId);
    event DecryptionCompleted(uint256 indexed requestId, uint256 indexed batchId, uint256 totalPoints);

    error NotOwner();
    error NotProvider();
    error PausedError();
    error CooldownActive();
    error BatchClosedError();
    error ReplayError();
    error StateMismatchError();
    error InvalidDecryptionProof();
    error InvalidBatchId();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyProvider() {
        if (!providers[msg.sender]) revert NotProvider();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert PausedError();
        _;
    }

    modifier checkSubmissionCooldown(address user) {
        if (block.timestamp < lastSubmissionTime[user] + cooldownSeconds) {
            revert CooldownActive();
        }
        _;
    }

    modifier checkDecryptionCooldown(address user) {
        if (block.timestamp < lastDecryptionRequestTime[user] + cooldownSeconds) {
            revert CooldownActive();
        }
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
        _openNewBatch(); // Open batch 1
    }

    function transferOwnership(address newOwner) external onlyOwner {
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function addProvider(address provider) external onlyOwner {
        providers[provider] = true;
        emit ProviderAdded(provider);
    }

    function removeProvider(address provider) external onlyOwner {
        providers[provider] = false;
        emit ProviderRemoved(provider);
    }

    function pause() external onlyOwner whenNotPaused {
        paused = true;
        emit Paused();
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused();
    }

    function setCooldownSeconds(uint256 newCooldownSeconds) external onlyOwner {
        uint256 oldCooldownSeconds = cooldownSeconds;
        cooldownSeconds = newCooldownSeconds;
        emit CooldownSecondsChanged(oldCooldownSeconds, newCooldownSeconds);
    }

    function openNewBatch() external onlyOwner {
        _openNewBatch();
    }

    function closeBatch(uint256 batchId) external onlyOwner {
        if (batchId == 0 || batchId > currentBatchId) revert InvalidBatchId();
        if (batchClosed[batchId]) revert BatchClosedError();
        batchClosed[batchId] = true;
        emit BatchClosed(batchId);
    }

    function submitAction(
        address user,
        euint32 encryptedPoints
    ) external onlyProvider whenNotPaused checkSubmissionCooldown(user) {
        if (batchClosed[currentBatchId]) revert BatchClosedError();

        lastSubmissionTime[user] = block.timestamp;
        // Store encrypted points for the user in the current batch
        // This is a simplified storage; a real system might map user -> batchId -> encryptedPoints
        // For this example, we'll assume a single encryptedPoints value per user per batch for simplicity.
        // The actual storage mechanism would depend on more detailed requirements.
        // For the purpose of this example, we'll just emit the event.
        emit ActionSubmitted(user, currentBatchId, encryptedPoints);
    }

    function requestBatchTotalPoints(uint256 batchId) external onlyProvider whenNotPaused checkDecryptionCooldown(msg.sender) {
        if (batchId == 0 || batchId > currentBatchId) revert InvalidBatchId();
        if (!batchClosed[batchId]) revert BatchClosedError(); // Must be closed to request decryption

        lastDecryptionRequestTime[msg.sender] = block.timestamp;

        // Step 1: Prepare Ciphertexts (simulated for this example)
        // In a real scenario, you'd fetch encrypted data for the batch.
        // For this example, we'll create a dummy euint32.
        // This euint32 would represent the sum of all actions in the batch.
        // The actual summation logic would happen encrypted.
        euint32 totalEncryptedPoints = FHE.asEuint32(0); // Placeholder for actual encrypted sum

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(totalEncryptedPoints);

        // Step 2: Compute State Hash
        bytes32 stateHash = _hashCiphertexts(cts);

        // Step 3: Request Decryption
        uint256 requestId = FHE.requestDecryption(cts, this.myCallback.selector);

        // Step 4: Store Context
        decryptionContexts[requestId] = DecryptionContext({ batchId: batchId, stateHash: stateHash, processed: false });
        emit DecryptionRequested(requestId, batchId);
    }

    function myCallback(uint256 requestId, bytes memory cleartexts, bytes memory proof) public {
        // Step 5a: Replay Guard
        if (decryptionContexts[requestId].processed) revert ReplayError();

        // Step 5b: State Verification
        // Rebuild cts in the exact same order as in requestBatchTotalPoints
        // For this example, we assume one euint32 was submitted for decryption.
        euint32 totalEncryptedPoints = FHE.asEuint32(0); // Placeholder, should be fetched from storage if applicable
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(totalEncryptedPoints);
        bytes32 currentHash = _hashCiphertexts(cts);

        if (currentHash != decryptionContexts[requestId].stateHash) {
            revert StateMismatchError();
        }

        // Step 5c: Proof Verification
        if (!FHE.checkSignatures(requestId, cleartexts, proof)) {
            revert InvalidDecryptionProof();
        }

        // Step 5d: Decode & Finalize
        // Decode cleartexts in the same order
        // For this example, one uint32 was decrypted
        uint256 totalPoints = abi.decode(cleartexts, (uint256));

        decryptionContexts[requestId].processed = true;
        emit DecryptionCompleted(requestId, decryptionContexts[requestId].batchId, totalPoints);
    }

    function _openNewBatch() internal {
        currentBatchId++;
        // Ensure batchClosed is false for the new batch (it should be by default)
        if (batchClosed[currentBatchId]) {
            batchClosed[currentBatchId] = false;
        }
        emit BatchOpened(currentBatchId);
    }

    function _hashCiphertexts(bytes32[] memory cts) internal view returns (bytes32) {
        return keccak256(abi.encode(cts, address(this)));
    }
}