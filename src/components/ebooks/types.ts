// src/components/ebooks/types.ts

// Interface for table of contents items, extended with content and image
export interface TocItem {
  id: string;
  title: string;
  content?: string;
  position?: number;
  image_url?: string;
}

// Interface for content scraped from URLs
// Uwaga: Scalono definicję podstawową z rozszerzoną (z linii 655 oryginału),
// aby obsłużyć wszystkie przypadki użycia w aplikacji.
export interface ScrapedContent {
  id?: number; // Opcjonalne ID z bazy danych
  url: string;
  title: string;
  content: string;
  source?: string;
  metadata?: any;
}

// Interface for cover status
export interface CoverStatus {
  prompt_ready: boolean;
  image_ready: boolean;
  complete: boolean;
}

// Interface for cover data
export interface EbookCoverData {
  ebook_id: number;
  title: string;
  subtitle?: string;
  has_cover_prompt: boolean;
  has_cover_image: boolean;
  cover_url?: string;
  cover_prompt?: string;
  cover_prompt_length: number;
  last_updated: string;
  cover_status: CoverStatus;
}

// Props dla głównego modala
export interface EbookGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEbookCreated?: () => void;
  ebookId?: number | null;
}