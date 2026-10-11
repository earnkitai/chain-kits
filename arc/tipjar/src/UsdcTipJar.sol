// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// The one ERC-20 call this contract makes.
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// A tip jar that takes USDC on Arc through the ERC-20 interface (6 decimals: 1 USDC = 1_000_000).
/// On Arc, USDC is also the gas token with 18 decimals (msg.value). This contract never touches
/// msg.value, so amounts are always 6-decimal USDC. Tips go straight to `owner`; the contract holds
/// nothing.
contract UsdcTipJar {
    /// USDC's ERC-20 interface on Arc mainnet and testnet (docs.arc.io, connect-to-arc).
    IERC20 public constant USDC = IERC20(0x3600000000000000000000000000000000000000);
    /// Longest note, in bytes, so a tip stays cheap.
    uint256 public constant MAX_NOTE = 280;

    /// Who receives every tip. Set once, in the constructor.
    address public immutable owner;
    /// The smallest tip, in 6-decimal USDC. 0 means any amount above zero.
    uint256 public immutable minTip;
    /// The jar's name (the builder's twist).
    string public name;

    /// Running totals, so one call reads exact usage (see `stats`).
    uint256 public tipCount;
    uint256 public totalTipped;
    uint256 public tipperCount;
    mapping(address => uint256) public tipsFrom;
    mapping(address => uint256) public tippedBy;

    event Tipped(address indexed from, uint256 amount, string note);

    constructor(address owner_, string memory name_, uint256 minTip_) {
        require(owner_ != address(0), "owner");
        owner = owner_;
        name = name_;
        minTip = minTip_;
    }

    /// Tip `amount` USDC (6 decimals). Approve this contract on USDC first.
    function tip(uint256 amount, string calldata note) external {
        require(amount > 0, "zero");
        require(amount >= minTip, "below min");
        require(bytes(note).length <= MAX_NOTE, "note too long");
        if (tipsFrom[msg.sender] == 0) tipperCount += 1;
        tipsFrom[msg.sender] += 1;
        tippedBy[msg.sender] += amount;
        tipCount += 1;
        totalTipped += amount;
        emit Tipped(msg.sender, amount, note);
        require(USDC.transferFrom(msg.sender, owner, amount), "transfer failed");
    }

    /// Every total in one call: tips, USDC tipped (6 decimals), unique tippers.
    function stats() external view returns (uint256 tips, uint256 total, uint256 tippers) {
        return (tipCount, totalTipped, tipperCount);
    }
}
