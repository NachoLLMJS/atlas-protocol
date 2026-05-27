const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const { loadLocalConfig } = require('./config-loader');

async function main() {
  const { rpc, privateKey } = loadLocalConfig();
  if (!privateKey) throw new Error('Missing RH_PRIVATE_KEY in config.js or env');
  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log('Deployer:', wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log('Balance:', ethers.formatEther(balance), 'RBH');

  // Read compiled artifacts
  const buildDir = path.join(__dirname, '..', 'build');
  const factoryAbi = JSON.parse(fs.readFileSync(path.join(buildDir, 'contracts_IndexFactory_sol_IndexFactory.abi'), 'utf8'));
  const factoryBin = fs.readFileSync(path.join(buildDir, 'contracts_IndexFactory_sol_IndexFactory.bin'), 'utf8');

  console.log('\nDeploying IndexFactory...');
  const Factory = new ethers.ContractFactory(factoryAbi, '0x' + factoryBin, wallet);
  const factory = await Factory.deploy();
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log('IndexFactory deployed:', factoryAddr);

  // Save deployment info
  const deployment = {
    network: 'robinhood-testnet',
    chainId: 46630,
    deployer: wallet.address,
    IndexFactory: factoryAddr,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(__dirname, '..', 'deployment.json'), JSON.stringify(deployment, null, 2));
  console.log('\nDeployment saved to deployment.json');
  console.log(JSON.stringify(deployment, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
