// src/utils/walletErrors.js

// Error base para todos los errores de wallet
class WalletError extends Error {
  constructor(message, code = 'WALLET_ERROR', statusCode = 400) {
    super(message);
    this.name = 'WalletError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

// Saldo insuficiente
class InsufficientBalanceError extends WalletError {
  constructor(available, required) {
    super(
      `Saldo insuficiente. Disponible: S/ ${available.toFixed(2)}, Requerido: S/ ${required.toFixed(2)}`,
      'INSUFFICIENT_BALANCE',
      400
    );
    this.available = available;
    this.required = required;
  }
}

// Wallet congelada
class WalletFrozenError extends WalletError {
  constructor(reason = 'La billetera está congelada') {
    super(reason, 'WALLET_FROZEN', 403);
  }
}

// Transacción duplicada
class DuplicateTransactionError extends WalletError {
  constructor(externalReference) {
    super(
      `Transacción duplicada. Referencia: ${externalReference}`,
      'DUPLICATE_TRANSACTION',
      409
    );
    this.externalReference = externalReference;
  }
}

// Monto inválido
class InvalidAmountError extends WalletError {
  constructor(amount, min = null, max = null) {
    let message = `Monto inválido: S/ ${amount}`;
    if (min !== null) message += `. Mínimo: S/ ${min}`;
    if (max !== null) message += `. Máximo: S/ ${max}`;
    
    super(message, 'INVALID_AMOUNT', 400);
    this.amount = amount;
    this.min = min;
    this.max = max;
  }
}

// Límite diario excedido
class DailyLimitExceededError extends WalletError {
  constructor(limit, requested) {
    super(
      `Límite diario excedido. Límite: S/ ${limit.toFixed(2)}, Solicitado: S/ ${requested.toFixed(2)}`,
      'DAILY_LIMIT_EXCEEDED',
      400
    );
    this.limit = limit;
    this.requested = requested;
  }
}

// Wallet no encontrada
class WalletNotFoundError extends WalletError {
  constructor(userId) {
    super(
      `Wallet no encontrada para usuario ${userId}`,
      'WALLET_NOT_FOUND',
      404
    );
    this.userId = userId;
  }
}

// Transacción no reversible
class TransactionNotReversibleError extends WalletError {
  constructor(transactionId, reason) {
    super(
      `La transacción ${transactionId} no puede ser revertida. ${reason}`,
      'TRANSACTION_NOT_REVERSIBLE',
      400
    );
    this.transactionId = transactionId;
  }
}

// Operación no permitida
class OperationNotAllowedError extends WalletError {
  constructor(operation, reason) {
    super(
      `Operación no permitida: ${operation}. ${reason}`,
      'OPERATION_NOT_ALLOWED',
      403
    );
    this.operation = operation;
  }
}

module.exports = {
  WalletError,
  InsufficientBalanceError,
  WalletFrozenError,
  DuplicateTransactionError,
  InvalidAmountError,
  DailyLimitExceededError,
  WalletNotFoundError,
  TransactionNotReversibleError,
  OperationNotAllowedError
};