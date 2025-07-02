import {
  CurrencyExchangeUseCase,
  ExchangeRateProvider,
  TransactionRepository,
  CurrencyExchangeRequest,
  CurrencyExchangeResponse
} from '../src/use-cases/CurrencyExchangeUseCase';

describe('CurrencyExchangeUseCase', () => {
  let useCase: CurrencyExchangeUseCase;
  let mockExchangeRateProvider: jest.Mocked<ExchangeRateProvider>;
  let mockTransactionRepository: jest.Mocked<TransactionRepository>;

  const validRequest: CurrencyExchangeRequest = {
    userId: 'user-123',
    fromCurrency: 'USD',
    toCurrency: 'EUR',
    amount: 100
  };

  beforeEach(() => {
    mockExchangeRateProvider = {
      getExchangeRate: jest.fn()
    };

    mockTransactionRepository = {
      saveTransaction: jest.fn()
    };

    useCase = new CurrencyExchangeUseCase(mockExchangeRateProvider, mockTransactionRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Happy Path', () => {
    it('should exchange currency successfully when all conditions are met', async () => {
      // Arrange
      const exchangeRate = 0.85;
      const expectedAmount = 85;
      const transactionId = 'txn-123';
      setupSuccessfulMocks(exchangeRate, transactionId);

      // Act
      const result = await useCase.execute(validRequest);

      // Assert
      expectSuccess(result, transactionId, expectedAmount);
      expectFullSuccessFlow('USD', 'EUR');
    });
  });

  describe('Input Validation', () => {
    it('should return error when user ID is missing', async () => {
      // Arrange
      const invalidRequest = { ...validRequest, userId: '' };

      // Act
      const result = await useCase.execute(invalidRequest);

      // Assert
      expectFailureWithMessage(result, 'Invalid request parameters');
      expectNoExternalCalls();
    });

    it('should return error when amount is zero or negative', async () => {
      // Arrange
      const invalidRequest = { ...validRequest, amount: 0 };

      // Act
      const result = await useCase.execute(invalidRequest);

      // Assert
      expectFailureWithMessage(result, 'Invalid request parameters');
      expectNoExternalCalls();
    });

    it('should return error when amount is negative', async () => {
      // Arrange
      const invalidRequest = { ...validRequest, amount: -10 };

      // Act
      const result = await useCase.execute(invalidRequest);

      // Assert
      expectFailureWithMessage(result, 'Invalid request parameters');
      expectNoExternalCalls();
    });

    it('should return error when fromCurrency is missing', async () => {
      // Arrange
      const invalidRequest = { ...validRequest, fromCurrency: '' };

      // Act
      const result = await useCase.execute(invalidRequest);

      // Assert
      expectFailureWithMessage(result, 'Invalid request parameters');
      expectNoExternalCalls();
    });

    it('should return error when toCurrency is missing', async () => {
      // Arrange
      const invalidRequest = { ...validRequest, toCurrency: '' };

      // Act
      const result = await useCase.execute(invalidRequest);

      // Assert
      expectFailureWithMessage(result, 'Invalid request parameters');
      expectNoExternalCalls();
    });
  });

  describe('Edge Cases', () => {
    it('should return error when exchange rate is invalid', async () => {
      // Arrange
      mockExchangeRateProvider.getExchangeRate.mockResolvedValue(0);

      // Act
      const result = await useCase.execute(validRequest);

      // Assert
      expectFailureWithMessage(result, 'Invalid exchange rate');
      expectCalledExchangeRateOnly('USD', 'EUR');
    });

    it('should handle exceptions gracefully', async () => {
      // Arrange
      mockExchangeRateProvider.getExchangeRate.mockRejectedValue(new Error('API error'));

      // Act
      const result = await useCase.execute(validRequest);

      // Assert
      expectFailureWithMessage(result, 'Internal error occurred');
      expectCalledExchangeRateOnly('USD', 'EUR');
    });

    it('should return error when exchange rate is negative', async () => {
      // Arrange
      mockExchangeRateProvider.getExchangeRate.mockResolvedValue(-0.5);

      // Act
      const result = await useCase.execute(validRequest);

      // Assert
      expectFailureWithMessage(result, 'Invalid exchange rate');
      expectCalledExchangeRateOnly('USD', 'EUR');
    });

    it('should handle transaction repository failures gracefully', async () => {
      // Arrange
      mockExchangeRateProvider.getExchangeRate.mockResolvedValue(0.85);
      mockTransactionRepository.saveTransaction.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await useCase.execute(validRequest);

      // Assert
      expectFailureWithMessage(result, 'Internal error occurred');
      expect(mockExchangeRateProvider.getExchangeRate).toHaveBeenCalledWith('USD', 'EUR');
      expect(mockTransactionRepository.saveTransaction).toHaveBeenCalled();
    });

    it('should correctly calculate exchanged amount with proper rounding', async () => {
      // Arrange
      const exchangeRate = 0.856789; // Results in 85.6789, should round to 85.68
      const expectedAmount = 85.68;
      const transactionId = 'txn-456';
      setupSuccessfulMocks(exchangeRate, transactionId);

      // Act
      const result = await useCase.execute(validRequest);

      // Assert
      expectSuccess(result, transactionId, expectedAmount);
    });

    it('should handle very small amounts correctly', async () => {
      // Arrange
      const smallAmountRequest = { ...validRequest, amount: 0.01 };
      const exchangeRate = 0.85;
      const expectedAmount = 0.01; // 0.01 * 0.85 = 0.0085, rounded to 0.01
      const transactionId = 'txn-small';
      setupSuccessfulMocks(exchangeRate, transactionId);

      // Act
      const result = await useCase.execute(smallAmountRequest);

      // Assert
      expectSuccess(result, transactionId, expectedAmount);
    });

    it('should handle large amounts correctly', async () => {
      // Arrange
      const largeAmountRequest = { ...validRequest, amount: 1000000 };
      const exchangeRate = 0.85;
      const expectedAmount = 850000;
      const transactionId = 'txn-large';
      setupSuccessfulMocks(exchangeRate, transactionId);

      // Act
      const result = await useCase.execute(largeAmountRequest);

      // Assert
      expectSuccess(result, transactionId, expectedAmount);
    });
  });

  function expectSuccess(result: CurrencyExchangeResponse, expectedTransactionId: string, expectedAmount: number) {
    expect(result.success).toBe(true);
    expect(result.transactionId).toBe(expectedTransactionId);
    expect(result.exchangedAmount).toBe(expectedAmount);
  }

  function expectFailureWithMessage(result: CurrencyExchangeResponse, expectedMessage: string) {
    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe(expectedMessage);
    expect(result.transactionId).toBeUndefined();
    expect(result.exchangedAmount).toBeUndefined();
  }

  function setupSuccessfulMocks(exchangeRate: number = 0.85, transactionId: string = 'txn-123') {
    mockExchangeRateProvider.getExchangeRate.mockResolvedValue(exchangeRate);
    mockTransactionRepository.saveTransaction.mockResolvedValue(transactionId);
  }

  function expectNoExternalCalls() {
    expect(mockExchangeRateProvider.getExchangeRate).not.toHaveBeenCalled();
    expect(mockTransactionRepository.saveTransaction).not.toHaveBeenCalled();
  }

  function expectFullSuccessFlow(fromCurrency: string, toCurrency: string) {
    expect(mockExchangeRateProvider.getExchangeRate).toHaveBeenCalledWith(fromCurrency, toCurrency);
    expect(mockTransactionRepository.saveTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        fromCurrency,
        toCurrency
      })
    );
  }

  function expectCalledExchangeRateOnly(fromCurrency: string, toCurrency: string) {
    expect(mockExchangeRateProvider.getExchangeRate).toHaveBeenCalledWith(fromCurrency, toCurrency);
    expect(mockTransactionRepository.saveTransaction).not.toHaveBeenCalled();
  }
}); 