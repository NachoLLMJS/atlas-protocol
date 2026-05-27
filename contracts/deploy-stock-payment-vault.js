const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const { loadLocalConfig } = require('./config-loader');

const STOCKS = {
  // usdPrice is shown in the UI/docs as the market-style quote.
  // nativePrice is the tiny demo amount paid in Robinhood testnet native gas token.
  TSLA: { addr: '0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E', usdPrice: '187.34', nativePrice: '0.00018734' },
  AMZN: { addr: '0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02', usdPrice: '191.75', nativePrice: '0.00019175' },
  NFLX: { addr: '0x3b8262A63d25f0477c4DDE23F83cfe22Cb768C93', usdPrice: '634.20', nativePrice: '0.00063420' },
  AMD:  { addr: '0x71178BAc73cBeb415514eB542a8995b82669778d', usdPrice: '168.92', nativePrice: '0.00016892' },
  PLTR: { addr: '0x1FBE1a0e43594b3455993B5dE5Fd0A7A266298d0', usdPrice: '74.85', nativePrice: '0.00007485' },
};

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function symbol() view returns (string)',
];

function readArtifact(buildDir, name) {
  return {
    abi: JSON.parse(fs.readFileSync(path.join(buildDir, `${name}.abi`), 'utf8')),
    bin: fs.readFileSync(path.join(buildDir, `${name}.bin`), 'utf8'),
  };
}

async function deploy(factory, label, ...args) {
  console.log(`Deploying ${label}...`);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log(`${label}:`, addr);
  return contract;
}

async function main() {
  const { rpc, privateKey } = loadLocalConfig();
  if (!privateKey) throw new Error('Missing RH_PRIVATE_KEY in config.js or env');

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log('Deployer:', wallet.address);
  console.log('Native balance:', ethers.formatEther(await provider.getBalance(wallet.address)));

  const buildDir = path.join(__dirname, '..', 'build');
  const stockVaultArtifact = readArtifact(buildDir, 'contracts_StockPaymentVault_sol_StockPaymentVault');

  const StockPaymentVault = new ethers.ContractFactory(stockVaultArtifact.abi, '0x' + stockVaultArtifact.bin, wallet);
  const stockPaymentVault = await deploy(StockPaymentVault, 'StockPaymentVault');
  const stockPaymentVaultAddr = await stockPaymentVault.getAddress();

  console.log('\nConfiguring native-token stock prices...');
  for (const [ticker, s] of Object.entries(STOCKS)) {
    const priceUnits = ethers.parseUnits(s.nativePrice, 18);
    const tx = await stockPaymentVault.setStock(s.addr, priceUnits, true);
    await tx.wait();
    console.log(`${ticker}: ${s.nativePrice} native units demo price ($${s.usdPrice} display quote)`);
  }

  console.log('\nSeeding stock purchase vault...');
  const seeded = [];
  for (const [ticker, s] of Object.entries(STOCKS)) {
    const token = new ethers.Contract(s.addr, ERC20_ABI, wallet);
    const decimals = await token.decimals();
    const available = await token.balanceOf(wallet.address);
    const seedAmount = ethers.parseUnits('0.5', decimals);
    if (available < seedAmount) {
      console.log(`${ticker}: wallet has ${ethers.formatUnits(available, decimals)}, skipping seed`);
      continue;
    }
    const tx = await token.transfer(stockPaymentVaultAddr, seedAmount);
    await tx.wait();
    seeded.push(`${ticker}: 0.5`);
    console.log(`${ticker}: seeded 0.5`);
  }

  const deploymentPath = path.join(__dirname, '..', 'deployment.json');
  let deployment = {};
  try { deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8')); } catch {}

  if (deployment.StockPaymentVault) deployment.StockPaymentVaultERC20Deprecated = deployment.StockPaymentVault;

  deployment.StockPaymentVault = stockPaymentVaultAddr;
  deployment.stockPaymentDeployedAt = new Date().toISOString();
  deployment.stockPaymentToken = 'Robinhood testnet native gas/payment token';
  deployment.stockPaymentMode = 'native';
  deployment.stockPaymentPrices = Object.fromEntries(Object.entries(STOCKS).map(([ticker, s]) => [ticker, s.usdPrice]));
  deployment.stockPaymentNativePrices = Object.fromEntries(Object.entries(STOCKS).map(([ticker, s]) => [ticker, s.nativePrice]));
  deployment.stockPaymentVaultSeeded = seeded;

  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log('\nDeployment saved to deployment.json');
  console.log(JSON.stringify({ StockPaymentVault: stockPaymentVaultAddr, stockPaymentMode: 'native' }, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
