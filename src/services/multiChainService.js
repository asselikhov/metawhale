/**
 * Multi-Chain Configuration Service
 * Manages different blockchain networks and their tokens
 */

class MultiChainService {
  constructor() {
    this.networks = {
      polygon: {
        name: 'Polygon',
        symbol: 'MATIC',
        chainId: 137,
        nativeToken: 'POL',
        rpcUrls: [
          process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
          'https://rpc.ankr.com/polygon',
          'https://polygon-mainnet.g.alchemy.com/v2/demo',
          'https://rpc-mainnet.matic.network',
          'https://matic-mainnet.chainstacklabs.com'
        ],
        explorer: 'https://polygonscan.com',
        tokens: {
          CES: {
            name: 'CES Token',
            symbol: 'CES',
            address: process.env.CES_CONTRACT_ADDRESS || '0x1bdf71ede1a4777db1eebe7232bcda20d6fc1610',
            decimals: 18
          },
          USDT: {
            name: 'Tether USD (PoS)',
            symbol: 'USDT',
            address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
            decimals: 6
          }
        },
        gasSettings: {
          minGasPrice: '30', // gwei
          maxGasPrice: '200', // gwei
          defaultGasLimit: 100000
        }
      },
      tron: {
        name: 'TRON',
        symbol: 'TRX',
        chainId: 'mainnet',
        nativeToken: 'TRX',
        rpcUrls: [
          'https://api.trongrid.io',
          'https://api.tronstack.io',
          'https://api.nileex.io'
        ],
        explorer: 'https://tronscan.org',
        tokens: {
          TRX: {
            name: 'TRON',
            symbol: 'TRX',
            address: 'native',
            decimals: 6
          },
          USDT: {
            name: 'Tether USD (TRC20)',
            symbol: 'USDT',
            address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
            decimals: 6
          }
        },
        gasSettings: {
          feeLimit: 100000000, // 100 TRX
          defaultBandwidth: 1000
        }
      },
      bsc: {
        name: 'BNB Smart Chain',
        symbol: 'BNB',
        chainId: 56,
        nativeToken: 'BNB',
        rpcUrls: [
          'https://bsc-dataseed1.binance.org',
          'https://bsc-dataseed2.binance.org',
          'https://bsc-dataseed3.binance.org',
          'https://rpc.ankr.com/bsc'
        ],
        explorer: 'https://bscscan.com',
        tokens: {
          BNB: {
            name: 'BNB',
            symbol: 'BNB',
            address: 'native',
            decimals: 18
          },
          USDT: {
            name: 'Tether USD (BEP20)',
            symbol: 'USDT',
            address: '0x55d398326f99059fF775485246999027B3197955',
            decimals: 18
          },
          BUSD: {
            name: 'Binance USD',
            symbol: 'BUSD',
            address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
            decimals: 18
          },
          USDC: {
            name: 'USD Coin (BEP20)',
            symbol: 'USDC',
            address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
            decimals: 18
          }
        },
        gasSettings: {
          minGasPrice: '5', // gwei
          maxGasPrice: '20', // gwei
          defaultGasLimit: 100000
        }
      },
      solana: {
        name: 'Solana',
        symbol: 'SOL',
        chainId: 'mainnet-beta',
        nativeToken: 'SOL',
        rpcUrls: [
          'https://api.mainnet-beta.solana.com',
          'https://solana-api.projectserum.com',
          'https://rpc.ankr.com/solana'
        ],
        explorer: 'https://explorer.solana.com',
        tokens: {
          SOL: {
            name: 'Solana',
            symbol: 'SOL',
            address: 'native',
            decimals: 9
          },
          USDT: {
            name: 'Tether USD (SPL)',
            symbol: 'USDT',
            address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
            decimals: 6
          },
          USDC: {
            name: 'USD Coin (SPL)',
            symbol: 'USDC',
            address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            decimals: 6
          }
        },
        gasSettings: {
          computeUnitPrice: 1000, // micro lamports
          computeUnitLimit: 200000
        }
      },
      arbitrum: {
        name: 'Arbitrum One',
        symbol: 'ETH',
        chainId: 42161,
        nativeToken: 'ETH',
        rpcUrls: [
          'https://arb1.arbitrum.io/rpc',
          'https://arbitrum-mainnet.infura.io/v3/YOUR_INFURA_KEY',
          'https://rpc.ankr.com/arbitrum'
        ],
        explorer: 'https://arbiscan.io',
        tokens: {
          ETH: {
            name: 'Ethereum',
            symbol: 'ETH',
            address: 'native',
            decimals: 18
          },
          USDT: {
            name: 'Tether USD (Arbitrum)',
            symbol: 'USDT',
            address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
            decimals: 6
          },
          USDC: {
            name: 'USD Coin (Arbitrum)',
            symbol: 'USDC',
            address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
            decimals: 6
          },
          ARB: {
            name: 'Arbitrum',
            symbol: 'ARB',
            address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
            decimals: 18
          }
        },
        gasSettings: {
          minGasPrice: '0.1', // gwei
          maxGasPrice: '2', // gwei
          defaultGasLimit: 100000
        }
      },
      avalanche: {
        name: 'Avalanche',
        symbol: 'AVAX',
        chainId: 43114,
        nativeToken: 'AVAX',
        rpcUrls: [
          'https://api.avax.network/ext/bc/C/rpc',
          'https://rpc.ankr.com/avalanche',
          'https://avalanche-mainnet.infura.io/v3/YOUR_INFURA_KEY'
        ],
        explorer: 'https://snowtrace.io',
        tokens: {
          AVAX: {
            name: 'Avalanche',
            symbol: 'AVAX',
            address: 'native',
            decimals: 18
          },
          USDT: {
            name: 'Tether USD (Avalanche)',
            symbol: 'USDT',
            address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
            decimals: 6
          },
          USDC: {
            name: 'USD Coin (Avalanche)',
            symbol: 'USDC',
            address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
            decimals: 6
          }
        },
        gasSettings: {
          minGasPrice: '25', // nAVAX
          maxGasPrice: '1000', // nAVAX
          defaultGasLimit: 100000
        }
      },
      ton: {
        name: 'TON Network',
        symbol: 'TON',
        chainId: 'mainnet',
        nativeToken: 'TON',
        rpcUrls: [
          'https://toncenter.com/api/v2/',
          'https://mainnet.tonapi.io/v2/',
          'https://tonapi.io/v2/'
        ],
        explorer: 'https://tonscan.org',
        tokens: {
          TON: {
            name: 'Toncoin',
            symbol: 'TON',
            address: 'native',
            decimals: 9
          },
          USDT: {
            name: 'Tether USD (TON)',
            symbol: 'USDT',
            address: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
            decimals: 6
          },
          NOT: {
            name: 'Notcoin',
            symbol: 'NOT',
            address: 'EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT',
            decimals: 9
          }
        },
        gasSettings: {
          defaultFee: 10000000, // 0.01 TON in nanotons
          maxFee: 100000000 // 0.1 TON in nanotons
        }
      }
    };

    this.defaultNetwork = 'polygon';
  }

  // Get all available networks
  getNetworks() {
    return Object.keys(this.networks).map(key => ({
      id: key,
      ...this.networks[key]
    }));
  }

  // Get network configuration by ID
  getNetworkConfig(networkId) {
    return this.networks[networkId];
  }

  // Get network tokens
  getNetworkTokens(networkId) {
    const network = this.networks[networkId];
    return network ? network.tokens : {};
  }

  // Get token configuration
  getTokenConfig(networkId, tokenSymbol) {
    const tokens = this.getNetworkTokens(networkId);
    return tokens[tokenSymbol];
  }

  // Get network display name
  getNetworkDisplayName(networkId) {
    const network = this.networks[networkId];
    return network ? network.name : 'Unknown Network';
  }

  // Get network emoji
  getNetworkEmoji(networkId) {
    const emojis = {
      polygon: '🟣',
      tron: '🔴',
      bsc: '🟡',
      solana: '🟢',
      arbitrum: '🔵',
      avalanche: '🔶',
      ton: '💎'
    };
    return emojis[networkId] || '🔗';
  }

  // Check if network is supported
  isNetworkSupported(networkId) {
    return this.networks.hasOwnProperty(networkId);
  }

  // Get default network
  getDefaultNetwork() {
    return this.defaultNetwork;
  }

  // Format balance display for network
  formatBalance(networkId, tokenSymbol, balance, usdPrice = 0, rubPrice = 0) {
    const network = this.getNetworkConfig(networkId);
    const token = this.getTokenConfig(networkId, tokenSymbol);
    
    if (!network || !token) return '';

    const emoji = this.getNetworkEmoji(networkId);
    const usd = (balance * usdPrice).toFixed(2);
    const rub = (balance * rubPrice).toFixed(2);
    
    return `${emoji} ${tokenSymbol}: ${balance.toFixed(4)} • $${usd} • ₽${rub}`;
  }

  // Get network selector buttons
  getNetworkSelectorButtons(currentNetwork = null) {
    const { Markup } = require('telegraf');
    
    const buttons = Object.keys(this.networks).map(networkId => {
      const network = this.networks[networkId];
      const emoji = this.getNetworkEmoji(networkId);
      const isSelected = networkId === currentNetwork;
      const buttonText = isSelected ? `${emoji} ${network.name} ✅` : `${emoji} ${network.name}`;
      
      return Markup.button.callback(buttonText, `switch_network_${networkId}`);
    });

    // Split into rows of 2
    const rows = [];
    for (let i = 0; i < buttons.length; i += 2) {
      rows.push(buttons.slice(i, i + 2));
    }

    return rows;
  }

  // Validate network address format
  validateAddress(networkId, address) {
    switch (networkId) {
      case 'polygon':
      case 'bsc':
      case 'arbitrum':
      case 'avalanche':
        return /^0x[a-fA-F0-9]{40}$/.test(address);
      case 'tron':
        return /^T[A-Za-z1-9]{33}$/.test(address);
      case 'solana':
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
      case 'ton':
        return /^[A-Za-z0-9\-_]{48}$/.test(address) || /^EQ[A-Za-z0-9\-_]{46}$/.test(address);
      default:
        return false;
    }
  }

  // Get minimum transfer amounts
  getMinimumTransferAmount(networkId, tokenSymbol) {
    const minimums = {
      polygon: {
        CES: 0.0001,
        USDT: 0.01,
        POL: 0.001
      },
      tron: {
        TRX: 1,
        USDT: 1
      },
      bsc: {
        BNB: 0.001,
        USDT: 0.01,
        BUSD: 0.01,
        USDC: 0.01
      },
      solana: {
        SOL: 0.001,
        USDT: 0.01,
        USDC: 0.01
      },
      arbitrum: {
        ETH: 0.0001,
        USDT: 0.01,
        USDC: 0.01,
        ARB: 0.1
      },
      avalanche: {
        AVAX: 0.001,
        USDT: 0.01,
        USDC: 0.01
      },
      ton: {
        TON: 0.01,
        USDT: 1,
        NOT: 1000
      }
    };
    
    return minimums[networkId]?.[tokenSymbol] || 0.001;
  }

  // Get network fee estimation
  estimateNetworkFee(networkId, tokenSymbol) {
    switch (networkId) {
      case 'polygon':
        return {
          gasLimit: tokenSymbol === 'POL' ? 21000 : 65000,
          estimatedFee: tokenSymbol === 'POL' ? 0.001 : 0.002,
          feeToken: 'POL'
        };
      case 'tron':
        return {
          bandwidth: 1000,
          energy: tokenSymbol === 'TRX' ? 0 : 15000,
          estimatedFee: tokenSymbol === 'TRX' ? 0 : 15,
          feeToken: 'TRX'
        };
      case 'bsc':
        return {
          gasLimit: tokenSymbol === 'BNB' ? 21000 : 65000,
          estimatedFee: tokenSymbol === 'BNB' ? 0.0002 : 0.0005,
          feeToken: 'BNB'
        };
      case 'solana':
        return {
          computeUnitLimit: 200000,
          estimatedFee: 0.000005, // ~5000 lamports
          feeToken: 'SOL'
        };
      case 'arbitrum':
        return {
          gasLimit: tokenSymbol === 'ETH' ? 21000 : 65000,
          estimatedFee: tokenSymbol === 'ETH' ? 0.00001 : 0.00002,
          feeToken: 'ETH'
        };
      case 'avalanche':
        return {
          gasLimit: tokenSymbol === 'AVAX' ? 21000 : 65000,
          estimatedFee: tokenSymbol === 'AVAX' ? 0.001 : 0.002,
          feeToken: 'AVAX'
        };
      case 'ton':
        return {
          estimatedFee: tokenSymbol === 'TON' ? 0.01 : 0.02,
          feeToken: 'TON'
        };
      default:
        return { estimatedFee: 0 };
    }
  }
}

module.exports = new MultiChainService();