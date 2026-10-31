// Real-time server-side event broker for SSE across clients & devices
const { EventEmitter } = require('events');

if (!global.__realtime_broker) {
  const broker = new EventEmitter();
  broker.setMaxListeners(1000);
  global.__realtime_broker = broker;
}

export function broadcastEvent(event) {
  if (global.__realtime_broker) {
    global.__realtime_broker.emit('realtime_event', event);
  }
}

export function subscribeEvents(listener) {
  if (!global.__realtime_broker) return () => {};
  global.__realtime_broker.on('realtime_event', listener);
  return () => {
    global.__realtime_broker.off('realtime_event', listener);
  };
}
