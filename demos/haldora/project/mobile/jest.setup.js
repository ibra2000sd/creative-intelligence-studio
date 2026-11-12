// Worklets and gestures have no native runtime under Jest: use the mocks each package ships.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
require('react-native-gesture-handler/jestSetup');
require('react-native-reanimated').setUpTests();
jest.mock('expo-font', () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
