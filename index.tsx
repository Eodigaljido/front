import 'react-native-gesture-handler';
import './global.css';
import { registerRootComponent } from 'expo';
import App from './App';

// sockjs-client가 참조하는 브라우저 전역 변수 폴리필 (React Native에 없음)
if (typeof global.navigator === 'undefined') {
  (global as any).navigator = { onLine: true };
} else if (typeof (global.navigator as any).onLine === 'undefined') {
  (global.navigator as any).onLine = true;
}

registerRootComponent(App);