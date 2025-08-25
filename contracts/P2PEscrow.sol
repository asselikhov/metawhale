// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title P2PEscrow
 * @dev Secure escrow contract for P2P CES token trading
 * @dev Ensures tokens are physically locked and cannot be spent by users
 */
contract P2PEscrow is ReentrancyGuard, Ownable, Pausable {
    IERC20 public immutable cesToken;
    
    // Escrow status enumeration
    enum EscrowStatus { Active, Released, Refunded, Disputed }
    
    // Escrow structure
    struct Escrow {
        address seller;
        address buyer;
        uint256 amount;
        uint256 timelock;
        EscrowStatus status;
        bool disputeInitiated;
        uint256 createdAt;
    }
    
    // State variables
    mapping(uint256 => Escrow) public escrows;
    uint256 public nextEscrowId = 1;
    uint256 public constant MAX_TIMELOCK = 7 days;
    uint256 public constant MIN_TIMELOCK = 30 minutes;
    
    // Events
    event EscrowCreated(uint256 indexed escrowId, address indexed seller, address indexed buyer, uint256 amount);
    event EscrowReleased(uint256 indexed escrowId);
    event EscrowRefunded(uint256 indexed escrowId);
    event DisputeInitiated(uint256 indexed escrowId);
    event DisputeResolved(uint256 indexed escrowId, bool favorBuyer);
    event TimelockExtended(uint256 indexed escrowId, uint256 newTimelock);
    
    // Custom errors
    error InvalidAddress();
    error InvalidAmount();
    error InvalidTimelock();
    error EscrowNotFound();
    error EscrowExpired();
    error EscrowNotExpired();
    error UnauthorizedAccess();
    error InvalidEscrowStatus();
    error InsufficientBalance();
    error TransferFailed();
    
    /**
     * @dev Constructor
     * @param _cesToken Address of the CES token contract
     */
    constructor(address _cesToken) {
        if (_cesToken == address(0)) revert InvalidAddress();
        cesToken = IERC20(_cesToken);
    }
    
    /**
     * @dev Create a new escrow
     * @param seller Address of the token seller
     * @param buyer Address of the token buyer
     * @param amount Amount of CES tokens to escrow
     * @param timelock Duration in seconds for the escrow timelock
     * @return escrowId The ID of the created escrow
     */
    function createEscrow(
        address seller,
        address buyer,
        uint256 amount,
        uint256 timelock
    ) external nonReentrant whenNotPaused returns (uint256 escrowId) {
        // Validate inputs
        if (seller == address(0) || buyer == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        if (timelock < MIN_TIMELOCK || timelock > MAX_TIMELOCK) revert InvalidTimelock();
        
        // Check seller has sufficient balance and allowance
        if (cesToken.balanceOf(seller) < amount) revert InsufficientBalance();
        if (cesToken.allowance(seller, address(this)) < amount) revert InsufficientBalance();
        
        // Transfer tokens from seller to escrow contract
        if (!cesToken.transferFrom(seller, address(this), amount)) revert TransferFailed();
        
        // Create escrow
        escrowId = nextEscrowId++;
        escrows[escrowId] = Escrow({
            seller: seller,
            buyer: buyer,
            amount: amount,
            timelock: block.timestamp + timelock,
            status: EscrowStatus.Active,
            disputeInitiated: false,
            createdAt: block.timestamp
        });
        
        emit EscrowCreated(escrowId, seller, buyer, amount);
    }
    
    /**
     * @dev Release escrow to buyer (called by seller after payment confirmation)
     * @param escrowId The ID of the escrow to release
     */
    function releaseEscrow(uint256 escrowId) external nonReentrant {
        Escrow storage escrow = escrows[escrowId];
        
        // Validate escrow exists and is active
        if (escrow.seller == address(0)) revert EscrowNotFound();
        if (escrow.status != EscrowStatus.Active) revert InvalidEscrowStatus();
        
        // Only seller or owner can release
        if (msg.sender != escrow.seller && msg.sender != owner()) revert UnauthorizedAccess();
        
        // Update status and transfer tokens to buyer
        escrow.status = EscrowStatus.Released;
        
        if (!cesToken.transfer(escrow.buyer, escrow.amount)) revert TransferFailed();
        
        emit EscrowReleased(escrowId);
    }
    
    /**
     * @dev Refund escrow to seller (after timelock expiry or dispute resolution)
     * @param escrowId The ID of the escrow to refund
     */
    function refundEscrow(uint256 escrowId) external nonReentrant {
        Escrow storage escrow = escrows[escrowId];
        
        // Validate escrow exists and is active
        if (escrow.seller == address(0)) revert EscrowNotFound();
        if (escrow.status != EscrowStatus.Active) revert InvalidEscrowStatus();
        
        // Check if timelock has expired or if owner is calling
        bool isOwner = msg.sender == owner();
        bool isExpired = block.timestamp >= escrow.timelock;
        bool isAuthorized = msg.sender == escrow.seller || msg.sender == escrow.buyer;
        
        if (!isOwner && !isExpired) revert EscrowNotExpired();
        if (!isOwner && !isAuthorized) revert UnauthorizedAccess();
        
        // Update status and refund tokens to seller
        escrow.status = EscrowStatus.Refunded;
        
        if (!cesToken.transfer(escrow.seller, escrow.amount)) revert TransferFailed();
        
        emit EscrowRefunded(escrowId);
    }
    
    /**
     * @dev Initiate a dispute for an escrow
     * @param escrowId The ID of the escrow to dispute
     */
    function initiateDispute(uint256 escrowId) external {
        Escrow storage escrow = escrows[escrowId];
        
        // Validate escrow exists and is active
        if (escrow.seller == address(0)) revert EscrowNotFound();
        if (escrow.status != EscrowStatus.Active) revert InvalidEscrowStatus();
        
        // Only seller or buyer can initiate dispute
        if (msg.sender != escrow.seller && msg.sender != escrow.buyer) revert UnauthorizedAccess();
        
        escrow.disputeInitiated = true;
        
        emit DisputeInitiated(escrowId);
    }
    
    /**
     * @dev Resolve a dispute (only owner)
     * @param escrowId The ID of the escrow in dispute
     * @param favorBuyer True to favor buyer, false to favor seller
     */
    function resolveDispute(uint256 escrowId, bool favorBuyer) external onlyOwner {
        Escrow storage escrow = escrows[escrowId];
        
        // Validate escrow exists and has dispute
        if (escrow.seller == address(0)) revert EscrowNotFound();
        if (escrow.status != EscrowStatus.Active) revert InvalidEscrowStatus();
        if (!escrow.disputeInitiated) revert InvalidEscrowStatus();
        
        // Resolve dispute
        if (favorBuyer) {
            escrow.status = EscrowStatus.Released;
            if (!cesToken.transfer(escrow.buyer, escrow.amount)) revert TransferFailed();
        } else {
            escrow.status = EscrowStatus.Refunded;
            if (!cesToken.transfer(escrow.seller, escrow.amount)) revert TransferFailed();
        }
        
        emit DisputeResolved(escrowId, favorBuyer);
    }
    
    /**
     * @dev Extend timelock for an escrow (only owner)
     * @param escrowId The ID of the escrow
     * @param additionalTime Additional time in seconds
     */
    function extendTimelock(uint256 escrowId, uint256 additionalTime) external onlyOwner {
        Escrow storage escrow = escrows[escrowId];
        
        if (escrow.seller == address(0)) revert EscrowNotFound();
        if (escrow.status != EscrowStatus.Active) revert InvalidEscrowStatus();
        
        escrow.timelock += additionalTime;
        
        emit TimelockExtended(escrowId, escrow.timelock);
    }
    
    /**
     * @dev Get escrow details
     * @param escrowId The ID of the escrow
     * @return seller Address of the seller
     * @return buyer Address of the buyer
     * @return amount Amount of tokens in escrow
     * @return timelock Timelock expiration timestamp
     * @return status Current escrow status
     */
    function getEscrowDetails(uint256 escrowId) external view returns (
        address seller,
        address buyer,
        uint256 amount,
        uint256 timelock,
        EscrowStatus status
    ) {
        Escrow storage escrow = escrows[escrowId];
        if (escrow.seller == address(0)) revert EscrowNotFound();
        
        return (
            escrow.seller,
            escrow.buyer,
            escrow.amount,
            escrow.timelock,
            escrow.status
        );
    }
    
    /**
     * @dev Check if escrow is expired
     * @param escrowId The ID of the escrow
     * @return True if expired
     */
    function isEscrowExpired(uint256 escrowId) external view returns (bool) {
        Escrow storage escrow = escrows[escrowId];
        if (escrow.seller == address(0)) revert EscrowNotFound();
        
        return block.timestamp >= escrow.timelock;
    }
    
    /**
     * @dev Emergency pause (only owner)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause (only owner)
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Emergency token recovery (only owner, when paused)
     * @param token Token address
     * @param amount Amount to recover
     */
    function emergencyTokenRecovery(address token, uint256 amount) external onlyOwner whenPaused {
        IERC20(token).transfer(owner(), amount);
    }
}