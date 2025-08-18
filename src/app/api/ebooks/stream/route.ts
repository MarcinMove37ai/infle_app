// Plik: src/app/api/ebooks/stream/route.ts

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ebookEvents } from '@/lib/ebookEvents';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }
    const userId = session.user.id;

    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    const sendEvent = (data: any, event?: string) => {
      const message = `${event ? `event: ${event}\n` : ''}data: ${JSON.stringify(data)}\n\n`;
      writer.write(encoder.encode(message));
    };

    const heartbeat = setInterval(() => {
      sendEvent({ type: 'heartbeat', timestamp: new Date().toISOString() }, 'heartbeat');
    }, 30000);

    // ✅ ZMIANA: Wysyłamy tylko prosty sygnał, a nie całe dane
    const unsubscribe = ebookEvents.onEbookChange(async (event) => {
      if (event.userId === userId) {
        console.log(`🔄 Sending update signal for user ${userId}:`, event.type);
        sendEvent({ type: 'update', trigger: event }, 'ebooks-update');
      }
    });

    // Wyślij sygnał 'initial' na start, aby klient wiedział, że połączenie działa
    sendEvent({ type: 'initial' }, 'ebooks-update');

    request.signal.addEventListener('abort', () => {
      console.log(`🚫 SSE connection closed for user ${userId}`);
      clearInterval(heartbeat);
      unsubscribe();
      writer.close();
    });

    return new Response(responseStream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('SSE Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}