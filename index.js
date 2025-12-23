// Import shim first before any other imports
import './shim';

// Ensure WebSocket exists early during startup (Hermes / bridgeless safety)
// Required for stability when any code touches WebSocket during initialization.
if (typeof global.WebSocket === 'undefined') {
	global.WebSocket = require('react-native').WebSocket;
}

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
