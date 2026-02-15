import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { 
  Encounter, 
  EncounterParticipantWithDetails,
  Character,
  ParticipantType 
} from '../types/encounter';
import type { NPC } from '../types/npc';
import type { CharacterAbility } from '../types/inventory';

// Extended participant with abilities
interface ParticipantWithAbilities extends EncounterParticipantWithDetails {
  abilities?: CharacterAbility[];
  npcAbilities?: { name: string; damage?: string | null; effect: string }[];
}

export default function DMEncounterManager() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(null);
  const [participants, setParticipants] = useState<ParticipantWithAbilities[]>([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  
  // HP change tracking
  const [hpChangeInputs, setHpChangeInputs] = useState<Record<string, string>>({});
  
  // Notes tracking with debounce
  const [notesInputs, setNotesInputs] = useState<Record<string, string>>({});
  const notesDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  
  // Available characters and NPCs for adding
  const [availableCharacters, setAvailableCharacters] = useState<Character[]>([]);
  const [availableNPCs, setAvailableNPCs] = useState<NPC[]>([]);
  
  // UI state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false);
  const [showInitiativeModal, setShowInitiativeModal] = useState(false);
  const [newEncounterName, setNewEncounterName] = useState('');
  const [newEncounterDescription, setNewEncounterDescription] = useState('');

  useEffect(() => {
    fetchEncounters();
    fetchAvailableParticipants();
  }, []);

  useEffect(() => {
    if (selectedEncounter) {
      fetchParticipants(selectedEncounter.id);
    }
  }, [selectedEncounter]);

  // Auto-select the current turn participant when encounter changes
  useEffect(() => {
    if (selectedEncounter?.status === 'active' && participants.length > 0) {
      const currentTurnParticipant = participants.find(
        p => p.initiative_order === selectedEncounter.current_turn
      );
      if (currentTurnParticipant && !selectedParticipantId) {
        setSelectedParticipantId(currentTurnParticipant.id);
      }
    }
  }, [selectedEncounter, participants]);

  const fetchEncounters = async () => {
    try {
      const { data, error } = await supabase
        .from('encounters')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEncounters(data || []);
    } catch (err: any) {
      console.error('Error fetching encounters:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableParticipants = async () => {
    try {
      const { data: chars, error: charError } = await supabase
        .from('characters')
        .select('id, user_id, name, class, level, current_hp, max_hp, ac, initiative_modifier, str, dex, con, wis, int, cha')
        .order('name');

      if (charError) throw charError;
      setAvailableCharacters(chars || []);

      const { data: npcs, error: npcError } = await supabase
        .from('npcs')
        .select('*')
        .eq('is_active', true)
        .eq('is_alive', true)
        .order('name');

      if (npcError) throw npcError;
      setAvailableNPCs(npcs || []);
    } catch (err: any) {
      console.error('Error fetching participants:', err);
    }
  };

  const fetchParticipants = async (encounterId: string) => {
    try {
      // Fetch participants
      const { data: participantsData, error: participantsError } = await supabase
        .from('encounter_participants')
        .select('*')
        .eq('encounter_id', encounterId)
        .order('initiative_order', { ascending: true, nullsFirst: false });

      if (participantsError) throw participantsError;

      // Fetch characters
      const characterIds = participantsData
        ?.filter(p => p.character_id)
        .map(p => p.character_id) || [];
      
      const { data: charactersData } = characterIds.length > 0
        ? await supabase
            .from('characters')
            .select('id, user_id, name, class, level, current_hp, max_hp, ac, initiative_modifier, str, dex, con, wis, int, cha')
            .in('id', characterIds)
        : { data: [] };

      // Fetch character abilities for all characters in the encounter
      const { data: abilitiesData } = characterIds.length > 0
        ? await supabase
            .from('character_abilities')
            .select(`
              *,
              ability:abilities(*)
            `)
            .in('character_id', characterIds)
        : { data: [] };

      // Group abilities by character_id
      const abilitiesByCharacter: Record<string, CharacterAbility[]> = {};
      (abilitiesData || []).forEach((ca: any) => {
        if (!abilitiesByCharacter[ca.character_id]) {
          abilitiesByCharacter[ca.character_id] = [];
        }
        abilitiesByCharacter[ca.character_id].push(ca);
      });

      // Fetch NPCs
      const npcIds = participantsData
        ?.filter(p => p.npc_id)
        .map(p => p.npc_id) || [];
      
      const { data: npcsData } = npcIds.length > 0
        ? await supabase.from('npcs').select('*').in('id', npcIds)
        : { data: [] };

      // Combine data
      const transformed: ParticipantWithAbilities[] = (participantsData || []).map((p: any) => {
        const char = charactersData?.find(c => c.id === p.character_id) || null;
        const npc = npcsData?.find(n => n.id === p.npc_id) || null;

        return {
          ...p,
          character: char || undefined,
          npc: npc || undefined,
          display_name: char?.name || npc?.name || 'Unknown',
          display_hp: p.current_hp ?? (char?.current_hp || npc?.current_hp || 0),
          display_max_hp: p.max_hp ?? (char?.max_hp || npc?.max_hp || 0),
          display_ac: char?.ac || npc?.ac || 10,
          display_initiative_modifier: char?.initiative_modifier || npc?.initiative_modifier || 0,
          abilities: char ? (abilitiesByCharacter[char.id] || []) : undefined,
          npcAbilities: npc?.abilities || undefined,
        };
      });

      setParticipants(transformed);
      
      // Initialize notes inputs
      const notesMap: Record<string, string> = {};
      transformed.forEach(p => {
        notesMap[p.id] = p.notes || '';
      });
      setNotesInputs(notesMap);
    } catch (err: any) {
      console.error('Error fetching participants:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const createEncounter = async () => {
    if (!newEncounterName.trim()) {
      alert('Please enter an encounter name');
      return;
    }

    try {
      const { data: profile } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('encounters')
        .insert({
          name: newEncounterName,
          description: newEncounterDescription || null,
          status: 'draft',
          created_by: profile.user?.id
        })
        .select()
        .single();

      if (error) throw error;

      setEncounters([data, ...encounters]);
      setSelectedEncounter(data);
      setShowCreateModal(false);
      setNewEncounterName('');
      setNewEncounterDescription('');
    } catch (err: any) {
      console.error('Error creating encounter:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const addParticipant = async (
    type: 'character' | 'npc',
    id: string,
    participantType: ParticipantType
  ) => {
    if (!selectedEncounter) return;

    try {
      let currentHp, maxHp;
      
      if (type === 'character') {
        const char = availableCharacters.find(c => c.id === id);
        if (!char) return;
        currentHp = char.current_hp;
        maxHp = char.max_hp;
      } else {
        const npc = availableNPCs.find(n => n.id === id);
        if (!npc) return;
        currentHp = npc.current_hp;
        maxHp = npc.max_hp;
      }

      const { error } = await supabase
        .from('encounter_participants')
        .insert({
          encounter_id: selectedEncounter.id,
          character_id: type === 'character' ? id : null,
          npc_id: type === 'npc' ? id : null,
          participant_type: participantType,
          current_hp: currentHp,
          max_hp: maxHp,
          is_active: true
        });

      if (error) throw error;

      await fetchParticipants(selectedEncounter.id);
    } catch (err: any) {
      console.error('Error adding participant:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const removeParticipant = async (participantId: string) => {
    if (!confirm('Remove this participant from the encounter?')) return;

    try {
      const { error } = await supabase
        .from('encounter_participants')
        .delete()
        .eq('id', participantId);

      if (error) throw error;

      setParticipants(participants.filter(p => p.id !== participantId));
      if (selectedParticipantId === participantId) {
        setSelectedParticipantId(null);
      }
    } catch (err: any) {
      console.error('Error removing participant:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const setInitiative = async (participantId: string, roll: number) => {
    try {
      const { error } = await supabase
        .from('encounter_participants')
        .update({ initiative_roll: roll })
        .eq('id', participantId);

      if (error) throw error;

      if (selectedEncounter) {
        await fetchParticipants(selectedEncounter.id);
      }
    } catch (err: any) {
      console.error('Error setting initiative:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const startEncounter = async () => {
    if (!selectedEncounter) return;

    const missingInit = participants.filter(p => p.initiative_roll === null);
    if (missingInit.length > 0) {
      alert(`${missingInit.length} participant(s) don't have initiative rolls yet!`);
      return;
    }

    if (!confirm('Start this encounter? This will make it visible to players.')) return;

    try {
      const { error } = await supabase.rpc('start_encounter', {
        encounter_uuid: selectedEncounter.id
      });

      if (error) throw error;

      const updated = { ...selectedEncounter, status: 'active' as const, started_at: new Date().toISOString(), current_turn: 1, round_number: 1 };
      setSelectedEncounter(updated);
      setEncounters(encounters.map(e => e.id === updated.id ? updated : e));
    } catch (err: any) {
      console.error('Error starting encounter:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const advanceTurn = async () => {
    if (!selectedEncounter) return;

    try {
      const { error } = await supabase.rpc('advance_turn', {
        encounter_uuid: selectedEncounter.id
      });

      if (error) throw error;

      const { data } = await supabase
        .from('encounters')
        .select('*')
        .eq('id', selectedEncounter.id)
        .single();

      if (data) {
        setSelectedEncounter(data);
        setEncounters(encounters.map(e => e.id === data.id ? data : e));
        
        // Auto-select the new current turn participant
        const currentTurnParticipant = participants.find(
          p => p.initiative_order === data.current_turn
        );
        if (currentTurnParticipant) {
          setSelectedParticipantId(currentTurnParticipant.id);
        }
      }
    } catch (err: any) {
      console.error('Error advancing turn:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const updateParticipantHP = async (participantId: string, newHp: number, entityId?: string, entityType?: 'player' | 'npc') => {
    try {
      const clampedHp = Math.max(0, newHp);
      
      const { error } = await supabase
        .from('encounter_participants')
        .update({ current_hp: clampedHp })
        .eq('id', participantId);

      if (error) throw error;

      // Also sync to actual character/NPC record
      if (entityId && entityType === 'player') {
        await supabase.from('characters').update({ current_hp: clampedHp }).eq('id', entityId);
      } else if (entityId && entityType === 'npc') {
        await supabase.from('npcs').update({ current_hp: clampedHp }).eq('id', entityId);
      }

      setParticipants(participants.map(p => 
        p.id === participantId ? { ...p, current_hp: clampedHp, display_hp: clampedHp } : p
      ));
      
      // Clear HP change input
      setHpChangeInputs(prev => ({ ...prev, [participantId]: '' }));
    } catch (err: any) {
      console.error('Error updating HP:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const applyHpChange = (participant: ParticipantWithAbilities, change: number) => {
    const newHp = Math.max(0, Math.min(participant.display_max_hp, participant.display_hp + change));
    const entityId = participant.character_id || participant.npc_id || undefined;
    const entityType = participant.character_id ? 'player' as const : 'npc' as const;
    updateParticipantHP(participant.id, newHp, entityId, entityType);
  };

  const updateParticipantNotes = async (participantId: string, notes: string) => {
    try {
      await supabase.from('encounter_participants').update({ notes }).eq('id', participantId);
      setParticipants(prev => prev.map(p => p.id === participantId ? { ...p, notes } : p));
    } catch (err: any) {
      console.error('Error updating notes:', err);
    }
  };

  const handleNotesChange = (participantId: string, value: string) => {
    setNotesInputs(prev => ({ ...prev, [participantId]: value }));
    
    if (notesDebounceRef.current[participantId]) {
      clearTimeout(notesDebounceRef.current[participantId]);
    }
    
    notesDebounceRef.current[participantId] = setTimeout(() => {
      updateParticipantNotes(participantId, value);
    }, 500);
  };

  const useAbilityCharge = async (characterAbilityId: string, abilityName: string, currentCharges: number) => {
    if (currentCharges <= 0) {
      alert('No charges remaining!');
      return;
    }
    
    if (!confirm(`Use one charge of ${abilityName}? (${currentCharges - 1} charges will remain)`)) return;
    
    try {
      await supabase
        .from('character_abilities')
        .update({ current_charges: currentCharges - 1 })
        .eq('id', characterAbilityId);
      
      // Update local state
      setParticipants(prev => prev.map(p => ({
        ...p,
        abilities: p.abilities?.map(ca => 
          ca.id === characterAbilityId ? { ...ca, current_charges: currentCharges - 1 } : ca
        )
      })));
    } catch (err: any) {
      console.error('Error using ability charge:', err);
      alert('Failed to use ability: ' + err.message);
    }
  };

  const completeEncounter = async () => {
    if (!selectedEncounter) return;
    if (!confirm('Mark this encounter as completed?')) return;

    try {
      const { error } = await supabase
        .from('encounters')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', selectedEncounter.id);

      if (error) throw error;

      const updated = { ...selectedEncounter, status: 'completed' as const, completed_at: new Date().toISOString() };
      setSelectedEncounter(updated);
      setEncounters(encounters.map(e => e.id === updated.id ? updated : e));
    } catch (err: any) {
      console.error('Error completing encounter:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const deleteEncounter = async (encounterId: string) => {
    if (!confirm('Delete this encounter? This cannot be undone!')) return;

    try {
      const { error } = await supabase
        .from('encounters')
        .delete()
        .eq('id', encounterId);

      if (error) throw error;

      setEncounters(encounters.filter(e => e.id !== encounterId));
      if (selectedEncounter?.id === encounterId) {
        setSelectedEncounter(null);
        setParticipants([]);
        setSelectedParticipantId(null);
      }
    } catch (err: any) {
      console.error('Error deleting encounter:', err);
      alert(`Error: ${err.message}`);
    }
  };

  // Get HP bar color based on percentage
  const getHpColor = (current: number, max: number) => {
    const pct = max > 0 ? current / max : 0;
    if (pct > 0.6) return 'var(--color-cyber-green)';
    if (pct > 0.3) return 'var(--color-cyber-yellow, #facc15)';
    return 'var(--color-cyber-pink)';
  };

  const selectedParticipant = participants.find(p => p.id === selectedParticipantId) || null;

  if (loading) {
    return (
      <div className="min-h-screen p-8" style={{ backgroundColor: 'var(--color-cyber-darker)' }}>
        <div className="text-center" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
          Loading encounters...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-cyber-darker)' }}>
      {/* Top Header Bar */}
      <div className="p-4 flex items-center gap-4 border-b" style={{ borderColor: 'color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)' }}>
        <button
          onClick={() => navigate('/dm')}
          className="neon-button text-sm px-3 py-1"
          style={{ borderColor: 'var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
        >
          ← BACK
        </button>
        
        <h1 className="text-2xl" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-pink)' }}>
          ⚔️ ENCOUNTER MANAGER
        </h1>

        <div className="flex-1" />

        {/* Encounter Selector */}
        <div className="flex items-center gap-2">
          <select
            value={selectedEncounter?.id || ''}
            onChange={(e) => {
              const enc = encounters.find(en => en.id === e.target.value);
              setSelectedEncounter(enc || null);
              setSelectedParticipantId(null);
              if (!enc) setParticipants([]);
            }}
            className="p-2 rounded bg-gray-900 border text-sm min-w-[200px]"
            style={{ borderColor: 'var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}
          >
            <option value="">-- Select Encounter --</option>
            {encounters.map(enc => (
              <option key={enc.id} value={enc.id}>
                {enc.name} [{enc.status.toUpperCase()}]
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowCreateModal(true)}
            className="neon-button text-sm px-3 py-2"
            style={{ borderColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-green)' }}
          >
            + NEW
          </button>

          {selectedEncounter && (
            <button
              onClick={() => deleteEncounter(selectedEncounter.id)}
              className="neon-button text-sm px-3 py-2"
              style={{ borderColor: 'var(--color-cyber-pink)', color: 'var(--color-cyber-pink)' }}
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {/* Encounter Status Bar */}
      {selectedEncounter && (
        <div className="px-4 py-2 flex items-center gap-4 flex-wrap border-b" style={{ borderColor: 'color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' }}>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>STATUS:</span>
            <span className="text-sm font-bold px-2 py-0.5 rounded" style={{ 
              color: selectedEncounter.status === 'active' ? 'var(--color-cyber-green)' : 
                     selectedEncounter.status === 'completed' ? 'var(--color-cyber-purple)' : 'var(--color-cyber-cyan)',
              border: `1px solid ${selectedEncounter.status === 'active' ? 'var(--color-cyber-green)' : 
                     selectedEncounter.status === 'completed' ? 'var(--color-cyber-purple)' : 'var(--color-cyber-cyan)'}`,
              fontFamily: 'var(--font-mono)' 
            }}>
              {selectedEncounter.status.toUpperCase()}
            </span>
          </div>

          {selectedEncounter.status === 'active' && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>ROUND:</span>
                <span className="text-lg font-bold" style={{ color: 'var(--color-cyber-pink)', fontFamily: 'var(--font-cyber)' }}>
                  {selectedEncounter.round_number}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>TURN:</span>
                <span className="text-lg font-bold" style={{ color: 'var(--color-cyber-pink)', fontFamily: 'var(--font-cyber)' }}>
                  {selectedEncounter.current_turn} / {participants.length}
                </span>
              </div>
            </>
          )}

          {selectedEncounter.description && (
            <div className="text-xs truncate max-w-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>
              {selectedEncounter.description}
            </div>
          )}

          <div className="flex-1" />

          {/* Action Buttons */}
          {selectedEncounter.status === 'draft' && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddParticipantModal(true)}
                className="neon-button text-xs px-3 py-1"
                style={{ borderColor: 'var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
              >
                + ADD PARTICIPANT
              </button>
              <button
                onClick={() => setShowInitiativeModal(true)}
                className="neon-button text-xs px-3 py-1"
                style={{ borderColor: 'var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}
                disabled={participants.length === 0}
              >
                🎲 SET INITIATIVE
              </button>
              <button
                onClick={startEncounter}
                className="neon-button text-xs px-3 py-1"
                style={{ borderColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-green)' }}
                disabled={participants.length === 0}
              >
                ▶ START
              </button>
            </div>
          )}

          {selectedEncounter.status === 'active' && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddParticipantModal(true)}
                className="neon-button text-xs px-3 py-1"
                style={{ borderColor: 'var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
              >
                + ADD
              </button>
              <button
                onClick={advanceTurn}
                className="neon-button text-xs px-3 py-1"
                style={{ borderColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-green)' }}
              >
                ⏩ NEXT TURN
              </button>
              <button
                onClick={completeEncounter}
                className="neon-button text-xs px-3 py-1"
                style={{ borderColor: 'var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}
              >
                ✓ COMPLETE
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Content: Initiative Sidebar + Detail Panel */}
      {selectedEncounter ? (
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT: Initiative Order (1/3 width) */}
          <div className="w-1/3 border-r overflow-y-auto p-4" style={{ borderColor: 'color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                INITIATIVE ORDER
              </h2>
              <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                {participants.length} combatants
              </span>
            </div>

            {participants.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                  No participants yet.
                </p>
                {selectedEncounter.status === 'draft' && (
                  <button
                    onClick={() => setShowAddParticipantModal(true)}
                    className="neon-button text-sm mt-3 px-4 py-2"
                    style={{ borderColor: 'var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                  >
                    + Add Participants
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {participants.map((p) => {
                  const isCurrentTurn = selectedEncounter.status === 'active' && 
                    p.initiative_order === selectedEncounter.current_turn;
                  const isSelected = p.id === selectedParticipantId;
                  const hpPct = p.display_max_hp > 0 ? (p.display_hp / p.display_max_hp) * 100 : 0;
                  const isDead = p.display_hp <= 0;

                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedParticipantId(p.id)}
                      className="rounded cursor-pointer transition-all relative overflow-hidden"
                      style={{
                        backgroundColor: isCurrentTurn 
                          ? 'color-mix(in srgb, var(--color-cyber-green) 15%, transparent)' 
                          : isSelected 
                            ? 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)' 
                            : 'transparent',
                        border: `1px solid ${
                          isCurrentTurn ? 'var(--color-cyber-green)' :
                          isSelected ? 'var(--color-cyber-cyan)' :
                          'color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)'
                        }`,
                        opacity: isDead ? 0.4 : 1,
                      }}
                    >
                      {/* Current turn indicator */}
                      {isCurrentTurn && (
                        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: 'var(--color-cyber-green)' }} />
                      )}

                      <div className="p-2 pl-3">
                        <div className="flex items-center gap-2">
                          {/* Initiative number */}
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" 
                            style={{ 
                              backgroundColor: isCurrentTurn ? 'var(--color-cyber-green)' : 'color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)',
                              color: isCurrentTurn ? 'var(--color-cyber-darker)' : 'var(--color-cyber-cyan)',
                              fontFamily: 'var(--font-mono)'
                            }}>
                            {p.initiative_roll ?? '?'}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="font-bold text-sm truncate" style={{ 
                                color: p.participant_type === 'player' ? 'var(--color-cyber-cyan)' :
                                       p.participant_type === 'enemy' ? 'var(--color-cyber-pink)' : 'var(--color-cyber-purple)',
                                fontFamily: 'var(--font-mono)' 
                              }}>
                                {p.display_name}
                              </span>
                              {isDead && <span className="text-xs">💀</span>}
                              {isCurrentTurn && <span className="text-xs ml-auto">◄</span>}
                            </div>
                            
                            <div className="flex items-center gap-2 mt-1">
                              {/* HP bar */}
                              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)' }}>
                                <div 
                                  className="h-full rounded-full transition-all"
                                  style={{ 
                                    width: `${Math.max(0, Math.min(100, hpPct))}%`, 
                                    backgroundColor: getHpColor(p.display_hp, p.display_max_hp) 
                                  }}
                                />
                              </div>
                              <span className="text-xs flex-shrink-0" style={{ color: getHpColor(p.display_hp, p.display_max_hp), fontFamily: 'var(--font-mono)' }}>
                                {p.display_hp}/{p.display_max_hp}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Type & class info */}
                        <div className="flex items-center gap-2 mt-1 pl-9">
                          <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                            {p.participant_type.toUpperCase()}
                            {p.character && ` • ${p.character.class} Lv${p.character.level}`}
                            {p.npc && ` • ${p.npc.type}`}
                          </span>
                          <span className="text-xs ml-auto" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                            AC {p.display_ac}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT: Participant Details (2/3 width) */}
          <div className="w-2/3 overflow-y-auto p-6">
            {selectedParticipant ? (
              <div className="space-y-6">
                {/* Name & Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-3xl" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-pink)' }}>
                      {selectedParticipant.display_name}
                    </h2>
                    <div className="text-sm mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                      {selectedParticipant.participant_type.toUpperCase()}
                      {selectedParticipant.character && ` • ${selectedParticipant.character.class} • Level ${selectedParticipant.character.level}`}
                      {selectedParticipant.npc && ` • ${selectedParticipant.npc.type} • ${selectedParticipant.npc.disposition}`}
                    </div>
                  </div>
                  
                  {selectedEncounter.status !== 'completed' && (
                    <button
                      onClick={() => removeParticipant(selectedParticipant.id)}
                      className="neon-button text-xs px-3 py-1"
                      style={{ borderColor: 'var(--color-cyber-pink)', color: 'var(--color-cyber-pink)' }}
                    >
                      REMOVE
                    </button>
                  )}
                </div>

                {/* Combat Stats Row */}
                <div className="grid grid-cols-4 gap-4">
                  {/* HP */}
                  <div className="glass-panel p-4 col-span-2">
                    <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                      HIT POINTS
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-3xl font-bold" style={{ color: getHpColor(selectedParticipant.display_hp, selectedParticipant.display_max_hp), fontFamily: 'var(--font-cyber)' }}>
                        {selectedParticipant.display_hp}
                      </span>
                      <span className="text-lg" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>/</span>
                      <span className="text-lg" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                        {selectedParticipant.display_max_hp}
                      </span>
                    </div>
                    
                    {/* HP bar */}
                    <div className="h-3 rounded-full overflow-hidden mb-3" style={{ backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)' }}>
                      <div 
                        className="h-full rounded-full transition-all"
                        style={{ 
                          width: `${Math.max(0, Math.min(100, (selectedParticipant.display_hp / selectedParticipant.display_max_hp) * 100))}%`, 
                          backgroundColor: getHpColor(selectedParticipant.display_hp, selectedParticipant.display_max_hp) 
                        }}
                      />
                    </div>

                    {/* HP Change Controls */}
                    {selectedEncounter.status !== 'completed' && (
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            const val = parseInt(hpChangeInputs[selectedParticipant.id] || '0');
                            if (val > 0) applyHpChange(selectedParticipant, -val);
                          }}
                          className="neon-button text-xs px-3 py-1"
                          style={{ borderColor: 'var(--color-cyber-pink)', color: 'var(--color-cyber-pink)' }}
                        >
                          − DMG
                        </button>
                        <input
                          type="number"
                          value={hpChangeInputs[selectedParticipant.id] || ''}
                          onChange={(e) => setHpChangeInputs(prev => ({ ...prev, [selectedParticipant.id]: e.target.value }))}
                          placeholder="Amount"
                          className="w-20 p-1 rounded bg-gray-900 border text-center text-sm"
                          style={{ borderColor: 'var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}
                          min="0"
                        />
                        <button 
                          onClick={() => {
                            const val = parseInt(hpChangeInputs[selectedParticipant.id] || '0');
                            if (val > 0) applyHpChange(selectedParticipant, val);
                          }}
                          className="neon-button text-xs px-3 py-1"
                          style={{ borderColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-green)' }}
                        >
                          + HEAL
                        </button>
                        <button
                          onClick={() => {
                            const entityId = selectedParticipant.character_id || selectedParticipant.npc_id || undefined;
                            const entityType = selectedParticipant.character_id ? 'player' as const : 'npc' as const;
                            updateParticipantHP(selectedParticipant.id, selectedParticipant.display_max_hp, entityId, entityType);
                          }}
                          className="neon-button text-xs px-2 py-1 ml-auto"
                          style={{ borderColor: 'var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                          title="Full Heal"
                        >
                          MAX
                        </button>
                      </div>
                    )}
                  </div>

                  {/* AC */}
                  <div className="glass-panel p-4 text-center">
                    <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                      ARMOR CLASS
                    </div>
                    <div className="text-4xl font-bold" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>
                      {selectedParticipant.display_ac}
                    </div>
                  </div>

                  {/* Initiative */}
                  <div className="glass-panel p-4 text-center">
                    <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                      INITIATIVE
                    </div>
                    <div className="text-4xl font-bold" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-cyber)' }}>
                      {selectedParticipant.initiative_roll ?? '—'}
                    </div>
                    <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                      MOD: {selectedParticipant.display_initiative_modifier >= 0 ? '+' : ''}{selectedParticipant.display_initiative_modifier}
                    </div>
                  </div>
                </div>

                {/* Attribute Stats */}
                {(selectedParticipant.character || selectedParticipant.npc) && (
                  <div className="glass-panel p-4">
                    <div className="text-xs mb-3" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                      ATTRIBUTES
                    </div>
                    <div className="grid grid-cols-6 gap-3">
                      {(['str', 'dex', 'con', 'wis', 'int', 'cha'] as const).map(stat => {
                        const entity = selectedParticipant.character || selectedParticipant.npc;
                        const value = entity?.[stat] || 10;
                        const mod = Math.floor((value - 10) / 2);
                        return (
                          <div key={stat} className="text-center p-2 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' }}>
                            <div className="text-xs font-bold" style={{ color: 'var(--color-cyber-pink)', fontFamily: 'var(--font-mono)' }}>
                              {stat.toUpperCase()}
                            </div>
                            <div className="text-2xl font-bold" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>
                              {value}
                            </div>
                            <div className="text-xs" style={{ color: mod >= 0 ? 'var(--color-cyber-green)' : 'var(--color-cyber-pink)', fontFamily: 'var(--font-mono)' }}>
                              {mod >= 0 ? '+' : ''}{mod}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Player Abilities */}
                {selectedParticipant.abilities && selectedParticipant.abilities.length > 0 && (
                  <div className="glass-panel p-4">
                    <div className="text-xs mb-3" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                      ABILITIES ({selectedParticipant.abilities.length})
                    </div>
                    <div className="space-y-2">
                      {selectedParticipant.abilities.map((ca: CharacterAbility) => {
                        const ability = ca.ability;
                        if (!ability) return null;
                        
                        const hasCharges = ability.charge_type !== 'infinite' && ability.max_charges !== null;
                        const chargesLeft = ca.current_charges;
                        
                        return (
                          <div key={ca.id} className="p-3 rounded" style={{ 
                            backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 5%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)'
                          }}>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                                    {ability.name}
                                  </span>
                                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ 
                                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-purple) 20%, transparent)',
                                    color: 'var(--color-cyber-purple)', 
                                    fontFamily: 'var(--font-mono)' 
                                  }}>
                                    {ability.type}
                                  </span>
                                  {ability.source && (
                                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ 
                                      backgroundColor: 'color-mix(in srgb, var(--color-cyber-green) 15%, transparent)',
                                      color: 'var(--color-cyber-green)', 
                                      fontFamily: 'var(--font-mono)' 
                                    }}>
                                      {ability.source}{ability.class_name ? `: ${ability.class_name}` : ''}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                                  {ability.description}
                                </div>
                                
                                {/* Combat details */}
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {ability.damage_dice && (
                                    <span className="text-xs" style={{ color: 'var(--color-cyber-pink)', fontFamily: 'var(--font-mono)' }}>
                                      🎯 {ability.damage_dice} {ability.damage_type || ''}
                                    </span>
                                  )}
                                  {ability.range_feet && (
                                    <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>
                                      📏 {ability.range_feet}ft
                                    </span>
                                  )}
                                  {ability.area_of_effect && (
                                    <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>
                                      💥 {ability.area_of_effect}
                                    </span>
                                  )}
                                  {ability.duration && (
                                    <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>
                                      ⏱ {ability.duration}
                                    </span>
                                  )}
                                </div>

                                {/* Effects */}
                                {ability.effects && ability.effects.length > 0 && (
                                  <div className="mt-1">
                                    {ability.effects.map((eff, i) => (
                                      <div key={i} className="text-xs" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                                        • {eff}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              
                              {/* Charges & Use button */}
                              {hasCharges && (
                                <div className="flex flex-col items-center gap-1 ml-3 flex-shrink-0">
                                  <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                                    CHARGES
                                  </div>
                                  <div className="text-lg font-bold" style={{ 
                                    color: chargesLeft > 0 ? 'var(--color-cyber-green)' : 'var(--color-cyber-pink)', 
                                    fontFamily: 'var(--font-mono)' 
                                  }}>
                                    {chargesLeft}/{ability.max_charges}
                                  </div>
                                  {selectedEncounter.status === 'active' && (
                                    <button
                                      onClick={() => useAbilityCharge(ca.id, ability.name, chargesLeft)}
                                      disabled={chargesLeft <= 0}
                                      className="neon-button text-xs px-2 py-0.5"
                                      style={{ 
                                        borderColor: chargesLeft > 0 ? 'var(--color-cyber-green)' : 'var(--color-cyber-pink)',
                                        color: chargesLeft > 0 ? 'var(--color-cyber-green)' : 'var(--color-cyber-pink)',
                                        opacity: chargesLeft <= 0 ? 0.4 : 1
                                      }}
                                    >
                                      USE
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* NPC Abilities */}
                {selectedParticipant.npcAbilities && selectedParticipant.npcAbilities.length > 0 && (
                  <div className="glass-panel p-4">
                    <div className="text-xs mb-3" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                      NPC ABILITIES ({selectedParticipant.npcAbilities.length})
                    </div>
                    <div className="space-y-2">
                      {selectedParticipant.npcAbilities.map((npcAbility, idx) => (
                        <div key={idx} className="p-3 rounded" style={{ 
                          backgroundColor: 'color-mix(in srgb, var(--color-cyber-pink) 5%, transparent)',
                          border: '1px solid color-mix(in srgb, var(--color-cyber-pink) 20%, transparent)'
                        }}>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm" style={{ color: 'var(--color-cyber-pink)', fontFamily: 'var(--font-mono)' }}>
                              {npcAbility.name}
                            </span>
                            {npcAbility.damage && (
                              <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                                🎯 {npcAbility.damage}
                              </span>
                            )}
                          </div>
                          <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                            {npcAbility.effect}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* NPC Roleplay Info (for NPCs) */}
                {selectedParticipant.npc && (
                  <div className="glass-panel p-4">
                    <div className="text-xs mb-3" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                      NPC DETAILS
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {selectedParticipant.npc.description && (
                        <div className="col-span-2">
                          <span className="text-xs" style={{ color: 'var(--color-cyber-pink)', fontFamily: 'var(--font-mono)' }}>Description: </span>
                          <span style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{selectedParticipant.npc.description}</span>
                        </div>
                      )}
                      {selectedParticipant.npc.three_words && (
                        <div>
                          <span className="text-xs" style={{ color: 'var(--color-cyber-pink)', fontFamily: 'var(--font-mono)' }}>3 Words: </span>
                          <span style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{selectedParticipant.npc.three_words}</span>
                        </div>
                      )}
                      {selectedParticipant.npc.speech_pattern && (
                        <div>
                          <span className="text-xs" style={{ color: 'var(--color-cyber-pink)', fontFamily: 'var(--font-mono)' }}>Speech: </span>
                          <span style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{selectedParticipant.npc.speech_pattern}</span>
                        </div>
                      )}
                      {selectedParticipant.npc.voice_direction && (
                        <div>
                          <span className="text-xs" style={{ color: 'var(--color-cyber-pink)', fontFamily: 'var(--font-mono)' }}>Voice: </span>
                          <span style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{selectedParticipant.npc.voice_direction}</span>
                        </div>
                      )}
                      {selectedParticipant.npc.mannerisms && (
                        <div>
                          <span className="text-xs" style={{ color: 'var(--color-cyber-pink)', fontFamily: 'var(--font-mono)' }}>Mannerisms: </span>
                          <span style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{selectedParticipant.npc.mannerisms}</span>
                        </div>
                      )}
                      {selectedParticipant.npc.drops_on_defeat && (
                        <div className="col-span-2">
                          <span className="text-xs" style={{ color: 'var(--color-cyber-pink)', fontFamily: 'var(--font-mono)' }}>Drops: </span>
                          <span style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                            ${selectedParticipant.npc.drops_on_defeat.usd}
                            {selectedParticipant.npc.drops_on_defeat.items.length > 0 && ` + ${selectedParticipant.npc.drops_on_defeat.items.join(', ')}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* DM Notes */}
                <div className="glass-panel p-4">
                  <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                    DM NOTES
                  </div>
                  <textarea
                    value={notesInputs[selectedParticipant.id] || ''}
                    onChange={(e) => handleNotesChange(selectedParticipant.id, e.target.value)}
                    className="w-full p-2 rounded bg-gray-900 border text-sm"
                    style={{ borderColor: 'color-mix(in srgb, var(--color-cyber-cyan) 40%, transparent)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}
                    rows={3}
                    placeholder="Type notes here... (auto-saves)"
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-6xl mb-4 opacity-20">⚔️</div>
                  <p className="text-lg" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4, fontFamily: 'var(--font-mono)' }}>
                    Select a participant from the initiative order
                  </p>
                  <p className="text-sm mt-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.3, fontFamily: 'var(--font-mono)' }}>
                    Click on a combatant to view their full details
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* No Encounter Selected */
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4 opacity-20">⚔️</div>
            <p className="text-lg" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4, fontFamily: 'var(--font-mono)' }}>
              Select an encounter from the dropdown above
            </p>
            <p className="text-sm mt-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.3, fontFamily: 'var(--font-mono)' }}>
              Or create a new one to get started
            </p>
          </div>
        </div>
      )}

      {/* ========== MODALS ========== */}

      {/* Create Encounter Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="glass-panel p-6 max-w-md w-full mx-4">
            <h3 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
              CREATE NEW ENCOUNTER
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  Encounter Name *
                </label>
                <input
                  type="text"
                  value={newEncounterName}
                  onChange={(e) => setNewEncounterName(e.target.value)}
                  className="w-full p-2 rounded bg-gray-900 border border-cyan-500"
                  style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}
                  placeholder="e.g., Ambush at the Docks"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  Description
                </label>
                <textarea
                  value={newEncounterDescription}
                  onChange={(e) => setNewEncounterDescription(e.target.value)}
                  className="w-full p-2 rounded bg-gray-900 border border-cyan-500"
                  style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}
                  rows={3}
                  placeholder="Optional description..."
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={createEncounter}
                  className="neon-button flex-1"
                  style={{ borderColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-green)' }}
                >
                  CREATE
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewEncounterName('');
                    setNewEncounterDescription('');
                  }}
                  className="neon-button flex-1"
                  style={{ borderColor: 'var(--color-cyber-pink)', color: 'var(--color-cyber-pink)' }}
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Participant Modal */}
      {showAddParticipantModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="glass-panel p-6 max-w-2xl w-full my-4">
            <h3 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
              ADD PARTICIPANT
            </h3>
            
            <div className="space-y-6">
              {/* Player Characters */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-lg" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>
                    PLAYER CHARACTERS
                  </h4>
                  {availableCharacters.length > 0 && (
                    <button
                      onClick={async () => {
                        for (const char of availableCharacters) {
                          const alreadyAdded = participants.some(p => p.character_id === char.id);
                          if (!alreadyAdded) {
                            await addParticipant('character', char.id, 'player');
                          }
                        }
                        setShowAddParticipantModal(false);
                      }}
                      className="neon-button text-xs px-3 py-1"
                      style={{ borderColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-green)' }}
                    >
                      ADD ALL PLAYERS
                    </button>
                  )}
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {availableCharacters.map(char => {
                    const alreadyAdded = participants.some(p => p.character_id === char.id);
                    return (
                      <div
                        key={char.id}
                        className="p-2 rounded border flex justify-between items-center"
                        style={{ 
                          borderColor: alreadyAdded ? 'color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' : 'var(--color-cyber-cyan)',
                          opacity: alreadyAdded ? 0.4 : 1
                        }}
                      >
                        <div>
                          <div style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                            {char.name} - {char.class} (Lvl {char.level})
                          </div>
                          <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6 }}>
                            HP: {char.current_hp}/{char.max_hp} • AC: {char.ac} • Init: {char.initiative_modifier >= 0 ? '+' : ''}{char.initiative_modifier}
                          </div>
                        </div>
                        {!alreadyAdded ? (
                          <button
                            onClick={() => addParticipant('character', char.id, 'player')}
                            className="neon-button text-xs px-3 py-1"
                            style={{ borderColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-green)' }}
                          >
                            ADD
                          </button>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>ADDED</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* NPCs */}
              <div>
                <h4 className="text-lg mb-2" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-cyber)' }}>
                  NPCs & ENEMIES
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {availableNPCs.map(npc => (
                    <div
                      key={npc.id}
                      className="p-2 rounded border border-purple-500 flex justify-between items-center"
                    >
                      <div>
                        <div style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)' }}>
                          {npc.name} - {npc.type}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6 }}>
                          HP: {npc.current_hp}/{npc.max_hp} • AC: {npc.ac} • Init: {npc.initiative_modifier >= 0 ? '+' : ''}{npc.initiative_modifier}
                        </div>
                      </div>
                      <button
                        onClick={() => addParticipant('npc', npc.id, npc.type.includes('Enemy') || npc.type === 'Boss' || npc.type === 'Mini-Boss' ? 'enemy' : 'npc')}
                        className="neon-button text-xs px-3 py-1"
                        style={{ borderColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-green)' }}
                      >
                        ADD
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setShowAddParticipantModal(false)}
                className="neon-button w-full"
                style={{ borderColor: 'var(--color-cyber-pink)', color: 'var(--color-cyber-pink)' }}
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Initiative Modal */}
      {showInitiativeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="glass-panel p-6 max-w-2xl w-full my-4">
            <h3 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
              🎲 SET INITIATIVE
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
              Enter initiative rolls (d20 + modifier) for each participant
            </p>
            
            <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
              {participants.map(p => (
                <div key={p.id} className="p-3 rounded border" style={{ borderColor: 'color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)' }}>
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <span style={{ 
                          color: p.participant_type === 'player' ? 'var(--color-cyber-cyan)' : 'var(--color-cyber-pink)',
                          fontFamily: 'var(--font-mono)' 
                        }}>
                          {p.display_name}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ 
                          backgroundColor: 'color-mix(in srgb, var(--color-cyber-purple) 20%, transparent)',
                          color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)' 
                        }}>
                          {p.participant_type}
                        </span>
                      </div>
                      <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>
                        Init Modifier: {p.display_initiative_modifier >= 0 ? '+' : ''}{p.display_initiative_modifier}
                      </div>
                    </div>
                    <input
                      type="number"
                      value={p.initiative_roll ?? ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) {
                          setInitiative(p.id, val);
                        }
                      }}
                      className="w-20 p-2 rounded bg-gray-900 border text-center"
                      style={{ borderColor: 'var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', fontSize: '1.2rem' }}
                      placeholder="?"
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowInitiativeModal(false)}
              className="neon-button w-full"
              style={{ borderColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-green)' }}
            >
              DONE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
