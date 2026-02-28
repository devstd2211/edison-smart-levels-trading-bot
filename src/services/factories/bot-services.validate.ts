/**
 * Bot services config validation.
 *
 * Extracted from BotFactory to keep the composition root thin.
 */

import { Config } from '../../types/legacy';
import { BotFactoryConfigValidationError } from '../../errors/DomainErrors';

export const validateBotConfig = (config: Config): void => {
  // Null/undefined check
  if (!config) {
    throw new BotFactoryConfigValidationError(
      'Configuration object is required',
      { missingField: 'config' },
    );
  }

  // Exchange validation
  if (!config.exchange) {
    throw new BotFactoryConfigValidationError(
      'Missing required field: exchange',
      { missingField: 'exchange' },
    );
  }

  const { exchange } = config;
  if (!exchange.symbol || typeof exchange.symbol !== 'string') {
    throw new BotFactoryConfigValidationError(
      'Missing or invalid field: exchange.symbol must be a string',
      { field: 'exchange.symbol', received: typeof exchange.symbol },
    );
  }

  if (!exchange.apiKey || typeof exchange.apiKey !== 'string') {
    throw new BotFactoryConfigValidationError(
      'Missing or invalid field: exchange.apiKey must be a string',
      { field: 'exchange.apiKey', received: typeof exchange.apiKey },
    );
  }

  if (!exchange.apiSecret || typeof exchange.apiSecret !== 'string') {
    throw new BotFactoryConfigValidationError(
      'Missing or invalid field: exchange.apiSecret must be a string',
      { field: 'exchange.apiSecret', received: typeof exchange.apiSecret },
    );
  }

  // Trading validation
  if (!config.trading) {
    throw new BotFactoryConfigValidationError(
      'Missing required field: trading',
      { missingField: 'trading' },
    );
  }

  if (
    typeof config.trading.leverage !== 'number' ||
    config.trading.leverage <= 0
  ) {
    throw new BotFactoryConfigValidationError(
      'Invalid field: trading.leverage must be a positive number',
      {
        field: 'trading.leverage',
        received: config.trading.leverage,
        type: typeof config.trading.leverage,
      },
    );
  }

  // Risk Management validation
  if (!config.riskManagement) {
    throw new BotFactoryConfigValidationError(
      'Missing required field: riskManagement',
      { missingField: 'riskManagement' },
    );
  }

  const { riskManagement } = config;
  if (
    typeof riskManagement.stopLossPercent !== 'number' ||
    riskManagement.stopLossPercent <= 0
  ) {
    throw new BotFactoryConfigValidationError(
      'Invalid field: riskManagement.stopLossPercent must be a positive number',
      {
        field: 'riskManagement.stopLossPercent',
        received: riskManagement.stopLossPercent,
      },
    );
  }

  if (!Array.isArray(riskManagement.takeProfits)) {
    throw new BotFactoryConfigValidationError(
      'Invalid field: riskManagement.takeProfits must be an array',
      {
        field: 'riskManagement.takeProfits',
        received: typeof riskManagement.takeProfits,
      },
    );
  }

  if (
    typeof riskManagement.positionSizeUsdt !== 'number' ||
    riskManagement.positionSizeUsdt <= 0
  ) {
    throw new BotFactoryConfigValidationError(
      'Invalid field: riskManagement.positionSizeUsdt must be a positive number',
      {
        field: 'riskManagement.positionSizeUsdt',
        received: riskManagement.positionSizeUsdt,
      },
    );
  }

  // Logging validation
  if (!config.logging) {
    throw new BotFactoryConfigValidationError(
      'Missing required field: logging',
      { missingField: 'logging' },
    );
  }

  if (!config.logging.level || typeof config.logging.level !== 'string') {
    throw new BotFactoryConfigValidationError(
      'Invalid field: logging.level must be a string',
      {
        field: 'logging.level',
        received: config.logging.level,
      },
    );
  }

  if (!config.logging.logDir || typeof config.logging.logDir !== 'string') {
    throw new BotFactoryConfigValidationError(
      'Invalid field: logging.logDir must be a string',
      {
        field: 'logging.logDir',
        received: config.logging.logDir,
      },
    );
  }

  // Timeframes validation
  if (!config.timeframes) {
    throw new BotFactoryConfigValidationError(
      'Missing required field: timeframes',
      { missingField: 'timeframes' },
    );
  }

  if (!config.timeframes.entry) {
    throw new BotFactoryConfigValidationError(
      'Missing required field: timeframes.entry',
      { missingField: 'timeframes.entry' },
    );
  }

  if (!config.timeframes.primary) {
    throw new BotFactoryConfigValidationError(
      'Missing required field: timeframes.primary',
      { missingField: 'timeframes.primary' },
    );
  }

  // Indicators validation (should be object, can be empty)
  if (!config.indicators || typeof config.indicators !== 'object') {
    throw new BotFactoryConfigValidationError(
      'Invalid field: indicators must be an object',
      {
        field: 'indicators',
        received: typeof config.indicators,
      },
    );
  }
};
