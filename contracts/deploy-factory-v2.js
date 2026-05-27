const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const { loadLocalConfig } = require('./config-loader');

const VAULT_ADDRESS = '0x3130865dE0D1594E38C5cC52596712F05d93a4d5';

async function main() {
  const { rpc, privateKey } = loadLocalConfig();
  if (!privateKey) throw new Error('Missing RH_PRIVATE_KEY in config.js or env');
  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(privateKey, provider);
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
