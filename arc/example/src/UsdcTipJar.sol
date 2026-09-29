// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// Minimal ERC-20 surface we need.
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// A tip jar that takes USDC on Arc through the ERC-20 interface (6 decimals).
/// On Arc, USDC is also the native gas token with 18 decimals (msg.value). This contract
/// never touches msg.value, so there's no decimals mix-up: amounts are always 6-decimal USDC.
contract UsdcTipJar {
    /// USDC's ERC-20 interface on Arc mainnet and testnet.
    IERC20 public constant USDC = IERC20(0x3600000000000000000000000000000000000000);
    address public immutable owner;

    event Tipped(address indexed from, uint256 amount, string note);

    constructor(address owner_) {
        owner = owner_;
    }

    /// Tip `amount` USDC (6 decimals: 1 USDC = 1_000_000). Approve this contract first.
    function tip(uint256 amount, string calldata note) external {
        require(amount > 0, "zero");
        emit Tipped(msg.sender, amount, note);
        require(USDC.transferFrom(msg.sender, owner, amount), "transfer failed");
    }
}
