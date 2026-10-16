import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import 'katex/dist/katex.min.css';
import './styles.css';
import { App } from './ui/App';

registerSW({
  immediate: true,
  onOfflineReady() {
    window.dispatchEvent(new Event('lernkarten-offline-bereit'));
  },
});

render(<App />, document.getElementById('app')!);
