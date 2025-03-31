# Lucid Token List

This repository contains a curated list of tokens that will be used as whitelisted tokens in the Lucid App. The token list is sourced from DeFiLlama's comprehensive token database, which is one of the most reliable and up-to-date sources for token information in the DeFi ecosystem.

## Source

The token data is fetched from DeFiLlama's public API endpoint:
```
https://defillama-datasets.llama.fi/tokenlist/all.json
```

This endpoint provides a comprehensive list of tokens across multiple chains, including:
- Token names and symbols
- Contract addresses
- Token decimals
- Logo URIs
- Cross-chain platform information

## Token List Structure

The tokens are organized in the following directory structure:
```
/tokens
  /{chain-name}
    /{token-address}.json
```

Each token file contains:
```json
{
    "symbol": "TOKEN_SYMBOL",
    "name": "TOKEN_NAME",
    "address": "TOKEN_ADDRESS",
    "decimals": 18,
    "type": "ERC20",
    "logo": {
        "src": "LOGO_URI",
        "width": "32",
        "height": "32"
    },
    "platforms": {
        "chain1": "address1",
        "chain2": "address2"
    }
}
```

## Usage in Lucid App

This token list serves as the whitelist for tokens that can be used within the Lucid App. The list ensures that:
1. Only verified and legitimate tokens are supported
2. Token information is accurate and up-to-date
3. Cross-chain token relationships are properly maintained
4. Token metadata (logos, decimals, etc.) is consistently formatted

## Token List Generation

The token list is generated using a Node.js script (`process-tokens.js`) that:
1. Fetches the latest token data from DeFiLlama
2. Validates token addresses using ethers.js
3. Organizes tokens by chain
4. Creates individual JSON files for each token
5. Handles rate limiting and concurrent processing
6. Provides progress feedback during generation

### Running the Script

```bash
# Process all chains
pnpm run process-tokens

# Process a specific chain
pnpm run process-tokens --chain ethereum

# Force override existing files
pnpm run process-tokens --chain ethereum --force

# Change output directory
pnpm run process-tokens --output ./custom-tokens

# Adjust concurrent processing limit
pnpm run process-tokens --limit 10
```

## Maintenance

The token list should be updated periodically to ensure it contains the latest token information. This can be done by running the process-tokens script with the appropriate options.

## License

This token list is part of the Lucid App ecosystem and is subject to the same licensing terms as the main application. 