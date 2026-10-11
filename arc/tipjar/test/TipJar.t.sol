// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {UsdcTipJar} from "../src/UsdcTipJar.sol";
import {MockUsdc} from "./MockUsdc.sol";

/// Foundry's cheatcodes, declared here so the kit needs no `forge install` (degit drops submodules).
interface Vm {
    function etch(address target, bytes calldata code) external;
    function prank(address sender) external;
    function expectRevert(bytes calldata message) external;
    function expectEmit(bool t1, bool t2, bool t3, bool data, address emitter) external;
}

contract TipJarTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant USDC = 0x3600000000000000000000000000000000000000;
    address constant OWNER = address(0xB0B);
    address constant ALICE = address(0xA11CE);
    address constant CAROL = address(0xCA201);

    event Tipped(address indexed from, uint256 amount, string note);

    UsdcTipJar jar;

    function setUp() public {
        vm.etch(USDC, address(new MockUsdc()).code);
        jar = new UsdcTipJar(OWNER, "PodTips", 0);
        fund(ALICE, 10_000_000);
        fund(CAROL, 10_000_000);
    }

    function fund(address who, uint256 amount) internal {
        MockUsdc(USDC).mint(who, amount);
        vm.prank(who);
        MockUsdc(USDC).approve(address(jar), type(uint256).max);
    }

    function eq(uint256 a, uint256 b, string memory what) internal pure {
        require(a == b, what);
    }

    function test_ownerIsTheConstructorArgument() public view {
        require(jar.owner() == OWNER, "owner");
        require(keccak256(bytes(jar.name())) == keccak256("PodTips"), "name");
        eq(jar.minTip(), 0, "minTip");
    }

    function test_zeroOwnerReverts() public {
        vm.expectRevert(bytes("owner"));
        new UsdcTipJar(address(0), "PodTips", 0);
    }

    function test_tipMovesUsdcToTheOwner() public {
        vm.prank(ALICE);
        jar.tip(1_500_000, "great episode");
        eq(MockUsdc(USDC).balanceOf(OWNER), 1_500_000, "owner balance");
        eq(MockUsdc(USDC).balanceOf(ALICE), 8_500_000, "alice balance");
        eq(MockUsdc(USDC).balanceOf(address(jar)), 0, "jar holds nothing");
    }

    function test_tipEmitsTipped() public {
        vm.expectEmit(true, false, false, true, address(jar));
        emit Tipped(ALICE, 2_000_000, "hi");
        vm.prank(ALICE);
        jar.tip(2_000_000, "hi");
    }

    function test_zeroTipReverts() public {
        vm.prank(ALICE);
        vm.expectRevert(bytes("zero"));
        jar.tip(0, "");
    }

    function test_minTipEnforced() public {
        jar = new UsdcTipJar(OWNER, "PodTips", 1_000_000);
        fund(ALICE, 0);
        vm.prank(ALICE);
        vm.expectRevert(bytes("below min"));
        jar.tip(999_999, "");
        vm.prank(ALICE);
        jar.tip(1_000_000, "");
        eq(jar.tipCount(), 1, "count");
    }

    function test_longNoteReverts() public {
        bytes memory note = new bytes(281);
        vm.prank(ALICE);
        vm.expectRevert(bytes("note too long"));
        jar.tip(1, string(note));
    }

    function test_noAllowanceReverts() public {
        address dave = address(0xDA5E);
        MockUsdc(USDC).mint(dave, 1_000_000);
        vm.prank(dave);
        vm.expectRevert(bytes("allowance"));
        jar.tip(1_000_000, "");
    }

    function test_countersAndStats() public {
        vm.prank(ALICE);
        jar.tip(1_000_000, "a");
        vm.prank(ALICE);
        jar.tip(500_000, "b");
        vm.prank(CAROL);
        jar.tip(250_000, "c");
        (uint256 tips, uint256 total, uint256 tippers) = jar.stats();
        eq(tips, 3, "tips");
        eq(total, 1_750_000, "total");
        eq(tippers, 2, "tippers");
        eq(jar.tipCount(), 3, "tipCount");
        eq(jar.totalTipped(), 1_750_000, "totalTipped");
        eq(jar.tipsFrom(ALICE), 2, "tipsFrom alice");
        eq(jar.tippedBy(ALICE), 1_500_000, "tippedBy alice");
        eq(jar.tippedBy(CAROL), 250_000, "tippedBy carol");
    }
}
