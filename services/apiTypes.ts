export interface Owner {
  id: string;
  email: string;
  name: string;
  phone?: string;
  propertyIds?: string[];
}

export interface Property {
  id: string;
  ownerId: string;
  name: string;
  address: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyStats {
  propertyId: string;
  totalBeds: number;
  occupiedBeds: number;
  occupancy: number;
}

export type BillingFrequency = 'monthly' | 'quarterly' | 'yearly';

export interface BillingConfig {
  status: 'paid' | 'due';
  billingCycle: 'monthly';
  anchorDay: number;
  method?: string;
}

export interface Tenant {
  id: string;
  propertyId: string;
  roomId: string;
  bedId: string;
  name: string;
  documentId: string;
  phone: string;
  rent: string;
  address?: string;
  joinDate: string;
  autoGeneratePayments?: boolean;
  billingConfig?: BillingConfig | null;
  createdAt: string;
  updatedAt: string;
  roomNumber?: string;
  bedNumber?: string;
}

export interface Payment {
  id: string;
  tenantId: string;
  propertyId: string;
  // property field removed
  tenantName?: string;
  roomNumber?: string;  // Enriched field
  bed: string;
  amount: string;
  status: 'paid' | 'due';
  dueDate?: string; // received from backend, optional
  paidDate?: string; // Date when payment was marked as paid
  date?: string;
  method: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Usage {
  ownerId: string;
  properties: number;
  tenants: number;
  rooms: number;
  staff?: number;
  updatedAt: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
}

export interface ApiResponse<T> {
  data: T;
  meta?: {
    timestamp: string;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: Owner;
  tokens: AuthTokens;
}

export interface EmailSendOTPRequest {
  email: string;
}

export interface EmailSendOTPResponse {
  message: string;
}

export interface EmailVerifyOTPRequest {
  email: string;
  otp: string;
}

export interface EmailVerifyOTPResponse {
  message: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface RegisterResponse {
  user: Owner;
  tokens: AuthTokens;
}

export interface VerifyOTPRequest {
  email: string;
  otp: string;
}

export interface VerifyOTPResponse {
  message: string;
}

export interface ResendOTPRequest {
  email: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface ResetPasswordRequest {
  email: string;
  otp: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  message: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponse {
  message: string;
  success: boolean;
}

export interface Room {
  id: string;
  propertyId: string;
  roomNumber: string;
  floor: string;
  price: number;
  numberOfBeds: number;
  active?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Bed {
  id: string;
  propertyId: string;
  roomId: string;
  bedNumber: string;
  status: 'available' | 'occupied' | 'maintenance';
  createdAt: string;
  updatedAt: string;
}

export interface Staff {
  id: string;
  propertyId: string;
  name: string;
  role: 'cooker' | 'worker' | 'cleaner' | 'manager' | 'security' | 'maintenance' | 'assistant' | 'other';
  mobileNumber: string;
  address: string;
  status: 'active' | 'inactive' | 'on_leave' | 'terminated';
  joiningDate?: string;
  salary?: number;
  emergencyContact?: string;
  emergencyContactNumber?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalTenants: number;
  activeTenants?: number;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyRate: number;
  // Revenue metrics
  monthlyRevenue?: number; // Revenue in paise
  monthlyRevenueFormatted?: string;
  pendingPayments?: number; // Count of pending payments
  duePaymentAmount?: number; // Total due amount in paise
  duePaymentAmountFormatted?: string;
  paidThisMonth?: number; // Paid amount this month in paise
  // Check-in/Check-out
  checkInsToday?: number;
  checkOutsToday?: number;
  upcomingCheckIns?: number;
  // Staff info
  totalStaff?: number;
  availableStaff?: number;
  // Alerts
  maintenanceAlerts?: number;
  urgentAlerts?: number;
}

export interface RecentCheckInOut {
  id: string;
  tenantName: string;
  roomNumber: string;
  type: 'check-in' | 'check-out';
  date: string;
  status: 'completed' | 'pending';
}

export interface CouponValidationResponse {
  isValid: boolean;
  message: string;
  originalAmount?: number; // Original price in paise
  discountAmount?: number; // Discount in paise
  finalAmount?: number; // Final price after discount
  discountPercentage?: number; // For percentage discounts
}

export interface VerifyPaymentRequest {
  payment_id: string;
  order_id: string;
  signature: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
}
