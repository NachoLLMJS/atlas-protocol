const fs = require('fs');
const path = require('path');

function loadLocalConfig() {
  const configPath = path.join(__dirname, '..', 'config.js');
  const cfg = {};
  if (fs.existsSync(configPath)) {
    const code = fs.readFileSync(configPath, 'utf8');
    const fn = new Function(`${code}; return { RH_RPC, RH_PRIVATE_KEY };`);
    Object.assign(cfg, fn());
  }
  return {
    rpc: process.env.RH_RPC || cfg.RH_RPC || 'https://rpc.testnet.chain.robinhood.com',
    privateKey: process.env.RH_PRIVATE_KEY || cfg.RH_PRIVATE_KEY,
  };
}

module.exports = { loadLocalConfig };
