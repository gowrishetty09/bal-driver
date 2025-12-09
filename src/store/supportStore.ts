import { create } from 'zustand';

import {
    CreateTicketPayload,
    getTicketById,
    getTickets,
    postTicketMessage,
    TicketDetail,
    TicketMessage,
    TicketSummary,
    createTicket as createTicketApi,
} from '../api/support';

export type SupportStoreState = {
    tickets: TicketSummary[];
    isLoadingList: boolean;
    selectedTicket: TicketDetail | null;
    isLoadingTicket: boolean;
    fetchTickets: () => Promise<void>;
    selectTicket: (ticketId: string) => Promise<TicketDetail | null>;
    createTicket: (payload: CreateTicketPayload) => Promise<TicketDetail | null>;
    sendMessage: (ticketId: string, body: string) => Promise<TicketMessage | null>;
    prependTicket: (ticket: TicketSummary) => void;
    reset: () => void;
};

const initialState: Pick<SupportStoreState, 'tickets' | 'isLoadingList' | 'selectedTicket' | 'isLoadingTicket'> = {
    tickets: [],
    isLoadingList: false,
    selectedTicket: null,
    isLoadingTicket: false,
};

export const useSupportStore = create<SupportStoreState>()((set, get) => ({
    ...initialState,
    fetchTickets: async () => {
        set({ isLoadingList: true });
        try {
            const tickets = await getTickets();
            set({ tickets });
        } catch (error) {
            set({ tickets: [] });
            throw error;
        } finally {
            set({ isLoadingList: false });
        }
    },
    selectTicket: async (ticketId: string) => {
        set({ isLoadingTicket: true });
        try {
            const ticket = await getTicketById(ticketId);
            set({ selectedTicket: ticket });
            return ticket;
        } catch (error) {
            set({ selectedTicket: null });
            throw error;
        } finally {
            set({ isLoadingTicket: false });
        }
    },
    createTicket: async (payload: CreateTicketPayload) => {
        try {
            const ticket = await createTicketApi(payload);
            set((state) => ({
                tickets: [ticket, ...(Array.isArray(state.tickets) ? state.tickets : [])],
            }));
            return ticket;
        } catch (error) {
            throw error;
        }
    },
    sendMessage: async (ticketId: string, body: string) => {
        const tempMessage: TicketMessage = {
            id: `temp-${Date.now()}`,
            authorType: 'DRIVER',
            body,
            message: body,
            createdAt: new Date().toISOString(),
        };
        const current = get().selectedTicket;
        if (current?.id === ticketId) {
            set({ selectedTicket: { ...current, messages: [...current.messages, tempMessage] } });
        }
        try {
            const saved = await postTicketMessage(ticketId, { message: body });
            const normalized = {
                ...saved,
                body: saved.body ?? saved.message ?? body,
                message: saved.message ?? saved.body ?? body,
            };
            const updated = get().selectedTicket;
            if (updated?.id === ticketId) {
                set({
                    selectedTicket: {
                        ...updated,
                        messages: updated.messages.map((message: TicketMessage) =>
                            message.id === tempMessage.id ? normalized : message
                        ),
                    },
                });
            }
            return normalized;
        } catch (error) {
            const reverted = get().selectedTicket;
            if (reverted?.id === ticketId) {
                set({
                    selectedTicket: {
                        ...reverted,
                        messages: reverted.messages.filter((message: TicketMessage) => message.id !== tempMessage.id),
                    },
                });
            }
            throw error;
        }
    },
    prependTicket: (ticket: TicketSummary) => {
        const { tickets } = get();
        set({ tickets: [ticket, ...tickets] });
    },
    reset: () => set(initialState),
}));
