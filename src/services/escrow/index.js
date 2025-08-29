/**
 * Escrow Service Index
 * Exports the main escrow service and specialized services
 */

const EscrowService = require('./EscrowService');
const CoreEscrowService = require('./core/CoreEscrowService');
const TimeoutEscrowService = require('./core/TimeoutEscrowService');
const StatisticsEscrowService = require('./core/StatisticsEscrowService');
const SmartContractEscrowService = require('./contract/SmartContractEscrowService');
const DisputeEscrowService = require('./dispute/DisputeEscrowService');
const BalanceValidationService = require('./validation/BalanceValidationService');

module.exports = {
  EscrowService,
  CoreEscrowService,
  TimeoutEscrowService,
  StatisticsEscrowService,
  SmartContractEscrowService,
  DisputeEscrowService,
  BalanceValidationService
};