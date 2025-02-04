import { log, Components } from './logger';

// Add test log entries
log('Testing info message', { component: Components.AUDIO, line: 1 });
log('Testing warning message', { component: Components.AUDIO, line: 2, type: 'warn' });
log('Testing error message', { component: Components.AUDIO, line: 3, type: 'error' });
