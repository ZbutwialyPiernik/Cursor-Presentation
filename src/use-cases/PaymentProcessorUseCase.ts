export interface PaymentGateway {
  processPayment(amount: number, cardToken: string): Promise<PaymentResult>;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  errorMessage?: string;
}

export interface PaymentRequest {
  userId: string;
  amount: number;
  cardToken: string;
  currency: string;
}

export class PaymentProcessorUseCase {
  private readonly SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP'];
  private readonly MAX_TRANSACTION_AMOUNT = 10000;

  constructor(private paymentGateway: PaymentGateway) {}

  async execute(request: PaymentRequest): Promise<PaymentResult> {
    if (request.amount <= 0) {
      return {
        success: false,
        errorMessage: 'Invalid amount'
      };
    }

    if (!this.SUPPORTED_CURRENCIES.includes(request.currency)) {
      return {
        success: false,
        errorMessage: `Currency ${request.currency} not supported`
      };
    }

    if (request.amount > this.MAX_TRANSACTION_AMOUNT) {
      return {
        success: false,
        errorMessage: `Amount exceeds maximum limit of ${this.MAX_TRANSACTION_AMOUNT}`
      };
    }

    const result = await this.paymentGateway.processPayment(
      request.amount, 
      request.cardToken
    );

    return result;
  }
} 