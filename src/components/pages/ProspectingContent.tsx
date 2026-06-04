// src/components/pages/ProspectingContent.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  Instagram, Linkedin, Youtube, Facebook, Globe,
  Sparkles, Send, X, Copy, Check, RefreshCw, ExternalLink, AlertCircle, Eye, Trash2, Inbox, Ticket, ChevronRight, Plus, Link2, Clock
} from 'lucide-react';

type AppStatus = 'pending' | 'invited' | 'rejected';

interface Seed { position: number; title: string; subtitle: string; description?: string; }

type Stage = 'new' | 'expired' | 'invited' | 'clicked' | 'registered' | 'ebook' | 'landing' | 'leads';

interface InviteCode {
  id: string;
  code: string;
  status: string;
  expiresAt: string;
  clickedAt?: string | null;
  usedByUserId?: string | null;
  recipientHandle?: string | null;
  recipientNote?: string | null;
  isLive?: boolean;
  stage?: Stage;
  hasEbook?: boolean;
  hasLanding?: boolean;
  hasLeads?: boolean;
  applicationId?: string | null;
  application?: { id: string; email: string; firstName: string } | null;
  usedBy?: { id: string; email: string; firstName?: string; lastName?: string } | null;
  seeds: Seed[];
}

interface Application {
  id: string;
  firstName: string;
  email: string;
  website?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  youtube?: string | null;
  linkedin?: string | null;
  status: AppStatus;
  createdAt: string;
}

const translations = {
  en: {
    applications: 'Applications',
    invites: 'Invites',
    newInvitation: 'New invitation',
    invitesCount: 'invites', invitesActive: 'active',
    noInvites: 'No invitations yet.',
    stageClicked: 'Clicked', stageRegistered: 'Registered', stageEbook: 'Ebook', stageLanding: 'Landing', stageLeads: 'Leads',
    stageNew: 'New', stageInvited: 'Invited', stageExpired: 'Expired',
    linkNeverOpened: 'link never opened',
    copyLink: 'Copy link', view: 'View', copied: 'Copied',
    handleLabel: 'Instagram or contact', handlePh: '@handle or profile link',
    notePh: 'Private note (optional)',
    generating: 'Generating...', regenerate: 'Regenerate',
    createInvite: 'Create invite', creating: 'Creating...',
    inviteReady: 'Invitation ready', inviteReadyHint: 'Copy this link and send it to the person.',
    done: 'Done',
    cancelInvite: 'Cancel invite', deleteInvite: 'Delete permanently',
    confirmCancelCode: 'Cancel this invite? The link will stop working.',
    confirmDeleteCode: 'Permanently delete this invite? This cannot be undone.',
    inviteCancelledNote: 'This invite was cancelled. The link no longer works.',
    total: 'total', new: 'new',
    statusNew: 'New', statusAccepted: 'Accepted', statusCancelled: 'Cancelled',
    review: 'Review', view: 'View', close: 'Close',
    titlesFor: 'Titles for this person',
    generateSeeds: 'Generate seeds',
    titlePh: 'Title', subtitlePh: 'Subtitle',
    cancelApp: 'Cancel',
    deleteApp: 'Delete permanently',
    confirmDelete: 'Permanently delete this application? This cannot be undone.',
    descriptionPh: 'Description and guidelines',
    titleTab: 'Title',
    acceptUser: 'Accept', accepting: 'Sending...',
    titlesSent: 'Titles sent',
    inviteLink: 'Invite link',
    copy: 'Copy', copied: 'Copied',
    cancelledNote: 'This application was cancelled.',
    noApps: 'No applications yet.',
    loading: 'Loading...',
    accessDenied: 'Access denied.',
    confirmCancel: 'Cancel this application? This cannot be undone.',
    errorTitle: 'Something went wrong',
  },
  pl: {
    applications: 'Wnioski',
    invites: 'Zaproszenia',
    newInvitation: 'Nowe zaproszenie',
    invitesCount: 'zaproszeń', invitesActive: 'aktywnych',
    noInvites: 'Brak zaproszeń.',
    stageClicked: 'Kliknięto', stageRegistered: 'Rejestracja', stageEbook: 'Ebook', stageLanding: 'Strona', stageLeads: 'Leady',
    stageNew: 'Nowy', stageInvited: 'Wysłano', stageExpired: 'Wygasło',
    linkNeverOpened: 'link nieotwarty',
    copyLink: 'Kopiuj link', view: 'Zobacz', copied: 'Skopiowano',
    handleLabel: 'Instagram lub kontakt', handlePh: '@nick lub link do profilu',
    notePh: 'Notatka prywatna (opcjonalnie)',
    generating: 'Generowanie...', regenerate: 'Generuj ponownie',
    createInvite: 'Utwórz zaproszenie', creating: 'Tworzenie...',
    inviteReady: 'Zaproszenie gotowe', inviteReadyHint: 'Skopiuj link i wyślij go tej osobie.',
    done: 'Gotowe',
    cancelInvite: 'Anuluj zaproszenie', deleteInvite: 'Usuń trwale',
    confirmCancelCode: 'Anulować to zaproszenie? Link przestanie działać.',
    confirmDeleteCode: 'Trwale usunąć to zaproszenie? Tej operacji nie można cofnąć.',
    inviteCancelledNote: 'To zaproszenie zostało anulowane. Link już nie działa.',
    total: 'łącznie', new: 'nowych',
    statusNew: 'New', statusAccepted: 'Accepted', statusCancelled: 'Cancelled',
    review: 'Przejrzyj', view: 'Zobacz', close: 'Zamknij',
    titlesFor: 'Tytuły dla tej osoby',
    generateSeeds: 'Generuj seedy',
    titlePh: 'Tytuł', subtitlePh: 'Podtytuł',
    cancelApp: 'Anuluj',
    deleteApp: 'Usuń trwale',
    confirmDelete: 'Trwale usunąć ten wniosek? Tej operacji nie można cofnąć.',
    descriptionPh: 'Opis i wytyczne',
    titleTab: 'Tytuł',
    acceptUser: 'Akceptuj', accepting: 'Wysyłanie...',
    titlesSent: 'Wysłane tytuły',
    inviteLink: 'Link z zaproszeniem',
    copy: 'Kopiuj', copied: 'Skopiowano',
    cancelledNote: 'Ten wniosek został anulowany.',
    noApps: 'Brak wniosków.',
    loading: 'Ładowanie...',
    accessDenied: 'Brak dostępu.',
    confirmCancel: 'Anulować ten wniosek? Tej operacji nie można cofnąć.',
    errorTitle: 'Coś poszło nie tak',
  },
};

const emptySeed = (position: number): Seed => ({ position, title: '', subtitle: '', description: '' });

const buildChannels = (app: Application) => {
  const out: { label: string; url: string; Icon: any }[] = [];
  const norm = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
  if (app.instagram) out.push({ label: 'Instagram', url: norm(app.instagram), Icon: Instagram });
  if (app.website)   out.push({ label: 'Website',   url: norm(app.website),   Icon: Globe });
  if (app.linkedin)  out.push({ label: 'LinkedIn',  url: norm(app.linkedin),  Icon: Linkedin });
  if (app.facebook)  out.push({ label: 'Facebook',  url: norm(app.facebook),  Icon: Facebook });
  if (app.youtube)   out.push({ label: 'YouTube',   url: norm(app.youtube),   Icon: Youtube });
  return out;
};

export default function ProspectingContent() {
  const { userRole, isLoading: authLoading } = useAuth();
  const [lang, setLang] = useState<'pl' | 'en'>('en');
  useEffect(() => {
    try { const s = localStorage.getItem('appLanguage'); if (s === 'pl' || s === 'en') setLang(s); } catch {}
  }, []);
  const t = translations[lang];

  const [apps, setApps] = useState<Application[]>([]);
  const [codeByApp, setCodeByApp] = useState<Record<string, InviteCode>>({});
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Seed[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCodeId, setSelectedCodeId] = useState<string | null>(null);
  const [activeSeedTab, setActiveSeedTab] = useState(0);
  const [activeTab, setActiveTab] = useState<'applications' | 'invites'>('applications');

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/admin/prospecting', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load applications');
      const data = await res.json();
      const applications: Application[] = data.applications || [];
      const codes: InviteCode[] = data.codes || [];
      const map: Record<string, InviteCode> = {};
      codes.forEach((c) => { if (c.applicationId) map[c.applicationId] = c; });
      setDrafts((prev) => {
        const next = { ...prev };
        applications.forEach((a) => {
          if (a.status === 'pending' && !next[a.id]) next[a.id] = [emptySeed(1), emptySeed(2), emptySeed(3)];
        });
        return next;
      });
      setApps(applications);
      setCodeByApp(map);
      setCodes(codes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (userRole === 'GOD') fetchData(); }, [userRole, fetchData]);

  useEffect(() => {
    if (selectedId === null) return;
    setActiveSeedTab(0);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedId(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedId]);

  useEffect(() => {
    if (selectedCodeId === null) return;
    setCodeSeedTab(0);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedCodeId(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedCodeId]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const magicLink = (code: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/register?lang=${lang}&invite=${code}`;
  };

  const updateDraft = (appId: string, idx: number, field: 'title' | 'subtitle' | 'description', value: string) => {
    setDrafts((prev) => {
      const arr = prev[appId] ? [...prev[appId]] : [emptySeed(1), emptySeed(2), emptySeed(3)];
      arr[idx] = { ...arr[idx], [field]: value };
      return { ...prev, [appId]: arr };
    });
  };

  const canInvite = (appId: string) => {
    const arr = drafts[appId];
    return !!arr && arr.length === 3 && arr.every((s) => s.title.trim().length > 0);
  };

  // Realne generowanie seedów dla wniosku (application): skrapujemy wszystkie linki,
  // które wnioskujący podał (IG + strony), i przepuszczamy przez LLM. Trwa ~30-70s.
  const [genSeedsAppId, setGenSeedsAppId] = useState<string | null>(null);
  const handleGenerateSeeds = async (appId: string) => {
    setGenSeedsAppId(appId); setError(null);
    try {
      const res = await fetch('/api/admin/generate-seeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ applicationId: appId, lang }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to generate seeds');
      const incoming = Array.isArray(data.seeds) ? data.seeds : [];
      setDrafts((prev) => ({
        ...prev,
        [appId]: [0, 1, 2].map((i) => ({
          position: i + 1,
          title: incoming[i]?.title || '',
          subtitle: incoming[i]?.subtitle || '',
          description: incoming[i]?.description || '',
        })),
      }));
      setActiveSeedTab(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setGenSeedsAppId(null);
    }
  };

  const handleInvite = async (app: Application) => {
    if (!canInvite(app.id)) return;
    setInvitingId(app.id); setError(null);
    try {
      const seeds = drafts[app.id].map((s) => ({ title: s.title.trim(), subtitle: s.subtitle.trim(), description: (s.description || '').trim() }));
      const res = await fetch('/api/admin/prospecting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ applicationId: app.id, seeds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to invite');
      await fetchData(); // modal zostaje otwarty → przełączy się na widok Accepted
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setInvitingId(null);
    }
  };

  const handleCancel = async (app: Application) => {
    if (!window.confirm(t.confirmCancel)) return;
    setCancelingId(app.id); setError(null);
    try {
      const res = await fetch('/api/admin/prospecting', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ applicationId: app.id, action: 'cancel' }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed to cancel'); }
      await fetchData();
      setSelectedId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setCancelingId(null);
    }
  };

  const handleDelete = async (app: Application) => {
    if (!window.confirm(t.confirmDelete)) return;
    setDeletingId(app.id); setError(null);
    try {
      const res = await fetch(`/api/admin/prospecting?applicationId=${app.id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed to delete'); }
      await fetchData();
      setSelectedId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  };

  // --- NEW INVITATION (outbound) ---
  const [newInviteOpen, setNewInviteOpen] = useState(false);
  const [niHandle, setNiHandle] = useState('');
  const [niNote, setNiNote] = useState('');
  const [niSeeds, setNiSeeds] = useState<Seed[]>([emptySeed(1), emptySeed(2), emptySeed(3)]);
  const [niTab, setNiTab] = useState(0);
  const [niGenerating, setNiGenerating] = useState(false);
  const [niGenerated, setNiGenerated] = useState(false);
  const [niSaving, setNiSaving] = useState(false);
  const [niResultLink, setNiResultLink] = useState<string | null>(null);
  const [niCopied, setNiCopied] = useState(false);

  const openNewInvite = () => {
    setNiHandle(''); setNiNote('');
    setNiSeeds([emptySeed(1), emptySeed(2), emptySeed(3)]);
    setNiTab(0); setNiResultLink(null); setNiGenerating(false); setNiGenerated(false); setNiCopied(false);
    setNewInviteOpen(true);
  };

  const updateNiSeed = (idx: number, field: 'title' | 'subtitle' | 'description', value: string) => {
    setNiSeeds((prev) => { const arr = [...prev]; arr[idx] = { ...arr[idx], [field]: value }; return arr; });
  };

  // Realne generowanie seedów z profilu IG przez LLM (endpoint /api/admin/generate-seeds).
  // Scrape + analiza + model trwają ~30-70s — spinner leci przez całość.
  const simulateGenerate = async () => {
    if (!niHandle.trim()) return;
    setNiGenerating(true); setError(null);
    try {
      const res = await fetch('/api/admin/generate-seeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ instagram: niHandle.trim(), lang }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to generate seeds');
      const incoming = Array.isArray(data.seeds) ? data.seeds : [];
      setNiSeeds([0, 1, 2].map((i) => ({
        position: i + 1,
        title: incoming[i]?.title || '',
        subtitle: incoming[i]?.subtitle || '',
        description: incoming[i]?.description || '',
      })));
      setNiGenerated(true);
      setNiTab(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setNiGenerating(false);
    }
  };

  const niCanSave = niHandle.trim().length > 0 && niSeeds.every((s) => s.title.trim().length > 0);

  const [codeBusyId, setCodeBusyId] = useState<string | null>(null);
  const [codeSeedTab, setCodeSeedTab] = useState(0);

  const handleCancelCode = async (codeId: string) => {
    if (!window.confirm(t.confirmCancelCode)) return;
    setCodeBusyId(codeId); setError(null);
    try {
      const res = await fetch('/api/admin/prospecting', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ codeId, action: 'cancel' }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed to cancel'); }
      await fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setCodeBusyId(null);
    }
  };

  const handleDeleteCode = async (codeId: string) => {
    if (!window.confirm(t.confirmDeleteCode)) return;
    setCodeBusyId(codeId); setError(null);
    try {
      const res = await fetch(`/api/admin/prospecting?codeId=${codeId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed to delete'); }
      await fetchData();
      setSelectedCodeId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setCodeBusyId(null);
    }
  };

  const handleCreateInvite = async () => {
    if (!niCanSave) return;
    setNiSaving(true); setError(null);
    try {
      const seeds = niSeeds.map((s) => ({ title: s.title.trim(), subtitle: s.subtitle.trim(), description: (s.description || '').trim() }));
      const res = await fetch('/api/admin/prospecting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ recipientHandle: niHandle.trim(), recipientNote: niNote.trim() || undefined, seeds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to create invitation');
      const code = data?.code?.code;
      setNiResultLink(code ? magicLink(code) : (data.magicLink || null));
      await fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setNiSaving(false);
    }
  };

  if (authLoading) return null;
  if (userRole !== 'GOD') {
    return (
      <div className="flex items-center gap-2 text-gray-600 text-sm p-6">
        <AlertCircle size={18} /> {t.accessDenied}
      </div>
    );
  }

  const order: Record<AppStatus, number> = { pending: 0, invited: 1, rejected: 2 };
  const sorted = [...apps].sort(
    (a, b) => (order[a.status] - order[b.status]) || (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  );
  const newCount = apps.filter((a) => a.status === 'pending').length;

  const statusBadge = (status: AppStatus) => {
    if (status === 'pending') return <span className="text-[11px] font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md">{t.statusNew}</span>;
    if (status === 'invited') return <span className="text-[11px] font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-md">{t.statusAccepted}</span>;
    return <span className="text-[11px] font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md">{t.statusCancelled}</span>;
  };

  const renderChips = (app: Application) => {
    const channels = buildChannels(app);
    if (channels.length === 0) return null;
    return (
      <div className="flex gap-1.5 mt-3 flex-wrap">
        {channels.map((ch, i) => {
          const Icon = ch.Icon;
          return (
            <a key={`${app.id}-${i}`} href={ch.url} target="_blank" rel="noopener noreferrer"
               onClick={(e) => e.stopPropagation()}
               className="inline-flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-blue-700 px-2.5 py-1 rounded-full transition-colors">
              <Icon size={13} /> {ch.label} <ExternalLink size={11} className="opacity-60" />
            </a>
          );
        })}
      </div>
    );
  };

  const selectedApp = apps.find((a) => a.id === selectedId) || null;
  const selectedCode = selectedId !== null ? codeByApp[selectedId] : undefined;

  // Pełna ścieżka osoby — wspólna dla Applications i Invites.
  // 7 kroków zawsze widocznych: New → Invited → Clicked → Registered → Ebook → Landing → Leads.
  // Osiągnięte = zielone z ✓, bieżący/dalsze = przygaszone. Cancelled/Expired = osobny badge.
  const PATH: { key: Stage; label: () => string }[] = [
    { key: 'new', label: () => t.stageNew },
    { key: 'invited', label: () => t.stageInvited },
    { key: 'clicked', label: () => t.stageClicked },
    { key: 'registered', label: () => t.stageRegistered },
    { key: 'ebook', label: () => t.stageEbook },
    { key: 'landing', label: () => t.stageLanding },
    { key: 'leads', label: () => t.stageLeads },
  ];
  const stageRank: Record<string, number> = {
    cancelled: -2, expired: -1, new: 0, invited: 1, clicked: 2, registered: 3, ebook: 4, landing: 5, leads: 6,
  };

  // appStatus: status wniosku (pending/invited/rejected) — dla New/Cancelled bez kodu.
  // code: powiązany kod (gdy zaproszony) — niesie stage z lejka.
  const renderPath = (appStatus: AppStatus, code?: InviteCode | null) => {
    if (appStatus === 'rejected') {
      return <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">{t.statusCancelled}</span>;
    }
    if (code?.stage === 'expired') {
      return (
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">{t.stageExpired}</span>
          {!code.clickedAt && <span className="text-xs text-gray-400">{t.linkNeverOpened}</span>}
        </div>
      );
    }
    // Bieżący etap: z kodu (jeśli zaproszony), inaczej 'new' (pending).
    const stage: Stage = appStatus === 'pending' ? 'new' : (code?.stage || 'invited');
    const current = stageRank[stage];
    return (
      <div className="flex items-center gap-0.5 flex-wrap">
        {PATH.map((s, i) => {
          const reached = current >= stageRank[s.key];
          const isCurrent = stage === s.key;
          return (
            <span key={s.key} className="flex items-center gap-0.5">
              {i > 0 && <ChevronRight size={12} className="text-gray-300" />}
              {reached ? (
                <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  isCurrent && stage === 'new'
                    ? 'text-blue-700 bg-blue-100'
                    : 'text-green-700 bg-green-50'
                }`}>
                  {stage === 'new' && isCurrent ? <Clock size={11} /> : <Check size={11} />} {s.label()}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 px-2 py-0.5 border border-dashed border-gray-300 rounded-full">
                  <Clock size={11} /> {s.label()}
                </span>
              )}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
          <div>
            <p className="text-red-800 text-sm font-medium">{t.errorTitle}</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-b border-gray-200">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('applications')}
            className={`inline-flex items-center gap-2 px-1 py-2.5 mr-6 text-sm border-b-2 -mb-px cursor-pointer transition-colors ${
              activeTab === 'applications'
                ? 'font-medium text-gray-900 border-blue-600'
                : 'font-normal text-gray-500 border-transparent hover:text-gray-700'
            }`}>
            <Inbox size={16} /> {t.applications}
            {newCount > 0 && <span className="text-[11px] font-medium bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{newCount}</span>}
          </button>
          <button
            onClick={() => setActiveTab('invites')}
            className={`inline-flex items-center gap-2 px-1 py-2.5 text-sm border-b-2 -mb-px cursor-pointer transition-colors ${
              activeTab === 'invites'
                ? 'font-medium text-gray-900 border-blue-600'
                : 'font-normal text-gray-500 border-transparent hover:text-gray-700'
            }`}>
            <Ticket size={16} /> {t.invites}
          </button>
        </div>
        {activeTab === 'invites' && (
          <button onClick={openNewInvite}
                  className="inline-flex items-center gap-1.5 bg-indigo-700 text-white hover:bg-indigo-800 px-3.5 py-2 rounded-md text-[13px] font-medium cursor-pointer transition-colors mb-1.5">
            <Plus size={15} /> {t.newInvitation}
          </button>
        )}
      </div>

      {activeTab === 'applications' && (
        <>
          <div className="flex items-center justify-end">
            {!loading && <span className="text-xs text-gray-400">{apps.length} {t.total} · {newCount} {t.new}</span>}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm py-10 justify-center">
              <RefreshCw size={18} className="animate-spin" /> {t.loading}
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-10">{t.noApps}</div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {sorted.map((app) => (
                <div key={app.id}
                     className={`bg-white border border-gray-200 rounded-xl px-4 py-3.5 grid items-center gap-4 ${app.status === 'rejected' ? 'opacity-60' : ''}`}
                     style={{ gridTemplateColumns: '1.3fr 1.6fr 3.2fr 0.7fr 120px' }}>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 whitespace-nowrap">{app.firstName}</div>
                    <div className="text-xs text-gray-400 mt-0.5 truncate">{app.email}</div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {buildChannels(app).map((ch, i) => {
                      const Icon = ch.Icon;
                      return (
                        <a key={`${app.id}-${i}`} href={ch.url} target="_blank" rel="noopener noreferrer"
                           onClick={(e) => e.stopPropagation()}
                           className="inline-flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-blue-700 px-2.5 py-1 rounded-full transition-colors">
                          <Icon size={13} /> {ch.label} <ExternalLink size={11} className="opacity-60" />
                        </a>
                      );
                    })}
                  </div>
                  <div className="min-w-0">
                    {renderPath(app.status, codeByApp[app.id])}
                  </div>
                  <div className="text-xs text-gray-400 whitespace-nowrap">{formatDate(app.createdAt)}</div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => setSelectedId(app.id)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[13px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        app.status === 'pending'
                          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}>
                      <Eye size={14} /> {app.status === 'pending' ? t.review : t.view}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'invites' && (() => {
        const outbound = [...codes]
          .filter((c) => !c.applicationId)
          .sort((a, b) => new Date(b.expiresAt).getTime() - new Date(a.expiresAt).getTime());
        if (outbound.length === 0) {
          return <div className="text-center text-gray-400 text-sm py-16">{t.noInvites}</div>;
        }
        return (
          <div className="flex flex-col gap-2.5">
            {outbound.map((c) => {
              const recipient = c.recipientHandle || c.recipientNote || '—';
              const live = c.isLive && !c.usedByUserId;
              return (
                <div key={c.id}
                     className={`bg-white border border-gray-200 rounded-xl px-4 py-3.5 grid items-center gap-4 ${c.stage === 'expired' ? 'opacity-60' : ''}`}
                     style={{ gridTemplateColumns: '1.5fr 3.2fr 0.7fr 220px' }}>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{recipient}</div>
                    <div className="text-xs text-gray-400 mt-0.5 truncate">{c.usedBy?.email || ''}</div>
                  </div>
                  <div className="min-w-0">
                    {renderPath('invited', c)}
                  </div>
                  <div className="text-xs text-gray-400 whitespace-nowrap">{formatDate(c.expiresAt)}</div>
                  <div className="flex items-center justify-end gap-2">
                    {live && (
                      <button onClick={() => handleCopy(magicLink(c.code))}
                              className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-2 rounded-md text-[13px] font-medium cursor-pointer transition-colors whitespace-nowrap">
                        {copied ? <><Check size={14} /> {t.copied}</> : <><Link2 size={14} /> {t.copyLink}</>}
                      </button>
                    )}
                    <button onClick={() => setSelectedCodeId(c.id)}
                            className="inline-flex items-center gap-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-2 rounded-md text-[13px] font-medium cursor-pointer transition-colors whitespace-nowrap">
                      <Eye size={14} /> {live ? t.review : t.view}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* MODAL — podgląd zaproszenia (outbound) */}
      {selectedCodeId && (() => {
        const c = codes.find((x) => x.id === selectedCodeId);
        if (!c) return null;
        const recipient = c.recipientHandle || c.recipientNote || '—';
        const live = c.isLive && !c.usedByUserId;
        const cancellable = live; // żywy, niezużyty → można anulować
        const deletable = c.stage === 'expired' || (!live && !c.usedByUserId); // wygasły/anulowany, niezużyty
        const seeds = [...(c.seeds || [])].sort((a, b) => a.position - b.position);
        return (
          <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
               onClick={(e) => { if (e.target === e.currentTarget) setSelectedCodeId(null); }}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-200 sticky top-0 bg-white">
                <div className="min-w-0">
                  <div className="text-base font-semibold text-gray-900 truncate">{recipient}</div>
                  {c.usedBy?.email && <div className="text-[13px] text-gray-500 mt-0.5 truncate">{c.usedBy.email}</div>}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-gray-400 whitespace-nowrap hidden sm:inline">{formatDate(c.expiresAt)}</span>
                  <button onClick={() => setSelectedCodeId(null)} aria-label={t.close}
                          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors">
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="p-5">
                <div className="mb-4">{renderPath('invited', c)}</div>

                {seeds.length > 0 && (
                  <div className="mb-5">
                    <div className="flex gap-1.5 mb-3.5">
                      {seeds.map((s, i) => (
                        <button key={s.position} type="button" onClick={() => setCodeSeedTab(i)}
                                className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-md text-[13px] font-medium transition-colors cursor-pointer ${
                                  codeSeedTab === i ? 'bg-indigo-700 text-white' : 'border border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                                }`}>
                          {t.titleTab} {i + 1}
                        </button>
                      ))}
                    </div>
                    {seeds.map((s, i) => (
                      <div key={s.position} className={`space-y-2 ${codeSeedTab === i ? '' : 'hidden'}`}>
                        <input value={s.title} readOnly
                               className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50" />
                        <input value={s.subtitle} readOnly
                               className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 bg-gray-50" />
                        <textarea value={s.description || ''} readOnly rows={3}
                                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 bg-gray-50 resize-none" />
                      </div>
                    ))}
                  </div>
                )}

                <div className="mb-2">
                  <span className="text-[13px] font-medium text-gray-800 block mb-2">{t.inviteLink}</span>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 min-w-0 font-mono text-xs bg-gray-100 px-2.5 py-2 rounded-md text-gray-600 truncate">{magicLink(c.code)}</code>
                    <button onClick={() => handleCopy(magicLink(c.code))}
                            className="inline-flex items-center gap-1.5 border border-gray-300 hover:bg-gray-50 px-3 py-2 rounded-md text-[13px] font-medium text-gray-700 cursor-pointer transition-colors whitespace-nowrap">
                      {copied ? <><Check size={14} /> {t.copied}</> : <><Copy size={14} /> {t.copy}</>}
                    </button>
                  </div>
                </div>

                {c.stage === 'expired' && (
                  <p className="text-xs text-gray-400 mt-2">{t.inviteCancelledNote}</p>
                )}

                <div className="flex items-center gap-4 border-t border-gray-200 mt-5 pt-4">
                  {live ? (
                    <button onClick={() => handleCancelCode(c.id)} disabled={codeBusyId === c.id}
                            className="inline-flex items-center gap-1.5 text-[13px] text-red-600 hover:text-red-700 cursor-pointer disabled:opacity-50">
                      {codeBusyId === c.id ? <RefreshCw size={15} className="animate-spin" /> : <X size={15} />} {t.cancelInvite}
                    </button>
                  ) : (
                    <button onClick={() => handleDeleteCode(c.id)} disabled={codeBusyId === c.id}
                            className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-red-600 cursor-pointer disabled:opacity-50">
                      {codeBusyId === c.id ? <RefreshCw size={15} className="animate-spin" /> : <Trash2 size={15} />} {t.deleteInvite}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL — New invitation (outbound) */}
      {newInviteOpen && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
             onClick={(e) => { if (e.target === e.currentTarget) setNewInviteOpen(false); }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3 p-5 border-b border-gray-200 sticky top-0 bg-white">
              <span className="text-base font-semibold text-gray-900">{t.newInvitation}</span>
              <button onClick={() => setNewInviteOpen(false)} aria-label={t.close}
                      className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-5">
              {niResultLink ? (
                <>
                  <div className="flex items-center gap-2 text-green-700 mb-3">
                    <Check size={18} /> <span className="text-sm font-medium">{t.inviteReady}</span>
                  </div>
                  <p className="text-[13px] text-gray-500 mb-3">{t.inviteReadyHint}</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 min-w-0 font-mono text-xs bg-gray-100 px-2.5 py-2 rounded-md text-gray-600 truncate">{niResultLink}</code>
                    <button onClick={async () => { try { await navigator.clipboard.writeText(niResultLink); setNiCopied(true); setTimeout(() => setNiCopied(false), 1800); } catch {} }}
                            className="inline-flex items-center gap-1.5 border border-gray-300 hover:bg-gray-50 px-3 py-2 rounded-md text-[13px] font-medium text-gray-700 cursor-pointer transition-colors whitespace-nowrap">
                      {niCopied ? <><Check size={14} /> {t.copied}</> : <><Copy size={14} /> {t.copy}</>}
                    </button>
                  </div>
                  <div className="flex justify-end border-t border-gray-200 mt-5 pt-4">
                    <button onClick={() => setNewInviteOpen(false)}
                            className="px-4 py-2 rounded-md text-[13px] font-medium bg-indigo-700 text-white hover:bg-indigo-800 cursor-pointer transition-colors">
                      {t.done}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <label className="block text-[13px] font-medium text-gray-700 mb-1.5">{t.handleLabel}</label>
                  <input
                    value={niHandle}
                    onChange={(e) => setNiHandle(e.target.value)}
                    placeholder={t.handlePh}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />

                  {!niGenerated && (
                    <button onClick={simulateGenerate} disabled={!niHandle.trim() || niGenerating}
                            className={`w-full mt-4 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-[13px] font-medium transition-colors ${
                              niHandle.trim() && !niGenerating
                                ? 'bg-indigo-700 text-white hover:bg-indigo-800 cursor-pointer'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}>
                      {niGenerating ? <><RefreshCw size={15} className="animate-spin" /> {t.generating}</> : <><Sparkles size={15} /> {t.generateSeeds}</>}
                    </button>
                  )}

                  {niGenerated && (
                    <>
                      <div className="flex items-center justify-between mt-5 mb-3">
                        <span className="text-[13px] font-medium text-gray-800">{t.titlesFor}</span>
                        <button onClick={simulateGenerate} disabled={niGenerating}
                                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-indigo-100 hover:bg-indigo-200 text-indigo-700 cursor-pointer transition-colors">
                          {niGenerating ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />} {t.regenerate}
                        </button>
                      </div>

                      <div className="flex gap-1.5 mb-3.5">
                        {[0, 1, 2].map((i) => {
                          const filled = (niSeeds[i]?.title || '').trim().length > 0;
                          const active = niTab === i;
                          return (
                            <button key={i} type="button" onClick={() => setNiTab(i)}
                                    className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-md text-[13px] font-medium transition-colors cursor-pointer ${
                                      active ? 'bg-indigo-700 text-white' : 'border border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                                    }`}>
                              {t.titleTab} {i + 1}
                              {filled && <Check size={13} className={active ? 'text-white' : 'text-green-600'} />}
                            </button>
                          );
                        })}
                      </div>
                      {[0, 1, 2].map((i) => (
                        <div key={i} className={`space-y-2 ${niTab === i ? '' : 'hidden'}`}>
                          <input value={niSeeds[i]?.title || ''} onChange={(e) => updateNiSeed(i, 'title', e.target.value)} placeholder={t.titlePh}
                                 className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                          <input value={niSeeds[i]?.subtitle || ''} onChange={(e) => updateNiSeed(i, 'subtitle', e.target.value)} placeholder={t.subtitlePh}
                                 className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                          <textarea value={niSeeds[i]?.description || ''} onChange={(e) => updateNiSeed(i, 'description', e.target.value)} placeholder={t.descriptionPh} rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" />
                        </div>
                      ))}

                      </>
                  )}

                  <div className="flex items-center justify-between gap-3 border-t border-gray-200 mt-5 pt-4">
                    <button onClick={() => setNewInviteOpen(false)}
                            className="text-[13px] text-gray-500 hover:text-gray-700 cursor-pointer">
                      {t.cancelApp}
                    </button>
                    <button onClick={handleCreateInvite} disabled={!niCanSave || niSaving}
                            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] font-medium transition-colors ${
                              niCanSave && !niSaving ? 'bg-indigo-700 text-white hover:bg-indigo-800 cursor-pointer' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}>
                      {niSaving ? <><RefreshCw size={14} className="animate-spin" /> {t.creating}</> : <><Link2 size={14} /> {t.createInvite}</>}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL — workspace wniosku */}
      {selectedApp && (
        <div
          className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-200 sticky top-0 bg-white">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-gray-900">{selectedApp.firstName}</span>
                  {statusBadge(selectedApp.status)}
                </div>
                <div className="text-[13px] text-gray-500 mt-0.5 truncate">{selectedApp.email}</div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-gray-400 whitespace-nowrap hidden sm:inline">{formatDate(selectedApp.createdAt)}</span>
                <button onClick={() => setSelectedId(null)} aria-label={t.close}
                        className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-5">
              {renderChips(selectedApp)}

              {/* NEW → workspace */}
              {selectedApp.status === 'pending' && (
                <>
                  <div className="mt-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[13px] font-medium text-gray-800">{t.titlesFor}</span>
                      <button onClick={() => handleGenerateSeeds(selectedApp.id)} disabled={genSeedsAppId === selectedApp.id}
                              className="inline-flex items-center gap-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-xs font-medium px-3 py-1.5 rounded-md cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                        {genSeedsAppId === selectedApp.id
                          ? <><RefreshCw size={14} className="animate-spin" /> {t.generating}</>
                          : <><Sparkles size={14} /> {t.generateSeeds}</>}
                      </button>
                    </div>
                    <div className="flex gap-1.5 mb-3.5">
                      {[0, 1, 2].map((i) => {
                        const filled = (drafts[selectedApp.id]?.[i]?.title || '').trim().length > 0;
                        const active = activeSeedTab === i;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setActiveSeedTab(i)}
                            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-md text-[13px] font-medium transition-colors cursor-pointer ${
                              active
                                ? 'bg-indigo-700 text-white'
                                : 'border border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {t.titleTab} {i + 1}
                            {filled && <Check size={13} className={active ? 'text-white' : 'text-green-600'} />}
                          </button>
                        );
                      })}
                    </div>
                    {[0, 1, 2].map((i) => (
                      <div key={i} className={`space-y-2 ${activeSeedTab === i ? '' : 'hidden'}`}>
                        <input
                          value={drafts[selectedApp.id]?.[i]?.title || ''}
                          onChange={(e) => updateDraft(selectedApp.id, i, 'title', e.target.value)}
                          placeholder={t.titlePh}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <input
                          value={drafts[selectedApp.id]?.[i]?.subtitle || ''}
                          onChange={(e) => updateDraft(selectedApp.id, i, 'subtitle', e.target.value)}
                          placeholder={t.subtitlePh}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <textarea
                          value={drafts[selectedApp.id]?.[i]?.description || ''}
                          onChange={(e) => updateDraft(selectedApp.id, i, 'description', e.target.value)}
                          placeholder={t.descriptionPh}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-gray-200 mt-5 pt-4">
                    <button onClick={() => handleCancel(selectedApp)} disabled={cancelingId === selectedApp.id}
                            className="inline-flex items-center gap-1.5 text-[13px] text-red-600 hover:text-red-700 cursor-pointer disabled:opacity-50">
                      {cancelingId === selectedApp.id ? <RefreshCw size={15} className="animate-spin" /> : <X size={15} />} {t.cancelApp}
                    </button>
                    <button onClick={() => handleInvite(selectedApp)} disabled={!canInvite(selectedApp.id) || invitingId === selectedApp.id}
                            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] font-medium transition-colors ${
                              canInvite(selectedApp.id) && invitingId !== selectedApp.id
                                ? 'bg-indigo-700 text-white hover:bg-indigo-800 cursor-pointer'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}>
                      {invitingId === selectedApp.id ? <><RefreshCw size={14} className="animate-spin" /> {t.accepting}</> : <><Send size={14} /> {t.acceptUser}</>}
                    </button>
                  </div>
                </>
              )}

              {/* ACCEPTED → podgląd + link */}
              {selectedApp.status === 'invited' && (
                <>
                  {selectedCode?.seeds?.length ? (
                    <div className="mt-5">
                      <span className="text-[13px] font-medium text-gray-800 block mb-2">{t.titlesSent}</span>
                      <ol className="list-decimal pl-5 space-y-1.5">
                        {[...selectedCode.seeds].sort((a, b) => a.position - b.position).map((s) => (
                          <li key={s.position} className="text-[13px] text-gray-800">
                            {s.title}
                            {s.subtitle ? <span className="text-gray-500"> — {s.subtitle}</span> : null}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}

                  {selectedCode?.code && (
                    <div className="mt-5">
                      <span className="text-[13px] font-medium text-gray-800 block mb-2">{t.inviteLink}</span>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 min-w-0 font-mono text-xs bg-gray-100 px-2.5 py-2 rounded-md text-gray-600 truncate">{magicLink(selectedCode.code)}</code>
                        <button onClick={() => handleCopy(magicLink(selectedCode.code))}
                                className="inline-flex items-center gap-1.5 border border-gray-300 hover:bg-gray-50 px-3 py-2 rounded-md text-[13px] font-medium text-gray-700 cursor-pointer transition-colors whitespace-nowrap">
                          {copied ? <><Check size={14} /> {t.copied}</> : <><Copy size={14} /> {t.copy}</>}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* CANCELLED */}
              {selectedApp.status === 'rejected' && (
                <>
                  <p className="text-sm text-gray-500 mt-5">{t.cancelledNote}</p>
                  <div className="border-t border-gray-200 mt-5 pt-4">
                    <button onClick={() => handleDelete(selectedApp)} disabled={deletingId === selectedApp.id}
                            className="inline-flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-red-600 cursor-pointer disabled:opacity-50">
                      {deletingId === selectedApp.id ? <RefreshCw size={15} className="animate-spin" /> : <Trash2 size={15} />} {t.deleteApp}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}