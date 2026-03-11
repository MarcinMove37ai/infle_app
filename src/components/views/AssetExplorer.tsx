'use client';
import { useState, useEffect } from "react";

const BASE = "/api/assets";
const EXPLORER = "/api/disk-explorer";

async function exploreDir(dirPath = "") {
  const res = await fetch(`${EXPLORER}?path=${encodeURIComponent(dirPath)}`);
  const data = await res.json();
  if (!data.success) return [];
  let files = [];
  for (const item of data.items) {
    if (item.type === "file") files.push(item);
    else files = files.concat(await exploreDir(item.path));
  }
  return files;
}

const EXT_IMAGE = [".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg"];
const EXT_AUDIO = [".mp3", ".wav", ".ogg"];
const EXT_VIDEO = [".mp4", ".webm"];
const EXT_TEXT  = [".txt", ".json"];

function fileType(name) {
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  if (EXT_IMAGE.includes(ext)) return "image";
  if (EXT_AUDIO.includes(ext)) return "audio";
  if (EXT_VIDEO.includes(ext)) return "video";
  if (EXT_TEXT.includes(ext))  return "text";
  return "other";
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

function extractUser(path) {
  const m = path.match(/uploads\/([^/]+?)(?:_EB|_REEL|_AVATAR|\/)/);
  return m ? m[1].slice(0, 8) + "…" : "—";
}

const TYPE_COLOR = {
  image: "#4ade80",
  audio: "#fb923c",
  video: "#818cf8",
  text:  "#fbbf24",
  other: "#94a3b8",
};

function FileCard({ file, onClick }) {
  const type = fileType(file.name);
  const url  = `${BASE}/${file.path}`;
  const color = TYPE_COLOR[type];

  return (
    <div
      onClick={() => onClick(file)}
      style={{
        background: "#0f172a",
        border: `1px solid #1e293b`,
        borderRadius: 10,
        overflow: "hidden",
        cursor: "pointer",
        transition: "border-color .15s, transform .15s",
        display: "flex",
        flexDirection: "column",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "#1e293b";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Preview area */}
      <div style={{ height: 120, background: "#020617", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
        {type === "image" && (
          <img src={url} alt={file.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
        )}
        {type === "audio" && (
          <div style={{ fontSize: 36 }}>🎵</div>
        )}
        {type === "video" && (
          <video src={url} style={{ maxWidth: "100%", maxHeight: "100%" }} muted />
        )}
        {type === "text" && (
          <div style={{ fontSize: 32 }}>📄</div>
        )}
        {type === "other" && (
          <div style={{ fontSize: 32 }}>📦</div>
        )}
        {/* type badge */}
        <span style={{
          position: "absolute", top: 6, right: 6,
          background: color + "22", border: `1px solid ${color}55`,
          color, fontSize: 9, fontWeight: 700, padding: "2px 6px",
          borderRadius: 4, letterSpacing: 1, textTransform: "uppercase",
          fontFamily: "monospace",
        }}>{type}</span>
      </div>

      {/* Meta */}
      <div style={{ padding: "8px 10px", flex: 1 }}>
        <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", wordBreak: "break-all", lineHeight: 1.4, marginBottom: 4 }}>
          {file.name}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#475569", fontFamily: "monospace" }}>
          <span>{formatSize(file.size)}</span>
          <span>{new Date(file.modified).toLocaleDateString("pl-PL")}</span>
        </div>
      </div>
    </div>
  );
}

function Modal({ file, onClose }) {
  if (!file) return null;
  const type = fileType(file.name);
  const url  = `${BASE}/${file.path}`;

  useEffect(() => {
    const fn = e => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 24
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#0f172a", border: "1px solid #334155", borderRadius: 14,
        maxWidth: 800, width: "100%", maxHeight: "90vh", overflow: "auto", padding: 24
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, color: "#f1f5f9", fontFamily: "monospace", fontWeight: 700, wordBreak: "break-all" }}>{file.name}</div>
            <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace", marginTop: 2 }}>{file.path}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #334155", color: "#94a3b8", cursor: "pointer", borderRadius: 6, padding: "4px 10px", fontSize: 13, marginLeft: 16, flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ background: "#020617", borderRadius: 8, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
          {type === "image" && <img src={url} alt={file.name} style={{ maxWidth: "100%", maxHeight: "60vh", objectFit: "contain" }} />}
          {type === "audio" && <audio src={url} controls style={{ width: "100%", margin: 24 }} />}
          {type === "video" && <video src={url} controls style={{ maxWidth: "100%", maxHeight: "60vh" }} />}
          {(type === "text" || type === "other") && (
            <div style={{ color: "#64748b", fontFamily: "monospace", fontSize: 12, padding: 32 }}>
              <a href={url} download style={{ color: "#4ade80" }}>⬇ Pobierz plik</a>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 16 }}>
          {[["Rozmiar", formatSize(file.size)], ["Typ", type], ["Zmodyfikowany", new Date(file.modified).toLocaleDateString("pl-PL")]].map(([k, v]) => (
            <div key={k} style={{ background: "#1e293b", borderRadius: 6, padding: "8px 12px" }}>
              <div style={{ fontSize: 9, color: "#475569", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1 }}>{k}</div>
              <div style={{ fontSize: 12, color: "#cbd5e1", fontFamily: "monospace", marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AssetExplorer() {
  const [files, setFiles]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("all");
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState(null);
  const [stats, setStats]       = useState({});

  useEffect(() => {
    exploreDir("").then(all => {
      setFiles(all);
      const s = { total: all.length, size: all.reduce((a, f) => a + f.size, 0) };
      ["image","audio","video","text","other"].forEach(t => {
        s[t] = all.filter(f => fileType(f.name) === t).length;
      });
      setStats(s);
      setLoading(false);
    });
  }, []);

  const visible = files.filter(f => {
    if (filter !== "all" && fileType(f.name) !== filter) return false;
    if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ background: "#020617", minHeight: "100vh", color: "#f1f5f9", fontFamily: "monospace" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #1e293b", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#4ade80", letterSpacing: 1 }}>
          ASSET EXPLORER
        </div>
        {!loading && (
          <div style={{ fontSize: 10, color: "#475569" }}>
            {stats.total} plików · {formatSize(stats.size)} łącznie
          </div>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            placeholder="szukaj…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 6, color: "#f1f5f9", padding: "6px 10px", fontSize: 11, fontFamily: "monospace", outline: "none", width: 160 }}
          />
          {["all","image","audio","video","text","other"].map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{
              background: filter === t ? (TYPE_COLOR[t] || "#4ade80") + "22" : "#0f172a",
              border: `1px solid ${filter === t ? (TYPE_COLOR[t] || "#4ade80") : "#1e293b"}`,
              color: filter === t ? (TYPE_COLOR[t] || "#4ade80") : "#64748b",
              borderRadius: 6, padding: "5px 10px", fontSize: 10, cursor: "pointer",
              textTransform: "uppercase", letterSpacing: 1, fontFamily: "monospace"
            }}>
              {t}{t !== "all" && stats[t] ? ` (${stats[t]})` : ""}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{ padding: 24 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "#334155", padding: 80, fontSize: 13 }}>
            Ładowanie plików…
          </div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign: "center", color: "#334155", padding: 80, fontSize: 13 }}>
            Brak wyników
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
            {visible.map(f => (
              <FileCard key={f.path} file={f} onClick={setSelected} />
            ))}
          </div>
        )}
      </div>

      <Modal file={selected} onClose={() => setSelected(null)} />
    </div>
  );
}