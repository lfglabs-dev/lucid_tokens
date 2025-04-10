#!/usr/bin/env node

const fetch = require('node-fetch');
const { ethers } = require('ethers');
const fs = require('fs-extra');
const path = require('path');
const ora = require('ora').default;
const { program } = require('commander');

// Chain configurations with Alchemy RPC endpoints
const CHAINS = {
  'world-chain': 'https://worldchain-mainnet.g.alchemy.com/v2/KmwG40UUX-Ih0ngWRLqV8nebiDIpcstE',
  'ethereum': 'https://eth-mainnet.g.alchemy.com/v2/KmwG40UUX-Ih0ngWRLqV8nebiDIpcstE',
  'zksync': 'https://zksync-mainnet.g.alchemy.com/v2/KmwG40UUX-Ih0ngWRLqV8nebiDIpcstE',
  'optimistic-ethereum': 'https://opt-mainnet.g.alchemy.com/v2/KmwG40UUX-Ih0ngWRLqV8nebiDIpcstE',
  'polygon-pos': 'https://polygon-mainnet.g.alchemy.com/v2/KmwG40UUX-Ih0ngWRLqV8nebiDIpcstE',
  'arbitrum-one': 'https://arb-mainnet.g.alchemy.com/v2/KmwG40UUX-Ih0ngWRLqV8nebiDIpcstE',
  'mantle': 'https://mantle-mainnet.g.alchemy.com/v2/KmwG40UUX-Ih0ngWRLqV8nebiDIpcstE',
  'berachain': 'https://berachain-mainnet.g.alchemy.com/v2/KmwG40UUX-Ih0ngWRLqV8nebiDIpcstE',
  'blast': 'https://blast-mainnet.g.alchemy.com/v2/KmwG40UUX-Ih0ngWRLqV8nebiDIpcstE',
  'linea': 'https://linea-mainnet.g.alchemy.com/v2/KmwG40UUX-Ih0ngWRLqV8nebiDIpcstE',
  'zora-network': 'https://zora-mainnet.g.alchemy.com/v2/KmwG40UUX-Ih0ngWRLqV8nebiDIpcstE',
  'base': 'https://base-mainnet.g.alchemy.com/v2/KmwG40UUX-Ih0ngWRLqV8nebiDIpcstE',
  'scroll': 'https://scroll-mainnet.g.alchemy.com/v2/KmwG40UUX-Ih0ngWRLqV8nebiDIpcstE',
  'xdai': 'https://gnosis-mainnet.g.alchemy.com/v2/KmwG40UUX-Ih0ngWRLqV8nebiDIpcstE',
  'binance-smart-chain': 'https://bnb-mainnet.g.alchemy.com/v2/KmwG40UUX-Ih0ngWRLqV8nebiDIpcstE',
  'avalanche': 'https://avax-mainnet.g.alchemy.com/v2/KmwG40UUX-Ih0ngWRLqV8nebiDIpcstE'
};

// Chain name mapping for DeFiLlama to our format
const CHAIN_MAPPING = {
  'ethereum': 'ethereum',
  'polygon-pos': 'polygon-pos',
  'binance-smart-chain': 'binance-smart-chain',
  'arbitrum': 'arbitrum-one',
  'optimism': 'optimistic-ethereum',
  'avalanche': 'avalanche',
  'zksync': 'zksync',
  'base': 'base',
  'linea': 'linea',
  'scroll': 'scroll',
  'mantle': 'mantle',
  'blast': 'blast',
  'zora': 'zora-network',
  'gnosis': 'xdai',
  'berachain': 'berachain',
  'world-chain': 'world-chain'
};

// ERC20 ABI for decimals
const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)"
];

// CLI options
program
  .option('-o, --output <dir>', 'Output directory', './tokens')
  .option('-f, --force', 'Force override existing files')
  .option('-c, --chain <chain>', 'Filter by chain name')
  .option('-l, --limit <number>', 'Concurrent processing limit', '5')
  .parse(process.argv);

const options = program.opts();

// Validate and create output directory
const outputDir = path.resolve(options.output);
fs.ensureDirSync(outputDir);

// Progress spinner
const spinner = ora('Processing tokens').start();

// Initialize providers for each chain
const providers = {};
for (const [chain, rpcUrl] of Object.entries(CHAINS)) {
  providers[chain] = new ethers.providers.JsonRpcProvider(rpcUrl);
}

function normalizeAddress(address) {
  try {
    return ethers.utils.getAddress(address).toLowerCase();
  } catch (error) {
    return null;
  }
}

async function getTokenInfo(address, chain) {
  try {
    const provider = providers[chain];
    if (!provider) {
      console.warn(`No provider available for chain ${chain}`);
      return null;
    }
    
    const contract = new ethers.Contract(address, ERC20_ABI, provider);
    const [decimals, symbol, name] = await Promise.all([
      contract.decimals(),
      contract.symbol(),
      contract.name()
    ]);
    return { decimals, symbol, name };
  } catch (error) {
    console.warn(`Failed to fetch token info for ${address} on chain ${chain}: ${error.message}`);
    return null;
  }
}

async function processToken(token, chain, address) {
  // Map the chain name to our format
  const mappedChain = CHAIN_MAPPING[chain] || chain;
  
  // Skip if we don't have a provider for this chain
  if (!providers[mappedChain]) {
    console.warn(`Skipping token ${token.symbol} on chain ${chain} - no provider available`);
    return;
  }
  
  // Normalize the address
  const normalizedAddress = normalizeAddress(address);
  if (!normalizedAddress) {
    console.warn(`Invalid address for token ${token.symbol} on chain ${chain}: ${address}`);
    return;
  }

  const chainDir = path.join(outputDir, mappedChain);
  const tokenFile = path.join(chainDir, `${normalizedAddress}.json`);

  // Skip if file exists and force is not set
  if (fs.existsSync(tokenFile) && !options.force) {
    return;
  }

  // Fetch actual token info from contract
  const tokenInfo = await getTokenInfo(normalizedAddress, mappedChain);
  if (!tokenInfo) {
    console.warn(`Skipping token ${token.symbol} on chain ${chain} due to contract error`);
    return;
  }

  // Create token data structure with normalized addresses
  const tokenData = {
    symbol: tokenInfo.symbol,
    name: tokenInfo.name,
    address: normalizedAddress,
    decimals: tokenInfo.decimals,
    type: 'ERC20',
    logo: token.logoURI ? {
      src: token.logoURI,
      width: "32",
      height: "32"
    } : undefined,
    platforms: {}
  };

  // Normalize all platform addresses
  for (const [platformChain, platformAddress] of Object.entries(token.platforms || {})) {
    const normalizedPlatformAddress = normalizeAddress(platformAddress);
    if (normalizedPlatformAddress) {
      tokenData.platforms[platformChain] = normalizedPlatformAddress;
    }
  }

  // Ensure chain directory exists
  fs.ensureDirSync(chainDir);

  // Write token file
  await fs.writeJson(tokenFile, tokenData, { spaces: 2 });
}

async function processBatch(tokens, startIdx, batchSize) {
  const promises = [];
  const endIdx = Math.min(startIdx + batchSize, tokens.length);

  for (let i = startIdx; i < endIdx; i++) {
    const token = tokens[i];
    if (options.chain) {
      // Process only the specified chain
      const chainAddress = token.platforms[options.chain.toLowerCase()];
      if (chainAddress) {
        promises.push(processToken(token, options.chain.toLowerCase(), chainAddress));
      }
    } else {
      // Process all chains
      for (const [chain, address] of Object.entries(token.platforms)) {
        if (address) {
          promises.push(processToken(token, chain, address));
        }
      }
    }
  }

  await Promise.all(promises);
  return endIdx;
}

async function main() {
  try {
    // Fetch token data
    spinner.text = 'Fetching token data...';
    const response = await fetch('https://defillama-datasets.llama.fi/tokenlist/all.json');
    const tokens = await response.json();

    console.log(`Total tokens fetched: ${tokens.length}`);
    
    // Debug: Log unique chain names from the first few tokens
    const uniqueChains = new Set();
    tokens.slice(0, 100).forEach(token => {
      Object.keys(token.platforms || {}).forEach(chain => uniqueChains.add(chain));
    });
    console.log('Found chain names in DeFiLlama data:', Array.from(uniqueChains).sort());
    
    // Process tokens in batches
    const batchSize = parseInt(options.limit);
    let processedCount = 0;
    let currentIdx = 0;

    while (currentIdx < tokens.length) {
      spinner.text = `Processing tokens ${currentIdx + 1}-${Math.min(currentIdx + batchSize, tokens.length)} of ${tokens.length}...`;
      currentIdx = await processBatch(tokens, currentIdx, batchSize);
      processedCount = currentIdx;
    }

    spinner.succeed(`Successfully processed ${processedCount} tokens`);
  } catch (error) {
    spinner.fail('Error processing tokens');
    console.error(error);
    process.exit(1);
  }
}

main(); 