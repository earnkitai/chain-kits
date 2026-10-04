// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// A contract people call directly. EarnKit campaigns count the wallets that send transactions to
/// your contracts and the smart accounts that call them, so every check-in is a user that counts.
contract Checkin {
    mapping(address => uint256) public checkins;

    event CheckedIn(address indexed user, uint256 count, string note);

    function checkIn(string calldata note) external {
        uint256 n = ++checkins[msg.sender];
        emit CheckedIn(msg.sender, n, note);
    }
}
