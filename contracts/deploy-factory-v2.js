const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const RPC = 'https://rpc.testnet.chain.robinhood.com';
const PRIVATE_KEY = 'cf0bc00a6b1d8bc2ff6a9805bbf627042cc6b09305dad8fc528047f072918ae7';
const VAULT_ADDRESS = '0x3130865dE0D1594E38C5cC52596712F05d93a4d5';

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  console.log('Deployer:', wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log('Balance:', ethers.formatEther(balance), 'RBH');

  const buildDir = path.join(__dirname, '..', 'build');
  const factoryAbi = JSON.parse(fs.readFileSync(path.join(buildDir, 'contracts_IndexFactory_sol_IndexFactory.abi'), 'utf8'));
  const factoryBin = fs.readFileSync(path.join(buildDir, 'contracts_IndexFactory_sol_IndexFactory.bin'), 'utf8');

  console.log('\nDeploying IndexFactory v2 (with vault fee split)...');
  console.log('Vault address:', VAULT_ADDRESS);
  const Factory = new ethers.ContractFactory(factoryAbi, '0x' + factoryBin, wallet);
  const factory = await Factory.deploy(VAULT_ADDRESS);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log('IndexFactory v2 deployed:', factoryAddr);

  // Update deployment.json
  const deploymentPath = path.join(__dirname, '..', 'deployment.json');
  let deployment = {};
  try { deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8')); } catch {}
  deployment.IndexFactoryV1 = deployment.IndexFactory;
  deployment.IndexFactory = factoryAddr;
  deployment.factoryV2DeployedAt = new Date().toISOString();
  deployment.feeSplit = '50% creator / 50% vault (LPs)';
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log('\nDeployment saved to deployment.json');
  console.log(JSON.stringify(deployment, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
