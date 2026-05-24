// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ATLAS IndexToken
 * @notice ERC-20 token representing a basket of tokenized stocks on Robinhood Chain.
 *         Users deposit underlying stock tokens proportionally to mint index tokens,
 *         and burn index tokens to withdraw the underlying stocks.
 */

// Minimal ERC-20 interface
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
}

contract IndexToken {
    // ── ERC-20 state ──
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // ── Index composition ──
    address[] public stocks;
    uint256[] public weights; // basis points (total = 10000)
    address public creator;
    uint256 public feeBps; // creator fee in basis points (e.g. 30 = 0.3%)
    address public factory;

    // ── ERC-20 events ──
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Mint(address indexed to, uint256 indexAmount, uint256 depositPerStock);
    event Burn(address indexed from, uint256 indexAmount);

    constructor(
        string memory _name,
        string memory _symbol,
        address[] memory _stocks,
        uint256[] memory _weights,
        address _creator,
        uint256 _feeBps
    ) {
        require(_stocks.length >= 2 && _stocks.length <= 5, "2-5 stocks");
        require(_stocks.length == _weights.length, "length mismatch");
        uint256 totalW;
        for (uint i = 0; i < _weights.length; i++) totalW += _weights[i];
        require(totalW == 10000, "weights must sum to 10000");
        require(_feeBps <= 500, "fee max 5%");

        name = _name;
        symbol = _symbol;
        stocks = _stocks;
        weights = _weights;
        creator = _creator;
        feeBps = _feeBps;
        factory = msg.sender;
    }

    // ── ERC-20 functions ──
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        return _transfer(msg.sender, to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "exceeds allowance");
            allowance[from][msg.sender] = allowed - amount;
        }
        return _transfer(from, to, amount);
    }

    function _transfer(address from, address to, uint256 amount) internal returns (bool) {
        require(balanceOf[from] >= amount, "insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }

    // ── Mint: deposit stocks proportionally, receive index tokens ──
    // `amount` = how many index tokens to mint (in 18 decimals)
    // For each stock, user must have approved: amount * weight / 10000
    function mint(uint256 amount) external {
        require(amount > 0, "zero amount");
        for (uint i = 0; i < stocks.length; i++) {
            IERC20 token = IERC20(stocks[i]);
            uint8 tokenDec = token.decimals();
            // Calculate how much of this stock to deposit
            // amount is in 18 decimals, stock might have different decimals
            uint256 stockAmount = (amount * weights[i]) / 10000;
            // Adjust for decimal difference
            if (tokenDec < 18) {
                stockAmount = stockAmount / (10 ** (18 - tokenDec));
            } else if (tokenDec > 18) {
                stockAmount = stockAmount * (10 ** (tokenDec - 18));
            }
            require(stockAmount > 0, "amount too small");
            require(token.transferFrom(msg.sender, address(this), stockAmount), "transfer failed");
        }

        // Apply creator fee
        uint256 fee = (amount * feeBps) / 10000;
        uint256 userAmount = amount - fee;

        totalSupply += amount;
        balanceOf[msg.sender] += userAmount;
        if (fee > 0) {
            balanceOf[creator] += fee;
            emit Transfer(address(0), creator, fee);
        }
        emit Transfer(address(0), msg.sender, userAmount);
        emit Mint(msg.sender, userAmount, amount);
    }

    // ── Burn: return index tokens, receive underlying stocks ──
    function burn(uint256 amount) external {
        require(amount > 0 && balanceOf[msg.sender] >= amount, "insufficient");
        // Calculate proportional share of each stock
        for (uint i = 0; i < stocks.length; i++) {
            IERC20 token = IERC20(stocks[i]);
            uint256 stockBalance = token.balanceOf(address(this));
            // User gets: stockBalance * amount / totalSupply
            uint256 stockAmount = (stockBalance * amount) / totalSupply;
            if (stockAmount > 0) {
                require(token.transfer(msg.sender, stockAmount), "transfer failed");
            }
        }
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        emit Transfer(msg.sender, address(0), amount);
        emit Burn(msg.sender, amount);
    }

    // ── View helpers ──
    function getStocks() external view returns (address[] memory) { return stocks; }
    function getWeights() external view returns (uint256[] memory) { return weights; }
    function stockCount() external view returns (uint256) { return stocks.length; }
}
