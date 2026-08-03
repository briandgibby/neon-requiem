import { useEffect, useState } from 'react';
import { ArrowLeft, LogOut, RefreshCw, Search, Shield } from 'lucide-react';
import { apiUrl } from '../lib/api';

interface SnapshotHistoryEntry {
  id: string;
  recordedAt: string;
  capturedAt: string;
  character: { id: string; name: string };
  state: { hp: number; stun: number; mana: number; roomId: string };
}

interface AdminSnapshotViewProps {
  token: string;
  onBack: () => void;
  onLogout: () => void;
}

export function AdminSnapshotView({ token, onBack, onLogout }: AdminSnapshotViewProps) {
  const [snapshots, setSnapshots] = useState<SnapshotHistoryEntry[]>([]);
  const [characterId, setCharacterId] = useState('');
  const [activeCharacterId, setActiveCharacterId] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ limit: '50' });
    if (activeCharacterId) query.set('characterId', activeCharacterId);

    fetch(apiUrl(`/admin/snapshots?${query}`), {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load snapshot history');
        return data as { snapshots: SnapshotHistoryEntry[] };
      })
      .then((data) => setSnapshots(data.snapshots))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load snapshot history');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [token, activeCharacterId, reloadKey]);

  const applyFilter = (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setActiveCharacterId(characterId.trim());
    setReloadKey((key) => key + 1);
  };

  const refresh = () => {
    setLoading(true);
    setError('');
    setReloadKey((key) => key + 1);
  };

  return (
    <div className="min-h-screen w-screen bg-[#020402] text-[#00ff41] font-mono crt p-4 md:p-8">
      <div className="mx-auto max-w-6xl neon-panel bg-grid min-h-[calc(100vh-4rem)]">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#00ff41]/20 bg-[#00ff41]/5 p-5">
          <div>
            <div className="flex items-center gap-3">
              <Shield size={20} />
              <h1 className="text-lg font-bold tracking-[0.2em] text-glow uppercase">Snapshot History</h1>
            </div>
            <p className="mt-1 text-[10px] uppercase tracking-widest opacity-50">Restricted operator console · newest 50 records</p>
          </div>
          <div className="flex gap-3">
            <button onClick={onBack} className="flex items-center gap-2 border border-[#00ff41]/30 px-4 py-2 text-[10px] font-bold tracking-widest hover:bg-[#00ff41]/10">
              <ArrowLeft size={14} /> PERSONAS
            </button>
            <button onClick={onLogout} className="flex items-center gap-2 border border-pink-500/40 px-4 py-2 text-[10px] font-bold tracking-widest text-pink-500 hover:bg-pink-500/10">
              <LogOut size={14} /> LOGOUT
            </button>
          </div>
        </header>

        <form onSubmit={applyFilter} className="flex flex-wrap gap-3 border-b border-[#00ff41]/20 p-5">
          <label className="min-w-64 flex-1">
            <span className="mb-2 block text-[10px] uppercase tracking-widest opacity-60">Character ID</span>
            <input
              value={characterId}
              onChange={(event) => setCharacterId(event.target.value)}
              placeholder="Leave blank for all characters"
              className="w-full border border-[#00ff41]/30 bg-[#050505] px-4 py-3 text-xs outline-none focus:border-[#00ff41]"
            />
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className="flex items-center gap-2 bg-[#00ff41] px-5 py-3 text-xs font-bold tracking-widest text-[#020402] hover:brightness-110">
              <Search size={14} /> FILTER
            </button>
            <button type="button" onClick={refresh} className="border border-[#00ff41]/30 p-3 hover:bg-[#00ff41]/10" aria-label="Refresh snapshot history">
              <RefreshCw size={16} />
            </button>
          </div>
        </form>

        <main className="overflow-x-auto p-5">
          {error ? (
            <div className="border border-pink-500/40 bg-pink-500/10 p-4 text-xs text-pink-500">SYSTEM ERROR: {error}</div>
          ) : loading ? (
            <div className="p-12 text-center text-xs tracking-widest opacity-50 animate-pulse">SCANNING AUDIT ARCHIVE...</div>
          ) : snapshots.length === 0 ? (
            <div className="border border-dashed border-[#00ff41]/20 p-12 text-center text-xs tracking-widest opacity-50">NO SNAPSHOTS FOUND</div>
          ) : (
            <table className="w-full min-w-[760px] border-collapse text-left text-xs">
              <thead className="text-[10px] uppercase tracking-widest opacity-60">
                <tr className="border-b border-[#00ff41]/30">
                  <th className="p-3">Recorded</th>
                  <th className="p-3">Character</th>
                  <th className="p-3">HP</th>
                  <th className="p-3">Stun</th>
                  <th className="p-3">Mana</th>
                  <th className="p-3">Room</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snapshot) => (
                  <tr key={snapshot.id} className="border-b border-[#00ff41]/10 hover:bg-[#00ff41]/5">
                    <td className="p-3 whitespace-nowrap">{new Date(snapshot.recordedAt).toLocaleString()}</td>
                    <td className="p-3">
                      <div className="font-bold">{snapshot.character.name}</div>
                      <div className="mt-1 text-[9px] opacity-40">{snapshot.character.id}</div>
                    </td>
                    <td className="p-3 font-bold">{snapshot.state.hp}</td>
                    <td className="p-3 text-purple-400">{snapshot.state.stun}</td>
                    <td className="p-3 text-blue-400">{snapshot.state.mana}</td>
                    <td className="p-3 font-mono text-[10px]">{snapshot.state.roomId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </main>
      </div>
    </div>
  );
}
