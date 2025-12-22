import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../utils/config';

// Extract base URL without /api path for WebSocket connection
const getSocketUrl = () => {
    const url = API_BASE_URL.replace(/\/api\/?$/, '');
    return url;
};

interface DriverJoinedData {
    driverId: string;
}

interface LocationAckData {
    received: boolean;
    timestamp: string;
}

class SocketService {
    private socket: Socket | null = null;
    private driverId: string | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;

    connect(driverId: string): Socket {
        if (this.socket?.connected && this.driverId === driverId) {
            return this.socket;
        }

        // Disconnect existing connection if any
        this.disconnect();

        this.driverId = driverId;
        const socketUrl = getSocketUrl();

        console.log(`[Socket] Connecting to ${socketUrl} as driver ${driverId}`);

        this.socket = io(socketUrl, {
            transports: ['websocket', 'polling'],
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
        });

        this.socket.on('connect', () => {
            console.log(`[Socket] Connected with id: ${this.socket?.id}`);
            this.reconnectAttempts = 0;
            // Join driver-specific room
            this.socket?.emit('driver:join', { driverId: this.driverId });
        });

        this.socket.on('driver:joined', (data: DriverJoinedData) => {
            console.log(`[Socket] Joined driver room:`, data);
        });

        this.socket.on('disconnect', (reason: string) => {
            console.log(`[Socket] Disconnected: ${reason}`);
        });

        this.socket.on('connect_error', (error: Error) => {
            console.log(`[Socket] Connection error:`, error.message);
            this.reconnectAttempts++;
        });

        this.socket.on('driver:locationAck', (data: LocationAckData) => {
            console.log(`[Socket] Location acknowledged:`, data.timestamp);
        });

        return this.socket;
    }

    disconnect(): void {
        if (this.socket) {
            console.log('[Socket] Disconnecting...');
            this.socket.disconnect();
            this.socket = null;
            this.driverId = null;
        }
    }

    isConnected(): boolean {
        return this.socket?.connected ?? false;
    }

    getSocket(): Socket | null {
        return this.socket;
    }

    /**
     * Send driver location update via WebSocket
     */
    sendLocation(data: {
        latitude: number;
        longitude: number;
        heading?: number;
        speed?: number;
        bookingId?: string;
    }): boolean {
        if (!this.socket?.connected || !this.driverId) {
            console.log('[Socket] Cannot send location - not connected');
            return false;
        }

        this.socket.emit('driver:updateLocation', {
            driverId: this.driverId,
            ...data,
        });

        return true;
    }

    /**
     * Join a booking room to receive updates for a specific booking
     */
    joinBookingRoom(bookingId: string): void {
        if (!this.socket?.connected) {
            console.log('[Socket] Cannot join booking room - not connected');
            return;
        }
        this.socket.emit('join:booking', { bookingId });
    }

    /**
     * Leave a booking room
     */
    leaveBookingRoom(bookingId: string): void {
        if (!this.socket?.connected) {
            console.log('[Socket] Cannot leave booking room - not connected');
            return;
        }
        this.socket.emit('leave:booking', { bookingId });
    }

    /**
     * Subscribe to an event
     */
    on(event: string, callback: (...args: any[]) => void): void {
        this.socket?.on(event, callback);
    }

    /**
     * Unsubscribe from an event
     */
    off(event: string, callback?: (...args: any[]) => void): void {
        if (callback) {
            this.socket?.off(event, callback);
        } else {
            this.socket?.off(event);
        }
    }
}

// Export singleton instance
export const socketService = new SocketService();
