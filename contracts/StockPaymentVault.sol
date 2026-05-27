// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20Like {
    function balanceOf(address) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
}

/**
 * @title StockPaymentVault
 * @notice Testnet purchase vault for buying individual Robinhood Chain stock tokens
 *         with the chain native payment/gas token. Separate from AtlasVault LP/index flows.
 */
contract StockPaymentVault {
    address public owner;

    // Native payment token decimals. EVM native units use 18 decimals.
    uint8 public constant paymentDecimals = 18;

    // stock token => native token wei per 1 whole stock token.
    // Example: TSLA at 187.34 native USD units = 187.34 ether-style units.
    mapping(address => uint256) public stockPrice;
    mapping(address => bool) public stockEnabled;
    address[] public stockList;

    event StockConfigured(address indexed stock, uint256 price, bool enabled);
    event StockBought(
        address indexed buyer,
        address indexed stock,
        uint256 stockAmount,
        uint256 paymentAmount
    );
    event WithdrawToken(address indexed token, address indexed to, uint256 amount);
    event WithdrawNative(address indexed to, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    receive() external payable {}

    function setStock(address stock, uint256 price, bool enabled) external onlyOwner {
        require(stock != address(0), "stock required");
        require(price > 0, "price required");
        if (!stockEnabled[stock] && enabled) {
            stockList.push(stock);
        }
        stockPrice[stock] = price;
        stockEnabled[stock] = enabled;
        emit StockConfigured(stock, price, enabled);
    }

    function buyStock(address stock, uint256 stockAmount) external payable {
        require(stockEnabled[stock], "stock disabled");
        require(stockAmount > 0, "zero amount");

        uint256 cost = quoteBuy(stock, stockAmount);
        require(msg.value >= cost, "insufficient native payment");
        require(IERC20Like(stock).balanceOf(address(this)) >= stockAmount, "insufficient stock liquidity");

        require(IERC20Like(stock).transfer(msg.sender, stockAmount), "stock transfer failed");

        uint256 refund = msg.value - cost;
        if (refund > 0) {
            (bool ok, ) = payable(msg.sender).call{value: refund}("");
            require(ok, "refund failed");
        }

        emit StockBought(msg.sender, stock, stockAmount, cost);
    }

    function quoteBuy(address stock, uint256 stockAmount) public view returns (uint256) {
        require(stockEnabled[stock], "stock disabled");
        uint8 stockDecimals = IERC20Like(stock).decimals();
        return (stockAmount * stockPrice[stock]) / (10 ** uint256(stockDecimals));
    }

    function getStockCount() external view returns (uint256) {
        return stockList.length;
    }

    function withdrawToken(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "zero address");
        require(IERC20Like(token).transfer(to, amount), "withdraw failed");
        emit WithdrawToken(token, to, amount);
    }

    function withdrawNative(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "zero address");
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "withdraw failed");
        emit WithdrawNative(to, amount);
    }
}
