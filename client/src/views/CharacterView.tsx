import React, { useState, useEffect } from 'react';
import { UserPlus, LogOut, ChevronRight, ChevronLeft, Shield, Zap, Target, Brain, Heart, Star } from 'lucide-react';

interface Character {
  id: string;
  name: string;
  level: number;
  faction: string;
  className: string;
}

interface CharacterViewProps {
  token: string;
  onSelect: (char: Character) => void;
  onLogout: () => void;
}

// Expanded data for UI
const RACES = [
  { slug: 'human', name: 'Human', description: 'Balanced and versatile.' },
  { slug: 'surge', name: 'S.U.R.G.E.', description: 'Metagenic variation with high intuition.' },
  { slug: 'elf', name: 'Elf', description: 'Graceful and magically adept.' },
  { slug: 'dark-elf', name: 'Dark Elf', description: 'Strong-willed and resilient.' },
  { slug: 'dwarf', name: 'Dwarf', description: 'Hardy and tech-inclined.' },
  { slug: 'gnome', name: 'Gnome', description: 'Small, agile, and intellectually gifted.' },
  { slug: 'halfling', name: 'Halfling', description: 'Exceptional luck and agility.' },
  { slug: 'goblin', name: 'Goblin', description: 'Wiry and street-tough.' },
  { slug: 'ork', name: 'Ork', description: 'Physically powerful and enduring.' },
  { slug: 'oni', name: 'Oni', description: 'Imposing and strong-willed.' },
  { slug: 'troll', name: 'Troll', description: 'Massive and durable.' },
  { slug: 'minotaur', name: 'Minotaur', description: 'The peak of raw physical might.' },
];

const CLASSES = [
  { slug: 'street-samurai', name: 'Street Samurai', line: 'combat', desc: 'Frontline chrome-warrior.' },
  { slug: 'razorboy', name: 'Razorboy', line: 'combat', desc: 'Agile blade specialist.' },
  { slug: 'bounty-hunter', name: 'Bounty Hunter', line: 'combat', desc: 'Tracking and tactical takedowns.' },
  { slug: 'mercenary', name: 'Mercenary', line: 'combat', desc: 'Heavy weapons and demolition.' },
  { slug: 'face', name: 'Face', line: 'shadow', desc: 'Social engineering and negotiation.' },
  { slug: 'infiltrator', name: 'Infiltrator', line: 'shadow', desc: 'Stealth and security bypass.' },
  { slug: 'rigger', name: 'Rigger', line: 'shadow', desc: 'Drone operations and vehicle mastery.' },
  { slug: 'smuggler', name: 'Smuggler', line: 'shadow', desc: 'Logistics and illegal transport.' },
  { slug: 'decker', name: 'Decker', line: 'matrix', desc: 'Cyber-combat and network hacking.' },
  { slug: 'technomancer', name: 'Technomancer', line: 'matrix', desc: 'Organic resonance with the Matrix.' },
  { slug: 'mage-hermetic', name: 'Mage', line: 'awakened', desc: 'Scientific approach to sorcery.' },
  { slug: 'shaman', name: 'Shaman', line: 'awakened', desc: 'Spiritual connection to power.' },
  { slug: 'street-doc', name: 'Street Doc', line: 'awakened', desc: 'Medical support and surgical repairs.' },
  { slug: 'weapons-adept', name: 'Weapons Adept', line: 'awakened', desc: 'Magically enhanced physical combat.' },
];

const getSelectedClass = (className: string) => CLASSES.find(c => c.slug === className);

const UI_RACE_DATA: any = {
  human: { body: { floor: 1, cap: 6 }, agility: { floor: 1, cap: 6 }, dexterity: { floor: 1, cap: 6 }, strength: { floor: 1, cap: 6 }, logic: { floor: 1, cap: 6 }, intuition: { floor: 1, cap: 6 }, willpower: { floor: 1, cap: 6 }, charisma: { floor: 1, cap: 6 }, luck: { floor: 1, cap: 7 } },
  surge: { body: { floor: 1, cap: 5 }, agility: { floor: 2, cap: 7 }, dexterity: { floor: 2, cap: 7 }, strength: { floor: 1, cap: 5 }, logic: { floor: 1, cap: 6 }, intuition: { floor: 2, cap: 7 }, willpower: { floor: 1, cap: 6 }, charisma: { floor: 1, cap: 6 }, luck: { floor: 1, cap: 7 } },
  elf: { body: { floor: 2, cap: 5 }, agility: { floor: 3, cap: 7 }, dexterity: { floor: 2, cap: 7 }, strength: { floor: 1, cap: 6 }, logic: { floor: 2, cap: 7 }, intuition: { floor: 1, cap: 7 }, willpower: { floor: 1, cap: 6 }, charisma: { floor: 4, cap: 8 }, luck: { floor: 2, cap: 6 } },
  'dark-elf': { body: { floor: 2, cap: 6 }, agility: { floor: 1, cap: 7 }, dexterity: { floor: 2, cap: 7 }, strength: { floor: 3, cap: 7 }, logic: { floor: 1, cap: 7 }, intuition: { floor: 3, cap: 6 }, willpower: { floor: 2, cap: 7 }, charisma: { floor: 1, cap: 5 }, luck: { floor: 1, cap: 5 } },
  dwarf: { body: { floor: 3, cap: 8 }, agility: { floor: 2, cap: 5 }, dexterity: { floor: 3, cap: 7 }, strength: { floor: 3, cap: 7 }, logic: { floor: 1, cap: 6 }, intuition: { floor: 1, cap: 7 }, willpower: { floor: 2, cap: 7 }, charisma: { floor: 1, cap: 5 }, luck: { floor: 1, cap: 5 } },
  gnome: { body: { floor: 1, cap: 4 }, agility: { floor: 4, cap: 8 }, dexterity: { floor: 3, cap: 7 }, strength: { floor: 1, cap: 4 }, logic: { floor: 4, cap: 8 }, intuition: { floor: 3, cap: 8 }, willpower: { floor: 1, cap: 6 }, charisma: { floor: 1, cap: 7 }, luck: { floor: 1, cap: 6 } },
  halfling: { body: { floor: 1, cap: 5 }, agility: { floor: 2, cap: 7 }, dexterity: { floor: 3, cap: 7 }, strength: { floor: 1, cap: 4 }, logic: { floor: 1, cap: 6 }, intuition: { floor: 2, cap: 6 }, willpower: { floor: 1, cap: 6 }, charisma: { floor: 3, cap: 6 }, luck: { floor: 2, cap: 9 } },
  goblin: { body: { floor: 1, cap: 5 }, agility: { floor: 2, cap: 8 }, dexterity: { floor: 3, cap: 7 }, strength: { floor: 1, cap: 5 }, logic: { floor: 1, cap: 5 }, intuition: { floor: 3, cap: 7 }, willpower: { floor: 1, cap: 6 }, charisma: { floor: 1, cap: 5 }, luck: { floor: 1, cap: 6 } },
  ork: { body: { floor: 4, cap: 8 }, agility: { floor: 1, cap: 6 }, dexterity: { floor: 1, cap: 5 }, strength: { floor: 3, cap: 8 }, logic: { floor: 1, cap: 5 }, intuition: { floor: 1, cap: 5 }, willpower: { floor: 3, cap: 9 }, charisma: { floor: 1, cap: 5 }, luck: { floor: 1, cap: 5 } },
  oni: { body: { floor: 3, cap: 6 }, agility: { floor: 2, cap: 7 }, dexterity: { floor: 2, cap: 6 }, strength: { floor: 1, cap: 6 }, logic: { floor: 1, cap: 6 }, intuition: { floor: 2, cap: 6 }, willpower: { floor: 3, cap: 7 }, charisma: { floor: 1, cap: 4 }, luck: { floor: 1, cap: 6 } },
  troll: { body: { floor: 3, cap: 9 }, agility: { floor: 1, cap: 5 }, dexterity: { floor: 2, cap: 5 }, strength: { floor: 4, cap: 9 }, logic: { floor: 1, cap: 4 }, intuition: { floor: 1, cap: 4 }, willpower: { floor: 2, cap: 6 }, charisma: { floor: 1, cap: 5 }, luck: { floor: 1, cap: 5 } },
  minotaur: { body: { floor: 4, cap: 10 }, agility: { floor: 1, cap: 4 }, dexterity: { floor: 1, cap: 4 }, strength: { floor: 5, cap: 11 }, logic: { floor: 1, cap: 4 }, intuition: { floor: 1, cap: 4 }, willpower: { floor: 3, cap: 6 }, charisma: { floor: 1, cap: 3 }, luck: { floor: 1, cap: 5 } },
};

const calculateStatKarmaCost = (floor: number, current: number) => {
  let cost = 0;
  for (let i = floor + 1; i <= current; i++) {
    if (i <= 5) cost += 1;
    else if (i <= 9) cost += 2;
    else cost += 3;
  }
  return cost;
};

export const CharacterView: React.FC<CharacterViewProps> = ({ token, onSelect, onLogout }) => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'list' | 'create'>('list');

  // Creation State
  const [step, setStep] = useState(1);
  const [karma, setKarma] = useState(50);
  const [formData, setFormData] = useState({
    name: '',
    faction: 'shadow',
    race: 'human',
    className: 'street-samurai',
    streetDocPath: 'tech',
    mentorSpirit: 'bear',
    body: 1, agility: 1, dexterity: 1, strength: 1,
    logic: 1, intuition: 1, willpower: 1, charisma: 1,
    luck: 1
  });

  // Reset stats to floor when race changes
  useEffect(() => {
    const data = UI_RACE_DATA[formData.race];
    if (data) {
      setFormData(prev => ({
        ...prev,
        body: data.body.floor,
        agility: data.agility.floor,
        dexterity: data.dexterity.floor,
        strength: data.strength.floor,
        logic: data.logic.floor,
        intuition: data.intuition.floor,
        willpower: data.willpower.floor,
        charisma: data.charisma.floor,
        luck: data.luck.floor
      }));
      setKarma(50);
    }
  }, [formData.race]);

  // Derived stats for summary
  const derived = {
    hp: 50 + (formData.body * 10) + (formData.strength * 5),
    stun: 50 + (formData.willpower * 10) + (formData.logic * 5),
    mana: getSelectedClass(formData.className)?.line === 'awakened'
      ? 50 + (formData.willpower * 10) + (formData.charisma * 5)
      : 0,
    slots: 5 + formData.strength + Math.floor(formData.body / 2)
  };

  const handleStatChange = (stat: string, delta: number) => {
    const currentVal = (formData as any)[stat];
    const targetVal = currentVal + delta;
    const race = UI_RACE_DATA[formData.race];
    
    if (targetVal < race[stat].floor || targetVal > race[stat].cap) return;

    // Calculate cost difference
    const currentCost = calculateStatKarmaCost(race[stat].floor, currentVal);
    const targetCost = calculateStatKarmaCost(race[stat].floor, targetVal);
    const costDelta = targetCost - currentCost;

    if (karma >= costDelta) {
      setKarma(prev => prev - costDelta);
      setFormData(prev => ({ ...prev, [stat]: targetVal }));
    }
  };

  useEffect(() => {
    fetchCharacters();
  }, []);

  const fetchCharacters = async () => {
    try {
      const response = await fetch('http://localhost:3000/characters', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to load characters');
      const data = await response.json();
      setCharacters(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      setError('');

      if (formData.name.trim().length < 2) {
        setError('NAME MUST BE AT LEAST 2 CHARACTERS');
        return;
      }

      const selectedClass = getSelectedClass(formData.className);
      const payload: any = {
        name: formData.name.trim(),
        faction: formData.faction,
        race: formData.race,
        className: formData.className,
        body: formData.body,
        agility: formData.agility,
        dexterity: formData.dexterity,
        strength: formData.strength,
        logic: formData.logic,
        intuition: formData.intuition,
        willpower: formData.willpower,
        charisma: formData.charisma,
        luck: formData.luck,
      };

      if (formData.className === 'street-doc') {
        payload.streetDocPath = formData.streetDocPath;
      }

      if (selectedClass?.line === 'awakened') {
        payload.mentorSpirit = formData.mentorSpirit;
      }

      const response = await fetch('http://localhost:3000/characters', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Creation failed');
      
      onSelect(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const CornerAccents = () => (
    <>
      <div className="corner-accent corner-tl" />
      <div className="corner-accent corner-tr" />
      <div className="corner-accent corner-bl" />
      <div className="corner-accent corner-br" />
    </>
  );

  if (view === 'create') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#020402] text-[#00ff41] font-mono crt p-4">
        <div className="w-full max-w-4xl neon-panel bg-grid flex flex-col h-[700px]">
          <CornerAccents />
          
          <div className="p-6 border-b border-[#00ff41]/20 flex justify-between items-center bg-[#00ff41]/5">
            <div>
              <h2 className="text-xl font-bold tracking-[0.2em] text-glow uppercase">Persona Initialization</h2>
              <p className="text-[10px] opacity-50 uppercase tracking-widest mt-1">Step {step} of 3: {step === 1 ? 'Archetype' : step === 2 ? 'Neural Mapping' : 'Finalize'}</p>
            </div>
            <button onClick={() => setView('list')} className="text-[10px] hover:text-pink-500 transition-colors uppercase font-bold tracking-widest">[ ABORT ]</button>
          </div>

          <div className="flex-1 overflow-y-auto p-8">
            {step === 1 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Name */}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest opacity-60">Identity Designation</label>
                  <input 
                    type="text" 
                    className="w-full bg-[#050505] border border-[#00ff41]/30 p-4 text-lg focus:outline-none focus:border-[#00ff41] transition-colors"
                    placeholder="ENTER NAME..."
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-8">
                  {/* Faction */}
                  <div className="space-y-4">
                    <label className="text-xs uppercase tracking-widest opacity-60 text-glow">Faction Alignment</label>
                    <div className="flex gap-4">
                      {['shadow', 'corp'].map(f => (
                        <button 
                          key={f}
                          onClick={() => setFormData({...formData, faction: f as any})}
                          className={`flex-1 py-4 border text-xs font-bold tracking-widest transition-all ${
                            formData.faction === f 
                              ? (f === 'shadow' ? 'bg-pink-500/20 border-pink-500 text-pink-500' : 'bg-blue-500/20 border-blue-500 text-blue-500')
                              : 'border-[#00ff41]/20 opacity-40 hover:opacity-100 hover:border-[#00ff41]'
                          }`}
                        >
                          {f.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] opacity-40 italic">
                      {formData.faction === 'shadow' 
                        ? 'Born in the sprawls. No official record. Total freedom, no protection.' 
                        : 'Corporate-born. Valid SIN. Safety of the system, but you left it behind.'}
                    </p>
                  </div>

                  {/* Race */}
                  <div className="space-y-4">
                    <label className="text-xs uppercase tracking-widest opacity-60">Genetic Template</label>
                    <select 
                      className="w-full bg-[#050505] border border-[#00ff41]/30 p-3 text-sm focus:outline-none"
                      value={formData.race}
                      onChange={(e) => setFormData({...formData, race: e.target.value})}
                    >
                      {RACES.map(r => <option key={r.slug} value={r.slug}>{r.name}</option>)}
                    </select>
                    <p className="text-[10px] opacity-40 italic">{RACES.find(r => r.slug === formData.race)?.description}</p>
                  </div>
                </div>

                {/* Class */}
                <div className="space-y-4">
                  <label className="text-xs uppercase tracking-widest opacity-60">Neural Specialization</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {CLASSES.map(c => (
                      <button 
                        key={c.slug}
                        onClick={() => setFormData({...formData, className: c.slug as any})}
                        className={`p-3 border text-[9px] font-bold tracking-widest transition-all text-center ${
                          formData.className === c.slug 
                            ? 'bg-[#00ff41]/20 border-[#00ff41] text-[#00ff41]'
                            : 'border-[#00ff41]/10 opacity-50 hover:opacity-100 hover:border-[#00ff41]/40'
                        }`}
                      >
                        {c.name.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] opacity-40 italic text-center">{CLASSES.find(c => c.slug === formData.className)?.desc}</p>
                </div>

                {/* Street Doc Path / Mentor Spirits */}
                <div className="grid grid-cols-2 gap-8">
                  {formData.className === 'street-doc' && (
                    <div className="space-y-4">
                      <label className="text-xs uppercase tracking-widest opacity-60">Medical Directive</label>
                      <select 
                        className="w-full bg-[#050505] border border-[#00ff41]/30 p-3 text-sm focus:outline-none"
                        value={formData.streetDocPath}
                        onChange={(e) => setFormData({...formData, streetDocPath: e.target.value})}
                      >
                        <option value="tech">TECH-BASED (Mundane)</option>
                        <option value="magic">MAGIC-BASED (Awakened)</option>
                      </select>
                    </div>
                  )}

                  {getSelectedClass(formData.className)?.line === 'awakened' && (
                    <div className="space-y-4">
                      <label className="text-xs uppercase tracking-widest opacity-60">Mentor Spirit</label>
                      <select 
                        className="w-full bg-[#050505] border border-[#00ff41]/30 p-3 text-sm focus:outline-none"
                        value={formData.mentorSpirit}
                        onChange={(e) => setFormData({...formData, mentorSpirit: e.target.value})}
                      >
                        {['bear', 'gator', 'cat', 'eagle', 'wolf', 'rat', 'valkyrie', 'chaos'].map(s => (
                          <option key={s} value={s}>{s.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex justify-between items-center bg-[#00ff41]/10 p-4 border border-[#00ff41]/30">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-[0.3em] font-bold">Allocatable Karma</span>
                    <span className="text-2xl font-bold text-glow">{karma}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-right">
                    <div>
                      <div className="text-[8px] opacity-40 uppercase">Max HP</div>
                      <div className="text-xs font-bold">{derived.hp}</div>
                    </div>
                    <div>
                      <div className="text-[8px] opacity-40 uppercase">Max Stun</div>
                      <div className="text-xs font-bold">{derived.stun}</div>
                    </div>
                    <div>
                      <div className="text-[8px] opacity-40 uppercase">Max Mana</div>
                      <div className="text-xs font-bold">{derived.mana}</div>
                    </div>
                    <div>
                      <div className="text-[8px] opacity-40 uppercase">Slots</div>
                      <div className="text-xs font-bold">{derived.slots}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {Object.entries({
                    body: <Heart size={14}/>, agility: <Target size={14}/>, dexterity: <Zap size={14}/>,
                    strength: <Shield size={14}/>, logic: <Brain size={14}/>, intuition: <Star size={14}/>,
                    willpower: <Shield size={14}/>, charisma: <UserPlus size={14}/>, luck: <Star size={14}/>
                  }).map(([stat, icon]) => {
                    const race = UI_RACE_DATA[formData.race];
                    const val = (formData as any)[stat];
                    return (
                      <div key={stat} className="neon-panel p-4 bg-[#050505]">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-[10px] uppercase tracking-widest opacity-60 flex items-center gap-2">{icon} {stat}</span>
                          <span className="text-lg font-bold">{val}</span>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            disabled={val <= race[stat].floor}
                            onClick={() => handleStatChange(stat, -1)}
                            className="flex-1 border border-[#00ff41]/30 hover:bg-[#00ff41]/20 p-1 text-xs disabled:opacity-20"
                          >-</button>
                          <button 
                            disabled={val >= race[stat].cap}
                            onClick={() => handleStatChange(stat, 1)}
                            className="flex-1 border border-[#00ff41]/30 hover:bg-[#00ff41]/20 p-1 text-xs disabled:opacity-20"
                          >+</button>
                        </div>
                        <div className="mt-2 text-[8px] opacity-30 uppercase tracking-widest text-center">
                          Limit: {race[stat].floor}-{race[stat].cap}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-8 animate-in fade-in zoom-in duration-500 text-center py-8">
                <div className="text-glow text-3xl font-bold tracking-[0.5em] mb-12 uppercase">{formData.name}</div>
                
                <div className="grid grid-cols-2 gap-12 max-w-2xl mx-auto">
                  <div className="space-y-6 text-left">
                    <h3 className="text-xs font-bold border-b border-[#00ff41]/20 pb-2 uppercase tracking-widest">Metadata</h3>
                    <div className="flex justify-between text-sm">
                      <span className="opacity-40 uppercase">Faction</span>
                      <span className={formData.faction === 'shadow' ? 'text-pink-500 font-bold' : 'text-blue-400 font-bold'}>{formData.faction.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="opacity-40 uppercase">Race</span>
                      <span className="font-bold">{formData.race.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="opacity-40 uppercase">Class</span>
                      <span className="font-bold">{formData.className.toUpperCase()}</span>
                    </div>
                    {formData.className === 'street-doc' && (
                       <div className="flex justify-between text-sm">
                         <span className="opacity-40 uppercase">Directive</span>
                         <span className="font-bold">{formData.streetDocPath.toUpperCase()}</span>
                       </div>
                    )}
                  </div>

                  <div className="space-y-6 text-left">
                    <h3 className="text-xs font-bold border-b border-[#00ff41]/20 pb-2 uppercase tracking-widest">Neural Thresholds</h3>
                    <div className="flex justify-between text-sm">
                      <span className="opacity-40 uppercase">Bio-Integrity</span>
                      <span className="text-[#00ff41] font-bold">{derived.hp}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="opacity-40 uppercase">Neural Load</span>
                      <span className="text-purple-400 font-bold">{derived.stun}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="opacity-40 uppercase">Mana Index</span>
                      <span className="text-blue-400 font-bold">{derived.mana}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="opacity-40 uppercase">Inventory Capacity</span>
                      <span className="font-bold">{derived.slots} SLOTS</span>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] opacity-50 max-w-md mx-auto mt-12 leading-relaxed uppercase tracking-widest">
                  Caution: Persona initialization is permanent. Confirm all neural mapping parameters before finalizing link.
                </p>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-[#00ff41]/20 flex justify-between bg-[#00ff41]/5">
            <button 
              onClick={() => step > 1 ? setStep(step - 1) : setView('list')}
              className="px-6 py-3 border border-[#00ff41]/30 text-xs font-bold tracking-widest flex items-center gap-2 hover:bg-[#00ff41]/10"
            >
              <ChevronLeft size={16} /> BACK
            </button>
            <button 
              onClick={() => step < 3 ? setStep(step + 1) : handleCreate()}
              className="px-8 py-3 bg-[#00ff41] text-[#020402] text-xs font-bold tracking-[0.3em] flex items-center gap-2 shadow-[0_0_15px_#00ff41] hover:brightness-110"
            >
              {step === 3 ? 'FINALIZE PERSONA' : 'CONTINUE'} <ChevronRight size={16} />
            </button>
          </div>

          {error && (
            <div className="px-6 py-2 bg-pink-500/10 border-t border-pink-500/30 text-pink-500 text-[10px] uppercase text-center font-bold">
              SYSTEM ERROR: {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#020402] text-[#00ff41] font-mono crt p-4">
      <div className="w-full max-w-4xl neon-panel bg-grid flex flex-col h-[600px]">
        <CornerAccents />
        
        <div className="p-6 border-b border-[#00ff41]/20 flex justify-between items-center bg-[#00ff41]/5">
          <div>
            <h2 className="text-xl font-bold tracking-[0.2em] text-glow uppercase">Neural Signatures</h2>
            <p className="text-[10px] opacity-50 uppercase tracking-widest mt-1">Select an active persona or initialize new</p>
          </div>
          <button 
            onClick={onLogout}
            className="flex items-center gap-2 text-[10px] hover:text-pink-500 transition-colors tracking-widest uppercase font-bold"
          >
            [ TERMINATE SESSION ] <LogOut size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-full italic opacity-50 tracking-widest animate-pulse">
              SCANNING DATABASE...
            </div>
          ) : characters.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 border border-dashed border-[#00ff41]/20 rounded p-8">
              <span className="italic opacity-50 text-sm tracking-widest">No active personas found.</span>
              <button 
                onClick={() => setView('create')}
                className="flex items-center gap-2 border border-[#00ff41] bg-[#00ff41]/10 px-8 py-4 text-xs font-bold tracking-[0.3em] hover:bg-[#00ff41]/30 transition-all shadow-[0_0_10px_rgba(0,255,65,0.2)]"
              >
                <UserPlus size={16} /> INITIALIZE FIRST PERSONA
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {characters.map(char => (
                <button 
                  key={char.id}
                  onClick={() => onSelect(char)}
                  className="group relative neon-panel p-4 bg-[#050505] text-left hover:bg-[#00ff41]/10 transition-all border-[#00ff41]/20 hover:border-[#00ff41] active:translate-y-0.5"
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-xl font-bold tracking-[0.2em] group-hover:text-glow">{char.name.toUpperCase()}</span>
                    <span className="text-[10px] border border-[#00ff41]/40 px-2 py-0.5 rounded tracking-widest font-bold">LVL {char.level}</span>
                  </div>
                  <div className="space-y-2 text-[10px] opacity-70 uppercase tracking-[0.2em]">
                    <div className="flex justify-between border-b border-[#00ff41]/10 pb-1">
                      <span>Faction</span>
                      <span className={char.faction === 'shadow' ? 'text-pink-500 font-bold' : 'text-blue-400 font-bold'}>{char.faction}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Archetype</span>
                      <span className="text-[#00ff41]/90">{char.className.replace('-', ' ')}</span>
                    </div>
                  </div>
                  <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                    <ChevronRight size={24} />
                  </div>
                </button>
              ))}
              
              <button 
                onClick={() => setView('create')}
                className="neon-panel p-4 bg-transparent border-dashed border-[#00ff41]/30 flex flex-col items-center justify-center gap-3 hover:bg-[#00ff41]/5 hover:border-[#00ff41]/60 transition-all group min-h-[120px]"
              >
                <UserPlus size={24} className="opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold tracking-[0.4em] opacity-40 group-hover:opacity-100">INITIALIZE NEW PERSONA</span>
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="px-6 py-2 bg-pink-500/10 border-t border-pink-500/30 text-pink-500 text-[10px] uppercase text-center font-bold tracking-widest">
            SCAN ERROR: {error}
          </div>
        )}
      </div>
    </div>
  );
};
