import { io, type Socket } from 'socket.io-client';
import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { WS_URL } from '../utils/config';

class SocketService {
	private socket: Socket | null = null;
	private token: string | null = null;
	private driverId: string | null = null;
	private connected = false;
	private listeners = new Map<string, Set<(...args: any[]) => void>>();

	// Offline-safe connection guards
	private netOnline: boolean | null = null;
	private appState: AppStateStatus = AppState.currentState;
	private netUnsub: (() => void) | null = null;
	private appStateSub: { remove: () => void } | null = null;

	// Offline queue (deduped by key)
	private readonly MAX_QUEUE = 250;
	private readonly DEFAULT_TTL_MS = 2 * 60 * 1000;
	private queuedByKey = new Map<string, { event: string; data: any; expiresAt: number }>();
	private queuedOrder: string[] = [];

	// Heartbeat
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	private readonly HEARTBEAT_INTERVAL_MS = 10_000;

	private readonly SOCKET_BASE_URL = WS_URL;
	private rideSubscriptions = new Set<string>();

	// ─────────────────────────────────────────────────────────────────────────
	// Background Location Batching (Battery Saver)
	// ─────────────────────────────────────────────────────────────────────────
	private locationQueue: LocationPoint[] = [];
	private isBackgrounded = false;
	private batchFlushTimer: ReturnType<typeof setInterval> | null = null;
	private currentBookingId: string | null = null;
	private readonly BATCH_FLUSH_INTERVAL_MS = 5000; // 5 seconds in background

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

	private shouldBeConnected(): boolean {
		const onlineOk = this.netOnline !== false;
		const activeOk = this.appState === 'active';
		return onlineOk && activeOk;
	}

	private wireConnectivityGuardsOnce(): void {
		if (this.netUnsub || this.appStateSub) return;

		this.netUnsub = NetInfo.addEventListener((state) => {
			const online = Boolean(state.isConnected && state.isInternetReachable !== false);
			this.netOnline = online;
			this.applyConnectionGate();
		});

		this.appStateSub = AppState.addEventListener('change', (next) => {
			this.appState = next;
			// Align batching with app lifecycle (battery saver)
			this.setBackgroundMode(next !== 'active');
			this.applyConnectionGate();
		});
	}

	private applyConnectionGate(): void {
		if (!this.socket) return;
		if (!this.shouldBeConnected()) {
			try {
				this.socket.disconnect();
			} catch {
				// ignore
			}
			return;
		}

		if (!this.socket.connected) {
			try {
				this.socket.connect();
			} catch {
				// ignore
			}
		}

		this.flushQueuedEmits();
		this.flushLocationQueue();
	}

	private enqueueEmit(event: string, data: any, opts?: { key?: string; ttlMs?: number }): void {
		const ttl = Math.max(1_000, opts?.ttlMs ?? this.DEFAULT_TTL_MS);
		const key = opts?.key ?? `${event}:${this.safeKeySuffix(data)}`;
		const existing = this.queuedByKey.has(key);
		this.queuedByKey.set(key, { event, data, expiresAt: Date.now() + ttl });
		if (!existing) this.queuedOrder.push(key);

		while (this.queuedOrder.length > this.MAX_QUEUE) {
			const drop = this.queuedOrder.shift();
			if (drop) this.queuedByKey.delete(drop);
		}
	}

	private safeKeySuffix(data: any): string {
		try {
			if (!data) return '0';
			if (typeof data === 'string') return data.slice(0, 64);
			if (typeof data === 'number') return String(data);
			if (typeof data === 'object') {
				const id = (data as any).bookingId ?? (data as any).rideId ?? (data as any).id;
				if (typeof id === 'string' || typeof id === 'number') return String(id);
			}
			return '1';
		} catch {
			return 'x';
		}
	}

	private flushQueuedEmits(): void {
		if (!this.socket || !this.connected) return;
		const now = Date.now();
		while (this.queuedOrder.length) {
			const key = this.queuedOrder[0];
			if (!key) {
				this.queuedOrder.shift();
				continue;
			}
			const item = this.queuedByKey.get(key);
			if (!item) {
				this.queuedOrder.shift();
				continue;
			}
			if (item.expiresAt <= now) {
				this.queuedOrder.shift();
				this.queuedByKey.delete(key);
				continue;
			}
			try {
				this.socket.emit(item.event, item.data);
			} catch {
				break;
			}
			this.queuedOrder.shift();
			this.queuedByKey.delete(key);
		}
	}

	private startHeartbeat(): void {
		if (this.heartbeatTimer) return;
		this.heartbeatTimer = setInterval(() => {
			if (!this.driverId) return;
			this.safeSend({
				event: 'driver:heartbeat',
				data: { driverId: this.driverId, timestamp: new Date().toISOString() },
				options: { key: `driver:heartbeat:${this.driverId}`, ttlMs: 45_000 },
			});
		}, this.HEARTBEAT_INTERVAL_MS);
	}

	private stopHeartbeat(): void {
		if (!this.heartbeatTimer) return;
		clearInterval(this.heartbeatTimer);
		this.heartbeatTimer = null;
	}

	/**
	 * Send a message over Socket.IO
	 */
	safeSend(message: WSMessage): boolean {
		const canSend = Boolean(this.socket && this.connected && this.shouldBeConnected());
		if (!canSend) {
			// Offline-safe: queue and return true (accepted)
			this.enqueueEmit(message.event, message.data, message.options);
			return true;
		}
		try {
			this.socket!.emit(message.event, message.data);
			return true;
		} catch (e) {
			console.log('[Socket] send failed:', e);
			this.enqueueEmit(message.event, message.data, message.options);
			return true;
		}
	}

	private ensureSocket(): Socket {
		if (this.socket && this.token) {
			if (!this.socket.connected) this.socket.connect();
			return this.socket;
		}

		if (!this.token) {
			throw new Error('Socket token is required');
		}

		try {
			this.socket?.disconnect();
		} catch {
			// ignore
		}

		this.socket = io(this.SOCKET_BASE_URL, {
			path: '/socket.io',
			transports: ['websocket'],
			auth: { token: this.token },
			reconnection: true,
			reconnectionAttempts: 10,
			reconnectionDelay: 1000,
			reconnectionDelayMax: 5000,
			timeout: 20000,
		});

		this.wireConnectivityGuardsOnce();

		this.socket.on('connect', () => {
			this.connected = true;
			console.log('[Socket] Connected:', this.SOCKET_BASE_URL);
			this.emit('connect');
			this.startHeartbeat();

			// Re-assert online status + re-join ride rooms.
			this.safeSend({
				event: 'driver:status',
				data: {
					driverId: this.driverId ?? undefined,
					status: 'online',
					updatedAt: new Date().toISOString(),
				},
				options: { key: `driver:status:online:${this.driverId ?? 'self'}`, ttlMs: 5 * 60 * 1000 },
			});

			for (const bookingId of this.rideSubscriptions) {
				this.safeSend({
					event: 'ride:join',
					data: { rideId: bookingId },
					options: { key: `ride:join:${bookingId}`, ttlMs: 10 * 60 * 1000 },
				});
				this.safeSend({
					event: 'ride:subscribe',
					data: { bookingId },
					options: { key: `ride:subscribe:${bookingId}`, ttlMs: 10 * 60 * 1000 },
				});
				this.safeSend({
					event: 'join:ride',
					data: { bookingId },
					options: { key: `join:ride:${bookingId}`, ttlMs: 10 * 60 * 1000 },
				});
			}

			// Flush any queued payloads collected while offline.
			this.flushQueuedEmits();
			this.flushLocationQueue();
		});

		this.socket.on('disconnect', (reason) => {
			this.connected = false;
			console.log('[Socket] Disconnected:', reason);
			this.emit('disconnect', reason);
			this.stopHeartbeat();
		});

		this.socket.on('connect_error', (err) => {
			const message = (err as any)?.message ?? String(err);
			console.log('[Socket] Error:', message);
			this.emit('error', err);
		});

		this.socket.onAny((event, ...args) => {
			this.emit(event, ...(args as any[]));
		});

		// Apply gate immediately (don’t spin reconnect loops in background/offline)
		this.applyConnectionGate();

		return this.socket;
	}

	/**
	 * Connect only when authenticated (LocationContext controls when this is called).
	 * Does not block app startup.
	 */
	async connect(params: { driverId: string; token: string }): Promise<void> {
		if (!params?.token) {
			throw new Error('Driver access token is required for realtime socket');
		}

		this.driverId = params.driverId;
		this.token = params.token;
		this.ensureSocket();
	}

	/**
	 * Disconnect from server
	 */
	disconnect(): void {
		this.stopBatchFlush();
		this.stopHeartbeat();
		this.connected = false;
		this.rideSubscriptions.clear();
		try {
			this.netUnsub?.();
		} catch {
			// ignore
		}
		this.netUnsub = null;
		try {
			this.appStateSub?.remove();
		} catch {
			// ignore
		}
		this.appStateSub = null;
		this.queuedByKey.clear();
		this.queuedOrder.splice(0);
		try {
			this.socket?.disconnect();
		} catch {
			// ignore
		}
		this.socket = null;
		this.driverId = null;
		this.token = null;
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
		if (!this.connected || !this.driverId || !this.socket) {
			// Keep queue for when we reconnect
			console.log('[Socket] Not connected, keeping queue:', this.locationQueue.length);
			return;
		}

		const points = this.locationQueue.splice(0);
		console.log('[Socket] Flushing location batch:', points.length);

		for (const point of points) {
			this.socket.emit('driver:location', {
				driverId: this.driverId,
				latitude: point.latitude,
				longitude: point.longitude,
				heading: point.heading,
				speed: point.speed,
				bookingId: this.currentBookingId ?? undefined,
				timestamp: point.timestamp ?? new Date().toISOString(),
			});
		}
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
			// Bound queue to avoid unbounded growth while offline/background
			if (this.locationQueue.length > 100) {
				this.locationQueue.splice(0, this.locationQueue.length - 100);
			}
			return true;
		}

		// Foreground: send immediately
		if (!this.connected || !this.socket || !this.shouldBeConnected()) {
			// Offline-safe: enqueue into the location queue and flush on reconnect
			this.locationQueue.push({
				latitude: data.latitude,
				longitude: data.longitude,
				heading: data.heading,
				speed: data.speed,
				timestamp: new Date().toISOString(),
			});
			if (this.locationQueue.length > 100) {
				this.locationQueue.splice(0, this.locationQueue.length - 100);
			}
			return true;
		}

		try {
			this.socket.emit('driver:location', {
				driverId: this.driverId,
				latitude: data.latitude,
				longitude: data.longitude,
				heading: data.heading,
				speed: data.speed,
				bookingId: data.bookingId,
				timestamp: new Date().toISOString(),
			});
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Join a booking room to receive updates for a specific booking
	 */
	joinBookingRoom(bookingId: string): void {
		if (!bookingId) return;
		this.rideSubscriptions.add(bookingId);
		this.safeSend({ event: 'ride:join', data: { rideId: bookingId }, options: { key: `ride:join:${bookingId}`, ttlMs: 10 * 60 * 1000 } });
		this.safeSend({ event: 'ride:subscribe', data: { bookingId }, options: { key: `ride:subscribe:${bookingId}`, ttlMs: 10 * 60 * 1000 } });
		this.safeSend({ event: 'join:ride', data: { bookingId }, options: { key: `join:ride:${bookingId}`, ttlMs: 10 * 60 * 1000 } });
	}

	/**
	 * Leave a booking room
	 */
	leaveBookingRoom(bookingId: string): void {
		if (!bookingId) return;
		this.rideSubscriptions.delete(bookingId);
		this.safeSend({ event: 'ride:leave', data: { rideId: bookingId }, options: { key: `ride:leave:${bookingId}`, ttlMs: 10 * 60 * 1000 } });
		this.safeSend({ event: 'ride:unsubscribe', data: { bookingId }, options: { key: `ride:unsubscribe:${bookingId}`, ttlMs: 10 * 60 * 1000 } });
		this.safeSend({ event: 'leave:ride', data: { bookingId }, options: { key: `leave:ride:${bookingId}`, ttlMs: 10 * 60 * 1000 } });
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

type WSMessageBase = {
	options?: { key?: string; ttlMs?: number };
};

type WSMessage =
	| (WSMessageBase & { event: 'driver:status'; data: { driverId?: string; status: 'online' | 'offline'; updatedAt?: string } })
	| (WSMessageBase & { event: 'driver:heartbeat'; data: { driverId: string; timestamp?: string } })
	| (WSMessageBase & { event: 'ride:join'; data: { rideId: string } })
	| (WSMessageBase & { event: 'ride:leave'; data: { rideId: string } })
	| (WSMessageBase & { event: 'join:ride'; data: { bookingId: string } })
	| (WSMessageBase & { event: 'leave:ride'; data: { bookingId: string } })
	| (WSMessageBase & {
		event: 'driver:location';
		data: {
			driverId: string;
			latitude: number;
			longitude: number;
			heading?: number;
			speed?: number;
			bookingId?: string;
			timestamp?: string;
		};
	})
	| (WSMessageBase & { event: 'ride:subscribe'; data: { bookingId: string } })
	| (WSMessageBase & { event: 'ride:unsubscribe'; data: { bookingId: string } })
	| (WSMessageBase & { event: 'driver:location'; data: any })
	| (WSMessageBase & {
		event: 'driver:statusNotification';
		data: {
			bookingId: string;
			notificationType: 'arrived' | 'at_pickup' | 'en_route' | 'picked_up';
			timestamp: string;
		};
	});

// Export singleton instance
export const socketService = new SocketService();
