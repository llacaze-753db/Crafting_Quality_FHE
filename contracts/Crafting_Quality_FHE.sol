pragma solidity ^0.8.24;
import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract CraftingQualityFHE is SepoliaConfig {
    using FHE for euint32;
    using FHE for ebool;

    error NotOwner();
    error NotProvider();
    error Paused();
    error BatchClosed();
    error BatchFull();
    error CooldownActive();
    error InvalidRequest();
    error ReplayDetected();
    error StaleWrite();
    error InvalidDecryption();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyProvider() {
        if (!providers[msg.sender]) revert NotProvider();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    modifier checkCooldown(uint256 interval) {
        if (block.timestamp < lastActionAt[msg.sender] + interval) {
            revert CooldownActive();
        }
        _;
    }

    address public owner;
    bool public paused;
    uint256 public constant MIN_INTERVAL = 30 seconds;
    mapping(address => uint256) public lastActionAt;
    mapping(address => bool) public providers;
    mapping(uint256 => Batch) public batches;
    mapping(uint256 => DecryptionContext) public decryptionContexts;
    mapping(address => uint256) public userCooldowns;
    uint256 public currentBatchId;
    uint256 public modelVersion;
    uint256 public submissionCount;
    uint256 public constant MAX_BATCH_SIZE = 100;
    uint256 public constant MAX_BATCHES = 10;

    struct Batch {
        uint256 id;
        bool active;
        uint256 createdAt;
        uint256 closedAt;
        uint256 submissionCount;
        euint32 qualityAccumulator;
        mapping(address => bool) hasSubmitted;
    }

    struct DecryptionContext {
        uint256 batchId;
        uint256 modelVersion;
        bytes32 stateHash;
        bool processed;
        address requester;
    }

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ProviderAdded(address indexed provider);
    event ProviderRemoved(address indexed provider);
    event PausedSet(bool paused);
    event CooldownUpdated(address indexed user, uint256 cooldown);
    event BatchOpened(uint256 indexed batchId, uint256 createdAt);
    event BatchClosed(uint256 indexed batchId, uint256 closedAt);
    event CraftingSubmitted(address indexed crafter, uint256 indexed batchId, bytes32 encryptedQuality);
    event DecryptionRequested(uint256 indexed requestId, uint256 indexed batchId, address indexed requester);
    event DecryptionCompleted(uint256 indexed requestId, uint256 indexed batchId, uint256 qualityScore);
    event ModelVersionUpdated(uint256 newVersion);

    constructor() {
        owner = msg.sender;
        modelVersion = 1;
        _openNewBatch();
    }

    function transferOwnership(address newOwner) external onlyOwner {
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function addProvider(address provider) external onlyOwner {
        providers[provider] = true;
        emit ProviderAdded(provider);
    }

    function removeProvider(address provider) external onlyOwner {
        providers[provider] = false;
        emit ProviderRemoved(provider);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PausedSet(_paused);
    }

    function setUserCooldown(address user, uint256 cooldown) external onlyOwner {
        userCooldowns[user] = cooldown;
        emit CooldownUpdated(user, cooldown);
    }

    function setModelVersion(uint256 newVersion) external onlyOwner {
        modelVersion = newVersion;
        emit ModelVersionUpdated(newVersion);
    }

    function openNewBatch() external onlyOwner {
        _openNewBatch();
    }

    function closeBatch(uint256 batchId) external onlyOwner {
        Batch storage batch = batches[batchId];
        if (!batch.active) revert BatchClosed();
        batch.active = false;
        batch.closedAt = block.timestamp;
        emit BatchClosed(batchId, block.timestamp);
    }

    function submitCraftingQuality(
        uint256 batchId,
        euint32 encryptedQuality
    ) external onlyProvider whenNotPaused checkCooldown(userCooldowns[msg.sender] == 0 ? MIN_INTERVAL : userCooldowns[msg.sender]) {
        Batch storage batch = batches[batchId];
        if (!batch.active) revert BatchClosed();
        if (batch.submissionCount >= MAX_BATCH_SIZE) revert BatchFull();
        if (batch.hasSubmitted[msg.sender]) revert ReplayDetected();

        _initIfNeeded(batch.qualityAccumulator);
        batch.qualityAccumulator = FHE.add(batch.qualityAccumulator, encryptedQuality);
        batch.submissionCount++;
        batch.hasSubmitted[msg.sender] = true;
        submissionCount++;
        lastActionAt[msg.sender] = block.timestamp;

        emit CraftingSubmitted(msg.sender, batchId, FHE.toBytes32(encryptedQuality));
    }

    function requestBatchQualityDecryption(uint256 batchId) external whenNotPaused checkCooldown(MIN_INTERVAL) {
        Batch storage batch = batches[batchId];
        if (batch.submissionCount == 0) revert InvalidRequest();
        if (batch.active) revert BatchClosed();

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(batch.qualityAccumulator);
        bytes32 stateHash = _hashCiphertexts(cts);
        uint256 requestId = FHE.requestDecryption(cts, this.completeBatchQualityDecryption.selector);

        decryptionContexts[requestId] = DecryptionContext({
            batchId: batchId,
            modelVersion: modelVersion,
            stateHash: stateHash,
            processed: false,
            requester: msg.sender
        });

        lastActionAt[msg.sender] = block.timestamp;
        emit DecryptionRequested(requestId, batchId, msg.sender);
    }

    function completeBatchQualityDecryption(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        if (decryptionContexts[requestId].processed) revert ReplayDetected();
        if (decryptionContexts[requestId].modelVersion != modelVersion) revert StaleWrite();

        Batch storage batch = batches[decryptionContexts[requestId].batchId];
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(batch.qualityAccumulator);
        bytes32 currHash = _hashCiphertexts(cts);

        if (currHash != decryptionContexts[requestId].stateHash) revert InvalidDecryption();
        FHE.checkSignatures(requestId, cleartexts, proof);

        uint32 qualityScore = abi.decode(cleartexts, (uint32));
        decryptionContexts[requestId].processed = true;

        emit DecryptionCompleted(requestId, decryptionContexts[requestId].batchId, qualityScore);
    }

    function _openNewBatch() internal {
        if (currentBatchId >= MAX_BATCHES) revert BatchFull();
        currentBatchId++;
        Batch storage newBatch = batches[currentBatchId];
        newBatch.id = currentBatchId;
        newBatch.active = true;
        newBatch.createdAt = block.timestamp;
        newBatch.qualityAccumulator = FHE.asEuint32(0);
        emit BatchOpened(currentBatchId, block.timestamp);
    }

    function _hashCiphertexts(bytes32[] memory cts) internal pure returns (bytes32) {
        return keccak256(abi.encode(cts));
    }

    function _initIfNeeded(euint32 x) internal pure returns (euint32) {
        if (!FHE.isInitialized(x)) {
            return FHE.asEuint32(0);
        }
        return x;
    }

    function _requireInitialized(euint32 x, string memory tag) internal pure {
        if (!FHE.isInitialized(x)) {
            revert(string(abi.encodePacked(tag, " not initialized")));
        }
    }
}