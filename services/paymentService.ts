import { api, ApiResponse } from './api';
import { ENDPOINTS } from './config';

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

export interface PaymentVerification {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface UPIPaymentData {
  amount: number;
  transactionId: string;
  screenshot?: string;
}

export interface CryptoPaymentData {
  amount: number;
  network: string;
  token: string;
  transactionHash: string;
}

export const paymentService = {
  // Create Razorpay order
  async createRazorpayOrder(amount: number, purpose?: string): Promise<ApiResponse<RazorpayOrder>> {
    return await api.post<RazorpayOrder>(ENDPOINTS.PAYMENTS.CREATE_RAZORPAY, { amount, purpose });
  },

  // Verify Razorpay payment
  async verifyRazorpayPayment(data: PaymentVerification): Promise<ApiResponse> {
    return await api.post(ENDPOINTS.PAYMENTS.VERIFY_RAZORPAY, data);
  },

  // Submit UPI payment
  async submitUPIPayment(data: UPIPaymentData): Promise<ApiResponse> {
    return await api.post(ENDPOINTS.PAYMENTS.SUBMIT_UPI, data);
  },

  // Submit crypto payment
  async submitCryptoPayment(data: CryptoPaymentData): Promise<ApiResponse> {
    return await api.post(ENDPOINTS.PAYMENTS.SUBMIT_CRYPTO, data);
  },

  // Verify crypto transaction
  async verifyCryptoTransaction(transactionHash: string, network: string): Promise<ApiResponse> {
    return await api.post(ENDPOINTS.PAYMENTS.VERIFY_CRYPTO, { transactionHash, network });
  },

  // Submit and verify crypto payment in one call
  async submitAndVerifyCrypto(data: CryptoPaymentData): Promise<ApiResponse> {
    return await api.post(ENDPOINTS.PAYMENTS.SUBMIT_VERIFY_CRYPTO, data);
  },
};

export default paymentService;
