const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

export class VeloraApiClient {
  private tenantId = 'velora-signature';
  private token: string | null = null;

  setTenantId(id: string) {
    this.tenantId = id;
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) localStorage.setItem('velora_token', token);
      else localStorage.removeItem('velora_token');
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('velora_token');
    }
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-Id': this.tenantId,
      ...(options.headers as Record<string, string>),
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || json.error || 'API Request failed');
    }

    return json.data !== undefined ? json.data : json;
  }

  // Public Salon Microsite
  async getPublicSalon(slug = 'velora-signature') {
    return this.request<any>(`/tenants/public/${slug}`);
  }

  // Services
  async getServices(categoryId?: string) {
    const q = categoryId ? `?categoryId=${categoryId}` : '';
    return this.request<any[]>(`/services${q}`);
  }

  async getCategories() {
    return this.request<any[]>('/services/categories');
  }

  // Stylists
  async getStaff(serviceId?: string) {
    const q = serviceId ? `?serviceId=${serviceId}` : '';
    return this.request<any[]>(`/staff${q}`);
  }

  // Booking & Dynamic Slots
  async getAvailability(branchId: string, serviceIds: string[], date: string, staffId?: string) {
    const params = new URLSearchParams({
      branchId,
      serviceIds: serviceIds.join(','),
      date,
    });
    if (staffId && staffId !== 'any') params.append('staffId', staffId);
    return this.request<any[]>(`/bookings/availability?${params.toString()}`);
  }

  async createBooking(data: {
    branchId: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    serviceIds: string[];
    dateStr: string;
    timeStr: string;
    staffId?: string;
    notes?: string;
  }) {
    return this.request<any>('/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Live Queue & Walk-ins
  async joinQueue(data: {
    branchId: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    serviceIds: string[];
    preferredStaffId?: string;
    notes?: string;
  }) {
    return this.request<any>('/queue/join', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPublicQueueStatus(tokenNumber: string) {
    return this.request<any>(`/queue/status/${tokenNumber}`);
  }

  // Auth
  async login(email: string, password: string) {
    const result = await this.request<{ accessToken: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(result.accessToken);
    return result;
  }

  async requestOtp(phone: string) {
    return this.request<{ success: boolean; cooldownSeconds: number }>('/auth/customer/otp/request', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }

  async verifyOtp(phone: string, otp: string, name?: string) {
    const result = await this.request<{ accessToken: string; customer: any }>('/auth/customer/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, otp, name }),
    });
    this.setToken(result.accessToken);
    return result;
  }

  // Desk Operations
  async getDeskOverview(branchId: string) {
    return this.request<any>(`/desk/overview?branchId=${branchId}`);
  }

  async searchDesk(branchId: string, q: string) {
    return this.request<any>(`/desk/search?branchId=${branchId}&q=${encodeURIComponent(q)}`);
  }

  async startService(queueEntryId: string, staffId: string) {
    return this.request<any>(`/desk/start-service/${queueEntryId}`, {
      method: 'POST',
      body: JSON.stringify({ staffId }),
    });
  }

  async completeService(queueEntryId: string) {
    return this.request<any>(`/desk/complete-service/${queueEntryId}`, {
      method: 'POST',
    });
  }

  async markNoShow(appointmentId: string) {
    return this.request<any>(`/desk/no-show/${appointmentId}`, {
      method: 'POST',
    });
  }

  // Unified Flow
  async getUnifiedTimeline(branchId: string, date?: string) {
    const q = date ? `&date=${date}` : '';
    return this.request<any>(`/flow/timeline?branchId=${branchId}${q}`);
  }

  async checkInAppointment(appointmentId: string) {
    return this.request<any>(`/flow/check-in/${appointmentId}`, {
      method: 'POST',
    });
  }

  // Insights / Analytics
  async getDashboardAnalytics(branchId?: string, date?: string) {
    const params = new URLSearchParams();
    if (branchId) params.append('branchId', branchId);
    if (date) params.append('date', date);
    return this.request<any>(`/analytics/dashboard?${params.toString()}`);
  }
}

export const apiClient = new VeloraApiClient();
