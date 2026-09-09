import { Vibration } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

let generation = 0;
let activeBookingId: string | null = null;
let player: AudioPlayer | null = null;

export function stopAssignmentAlarm(bookingId?: string) {
  if (bookingId && activeBookingId !== bookingId) return;
  generation += 1;
  activeBookingId = null;
  Vibration.cancel();
  const current = player;
  player = null;
  try { current?.pause(); } catch { /* Already disposed. */ }
  try { current?.remove(); } catch { /* Already disposed. */ }
}

export function startAssignmentAlarm(bookingId: string): () => void {
  stopAssignmentAlarm();
  const revision = generation;
  activeBookingId = bookingId;
  Vibration.vibrate([0, 900, 500], true);
  void (async () => {
    try {
      await setAudioModeAsync({allowsRecording: false, playsInSilentMode: true,
        shouldPlayInBackground: false, interruptionMode: 'duckOthers'});
      // Confirmation can arrive while the native audio session is being prepared.
      if (revision !== generation) return;
      player = createAudioPlayer(require('../../assets/notify.wav'));
      player.loop = true;
      player.volume = 1;
      player.play();
    } catch (error) { console.warn('[AssignmentAlarm] Playback failed', error); }
  })();
  return () => { if (revision === generation) stopAssignmentAlarm(bookingId); };
}
