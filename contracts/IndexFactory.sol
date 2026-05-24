// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IndexToken.sol";

/**
 * @title ATLAS IndexFactory
 * @notice Factory contract that deploys new IndexToken instances.
 *         Anyone can create a custom stock index fund.
 */
contract IndexFactory {
    address[] public allIndices;
    mapping(address => address[]) public creatorIndices;

    event IndexCreated(
        address indexed indexToken,
        string name,
        string symbol,
        address indexed creator,
        address[] stocks,
        uint256[] weights,
        uint256 feeBps
    );

    function createIndex(
        string memory _name,
        string memory _symbol,
        address[] memory _stocks,
        uint256[] memory _weights,
        uint256 _feeBps
    ) external returns (address) {
        IndexToken idx = new IndexToken(_name, _symbol, _stocks, _weights, msg.sender, _feeBps);
        address addr = address(idx);
        allIndices.push(addr);
        creatorIndices[msg.sender].push(addr);
        emit IndexCreated(addr, _name, _symbol, msg.sender, _stocks, _weights, _feeBps);
        return addr;
    }

    function totalIndices() external view returns (uint256) { return allIndices.length; }

    function getCreatorIndices(address creator) external view returns (address[] memory) {
        return creatorIndices[creator];
    }

    function getIndex(uint256 i) external view returns (address) { return allIndices[i]; }
}
