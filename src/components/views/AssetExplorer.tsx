'use client';
import { useState, useEffect } from 'react';
import { Search, Image as ImageIcon, Music, Video, FileText, Package, Trash2, X, Download, HardDrive, FolderOpen } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const BASE = '/api/assets';
const EXPLORER = '/api/disk-explorer';

const translations = {
  pl: {
    title: 'Moje pliki',
    filesCount: (n: number) => `${n} ${n === 1 ? 'plik' : n < 5 ? 'pliki' : 'plików'}`,
    totalSize: 'łącznie',
    loading: 'Ładowanie plików…',
    noResults: 'Brak wyników',
    noFiles: 'Nie masz jeszcze żadnych plików',
    search: 'Szukaj pliku…',
    all: 'Wszystkie',
    image: 'Obrazy',
    audio: 'Audio',
    video: 'Wideo',
    text: 'Teksty',
    other: 'Inne',
    size: 'Rozmiar',
    type: 'Typ',
    modified: 'Zmodyfikowany',
    download: 'Pobierz plik',
    delete: 'Usuń',
    deleteConfirm: 'Czy na pewno usunąć',
    deleteError: 'Nie udało się usunąć pliku',
  },
  en: {
    title: 'My files',
    filesCount: (n: number) => `${n} ${n === 1 ? 'file' : 'files'}`,
    totalSize: 'total',
    loading: 'Loading files…',
    noResults: 'No results found',
    noFiles: 'You have no files yet',
    search: 'Search files…',
    all: 'All',
    image: 'Images',
    audio: 'Audio',
    video: 'Video',
    text: 'Text',
    other: 'Other',
    size: 'Size',
    type: 'Type',
    modified: 'Modified',
    download: 'Download file',
    delete: 'Delete',
    deleteConfirm: 'Are you sure you want to delete',
    deleteError: 'Failed to delete file',
  }
};

async function exploreDir(dirPath = ''): Promise<any[]> {
  const res = await fetch(`${EXPLORER}?path=${encodeURIComponent(dirPath)}`);
  const data = await res.json();
  if (!data.success) return [];
  let files: any[] = [];
  for (const item of data.items) {
    if (item.type === 'file') files.push(item);
    else files = files.concat(await exploreDir(item.path));
  }
  return files;
}

const EXT_IMAGE = ['.webp', '.png', '.jpg', '.jpeg', '.gif', '.svg'];
const EXT_AUDIO = ['.mp3', '.wav', '.ogg'];
const EXT_VIDEO = ['.mp4', '.webm'];
const EXT_TEXT  = ['.txt', '.json'];

function fileType(name: string) {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  if (EXT_IMAGE.includes(ext)) return 'image';
  if (EXT_AUDIO.includes(ext)) return 'audio';
  if (EXT_VIDEO.includes(ext)) return 'video';
  if (EXT_TEXT.includes(ext))  return 'text';
  return 'other';
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

const TYPE_BAR: Record<string, string> = {
  image: 'bg-blue-400',
  audio: 'bg-orange-400',
  video: 'bg-purple-400',
  text:  'bg-yellow-400',
  other: 'bg-gray-300',
};

const TYPE_BADGE: Record<string, string> = {
  image: 'bg-blue-50 text-blue-600',
  audio: 'bg-orange-50 text-orange-600',
  video: 'bg-purple-50 text-purple-600',
  text:  'bg-yellow-50 text-yellow-600',
  other: 'bg-gray-100 text-gray-500',
};

const TYPE_ICON: Record<string, any> = {
  image: ImageIcon,
  audio: Music,
  video: Video,
  text:  FileText,
  other: Package,
};

function FileCard({ file, onClick }: { file: any; onClick: (f: any) => void }) {
  const type = fileType(file.name);
  const url  = `${BASE}/${file.path}`;
  const Icon = TYPE_ICON[type];

  return (
    <div
      onClick={() => onClick(file)}
      className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md hover:border-gray-300 transition-all duration-200 cursor-pointer flex flex-col"
    >
      <div className={`h-1 w-full ${TYPE_BAR[type]}`} />

      <div className="h-28 bg-gray-50 flex items-center justify-center overflow-hidden relative border-b border-gray-100">
        {type === 'image' ? (
          <img src={url} alt={file.name} className="max-w-full max-h-full object-contain p-2" />
        ) : type === 'audio' ? (
          <Music size={32} className="text-orange-200" />
        ) : type === 'video' ? (
          <video src={url} className="max-w-full max-h-full" muted />
        ) : type === 'text' ? (
          <FileText size={32} className="text-yellow-200" />
        ) : (
          <Package size={32} className="text-gray-200" />
        )}
        <span className={`absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-md uppercase tracking-wide ${TYPE_BADGE[type]}`}>
          {type}
        </span>
      </div>

      <div className="p-3 flex-1">
        <p className="text-xs font-medium text-gray-800 truncate leading-snug mb-1.5" title={file.name}>
          {file.name}
        </p>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">{formatSize(file.size)}</span>
          <span className="text-xs text-gray-400">{new Date(file.modified).toLocaleDateString('pl-PL')}</span>
        </div>
      </div>
    </div>
  );
}

function Modal({ file, onClose, onDelete, isGod, t }: {
  file: any;
  onClose: () => void;
  onDelete: (p: string) => void;
  isGod: boolean;
  t: typeof translations['pl'];
}) {
  const type = file ? fileType(file.name) : null;
  const url  = file ? `${BASE}/${file.path}` : null;
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!file) return;
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose, file]);

  if (!file) return null;

  const handleDelete = async () => {
    if (!confirm(`${t.deleteConfirm}: ${file.name}?`)) return;
    setDeleting(true);
    const res = await fetch('/api/disk-explorer', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: file.path, action: 'delete' }),
    });
    const data = await res.json();
    if (data.success) onDelete(file.path);
    else { alert(t.deleteError); setDeleting(false); }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div className="flex-1 min-w-0 pr-4">
            <p className="font-semibold text-gray-900 text-sm break-all">{file.name}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={url!}
              download={file.name}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-700 transition-colors"
            >
              <Download size={13} />
              {t.download}
            </a>
            {isGod && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Trash2 size={13} />
                {t.delete}
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-gray-50 flex items-center justify-center min-h-48 border-b border-gray-100">
          {type === 'image' && <img src={url!} alt={file.name} className="max-w-full max-h-96 object-contain p-4" />}
          {type === 'audio' && <audio src={url!} controls className="w-full mx-6 my-8" />}
          {type === 'video' && <video src={url!} controls className="max-w-full max-h-96" />}
          {(type === 'text' || type === 'other') && (
            <div className="py-12 text-center">
              <FolderOpen size={40} className="mx-auto text-gray-300 mb-3" />
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="grid grid-cols-3 gap-3 p-5">
          {([[t.size, formatSize(file.size)], [t.type, type], [t.modified, new Date(file.modified).toLocaleDateString('pl-PL')]] as [string, string][]).map(([k, v]) => (
            <div key={k} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">{k}</p>
              <p className="text-sm font-semibold text-gray-800">{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AssetExplorer() {
  const { userRole } = useAuth();
  const isGod = userRole?.toUpperCase() === 'GOD';

  const [currentLang, setCurrentLang] = useState<'pl' | 'en'>('pl');
  useEffect(() => {
    const saved = localStorage.getItem('appLanguage');
    if (saved === 'en' || saved === 'pl') setCurrentLang(saved);
  }, []);
  const t = translations[currentLang];

  const [files, setFiles]         = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('all');
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState<any>(null);
  const [totalSize, setTotalSize] = useState(0);

  useEffect(() => {
    exploreDir('').then(all => {
      setFiles(all);
      setTotalSize(all.reduce((a: number, f: any) => a + f.size, 0));
      setLoading(false);
    });
  }, []);

  const counts: Record<string, number> = { all: files.length };
  ['image', 'audio', 'video', 'text', 'other'].forEach(tp => {
    counts[tp] = files.filter(f => fileType(f.name) === tp).length;
  });

  const visible = files.filter(f => {
    if (filter !== 'all' && fileType(f.name) !== filter) return false;
    if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const FILTERS = [
    { key: 'all',   label: t.all },
    { key: 'image', label: t.image },
    { key: 'audio', label: t.audio },
    { key: 'video', label: t.video },
    { key: 'text',  label: t.text },
    { key: 'other', label: t.other },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
          {!loading && (
            <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1.5">
              <HardDrive size={13} />
              {t.filesCount(files.length)} · {formatSize(totalSize)} {t.totalSize}
            </p>
          )}
        </div>
        <div className="relative sm:w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            placeholder={t.search}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400"
          />
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              filter === key
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}{counts[key] > 0 ? ` (${counts[key]})` : ''}
          </button>
        ))}
      </div>

      {/* Grid container */}
      <div className="bg-transparent sm:bg-white rounded-none sm:rounded-xl border-0 sm:border border-gray-200 overflow-hidden -mx-4 sm:mx-0">
        {loading ? (
          <div className="py-24 text-center">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-400 text-sm">{t.loading}</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="py-24 text-center px-4">
            <FolderOpen size={48} className="mx-auto text-gray-200 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">
              {search || filter !== 'all' ? t.noResults : t.noFiles}
            </h3>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-6">
            {visible.map(f => (
              <FileCard key={f.path} file={f} onClick={setSelected} />
            ))}
          </div>
        )}
      </div>

      <Modal
        file={selected}
        onClose={() => setSelected(null)}
        onDelete={(deletedPath: string) => {
          setFiles(prev => prev.filter(f => f.path !== deletedPath));
          setTotalSize(prev => prev - (selected?.size ?? 0));
          setSelected(null);
        }}
        isGod={isGod}
        t={t}
      />
    </div>
  );
}