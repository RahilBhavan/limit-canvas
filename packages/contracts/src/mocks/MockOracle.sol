// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

contract MockOracle {
  int256 public answer;

  function setAnswer(int256 _answer) external {
    answer = _answer;
  }

  function latestAnswer() external view returns (int256) {
    return answer;
  }
}
