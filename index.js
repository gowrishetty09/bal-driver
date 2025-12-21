import { registerRootComponent } from 'expo';

// Polyfill FormData for Hermes engine compatibility with axios
if (typeof global.FormData === 'undefined') {
    global.FormData = require('react-native/Libraries/Network/FormData');
}

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
