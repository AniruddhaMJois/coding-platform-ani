import { subscribeEvents } from '@/lib/realtime';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  let unsubscribe;
  let heartbeatTimer;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial handshake
      try {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`)
        );
      } catch (e) {
        return;
      }

      // Keepalive heartbeat every 15 seconds
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch (e) {
          clearInterval(heartbeatTimer);
          if (unsubscribe) unsubscribe();
        }
      }, 15000);

      // Subscribe to real-time events from admin actions
      unsubscribe = subscribeEvents((event) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch (e) {
          clearInterval(heartbeatTimer);
          if (unsubscribe) unsubscribe();
        }
      });
    },
    cancel() {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (unsubscribe) unsubscribe();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
}
