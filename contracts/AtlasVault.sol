// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
}

interface IIndexToken {
    function stocks(uint256 i) external view returns (address);
    function weights(uint256 i) external view returns (uint256);
    function stockCount() external view returns (uint256);
    function creator() external view returns (address);
    function feeBps() external view returns (uint256);
    function mint(uint256 amount) external;
    function burn(uint256 amount) external;
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address) external view returns (uint256);
    function decimals() external view returns (uint8);
}

/**
 * @title AtlasVault
 * @notice Liquidity vault for the ATLAS protocol.
 *         LPs deposit stock tokens. Buyers purchase index tokens in one tx.
 *         Fee split: 50% to index creator, 50% to LPs.
 */
contract AtlasVault {
    address public owner;

    // LP tracking
    struct LPInfo {
        uint256 totalDeposited; // total value deposited (sum across tokens, in raw units)
        bool active;
    }
    mapping(address => LPInfo) public lps;
    mapping(address => mapping(address => uint256)) public lpTokenDeposits; // lp => token => amount
    address[] public lpList;

    // Fee distribution
    uint256 public lpFeeShareBps = 5000; // 50% of creator fee goes to LPs
    uint256 public totalFeesCollected;
    mapping(address => uint256) public lpFeesEarned;

    // Events
    event Deposit(address indexed lp, address indexed token, uint256 amount);
    event Withdraw(address indexed lp, address indexed token, uint256 amount);
    event IndexBought(address indexed buyer, address indexed indexToken, uint256 amount);
    event IndexSold(address indexed seller, address indexed indexToken, uint256 amount);
    event FeeDistributed(address indexed lp, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // ── LP Functions ──

    /// @notice Deposit stock tokens into the vault as liquidity
    function deposit(address token, uint256 amount) external {
        require(amount > 0, "zero amount");
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        lpTokenDeposits[msg.sender][token] += amount;
        if (!lps[msg.sender].active) {
            lps[msg.sender].active = true;
            lpList.push(msg.sender);
        }
        lps[msg.sender].totalDeposited += amount;
        emit Deposit(msg.sender, token, amount);
    }

    /// @notice Withdraw stock tokens from the vault (LP only)
    function withdraw(address token, uint256 amount) external {
        require(lpTokenDeposits[msg.sender][token] >= amount, "exceeds deposit");
        lpTokenDeposits[msg.sender][token] -= amount;
        lps[msg.sender].totalDeposited -= amount;
        IERC20(token).transfer(msg.sender, amount);
        emit Withdraw(msg.sender, token, amount);
    }

    // ── Buy Index ──

    /// @notice Buy index tokens: vault provides underlying stocks, mints, sends to buyer
    /// @param indexToken The IndexToken contract address
    /// @param amount How many index tokens to mint (18 decimals)
    function buyIndex(address indexToken, uint256 amount) external {
        require(amount > 0, "zero amount");
        IIndexToken idx = IIndexToken(indexToken);
        uint256 count = idx.stockCount();

        // Approve each underlying stock to the index contract
        for (uint256 i = 0; i < count; i++) {
            address stock = idx.stocks(i);
            uint256 weight = idx.weights(i);
            IERC20 token = IERC20(stock);
            uint8 tokenDec = token.decimals();

            // Calculate required amount (same logic as IndexToken.mint)
            uint256 stockAmount = (amount * weight) / 10000;
            if (tokenDec < 18) {
                stockAmount = stockAmount / (10 ** (18 - tokenDec));
            } else if (tokenDec > 18) {
                stockAmount = stockAmount * (10 ** (tokenDec - 18));
            }
            require(token.balanceOf(address(this)) >= stockAmount, "vault: insufficient liquidity");
            token.approve(indexToken, stockAmount);
        }

        // Mint index tokens (they go to this vault)
        idx.mint(amount);

        // The index creator already took feeBps inside mint().
        // We receive (amount - fee) index tokens.
        uint256 vaultBalance = idx.balanceOf(address(this));
        require(vaultBalance > 0, "mint failed");

        // Transfer all received index tokens to the buyer
        idx.transfer(msg.sender, vaultBalance);

        emit IndexBought(msg.sender, indexToken, amount);
    }

    // ── Sell Index ──

    /// @notice Sell index tokens: buyer sends index tokens back, vault burns and keeps stocks
    /// @param indexToken The IndexToken contract address
    /// @param amount How many index tokens to sell (18 decimals)
    function sellIndex(address indexToken, uint256 amount) external {
        require(amount > 0, "zero amount");
        IIndexToken idx = IIndexToken(indexToken);

        // Transfer index tokens from seller to vault
        IERC20(indexToken).transferFrom(msg.sender, address(this), amount);

        // Burn to get underlying stocks back into vault
        idx.burn(amount);

        emit IndexSold(msg.sender, indexToken, amount);
    }

    // ── View Functions ──

    function getVaultBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    function getLPCount() external view returns (uint256) {
        return lpList.length;
    }

    function getLP(uint256 i) external view returns (address) {
        return lpList[i];
    }

    // ── Owner Functions ──

    function setLPFeeShare(uint256 bps) external onlyOwner {
        require(bps <= 10000, "max 100%");
        lpFeeShareBps = bps;
    }

    /// @notice Emergency withdraw by owner
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
    }
}
