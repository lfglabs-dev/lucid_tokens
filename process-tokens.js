#!/usr/bin/env node

const fetch = require('node-fetch');
const { ethers } = require('ethers');
const fs = require('fs-extra');
const path = require('path');
const ora = require('ora').default;
const { program } = require('commander');

// QuickNode RPC
const QUICKNODE_RPC = "YOUR_QUICKNODE_RPC_URL";

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

// Initialize provider
const provider = new ethers.providers.JsonRpcProvider(QUICKNODE_RPC);

function normalizeAddress(address) {
  try {
    return ethers.utils.getAddress(address).toLowerCase();
  } catch (error) {
    return null;
  }
}

async function getTokenInfo(address) {
  try {
    const contract = new ethers.Contract(address, ERC20_ABI, provider);
    const [decimals, symbol, name] = await Promise.all([
      contract.decimals(),
      contract.symbol(),
      contract.name()
    ]);
    return { decimals, symbol, name };
  } catch (error) {
    console.warn(`Failed to fetch token info for ${address}: ${error.message}`);
    return null;
  }
}

async function processToken(token, chain, address) {
  // Normalize the address
  const normalizedAddress = normalizeAddress(address);
  if (!normalizedAddress) {
    console.warn(`Invalid address for token ${token.symbol} on chain ${chain}: ${address}`);
    return;
  }

  const chainDir = path.join(outputDir, chain);
  const tokenFile = path.join(chainDir, `${normalizedAddress}.json`);

  // Skip if file exists and force is not set
  if (fs.existsSync(tokenFile) && !options.force) {
    return;
  }

  // Fetch actual token info from contract
  const tokenInfo = await getTokenInfo(normalizedAddress);
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
      const chainAddress = token.platforms[options.chain.toLowerCase()];
      if (chainAddress) {
        promises.push(processToken(token, options.chain.toLowerCase(), chainAddress));
      }
    } else {
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