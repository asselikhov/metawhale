/**
 * Dispute Service Index
 * Exports the main dispute service and specialized services
 */

const DisputeService = require('./DisputeService');
const DisputeInitiationService = require('./DisputeInitiationService');
const EvidenceService = require('./EvidenceService');
const DisputeStatisticsService = require('./DisputeStatisticsService');

module.exports = {
  DisputeService,
  DisputeInitiationService,
  EvidenceService,
  DisputeStatisticsService
};