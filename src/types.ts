/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  totalDebt: number;
  lastPurchaseDate: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Unit {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  unitId: string;
  categoryId: string;
  stock?: number;
}

export interface InvoiceItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Invoice {
  id: string;
  customerId: string;
  customerName: string;
  date: string;
  items: InvoiceItem[];
  totalAmount: number;
  paidAmount: number;
  debtAmount: number;
  status: 'paid' | 'partial' | 'debt';
  note?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  customerId: string;
  date: string;
  amount: number;
  method: 'cash' | 'transfer';
  note?: string;
}
