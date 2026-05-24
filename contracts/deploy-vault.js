const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const RPC = 'https://rpc.testnet.chain.robinhood.com';
const PRIVATE_KEY = 'cf0bc00a6b1d8bc2ff6a9805bbf627042cc6b09305dad8fc528047f072918ae7';

// Official stock token addresses on RH testnet
const STOCKS = {
  TSLA: '0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E',
  AMZN: '0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02',
  NFLX: '0x3b8262A63d25f0477c4DDE23F83cfe22Cb768C93',
  AMD:  '0x71178BAc73cBeb415514eB542a8995b82669778d',
  PLTR: '0x1FBE1a0e43594b3455993B5dE5Fd0A7A266298d0',
};

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function symbol() view returns (string)',
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  console.log('Deployer:', wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log('RBH Balance:', ethers.formatEther(balance));

  // Check stock balances
  console.log('\n--- Stock Balances ---');
  for (const [ticker, addr] of Object.entries(STOCKS)) {
    const token = new ethers.Contract(addr, ERC20_ABI, wallet);
    const bal = await token.balanceOf(wallet.address);
    const dec = await token.decimals();
    console.log(`${ticker}: ${ethers.formatUnits(bal, dec)}`);
  }

  // Deploy AtlasVault
  const buildDir = path.join(__dirname, '..', 'build');
  const vaultAbi = JSON.parse(fs.readFileSync(path.join(buildDir, 'contracts_AtlasVault_sol_AtlasVault.abi'), 'utf8'));
  const vaultBin = fs.readFileSync(path.join(buildDir, 'contracts_AtlasVault_sol_AtlasVault.bin'), 'utf8');

  console.log('\nDeploying AtlasVault...');
  const VaultFactory = new ethers.ContractFactory(vaultAbi, '0x' + vaultBin, wallet);
  const vault = await VaultFactory.deploy();
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log('AtlasVault deployed:', vaultAddr);

  // Seed vault with stocks - deposit 2 of each (keep 3 for ourselves)
  console.log('\n--- Seeding vault with liquidity ---');
  const DEPOSIT_AMOUNT = '2'; // deposit 2 of each stock

  for (const [ticker, addr] of Object.entries(STOCKS)) {
    const token = new ethers.Contract(addr, ERC20_ABI, wallet);
    const dec = await token.decimals();
    const amount = ethers.parseUnits(DEPOSIT_AMOUNT, dec);
    const bal = await token.balanceOf(wallet.address);

    if (bal < amount) {
      console.log(`${ticker}: insufficient balance (${ethers.formatUnits(bal, dec)}), skipping`);
      continue;
    }

    // Approve vault
    console.log(`${ticker}: approving ${DEPOSIT_AMOUNT}...`);
    const approveTx = await token.approve(vaultAddr, amount);
    await approveTx.wait();

    // Deposit
    console.log(`${ticker}: depositing ${DEPOSIT_AMOUNT}...`);
    const vaultContract = new ethers.Contract(vaultAddr, vaultAbi, wallet);
    const depositTx = await vaultContract.deposit(addr, amount);
    await depositTx.wait();
    console.log(`${ticker}: deposited!`);
  }

  // Verify vault balances
  console.log('\n--- Vault Balances ---');
  const vaultContract = new ethers.Contract(vaultAddr, vaultAbi, wallet);
  for (const [ticker, addr] of Object.entries(STOCKS)) {
    const bal = await vaultContract.getVaultBalance(addr);
    const token = new ethers.Contract(addr, ERC20_ABI, wallet);
    const dec = await token.decimals();
    console.log(`${ticker}: ${ethers.formatUnits(bal, dec)}`);
  }

  // Save deployment
  const deploymentPath = path.join(__dirname, '..', 'deployment.json');
  let deployment = {};
  try { deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8')); } catch {}
  deployment.AtlasVault = vaultAddr;
  deployment.vaultDeployedAt = new Date().toISOString();
  deployment.vaultSeeded = Object.keys(STOCKS).map(t => `${t}: ${DEPOSIT_AMOUNT}`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log('\nDeployment saved to deployment.json');
  console.log(JSON.stringify(deployment, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
