import { DeviceEventEmitter, EmitterSubscription } from 'react-native';

export const JOB_EVENTS = {
    REFRESH: 'JOB_REFRESH_EVENT',
} as const;

export const emitJobRefresh = () => {
    DeviceEventEmitter.emit(JOB_EVENTS.REFRESH);
};

export const subscribeJobRefresh = (listener: () => void): EmitterSubscription =>
    DeviceEventEmitter.addListener(JOB_EVENTS.REFRESH, listener);

export type AssignmentConfirmation = {jobId: string; acknowledgedAt: string};
export const emitAssignmentConfirmed = (confirmation: AssignmentConfirmation) => {
    DeviceEventEmitter.emit('JOB_ASSIGNMENT_CONFIRMED', confirmation);
};
export const subscribeAssignmentConfirmed = (listener: (confirmation: AssignmentConfirmation) => void): EmitterSubscription =>
    DeviceEventEmitter.addListener('JOB_ASSIGNMENT_CONFIRMED', listener);
