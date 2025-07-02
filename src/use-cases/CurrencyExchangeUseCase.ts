export interface ExchangeRateProvider {
    getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number>;
}

export interface TransactionRepository {
    saveTransaction(transaction: CurrencyTransaction): Promise<string>;
}

export interface CurrencyTransaction {
    userId: string;
    fromCurrency: string;
    toCurrency: string;
    fromAmount: number;
    toAmount: number;
    exchangeRate: number;
    timestamp: Date;
}

export interface CurrencyExchangeRequest {
    userId: string;
    fromCurrency: string;
    toCurrency: string;
    amount: number;
}

export interface CurrencyExchangeResponse {
    success: boolean;
    transactionId?: string;
    exchangedAmount?: number;
    errorMessage?: string;
}

export class CurrencyExchangeUseCase {
    constructor(
        private exchangeRateProvider: ExchangeRateProvider,
        private transactionRepository: TransactionRepository
    ) {}

    async execute(request: CurrencyExchangeRequest): Promise<CurrencyExchangeResponse> {
        try {
            if (!request.userId || !request.fromCurrency || !request.toCurrency || request.amount <= 0) {
                return {
                    success: false,
                    errorMessage: 'Invalid request parameters'
                };
            }

            const exchangeRate = await this.exchangeRateProvider.getExchangeRate(
                request.fromCurrency, 
                request.toCurrency
            );

            if (exchangeRate <= 0) {
                return {
                    success: false,
                    errorMessage: 'Invalid exchange rate'
                };
            }

            // 3. Calculate and save transaction
            const exchangedAmount = Math.round(request.amount * exchangeRate * 100) / 100;
            
            const transaction: CurrencyTransaction = {
                userId: request.userId,
                fromCurrency: request.fromCurrency,
                toCurrency: request.toCurrency,
                fromAmount: request.amount,
                toAmount: exchangedAmount,
                exchangeRate: exchangeRate,
                timestamp: new Date()
            };

            const transactionId = await this.transactionRepository.saveTransaction(transaction);

            return {
                success: true,
                transactionId: transactionId,
                exchangedAmount: exchangedAmount
            };

        } catch (error) {
            return {
                success: false,
                errorMessage: 'Internal error occurred'
            };
        }
    }
}