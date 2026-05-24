const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const RPC = 'https://rpc.testnet.chain.robinhood.com';
const PRIVATE_KEY = 'cf0bc00a6b1d8bc2ff6a9805bbf627042cc6b09305dad8fc528047f072918ae7';

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
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
