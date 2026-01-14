import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { 
  Encounter, 
  EncounterParticipantWithDetails,
  Character,
  ParticipantType 
} from '../types/encounter';
import type { NPC } from '../types/npc';

export default function DMEncounterManager() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(null);
  const [participants, setParticipants] = useState<EncounterParticipantWithDetails[]>([]);
  
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
      // Fetch all characters
      const { data: chars, error: charError } = await supabase
        .from('characters')
        .select('id, user_id, name, class, level, current_hp, max_hp, ac, initiative_modifier, str, dex, con, wis, int, cha')
        .order('name');

      if (charError) throw charError;
      setAvailableCharacters(chars || []);

      // Fetch all NPCs
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
      // Fetch participants without joins to avoid RLS recursion
      const { data: participantsData, error: participantsError } = await supabase
        .from('encounter_participants')
        .select('*')
        .eq('encounter_id', encounterId)
        .order('initiative_order', { ascending: true, nullsFirst: false });

      if (participantsError) throw participantsError;

      // Fetch characters separately
      const characterIds = participantsData
        ?.filter(p => p.character_id)
        .map(p => p.character_id) || [];
      
      const { data: charactersData, error: charError } = await supabase
        .from('characters')
        .select('id, user_id, name, class, level, current_hp, max_hp, ac, initiative_modifier, str, dex, con, wis, int, cha')
        .in('id', characterIds);

      if (charError) throw charError;

      // Fetch NPCs separately
      const npcIds = participantsData
        ?.filter(p => p.npc_id)
        .map(p => p.npc_id) || [];
      
      const { data: npcsData, error: npcError } = await supabase
        .from('npcs')
        .select('*')
        .in('id', npcIds);

      if (npcError) throw npcError;

      // Combine the data
      const transformed: EncounterParticipantWithDetails[] = (participantsData || []).map((p: any) => {
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
        };
      });

      setParticipants(transformed);
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
      alert('Encounter created!');
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
      // Get participant details
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
      alert('Participant added!');
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

      // Refresh participants to get updated order
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

    // Check if all participants have initiative
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

      // Update local state
      const updated = { ...selectedEncounter, status: 'active' as const, started_at: new Date().toISOString() };
      setSelectedEncounter(updated);
      setEncounters(encounters.map(e => e.id === updated.id ? updated : e));
      
      alert('Encounter started!');
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

      // Refresh encounter data
      const { data } = await supabase
        .from('encounters')
        .select('*')
        .eq('id', selectedEncounter.id)
        .single();

      if (data) {
        setSelectedEncounter(data);
        setEncounters(encounters.map(e => e.id === data.id ? data : e));
      }
    } catch (err: any) {
      console.error('Error advancing turn:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const updateParticipantHP = async (participantId: string, newHp: number) => {
    try {
      const { error } = await supabase
        .from('encounter_participants')
        .update({ current_hp: Math.max(0, newHp) })
        .eq('id', participantId);

      if (error) throw error;

      // Update local state
      setParticipants(participants.map(p => 
        p.id === participantId ? { ...p, current_hp: Math.max(0, newHp), display_hp: Math.max(0, newHp) } : p
      ));
    } catch (err: any) {
      console.error('Error updating HP:', err);
      alert(`Error: ${err.message}`);
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
      
      alert('Encounter completed!');
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
      }
    } catch (err: any) {
      console.error('Error deleting encounter:', err);
      alert(`Error: ${err.message}`);
    }
  };

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
    <div className="min-h-screen p-8" style={{ backgroundColor: 'var(--color-cyber-darker)' }}>
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/dm')}
          className="neon-button mb-4"
          style={{ borderColor: 'var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
        >
          ← BACK TO DM DASHBOARD
        </button>
        
        <h1 className="text-4xl mb-2" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-pink)' }}>
          ⚔️ ENCOUNTER MANAGER
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
          Create and manage combat encounters with initiative tracking
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Encounter List */}
        <div className="glass-panel p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
              ENCOUNTERS
            </h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="neon-button text-sm px-3 py-1"
              style={{ borderColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-green)' }}
            >
              + NEW
            </button>
          </div>

          <div className="space-y-2">
            {encounters.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                No encounters yet. Create one to get started!
              </p>
            ) : (
              encounters.map(enc => (
                <div
                  key={enc.id}
                  onClick={() => setSelectedEncounter(enc)}
                  className={`p-3 rounded cursor-pointer transition-all ${
                    selectedEncounter?.id === enc.id ? 'glass-panel' : 'hover:bg-gray-800'
                  }`}
                  style={{
                    borderLeft: `3px solid ${
                      enc.status === 'active' ? 'var(--color-cyber-green)' :
                      enc.status === 'completed' ? 'var(--color-cyber-purple)' :
                      'var(--color-cyber-cyan)'
                    }`
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                        {enc.name}
                      </div>
                      <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6 }}>
                        {enc.status.toUpperCase()}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteEncounter(enc.id);
                      }}
                      className="text-xs px-2 py-1 rounded"
                      style={{ color: 'var(--color-cyber-pink)', borderColor: 'var(--color-cyber-pink)' }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Middle & Right Columns: Encounter Details */}
        {selectedEncounter ? (
          <>
            {/* Encounter Info & Actions */}
            <div className="glass-panel p-6">
              <h2 className="text-2xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-pink)' }}>
                {selectedEncounter.name}
              </h2>
              
              <div className="space-y-3 mb-6">
                <div>
                  <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                    STATUS:
                  </span>
                  <div className="text-lg" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-cyber)' }}>
                    {selectedEncounter.status.toUpperCase()}
                  </div>
                </div>

                {selectedEncounter.description && (
                  <div>
                    <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                      DESCRIPTION:
                    </span>
                    <div className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                      {selectedEncounter.description}
                    </div>
                  </div>
                )}

                {selectedEncounter.status === 'active' && (
                  <div>
                    <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                      ROUND:
                    </span>
                    <div className="text-2xl" style={{ color: 'var(--color-cyber-pink)', fontFamily: 'var(--font-cyber)' }}>
                      {selectedEncounter.round_number}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-2">
                {selectedEncounter.status === 'draft' && (
                  <>
                    <button
                      onClick={() => setShowAddParticipantModal(true)}
                      className="neon-button w-full"
                      style={{ borderColor: 'var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                    >
                      + ADD PARTICIPANT
                    </button>
                    <button
                      onClick={() => setShowInitiativeModal(true)}
                      className="neon-button w-full"
                      style={{ borderColor: 'var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}
                      disabled={participants.length === 0}
                    >
                      SET INITIATIVE
                    </button>
                    <button
                      onClick={startEncounter}
                      className="neon-button w-full"
                      style={{ borderColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-green)' }}
                      disabled={participants.length === 0}
                    >
                      ▶ START ENCOUNTER
                    </button>
                  </>
                )}

                {selectedEncounter.status === 'active' && (
                  <>
                    <button
                      onClick={advanceTurn}
                      className="neon-button w-full"
                      style={{ borderColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-green)' }}
                    >
                      ⏩ NEXT TURN
                    </button>
                    <button
                      onClick={completeEncounter}
                      className="neon-button w-full"
                      style={{ borderColor: 'var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}
                    >
                      ✓ COMPLETE ENCOUNTER
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Participants List */}
            <div className="glass-panel p-6">
              <h3 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                PARTICIPANTS ({participants.length})
              </h3>

              <div className="space-y-3">
                {participants.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                    No participants yet. Add some to start the encounter!
                  </p>
                ) : (
                  participants.map((p) => {
                    const isCurrentTurn = selectedEncounter.status === 'active' && 
                      p.initiative_order === selectedEncounter.current_turn;

                    return (
                      <div
                        key={p.id}
                        className="p-3 rounded"
                        style={{
                          backgroundColor: isCurrentTurn ? 'color-mix(in srgb, var(--color-cyber-green) 20%, transparent)' : 'transparent',
                          border: `1px solid ${
                            p.participant_type === 'player' ? 'var(--color-cyber-cyan)' :
                            p.participant_type === 'npc' ? 'var(--color-cyber-purple)' :
                            'var(--color-cyber-pink)'
                          }`
                        }}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-bold" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                              {p.initiative_order && `#${p.initiative_order} - `}{p.display_name}
                            </div>
                            <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6 }}>
                              {p.participant_type.toUpperCase()}
                              {p.character && ` • ${p.character.class}`}
                            </div>
                          </div>
                          <button
                            onClick={() => removeParticipant(p.id)}
                            className="text-xs"
                            style={{ color: 'var(--color-cyber-pink)' }}
                          >
                            ✕
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>HP: </span>
                            <input
                              type="number"
                              value={p.current_hp || 0}
                              onChange={(e) => updateParticipantHP(p.id, parseInt(e.target.value) || 0)}
                              className="w-16 bg-gray-900 border border-cyan-500 rounded px-1"
                              style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}
                            />
                            <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}> / {p.display_max_hp}</span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>AC: </span>
                            <span style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                              {p.display_ac}
                            </span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>INIT: </span>
                            <span style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                              {p.initiative_roll !== null ? p.initiative_roll : '—'}
                            </span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>INIT MOD: </span>
                            <span style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                              {p.display_initiative_modifier >= 0 ? '+' : ''}{p.display_initiative_modifier}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="lg:col-span-2 glass-panel p-12 text-center">
            <p style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
              Select an encounter to view details
            </p>
          </div>
        )}
      </div>

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
                <h4 className="text-lg mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>
                  PLAYER CHARACTERS
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {availableCharacters.map(char => (
                    <div
                      key={char.id}
                      className="p-2 rounded border border-cyan-500 flex justify-between items-center"
                    >
                      <div>
                        <div style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                          {char.name} - {char.class} (Lvl {char.level})
                        </div>
                        <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6 }}>
                          HP: {char.current_hp}/{char.max_hp} • AC: {char.ac} • Init: {char.initiative_modifier >= 0 ? '+' : ''}{char.initiative_modifier}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          addParticipant('character', char.id, 'player');
                          setShowAddParticipantModal(false);
                        }}
                        className="neon-button text-xs px-3 py-1"
                        style={{ borderColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-green)' }}
                      >
                        ADD
                      </button>
                    </div>
                  ))}
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
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            addParticipant('npc', npc.id, npc.type.includes('Enemy') ? 'enemy' : 'npc');
                            setShowAddParticipantModal(false);
                          }}
                          className="neon-button text-xs px-3 py-1"
                          style={{ borderColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-green)' }}
                        >
                          ADD
                        </button>
                      </div>
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
              SET INITIATIVE
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
              Enter initiative rolls (d20 + modifier) for each participant. They'll be automatically sorted!
            </p>
            
            <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
              {participants.map(p => (
                <div key={p.id} className="p-3 rounded border border-cyan-500">
                  <div className="flex justify-between items-center">
                    <div>
                      <div style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                        {p.display_name}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6 }}>
                        Init Modifier: {p.display_initiative_modifier >= 0 ? '+' : ''}{p.display_initiative_modifier}
                      </div>
                    </div>
                    <input
                      type="number"
                      value={p.initiative_roll || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) {
                          setInitiative(p.id, val);
                        }
                      }}
                      className="w-20 p-2 rounded bg-gray-900 border border-cyan-500 text-center"
                      style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', fontSize: '1.2rem' }}
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
