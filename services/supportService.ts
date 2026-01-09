import { api, ApiResponse } from './api';
import { ENDPOINTS } from './config';

export interface SupportTicket {
  id: number;
  ticketNumber: string;
  userId: number;
  subject: string;
  description: string;
  category: 'Technical' | 'Billing' | 'General' | 'Feature Request';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  assignedTo?: number;
  assignedUser?: {
    id: number;
    name: string;
  };
  messages?: SupportMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface SupportMessage {
  id: number;
  ticketId: number;
  authorId: number;
  author?: {
    id: number;
    name: string;
    avatar?: string;
    role: string;
  };
  message: string;
  attachments?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTicketData {
  subject: string;
  description: string;
  category: 'Technical' | 'Billing' | 'General' | 'Feature Request';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

export interface TicketFilters {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  priority?: string;
}

export const supportService = {
  // Get user's tickets
  async getTickets(filters?: TicketFilters): Promise<ApiResponse<SupportTicket[]>> {
    return await api.get<SupportTicket[]>(ENDPOINTS.SUPPORT.LIST, filters);
  },

  // Get ticket by ID
  async getTicketById(id: number): Promise<ApiResponse<SupportTicket>> {
    return await api.get<SupportTicket>(ENDPOINTS.SUPPORT.BY_ID(id));
  },

  // Create new ticket
  async createTicket(data: CreateTicketData): Promise<ApiResponse<SupportTicket>> {
    return await api.post<SupportTicket>(ENDPOINTS.SUPPORT.LIST, data);
  },

  // Add message to ticket
  async addMessage(ticketId: number, message: string, attachments?: string[]): Promise<ApiResponse<SupportMessage>> {
    return await api.post<SupportMessage>(ENDPOINTS.SUPPORT.ADD_MESSAGE(ticketId), {
      message,
      attachments,
    });
  },

  // Close ticket
  async closeTicket(id: number): Promise<ApiResponse<SupportTicket>> {
    return await api.post<SupportTicket>(ENDPOINTS.SUPPORT.CLOSE(id));
  },
};

export default supportService;
