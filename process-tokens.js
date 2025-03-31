#!/usr/bin/env node

const fetch = require('node-fetch');
const { ethers } = require('ethers');
const fs = require('fs-extra');
const path = require('path');
const ora = require('ora').default;
const { program } = require('commander');

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

async function validateAddress(address) {
  try {
    return ethers.utils.getAddress(address);
  } catch (error) {
    return null;
  }
}

async function processToken(token, chain, address) {
  const chainDir = path.join(outputDir, chain);
  const tokenFile = path.join(chainDir, `${address}.json`);

  // Skip if file exists and force is not set
  if (fs.existsSync(tokenFile) && !options.force) {
    return;
  }

  // Validate address
  const validAddress = await validateAddress(address);
  if (!validAddress) {
    console.warn(`Invalid address for token ${token.symbol} on chain ${chain}`);
    return;
  }

  // Create token data structure
  const tokenData = {
    symbol: token.symbol,
    name: token.name,
    address: validAddress,
    decimals: token.decimals || 18,
    type: 'ERC20',
    logo: token.logoURI ? {
      src: token.logoURI,
      width: '32',
      height: '32'
    } : undefined,
    platforms: token.platforms || {}
  };

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