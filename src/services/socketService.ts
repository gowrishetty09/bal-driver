import { InteractionManager } from 'react-native';
import { API_BASE_URL } from '../utils/config';

/**
 * Socket Service - Dynamic Loading Implementation
 *
 * socket.io-client is loaded DYNAMICALLY after the app has fully initialized
 * to avoid "Property 'WebSocket' doesn't exist" errors during React Native startup.
 *
 * The socket connection is used for:
 * - Real-time driver location updates to backend
 * - Real-time ride status updates
 */

const getSocketUrl = () => {
	const url = API_BASE_URL.replace(/\/api\/?$/, '');
	return url;
};

type Socket = any;

// Dynamic socket.io loader - only loads after app is fully ready
let ioModule: typeof import('socket.io-client') | null = null;
let loadPromise: Promise<typeof import('socket.io-client') | null> | null = null;

const loadSocketIO = (): Promise<typeof import('socket.io-client') | null> => {
	if (ioModule) {
		return Promise.resolve(ioModule);
	}

	if (loadPromise) {
		return loadPromise;
	}

	loadPromise = new Promise((resolve) => {
		// Wait for React Native to be fully initialized
		InteractionManager.runAfterInteractions(() => {
			// Additional small delay to ensure WebSocket is available on global
			setTimeout(async () => {
				try {
					// Ensure WebSocket is on globalThis for socket.io-client
					if (typeof global !== 'undefined' && (global as any).WebSocket) {
						if (typeof globalThis !== 'undefined' && !globalThis.WebSocket) {
							globalThis.WebSocket = (global as any).WebSocket;
						}
					}

					// Dynamic import - this only runs after runtime is ready
					const socketIO = await import('socket.io-client');
					ioModule = socketIO;
					console.log('[Socket] socket.io-client loaded successfully');
					resolve(socketIO);
				} catch (e) {
					console.warn('[Socket] Failed to load socket.io-client:', e);
					resolve(null);
				}
			}, 200);
		});
	});

	return loadPromise;
};

class SocketService {
	private socket: Socket | null = null;
	private driverId: string | null = null;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 10;
	private connecting = false;
	private initialized = false;

	/**
	 * Initialize socket.io (call this after app has mounted)
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		const io = await loadSocketIO();
		if (io) {
			this.initialized = true;
			console.log('[Socket] Service initialized');
		}
	}

	/**
	 * Connect to socket server
	 */
	async connect(driverId: string): Promise<Socket | null> {
		if (this.connecting) {
			return this.socket;
		}

		if (this.socket?.connected && this.driverId === driverId) {
			return this.socket;
		}

		this.connecting = true;

		try {
			// Ensure socket.io is loaded
			const io = await loadSocketIO();
			if (!io) {
				console.warn('[Socket] socket.io not available, using REST API fallback');
				this.connecting = false;
				return null;
			}

			// Disconnect existing connection if any
			this.disconnect();

			this.driverId = driverId;
			const socketUrl = getSocketUrl();

			console.log(`[Socket] Connecting to ${socketUrl} as driver ${driverId}`);

			this.socket = io.io(socketUrl, {
				transports: ['polling', 'websocket'],
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
				this.socket?.emit('driver:join', { driverId: this.driverId });
			});

			this.socket.on('driver:joined', (data: any) => {
				console.log(`[Socket] Joined driver room:`, data);
			});

			this.socket.on('disconnect', (reason: string) => {
				console.log(`[Socket] Disconnected: ${reason}`);
			});

			this.socket.on('connect_error', (error: Error) => {
				this.reconnectAttempts++;
				if (this.reconnectAttempts <= 3) {
					console.log(
						`[Socket] Connection error (${this.reconnectAttempts}/${this.maxReconnectAttempts}):`,
						error.message
					);
				} else if (this.reconnectAttempts === this.maxReconnectAttempts) {
					console.log(`[Socket] Max reconnection attempts reached`);
				}
			});

			this.socket.on('driver:locationAck', (data: any) => {
				console.log(`[Socket] Location acknowledged:`, data.timestamp);
			});

			return this.socket;
		} catch (error) {
			console.log('[Socket] Failed to connect:', error);
			return null;
		} finally {
			this.connecting = false;
		}
	}

	/**
	 * Disconnect from socket server
	 */
	disconnect(): void {
		this.connecting = false;
		if (this.socket) {
			console.log('[Socket] Disconnecting...');
			this.socket.disconnect();
			this.socket = null;
			this.driverId = null;
		}
	}

	/**
	 * Check if connected
	 */
	isConnected(): boolean {
		return this.socket?.connected ?? false;
	}

	/**
	 * Get the socket instance
	 */
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
			return;
		}
		this.socket.emit('join:booking', { bookingId });
	}

	/**
	 * Leave a booking room
	 */
	leaveBookingRoom(bookingId: string): void {
		if (!this.socket?.connected) {
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
