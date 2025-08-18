// src/lib/ebookEvents.ts
import { EventEmitter } from 'events';

interface EbookEvent {
  type: 'created' | 'updated' | 'deleted';
  userId: string;
  ebookId?: number;
  timestamp: Date;
}

class EbookEventEmitter extends EventEmitter {
  emitEbookChange(event: EbookEvent) {
    console.log(`📡 Emitting ebook event: ${event.type} for user ${event.userId}`);
    this.emit('ebook-change', event);
  }

  onEbookChange(callback: (event: EbookEvent) => void) {
    this.on('ebook-change', callback);
    return () => this.off('ebook-change', callback);
  }
}

// Singleton instance
export const ebookEvents = new EbookEventEmitter();