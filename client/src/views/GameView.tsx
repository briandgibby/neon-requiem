import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Terminal } from '../components/Terminal';
import type { TerminalHandle } from '../components/Terminal';
import { CommandPicker } from '../components/CommandPicker';
import type { CommandMetadata } from '../components/CommandPicker';
import type { CommandArgumentSource } from '../lib/command-picker';
import { Shield, Activity, Map as MapIcon, Terminal as TerminalIcon } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { useHotkeys } from '../hooks/useHotkeys';
import { apiUrl } from '../lib/api';
import { resolveHotkey } from '../lib/hotkeys';
import type { HotkeyMap } from '../lib/hotkeys';
import { CornerAccents } from '../components/CornerAccents';
import type { Character } from '../types';

interface NamedEntity {
  name: string;
}

interface RoomData {
  id?: string;
  name: string;
  description: string;
  slug?: string;
  gridX?: number;
  gridY?: number;
  exits?: Record<string, string>;
  occupants?: NamedEntity[];
  poiCategory?: string | null;
  zone?: { name: string; slug: string };
}

interface CombatTarget {
  id: string;
  name: string;
  currentHp: number;
  maxHp: number;
}

interface CombatTargets {
  hostiles: CombatTarget[];
  allies: CombatTarget[];
}

interface MissionTemplate {
  slug: string;
  name: string;
  basePayout: number;
}

interface ShopItem {
  itemId: string;
  price: number;
  stock: number;
  item: { id: string; name: string };
}

interface MatrixIce {
  id: string;
  name?: string;
  slug?: string;
  type: string;
  currentHp: number;
  maxHp: number;
}

interface MatrixData {
  name?: string;
  nodeId?: string;
  securityLevel?: number;
  alertLevel?: string;
  occupants?: NamedEntity[];
  activeIC?: MatrixIce[];
}

interface LocalPoi {
  slug: string;
  name: string;
  poiCategory: string;
}

const EMPTY_HOTKEYS: HotkeyMap = {};

interface RoomOccupant {
  characterId: string;
  name: string;
  selector: string;
}

interface ChatMessage {
  from: string;
  text: string;
  scope: 'room' | 'tell';
}

interface GameViewProps {
  token: string;
  character: Character;
  onLogout: () => void;
}

export const GameView: React.FC<GameViewProps> = ({ token, character, onLogout }) => {
  const { socket, isConnected } = useSocket(token);
  const [charData, setCharData] = useState<Character>(character);
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [matrixData, setMatrixData] = useState<MatrixData | null>(null);
  const [localPois, setLocalPois] = useState<LocalPoi[]>([]);
  const [roomOccupants, setRoomOccupants] = useState<RoomOccupant[]>([]);
  const [commands, setCommands] = useState<CommandMetadata[]>([]);
  const [combatTargets, setCombatTargets] = useState<CombatTargets>({ hostiles: [], allies: [] });
  const [missionTemplates, setMissionTemplates] = useState<MissionTemplate[]>([]);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const currentAp = charData.currentAp ?? 6;
  const maxAp = charData.maxAp ?? 6;
  const terminalRef = useRef<TerminalHandle>(null);
  const requestCommandArguments = useCallback((source: CommandArgumentSource) => {
    if (source === 'hostile' || source === 'ally' || source === 'injured-ally') {
      socket?.emit('request_combat_targets');
    }
  }, [socket]);
  const {
    hotkeys,
    isSavingHotkey,
    saveHotkey,
    removeHotkey,
  } = useHotkeys({
    token,
    characterId: character.id,
    initialHotkeys: character.hotkeys ?? EMPTY_HOTKEYS,
    onError: (message) => terminalRef.current?.writeln(`\x1b[31m${message}\x1b[0m`),
  });

  useEffect(() => {
    let cancelled = false;

    fetch(apiUrl('/api/commands'), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => {
        if (!response.ok) throw new Error('Failed to load command catalog');
        return response.json();
      })
      .then((data: { commands?: CommandMetadata[] }) => {
        if (!cancelled) setCommands(data.commands ?? []);
      })
      .catch((err) => {
        console.error('[GameView] command catalog load failed:', err);
      });

    fetch(apiUrl(`/mission/templates?characterId=${encodeURIComponent(character.id)}`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => {
        if (!response.ok) throw new Error('Failed to load Mission catalog');
        return response.json();
      })
      .then((data: { missions?: MissionTemplate[] }) => {
        if (!cancelled) setMissionTemplates(data.missions ?? []);
      })
      .catch((err) => {
        console.error('[GameView] Mission catalog load failed:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [character.id, token]);

  useEffect(() => {
    if (!roomData?.id || charData.isJackedIn) {
      return;
    }

    const controller = new AbortController();
    fetch(apiUrl(`/combat/targets?characterId=${encodeURIComponent(character.id)}`), {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('Failed to load combat targets');
        return response.json();
      })
      .then((targets: CombatTargets) => setCombatTargets(targets))
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('[GameView] combat target load failed:', err);
      });

    return () => controller.abort();
  }, [character.id, charData.isJackedIn, roomData?.id, token]);

  useEffect(() => {
    if (!roomData?.id || roomData.poiCategory !== 'SHOP' || charData.isJackedIn) return;
    const controller = new AbortController();
    fetch(apiUrl('/api/shop/' + encodeURIComponent(roomData.id)), {
      headers: { Authorization: 'Bearer ' + token },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('Failed to load shop inventory');
        return response.json();
      })
      .then((inventory: ShopItem[]) => setShopItems(inventory))
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('[GameView] shop inventory load failed:', err);
      });
    return () => controller.abort();
  }, [charData.isJackedIn, roomData?.id, roomData?.poiCategory, token]);

  useEffect(() => {
    if (!socket) return;

    socket.on('message', (data: { text: string; type?: string }) => {
      if (terminalRef.current) {
        let color = '\x1b[0m';
        if (data.type === 'error') color = '\x1b[31m';
        if (data.type === 'success') color = '\x1b[32m';
        if (data.type === 'info') color = '\x1b[34m';
        if (data.type === 'combat') color = '\x1b[35m';
        
        terminalRef.current.writeln(`${color}${data.text}\x1b[0m`);
      }
    });

    const formatOccupants = (occupants: NamedEntity[]) => {
      const counts: Record<string, number> = {};
      occupants.forEach(o => {
        counts[o.name] = (counts[o.name] || 0) + 1;
      });
      return Object.entries(counts)
        .map(([name, count]) => count > 1 ? `${name} (${count})` : name)
        .join(', ');
    };

    socket.on('matrix_data', (data: MatrixData | null) => {
      setMatrixData(data);
      if (data) {
        setCombatTargets({ hostiles: [], allies: [] });
        setShopItems([]);
      }
      setCharData(prev => ({ ...prev, isJackedIn: !!data }));
      if (terminalRef.current && data) {
        terminalRef.current.writeln(`\r\n\x1b[1;36m[ HOST: ${data.name || data.nodeId} ]\x1b[0m`);
        terminalRef.current.writeln(`Security Level: ${data.securityLevel} | Alert Level: ${data.alertLevel}`);
        
        if (data.occupants && data.occupants.length > 0) {
          if (data.occupants.length > 15) {
            terminalRef.current.writeln(`\x1b[35mThere are ${data.occupants.length} other entities present here.\x1b[0m`);
          } else {
            const formatted = formatOccupants(data.occupants);
            terminalRef.current.writeln(`\x1b[35mAlso present: ${formatted}\x1b[0m`);
          }
        }
      }
    });

    socket.on('room_data', (data: RoomData) => {
      setRoomData(data);
      setCombatTargets({ hostiles: [], allies: [] });
      socket.emit('request_combat_targets');
      if (data.poiCategory !== 'SHOP') setShopItems([]);
      if (terminalRef.current) {
        terminalRef.current.writeln(`\r\n\x1b[1;36m[ ${data.name} ]\x1b[0m`);
        
        if (data.occupants && data.occupants.length > 0) {
          if (data.occupants.length > 15) {
            terminalRef.current.writeln(`\x1b[32mThere are ${data.occupants.length} other entities present here.\x1b[0m`);
          } else {
            const formatted = formatOccupants(data.occupants);
            terminalRef.current.writeln(`\x1b[32mAlso present: ${formatted}\x1b[0m`);
          }
        }

        terminalRef.current.writeln(data.description);
        
        if (data.exits && Object.keys(data.exits).length > 0) {
          terminalRef.current.writeln(`\x1b[33mVisible exits: ${Object.keys(data.exits).join(', ')}\x1b[0m`);
        }
      }
    });

    socket.on('character_update', (data: Partial<Character>) => {
      setCharData(prev => ({ ...prev, ...data }));
    });

    socket.on('local_pois', (data: LocalPoi[]) => {
      setLocalPois(data);
    });

    socket.on('room_occupants', (data: RoomOccupant[]) => {
      setRoomOccupants(data);
    });

    socket.on('player_entered', (data: RoomOccupant) => {
      terminalRef.current?.writeln(`\x1b[32m${data.name} enters the room.\x1b[0m`);
      socket.emit('request_combat_targets');
    });

    socket.on('player_left', (data: RoomOccupant) => {
      terminalRef.current?.writeln(`\x1b[33m${data.name} leaves the room.\x1b[0m`);
      socket.emit('request_combat_targets');
    });

    socket.on('combat_targets_invalidated', () => {
      socket.emit('request_combat_targets');
    });

    socket.on('chat_message', (data: ChatMessage) => {
      const prefix = data.scope === 'tell' ? '[tell]' : '[say]';
      terminalRef.current?.writeln(`\x1b[36m${prefix} ${data.from}: ${data.text}\x1b[0m`);
    });

    socket.on('combat_targets', (targets: CombatTargets) => {
      setCombatTargets(targets);
    });

    socket.on('shop_items', (inventory: ShopItem[]) => {
      setShopItems(inventory);
    });

    // Initial character select to server
    socket.emit('select_character', { characterId: character.id });

    return () => {
      socket.off('message');
      socket.off('matrix_data');
      socket.off('room_data');
      socket.off('character_update');
      socket.off('local_pois');
      socket.off('room_occupants');
      socket.off('player_entered');
      socket.off('player_left');
      socket.off('chat_message');
      socket.off('combat_targets');
      socket.off('combat_targets_invalidated');
      socket.off('shop_items');
    };
  }, [socket, character.id]);

  const dispatchCommand = (command: string) => {
    if (command === 'logout') return onLogout();
    if (command === 'clear') return terminalRef.current?.clear();
    
    if (socket && isConnected) {
      socket.emit('command', { text: command });
    } else {
      terminalRef.current?.writeln('\x1b[31mConnection lost. Attempting to reconnect...\x1b[0m');
    }
  };

  const handleTerminalCommand = (input: string) => {
    dispatchCommand(resolveHotkey(input, hotkeys));
  };

  const hasMapAccess = Boolean(
    roomData?.zone?.slug && charData.areaKnowledge?.includes(roomData.zone.slug),
  );

  const renderCommlink = () => {
    return (
      <div className="flex-1 flex flex-col gap-4">
        <div className={`text-[10px] font-bold border-b pb-2 ${charData.isJackedIn ? 'border-cyan-500/20' : 'border-[#00ff41]/20'} flex justify-between`}>
          <span className="tracking-[0.2em] uppercase">{charData.isJackedIn ? 'Cyberdeck [V1.2]' : 'Commlink [V4.2]'}</span>
          <span className="opacity-50 text-[8px]">{charData.isJackedIn ? `SEC: ${matrixData?.securityLevel || 0}` : `GPS: ${roomData?.gridX || 0}:${roomData?.gridY || 0}`}</span>
        </div>

        <div className={`flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar ${charData.isJackedIn ? 'text-cyan-400' : 'text-[#00ff41]'}`}>
           {charData.isJackedIn ? (
             <>
               <div>
                 <div className="text-[8px] opacity-40 uppercase tracking-widest mb-1">Current Host</div>
                 <div className="text-xs font-bold text-glow uppercase truncate">
                   {matrixData?.name || matrixData?.nodeId || 'Unknown Node'}
                 </div>
               </div>

               <div>
                 <div className="text-[8px] opacity-40 uppercase tracking-widest mb-2 flex justify-between">
                   <span>Node Status</span>
                 </div>
                 
                 <div className="space-y-1">
                    <div className={`p-2 border text-[10px] uppercase tracking-wider ${
                      matrixData?.alertLevel === 'RED' ? 'border-red-500/50 bg-red-500/10 text-red-500' :
                      matrixData?.alertLevel === 'YELLOW' ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-500' :
                      'border-cyan-500/30 bg-cyan-500/10 text-cyan-400'
                    }`}>
                      ALERT: {matrixData?.alertLevel || 'GREEN'}
                    </div>
                 </div>
               </div>

               <div>
                 <div className="text-[8px] opacity-40 uppercase tracking-widest mb-2 flex justify-between">
                   <span>Matrix Entities</span>
                   <span className="opacity-50">{/* Could add ICE count here later */}</span>
                 </div>
                 <div className="space-y-1">
                     {/* Placeholder for Matrix Entities */}
                     <div className="text-[10px] italic opacity-30 p-2 text-center">Scanning local grid...</div>
                 </div>
               </div>
             </>
           ) : (
             <>
               <div>
                 <div className="text-[8px] opacity-40 uppercase tracking-widest mb-1">Current Sector</div>
                 <div className="text-xs font-bold text-glow uppercase truncate">
                   {roomData?.zone?.name || 'Unknown Sector'}
                 </div>
               </div>

               <div>
                 <div className="text-[8px] opacity-40 uppercase tracking-widest mb-2 flex justify-between">
                   <span>Local Points of Interest</span>
                   {hasMapAccess ? (
                     <span className="text-blue-400 font-bold">[ MAP UNLOCKED ]</span>
                   ) : (
                     <span className="text-pink-500 font-bold">[ NO MAP DATA ]</span>
                   )}
                 </div>
                 
                 <div className="space-y-1">
                   {hasMapAccess ? (
                     localPois.length > 0 ? (
                       localPois.map(poi => (
                         <button 
                           key={poi.slug}
                           onClick={() => dispatchCommand(`navigate ${poi.slug}`)}
                           className={`w-full text-left p-2 border transition-all text-[10px] group ${
                             poi.slug === roomData?.slug 
                             ? 'bg-blue-500/20 border-blue-500/50 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
                             : 'border-white/5 hover:border-blue-500/30 hover:bg-blue-500/5'
                           }`}
                         >
                           <div className="flex justify-between items-center">
                             <span className="font-bold tracking-wider">{poi.name}</span>
                             <span className="text-[8px] opacity-30 group-hover:opacity-100">{poi.poiCategory}</span>
                           </div>
                         </button>
                       ))
                     ) : (
                       <div className="text-[10px] italic opacity-30 p-2 text-center">No POIs in this sector.</div>
                     )
                   ) : (
                     <div className="text-[10px] italic opacity-30 p-4 border border-dashed border-white/10 text-center bg-white/[0.02]">
                       Connect to local grid to download district data.
                     </div>
                   )}
                 </div>
               </div>

               <div>
                 <div className="text-[8px] opacity-40 uppercase tracking-widest mb-2 flex justify-between">
                   <span>Room Occupants</span>
                   <span className="opacity-50">{roomOccupants.length}</span>
                 </div>
                 <div className="space-y-1">
                   {roomOccupants.length > 0 ? (
                     roomOccupants.map(occupant => (
                       <div
                         key={occupant.characterId}
                         className={`p-2 border text-[10px] uppercase tracking-wider ${
                           occupant.characterId === charData.id
                             ? 'border-[#00ff41]/30 bg-[#00ff41]/10 text-[#00ff41]'
                             : 'border-white/5 bg-white/[0.02] text-[#00ff41]/70'
                         }`}
                       >
                         {occupant.name}{occupant.characterId === charData.id ? ' [YOU]' : ''}
                       </div>
                     ))
                   ) : (
                     <div className="text-[10px] italic opacity-30 p-2 text-center">No visible occupants.</div>
                   )}
                 </div>
               </div>
             </>
           )}
        </div>

        <div className={`mt-auto pt-4 border-t ${charData.isJackedIn ? 'border-cyan-500/20' : 'border-[#00ff41]/20'}`}>
          <div className={`text-[8px] border px-2 py-1 text-center font-bold tracking-[0.2em] ${isConnected ? (charData.isJackedIn ? 'border-cyan-500/40 text-cyan-400' : 'border-[#00ff41]/40 text-[#00ff41]') : 'border-pink-500/40 text-pink-500'}`}>
            NETWORK: {isConnected ? (charData.isJackedIn ? 'ENCRYPTED LINK' : 'STABLE') : 'OFFLINE'}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`flex h-screen w-screen bg-[#020402] ${charData.isJackedIn ? 'text-cyan-400' : 'text-[#00ff41]'} font-mono crt overflow-hidden p-2 gap-2 transition-colors duration-1000`}>
      
      {/* Left Sidebar - Commlink & Navigation */}
      <div className="w-64 flex flex-col gap-2">
        <div className={`flex-1 neon-panel flex flex-col p-4 bg-grid ${charData.isJackedIn ? 'border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : ''}`}>
          <CornerAccents />
          <div className={`flex items-center gap-2 text-sm font-bold border-b ${charData.isJackedIn ? 'border-cyan-500/20' : 'border-[#00ff41]/20'} pb-2 mb-4`}>
            <MapIcon size={16} />
            <span className="tracking-widest uppercase">{charData.isJackedIn ? 'Cyberdeck' : 'Commlink'}</span>
          </div>
          {renderCommlink()}
        </div>

        <div className={`h-40 neon-panel p-4 flex flex-col justify-between ${charData.isJackedIn ? 'border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : ''}`}>
          <CornerAccents />
          <div className={`text-[10px] ${charData.isJackedIn ? 'text-cyan-400/50' : 'text-[#00ff41]/50'} uppercase tracking-widest`}>{charData.isJackedIn ? 'Access' : 'Exits'}</div>
          <div className="grid grid-cols-4 gap-2">
            {['N', 'S', 'E', 'W'].map(exit => (
              <button 
                key={exit} 
                onClick={() => dispatchCommand(exit.toLowerCase())}
                disabled={!roomData?.exits?.[exit.toLowerCase()]}
                className={`aspect-square flex items-center justify-center border text-xs transition-colors ${
                  roomData?.exits?.[exit.toLowerCase()] 
                    ? (charData.isJackedIn ? 'border-cyan-500/50 bg-cyan-500/10 hover:bg-cyan-500/30' : 'border-[#00ff41]/50 bg-[#00ff41]/10 hover:bg-[#00ff41]/30') 
                    : (charData.isJackedIn ? 'border-cyan-500/10 bg-transparent opacity-20 grayscale cursor-not-allowed' : 'border-[#00ff41]/10 bg-transparent opacity-20 grayscale cursor-not-allowed')
                }`}
              >
                {exit}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {['U', 'D'].map(exit => (
              <button 
                key={exit} 
                onClick={() => dispatchCommand(exit === 'U' ? 'up' : 'down')}
                disabled={!roomData?.exits?.[exit === 'U' ? 'up' : 'down']}
                className={`py-1 border text-[8px] transition-colors ${
                  roomData?.exits?.[exit === 'U' ? 'up' : 'down']
                    ? (charData.isJackedIn ? 'border-cyan-500/50 bg-cyan-500/10 hover:bg-cyan-500/30' : 'border-[#00ff41]/50 bg-[#00ff41]/10 hover:bg-[#00ff41]/30')
                    : (charData.isJackedIn ? 'border-cyan-500/10 bg-transparent opacity-20 grayscale cursor-not-allowed' : 'border-[#00ff41]/10 bg-transparent opacity-20 grayscale cursor-not-allowed')
                }`}
              >
                {exit === 'U' ? 'UP' : 'DOWN'}
              </button>
            ))}
          </div>
        </div>

        <div className={`h-72 neon-panel p-4 flex flex-col ${charData.isJackedIn ? 'border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : ''}`}>
          <CornerAccents />
          <CommandPicker
            key={charData.isJackedIn ? 'matrix' : 'physical'}
            commands={commands}
            hotkeys={hotkeys}
            argumentOptions={{
              direction: Object.keys(roomData?.exits ?? {}).map((direction) => ({
                value: direction,
                label: direction.toUpperCase(),
              })),
              poi: hasMapAccess
                ? localPois.map((poi) => ({ value: poi.slug, label: poi.name }))
                : [],
              ice: (matrixData?.activeIC ?? [])
                .filter((ice) => ice.currentHp > 0)
                .map((ice) => ({
                  value: ice.id,
                  label: `${ice.name ?? ice.slug ?? ice.type} (${ice.currentHp}/${ice.maxHp})`,
                })),
              hostile: combatTargets.hostiles.map((target) => ({
                value: target.id,
                label: `${target.name} (${target.currentHp}/${target.maxHp})`,
              })),
              ally: combatTargets.allies.map((target) => ({
                value: target.id,
                label: `${target.name} (${target.currentHp}/${target.maxHp})`,
              })),
              'injured-ally': combatTargets.allies
                .filter((target) => target.currentHp < target.maxHp)
                .map((target) => ({
                  value: target.id,
                  label: `${target.name} (${target.currentHp}/${target.maxHp})`,
                })),
              mission: missionTemplates.map((mission) => ({
                value: mission.slug,
                label: `${mission.name} (${mission.basePayout}¥)`,
              })),
              'shop-item': shopItems
                .filter((entry) => entry.stock === -1 || entry.stock > 0)
                .map((entry) => ({
                  value: entry.itemId,
                  label: entry.item.name + ' (' + entry.price + '¥)',
                })),
            }}
            argumentSuggestions={{
              occupant: roomOccupants
                .filter((occupant) => occupant.characterId !== charData.id)
                .map((occupant) => ({
                  value: occupant.selector,
                  label: occupant.name,
                })),
            }}
            isMatrixMode={charData.isJackedIn}
            onCommand={dispatchCommand}
            onArgumentSourceSelected={requestCommandArguments}
            onSaveHotkey={saveHotkey}
            onRemoveHotkey={removeHotkey}
            isSavingHotkey={isSavingHotkey}
          />
        </div>
      </div>

      {/* Center Column - Visuals & Terminal */}
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        {/* World View Panel */}
        <div className={`h-3/5 neon-panel overflow-hidden group transition-all duration-1000 ${charData.isJackedIn ? 'border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.3)]' : ''}`}>
          <CornerAccents />
          <div className={`absolute top-2 left-4 text-[10px] uppercase tracking-[0.2em] ${charData.isJackedIn ? 'text-cyan-400/60' : 'text-[#00ff41]/60'} z-10 flex justify-between w-[calc(100%-2rem)]`}>
            <span>{charData.isJackedIn ? 'NEURAL OVERLAY [V2.4]' : 'NEON REQUIEM [V1.0]'}</span>
            <span className="opacity-20 text-[8px] uppercase">{charData.name}@{charData.isJackedIn ? 'MATRIX' : 'NR-DECK'}</span>
          </div>
          <div className="w-full h-full bg-[#050505] flex items-center justify-center relative">
             <img 
               src="https://images.unsplash.com/photo-1614728263952-84ea256f9679?q=80&w=1000&auto=format&fit=crop" 
               alt="Sprawl View" 
               className={`w-full h-full object-cover opacity-40 transition-all duration-1000 ${charData.isJackedIn ? 'hue-rotate-[180deg] brightness-[1.2] saturate-[1.5]' : 'grayscale hover:grayscale-0'}`}
             />
             <div className={`absolute inset-0 bg-gradient-to-t ${charData.isJackedIn ? 'from-cyan-950/80' : 'from-[#020402]'} to-transparent opacity-60`} />
          </div>
        </div>

        {/* Terminal Panel */}
        <div className={`flex-1 neon-panel flex flex-col overflow-hidden bg-[#050505]/80 ${charData.isJackedIn ? 'border-cyan-500/50' : ''}`}>
          <CornerAccents />
          <div className={`px-4 py-2 border-b ${charData.isJackedIn ? 'border-cyan-500/10 bg-cyan-500/5' : 'border-[#00ff41]/10 bg-[#00ff41]/5'} flex justify-between items-center`}>
            <div className="flex items-center gap-2">
              <TerminalIcon size={14} className="opacity-60" />
              <span className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-80">{charData.isJackedIn ? 'Neural Feed' : 'Terminal Output'}</span>
            </div>
            <span className={`text-[8px] opacity-30 animate-pulse font-bold tracking-widest uppercase`}>{charData.isJackedIn ? 'Linking...' : 'Receiving Data...'}</span>
          </div>
          <div className="flex-1 relative">
            <Terminal ref={terminalRef} onInput={handleTerminalCommand} isMatrixMode={charData.isJackedIn} />
          </div>
        </div>
      </div>

      {/* Right Sidebar - Vitals & Character */}
      <div className="w-72 flex flex-col gap-2">
        <div className="flex-1 neon-panel p-4 flex flex-col gap-6 overflow-y-auto">
          <CornerAccents />
          <div className="flex items-center gap-2 text-sm font-bold border-b border-[#00ff41]/20 pb-2">
            <Activity size={16} />
            <span className="tracking-widest uppercase text-glow">Vitals</span>
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] tracking-widest text-[#00ff41]/80 font-bold">
              <span>BIO-INTEGRITY</span>
              <span>{charData.currentHp}/{charData.maxHp}</span>
            </div>
            <div className="w-full h-1.5 bg-[#00ff41]/10 border border-[#00ff41]/20 overflow-hidden">
              <div 
                className="h-full bg-[#00ff41] shadow-[0_0_10px_#00ff41] transition-all duration-500" 
                style={{ width: `${(charData.currentHp / charData.maxHp) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="space-y-1">
            <div className={`flex justify-between text-[10px] tracking-widest ${charData.isJackedIn ? 'text-cyan-400' : 'text-[#00ff41]/80'} font-bold`}>
              <span>NEURAL LOAD</span>
              <span>{charData.currentStun ?? 100}/{charData.maxStun ?? 100}</span>
            </div>
            <div className={`w-full h-1.5 bg-purple-900/20 border ${charData.isJackedIn ? 'border-cyan-500/30' : 'border-purple-500/20'} overflow-hidden`}>
              <div 
                className={`h-full ${charData.isJackedIn ? 'bg-cyan-400 shadow-[0_0_10px_#22d3ee]' : 'bg-purple-500 shadow-[0_0_10px_#a855f7]'} transition-all duration-500`} 
                style={{ width: `${((charData.currentStun ?? 100) / (charData.maxStun ?? 100)) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-[10px] tracking-widest text-[#00ff41]/80 font-bold">
              <span>ACTION POOL</span>
              <span>{currentAp}/{maxAp}</span>
            </div>
            <div className="flex gap-2">
              {Array.from({ length: maxAp }, (_, index) => index + 1).map(pip => (
                <div
                  key={pip}
                  className={`w-4 h-4 border ${pip <= currentAp
                    ? 'bg-orange-500 border-orange-400/50 shadow-[0_0_8px_rgba(249,115,22,0.4)]'
                    : 'bg-orange-950/20 border-orange-500/20'}`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-[#00ff41]/90">
            <Shield size={14} className="opacity-70" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold">Soak: {charData.armorValue}</span>
          </div>

          <div className="aspect-[4/5] w-full neon-panel overflow-hidden mt-2 bg-[#050505]">
            <CornerAccents />
            <img 
              src="https://images.unsplash.com/photo-1544642239-674ca60f4c3a?q=80&w=1000&auto=format&fit=crop" 
              alt="Portrait" 
              className="w-full h-full object-cover opacity-60 grayscale brightness-90 hover:grayscale-0 transition-all duration-700"
            />
          </div>
        </div>

        <div className="h-32 neon-panel p-4 flex flex-col justify-center gap-2">
          <CornerAccents />
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-[#00ff41]/50 tracking-widest uppercase">Persona</span>
            <span className="text-[#00ff41] font-bold tracking-[0.2em]">{charData.name.toUpperCase()} [LVL {charData.level}]</span>
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-[#00ff41]/50 tracking-widest uppercase">Alignment</span>
            <span className={`${charData.faction === 'shadow' ? 'text-pink-500' : 'text-blue-400'} font-bold tracking-widest uppercase`}>{charData.faction}</span>
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-[#00ff41]/50 tracking-widest uppercase">Archetype</span>
            <span className="text-[#00ff41]/80 tracking-widest uppercase font-bold">{charData.className.replace('-', ' ')}</span>
          </div>
          <button 
            onClick={onLogout}
            className="mt-2 text-[8px] text-pink-500/50 hover:text-pink-500 transition-colors uppercase font-bold tracking-[0.4em] flex items-center justify-center gap-2"
          >
            [ DISCONNECT ]
          </button>
        </div>
      </div>
    </div>
  );
};
