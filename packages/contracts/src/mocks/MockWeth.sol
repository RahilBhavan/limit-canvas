// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IWETH} from "@1inch/solidity-utils/contracts/interfaces/IWETH.sol";

contract MockWeth is ERC20, IWETH {
  constructor() ERC20("WETH", "WETH") {}

  function deposit() external payable {
    _mint(msg.sender, msg.value);
    emit Deposit(msg.sender, msg.value);
  }

  function withdraw(uint256 amount) external {
    _burn(msg.sender, amount);
    emit Withdrawal(msg.sender, amount);
    (bool ok,) = msg.sender.call{value: amount}("");
    require(ok, "withdraw failed");
  }

  receive() external payable {}
}
