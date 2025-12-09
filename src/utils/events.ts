import { DeviceEventEmitter, EmitterSubscription } from 'react-native';

export const JOB_EVENTS = {
    REFRESH: 'JOB_REFRESH_EVENT',
} as const;

export const emitJobRefresh = () => {
    DeviceEventEmitter.emit(JOB_EVENTS.REFRESH);
};

export const subscribeJobRefresh = (listener: () => void): EmitterSubscription =>
    DeviceEventEmitter.addListener(JOB_EVENTS.REFRESH, listener);
