/**
 * Escrow Service Instance
 * Exports a singleton instance of the EscrowService
 */

const EscrowService = require('./EscrowService');

module.exports = new EscrowService();