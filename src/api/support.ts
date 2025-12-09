import { apiClient } from './client';
import { USE_MOCKS } from '../utils/config';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH';
export type TicketCategory = 'BOOKING_ISSUE' | 'PAYMENT_ISSUE' | 'APP_ISSUE' | 'DRIVER_ISSUE' | 'OTHER';

export type TicketSummary = {
    id: string;
    subject: string;
    category: TicketCategory;
    status: TicketStatus;
    priority: TicketPriority;
    relatedBookingId?: string;
    createdAt: string;
    updatedAt: string;
    lastMessagePreview?: string;
};

export type TicketMessage = {
    id: string;
    authorType: 'DRIVER' | 'DISPATCH' | 'SYSTEM';
    body?: string;
    message?: string;
    createdAt: string;
};

export type TicketDetail = TicketSummary & {
    description: string;
    messages: TicketMessage[];
};

export type CreateTicketPayload = {
    subject: string;
    description: string;
    category: TicketCategory;
    priority?: TicketPriority;
};

type TicketListResponse = {
    data: TicketSummary[];
    meta?: {
        total: number;
        limit: number;
        offset: number;
    };
};

export type TicketMessagePayload = {
    message: string;
};

export const getTickets = async (): Promise<TicketSummary[]> => {
    try {
        const { data } = await apiClient.get<TicketListResponse>('/tickets');
        return Array.isArray(data.data) ? data.data : [];
    } catch (error) {
        if (USE_MOCKS) {
            return mockTickets;
        }
        throw error;
    }
};

export const getTicketById = async (ticketId: string): Promise<TicketDetail> => {
    try {
        const { data } = await apiClient.get<TicketDetail>(`/tickets/${ticketId}`);
        return normalizeTicketDetail(data);
    } catch (error) {
        if (USE_MOCKS) {
            return mockTicketDetail(ticketId);
        }
        throw error;
    }
};

export const createTicket = async (payload: CreateTicketPayload): Promise<TicketDetail> => {
    try {
        const { data } = await apiClient.post<TicketDetail>('/tickets', payload);
        return normalizeTicketDetail(data);
    } catch (error) {
        if (USE_MOCKS) {
            const newTicket = mockTicketDetail(`TICKET-${Date.now()}`, payload);
            mockTickets = [newTicket, ...mockTickets];
            return newTicket;
        }
        throw error;
    }
};

export const postTicketMessage = async (
    ticketId: string,
    payload: TicketMessagePayload
): Promise<TicketMessage> => {
    try {
        const { data } = await apiClient.post<TicketMessage>(`/tickets/${ticketId}/messages`, payload);
        return normalizeTicketMessage(data);
    } catch (error) {
        if (USE_MOCKS) {
            return {
                id: `msg-${Date.now()}`,
                authorType: 'DRIVER',
                body: payload.message,
                message: payload.message,
                createdAt: new Date().toISOString(),
            };
        }
        throw error;
    }
};

let mockTickets: TicketDetail[] = [
    {
        id: 'TICKET-100',
        subject: 'Incorrect fare credited',
        description: 'Ride REF-12877 credited ₹20 less',
        category: 'PAYMENT_ISSUE',
        status: 'OPEN',
        priority: 'NORMAL',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [
            {
                id: 'msg-1',
                authorType: 'DRIVER',
                body: 'Payment seems short by ₹20, please verify.',
                message: 'Payment seems short by ₹20, please verify.',
                createdAt: new Date().toISOString(),
            },
            {
                id: 'msg-2',
                authorType: 'DISPATCH',
                body: 'Thanks for raising, finance is investigating.',
                message: 'Thanks for raising, finance is investigating.',
                createdAt: new Date().toISOString(),
            },
        ],
    },
];

const mockTicketDetail = (
    ticketId: string,
    payload?: Partial<CreateTicketPayload>
): TicketDetail => ({
    id: ticketId,
    subject: payload?.subject ?? 'Mock subject',
    description: payload?.description ?? 'Mock description for ticket',
    category: payload?.category ?? 'OTHER',
    status: 'OPEN',
    priority: payload?.priority ?? 'NORMAL',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [
        {
            id: 'msg-1',
            authorType: 'DRIVER',
            body: payload?.description ?? 'Mock driver description',
            message: payload?.description ?? 'Mock driver description',
            createdAt: new Date().toISOString(),
        },
    ],
});

const normalizeTicketMessage = (input: TicketMessage): TicketMessage => {
    const text = input.body ?? input.message ?? '';
    return {
        ...input,
        body: text,
        message: text,
    };
};

const normalizeTicketDetail = (ticket: TicketDetail): TicketDetail => ({
    ...ticket,
    messages: Array.isArray(ticket.messages) ? ticket.messages.map(normalizeTicketMessage) : [],
});
