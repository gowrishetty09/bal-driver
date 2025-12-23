class SocketService {
	private ws: WebSocket | null = null;
	private driverId: string | null = null;
	private connected = false;
	private reconnectAttempts = 0;
	private readonly maxReconnectAttempts = 10;
	private shouldReconnect = false;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private listeners = new Map<string, Set<(...args: any[]) => void>>();

	private readonly WS_URL = 'wss://bestaerolimo.online/ws';

	// ─────────────────────────────────────────────────────────────────────────
	// Background Location Batching (Battery Saver)
	// ─────────────────────────────────────────────────────────────────────────
	private locationQueue: LocationPoint[] = [];
	private isBackgrounded = false;
	private batchFlushTimer: ReturnType<typeof setInterval> | null = null;
	private currentBookingId: string | null = null;
	private readonly BATCH_FLUSH_INTERVAL_MS = 5000; // 5 seconds in background

	private getReconnectDelayMs(attemptIndex: number): number {
		// 1s -> 2s -> 4s -> 5s (cap)
		return Math.min(1000 * Math.pow(2, attemptIndex), 5000);
	}

	private clearReconnectTimer(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
	}

	private emit(event: string, ...args: any[]): void {
		const handlers = this.listeners.get(event);
		if (!handlers) return;
		for (const handler of handlers) {
			try {
				handler(...args);
			} catch (e) {
				console.log('[Socket] listener error:', e);
			}
		}
	}

	private safeSend(message: WSMessage): boolean {
		if (!this.ws || !this.connected) return false;
		try {
			this.ws.send(JSON.stringify(message));
			return true;
		} catch (e) {
			console.log('[Socket] send failed:', e);
			return false;
		}
	}

	private openWebSocket(): void {
		if (!this.shouldReconnect || !this.driverId) return;

		// Always tear down any existing instance first
		this.closeWebSocket(false);

		try {
			this.ws = new WebSocket(this.WS_URL);
		} catch (e) {
			console.log('[Socket] WebSocket constructor failed:', e);
			this.scheduleReconnect();
			return;
		}

		this.ws.onopen = () => {
			this.connected = true;
			this.reconnectAttempts = 0;
			console.log('[Socket] Connected');
			this.safeSend({ event: 'driver:join', data: { driverId: this.driverId! } });
			this.emit('connect');
		};

		this.ws.onmessage = (event) => {
			const raw = typeof event.data === 'string' ? event.data : '';
			if (!raw) return;
			try {
				const parsed = JSON.parse(raw) as Partial<WSMessage> & { event?: string };

				if (parsed?.event === 'ping') {
					this.safeSend({ event: 'pong', data: {} });
					return;
				}

				if (parsed?.event) {
					this.emit(parsed.event, (parsed as any).data);
				}
			} catch {
				// ignore non-JSON messages
			}
		};

		this.ws.onerror = () => {
			// Some platforms only surface errors via onclose; keep this minimal.
			this.emit('error');
		};

		this.ws.onclose = () => {
			this.connected = false;
			this.ws = null;
			this.emit('disconnect');
			if (this.shouldReconnect) {
				this.scheduleReconnect();
			}
		};
	}

	private closeWebSocket(markIntentional: boolean): void {
		if (markIntentional) {
			this.shouldReconnect = false;
		}
		this.clearReconnectTimer();
		this.connected = false;
		if (this.ws) {
			try {
				this.ws.onopen = null;
				this.ws.onmessage = null;
				this.ws.onerror = null;
				this.ws.onclose = null;
				this.ws.close();
			} catch {
				// ignore
			}
			this.ws = null;
		}
	}

	private scheduleReconnect(): void {
		if (!this.shouldReconnect) return;
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			console.log('[Socket] Max reconnect attempts reached');
			return;
		}

		this.clearReconnectTimer();
		const delay = this.getReconnectDelayMs(this.reconnectAttempts);
		this.reconnectAttempts += 1;
		console.log(`[Socket] Reconnecting in ${delay}ms (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
		this.reconnectTimer = setTimeout(() => this.openWebSocket(), delay);
	}

	/**
	 * Connect only when authenticated (LocationContext controls when this is called).
	 * Does not block app startup.
	 */
	async connect(driverId: string): Promise<void> {
		if (this.driverId === driverId && this.connected) {
			return;
		}

		this.driverId = driverId;
		this.shouldReconnect = true;
		this.reconnectAttempts = 0;
		this.openWebSocket();
	}

	/**
	 * Disconnect from server
	 */
	disconnect(): void {
		this.stopBatchFlush();
		this.closeWebSocket(true);
		this.driverId = null;
	}

	/**
	 * Check if connected
	 */
	isConnected(): boolean {
		return this.connected;
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Background Mode Control
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Call when app goes to background to enable batching
	 */
	setBackgroundMode(isBackground: boolean): void {
		this.isBackgrounded = isBackground;

		if (isBackground) {
			// Start batch flush timer
			this.startBatchFlush();
			console.log('[Socket] Background mode enabled - batching locations');
		} else {
			// Stop batch flush and send any queued locations
			this.stopBatchFlush();
			this.flushLocationQueue();
			console.log('[Socket] Foreground mode - sending locations immediately');
		}
	}

	/**
	 * Set current booking ID for location updates
	 */
	setCurrentBookingId(bookingId: string | null): void {
		this.currentBookingId = bookingId;
	}

	private startBatchFlush(): void {
		if (this.batchFlushTimer) return;

		this.batchFlushTimer = setInterval(() => {
			this.flushLocationQueue();
		}, this.BATCH_FLUSH_INTERVAL_MS);
	}

	private stopBatchFlush(): void {
		if (this.batchFlushTimer) {
			clearInterval(this.batchFlushTimer);
			this.batchFlushTimer = null;
		}
	}

	/**
	 * Flush queued locations as a batch
	 */
	private flushLocationQueue(): void {
		if (this.locationQueue.length === 0) return;
		if (!this.connected || !this.driverId) {
			// Keep queue for when we reconnect
			console.log('[Socket] Not connected, keeping queue:', this.locationQueue.length);
			return;
		}

		const points = this.locationQueue.splice(0);
		console.log('[Socket] Flushing location batch:', points.length);

		this.safeSend({
			event: 'driver:updateLocationBatch',
			data: {
				driverId: this.driverId,
				points,
				bookingId: this.currentBookingId ?? undefined,
			},
		});
	}

	/**
	 * Send driver location update via WebSocket
	 * In background mode, queues locations for batch sending
	 */
	sendLocation(data: {
		latitude: number;
		longitude: number;
		heading?: number;
		speed?: number;
		bookingId?: string;
	}): boolean {
		if (!this.driverId) {
			return false;
		}

		// Update current booking ID
		if (data.bookingId) {
			this.currentBookingId = data.bookingId;
		}

		// In background mode, queue the location
		if (this.isBackgrounded) {
			this.locationQueue.push({
				latitude: data.latitude,
				longitude: data.longitude,
				heading: data.heading,
				speed: data.speed,
				timestamp: new Date().toISOString(),
			});
			return true;
		}

		// Foreground: send immediately
		if (!this.connected) {
			return false;
		}

		return this.safeSend({
			event: 'driver:updateLocation',
			data: {
				driverId: this.driverId,
				latitude: data.latitude,
				longitude: data.longitude,
				heading: data.heading,
				speed: data.speed,
				bookingId: data.bookingId,
			},
		});
	}

	/**
	 * Join a booking room to receive updates for a specific booking
	 */
	joinBookingRoom(bookingId: string): void {
		this.safeSend({ event: 'join:booking', data: { bookingId } });
	}

	/**
	 * Leave a booking room
	 */
	leaveBookingRoom(bookingId: string): void {
		this.safeSend({ event: 'leave:booking', data: { bookingId } });
	}

	/**
	 * Subscribe to an event.
	 *
	 * Supports:
	 * - lifecycle: 'connect' | 'disconnect' | 'error'
	 * - message types: 'driver:join' | 'driver:updateLocation' | 'join:booking' | 'leave:booking'
	 */
	on(event: string, callback: (...args: any[]) => void): void {
		const set = this.listeners.get(event) ?? new Set();
		set.add(callback);
		this.listeners.set(event, set);
	}

	/**
	 * Unsubscribe from an event
	 */
	off(event: string, callback?: (...args: any[]) => void): void {
		const set = this.listeners.get(event);
		if (!set) return;
		if (callback) {
			set.delete(callback);
		} else {
			set.clear();
		}
	}
}

// Location point for batching
interface LocationPoint {
	latitude: number;
	longitude: number;
	heading?: number;
	speed?: number;
	timestamp?: string;
}

type WSMessage =
	| { event: 'driver:join'; data: { driverId: string } }
	| {
		event: 'driver:updateLocation';
		data: {
			driverId: string;
			latitude: number;
			longitude: number;
			heading?: number;
			speed?: number;
			bookingId?: string;
		};
	}
	| {
		event: 'driver:updateLocationBatch';
		data: {
			driverId: string;
			points: LocationPoint[];
			bookingId?: string;
		};
	}
	| { event: 'join:booking'; data: { bookingId: string } }
	| { event: 'leave:booking'; data: { bookingId: string } }
	| { event: 'driver:location'; data: any }
	| { event: 'driver:locationAck'; data: any }
	| { event: 'joined:booking'; data: any }
	| { event: 'ping'; data: {} }
	| { event: 'pong'; data: {} };

// Export singleton instance
export const socketService = new SocketService();
