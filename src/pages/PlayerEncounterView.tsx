import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Encounter, EncounterParticipantWithDetails, PlayerEncounterNote } from '../types/encounter';
import type { Character } from '../types/encounter';

export default function PlayerEncounterView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeEncounter, setActiveEncounter] = useState<Encounter | null>(null);
  const [participants, setParticipants] = useState<EncounterParticipantWithDetails[]>([]);
  const [myCharacters, setMyCharacters] = useState<Character[]>([]);
  const [notes, setNotes] = useState<PlayerEncounterNote[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [selectedTurn, setSelectedTurn] = useState<number | null>(null);

  useEffect(() => {
    loadEncounterData();
    
    // Poll for encounter updates every 5 seconds
    const interval = setInterval(() => {
      loadEncounterData();
    }, 5000);

    return () => clearInterval(interval);
  }, [user]);

  const loadEncounterData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // First fetch my characters
      const { data: charactersData, error: charError } = await supabase
        .from('characters')
        .select('*')
        .eq('user_id', user.id);

      if (charError) throw charError;
      
      const myChars = charactersData || [];
      setMyCharacters(myChars);

      if (myChars.length === 0) {
        setActiveEncounter(null);
        setLoading(false);
        return;
      }

      // Now fetch active encounters
      await fetchActiveEncounter(myChars);
    } catch (err: any) {
      console.error('Error loading encounter data:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveEncounter = async (characters: Character[]) => {
    try {
      // Get active encounters
      const { data: encounters, error: encounterError } = await supabase
        .from('encounters')
        .select('*')
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1);

      if (encounterError) throw encounterError;

      if (!encounters || encounters.length === 0) {
        setActiveEncounter(null);
        return;
      }

      const encounter = encounters[0];

      // Check if I'm in this encounter
      const characterIds = characters.map(c => c.id);
      const { data: myParticipation, error: partError } = await supabase
        .from('encounter_participants')
        .select('id')
        .eq('encounter_id', encounter.id)
        .in('character_id', characterIds);

      if (partError) throw partError;

      if (!myParticipation || myParticipation.length === 0) {
        setActiveEncounter(null);
        return;
      }

      setActiveEncounter(encounter);
      await fetchParticipants(encounter.id);
      await fetchMyNotes(encounter.id);
    } catch (err: any) {
      console.error('Error fetching encounter:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const fetchParticipants = async (encounterId: string) => {
    try {
      // Fetch participants without joins
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

      // Fetch NPCs separately (but we won't show their stats to players)
      const npcIds = participantsData
        ?.filter(p => p.npc_id)
        .map(p => p.npc_id) || [];
      
      const { data: npcsData, error: npcError } = await supabase
        .from('npcs')
        .select('id, name, type')
        .in('id', npcIds);

      if (npcError) throw npcError;

      // Combine the data - hide enemy stats from players
      const transformed: EncounterParticipantWithDetails[] = (participantsData || []).map((p: any) => {
        const char = charactersData?.find(c => c.id === p.character_id) || null;
        const npc = npcsData?.find(n => n.id === p.npc_id) || null;
        const isMyCharacter = char && myCharacters.some(mc => mc.id === char.id);

        // Players can only see full stats for their own characters
        return {
          ...p,
          character: char || undefined,
          npc: npc ? { ...npc, current_hp: undefined, max_hp: undefined, ac: undefined } as any : undefined,
          display_name: char?.name || npc?.name || 'Unknown',
          // Only show HP/AC for player's own characters
          display_hp: isMyCharacter ? (p.current_hp ?? char?.current_hp) : undefined,
          display_max_hp: isMyCharacter ? (p.max_hp ?? char?.max_hp) : undefined,
          display_ac: isMyCharacter ? char?.ac : undefined,
          display_initiative_modifier: 0, // Don't show to players
        };
      });

      setParticipants(transformed);
    } catch (err: any) {
      console.error('Error fetching participants:', err);
    }
  };

  const fetchMyNotes = async (encounterId: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('player_encounter_notes')
        .select('*')
        .eq('encounter_id', encounterId)
        .eq('player_id', user.id)
        .order('round_number', { ascending: true })
        .order('turn_number', { ascending: true });

      if (error) throw error;
      setNotes(data || []);
    } catch (err: any) {
      console.error('Error fetching notes:', err);
    }
  };

  const saveNote = async () => {
    if (!activeEncounter || !user || !newNoteText.trim()) return;
    if (selectedTurn === null) {
      alert('Please select a turn to add a note');
      return;
    }

    try {
      const { error } = await supabase
        .from('player_encounter_notes')
        .upsert({
          encounter_id: activeEncounter.id,
          player_id: user.id,
          turn_number: selectedTurn,
          round_number: activeEncounter.round_number,
          note_text: newNoteText.trim(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'encounter_id,player_id,turn_number,round_number'
        });

      if (error) throw error;

      await fetchMyNotes(activeEncounter.id);
      setNewNoteText('');
      setSelectedTurn(null);
      alert('Note saved!');
    } catch (err: any) {
      console.error('Error saving note:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!confirm('Delete this note?')) return;

    try {
      const { error } = await supabase
        .from('player_encounter_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      setNotes(notes.filter(n => n.id !== noteId));
    } catch (err: any) {
      console.error('Error deleting note:', err);
      alert(`Error: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-8" style={{ backgroundColor: 'var(--color-cyber-darker)' }}>
        <div className="text-center" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
          Loading encounter...
        </div>
      </div>
    );
  }

  if (!activeEncounter) {
    return (
      <div className="min-h-screen p-8" style={{ backgroundColor: 'var(--color-cyber-darker)' }}>
        <button
          onClick={() => navigate('/dashboard')}
          className="neon-button mb-4"
          style={{ borderColor: 'var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
        >
          ← BACK TO DASHBOARD
        </button>

        <div className="glass-panel p-12 text-center">
          <h2 className="text-2xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-pink)' }}>
            NO ACTIVE ENCOUNTER
          </h2>
          <p style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
            There are no active encounters at the moment. Check back later!
          </p>
        </div>
      </div>
    );
  }

  const currentTurnParticipant = participants.find(p => p.initiative_order === activeEncounter.current_turn);

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: 'var(--color-cyber-darker)' }}>
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="neon-button mb-4"
          style={{ borderColor: 'var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
        >
          ← BACK TO DASHBOARD
        </button>
        
        <h1 className="text-4xl mb-2" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-pink)' }}>
          ⚔️ {activeEncounter.name}
        </h1>
        {activeEncounter.description && (
          <p className="text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
            {activeEncounter.description}
          </p>
        )}
        <div className="text-2xl" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-cyber)' }}>
          ROUND {activeEncounter.round_number}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Initiative Order */}
        <div className="glass-panel p-6">
          <h2 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
            INITIATIVE ORDER
          </h2>

          {currentTurnParticipant && (
            <div className="mb-4 p-3 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--color-cyber-green) 20%, transparent)', border: '2px solid var(--color-cyber-green)' }}>
              <div className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                CURRENT TURN:
              </div>
              <div className="text-xl" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-cyber)' }}>
                {currentTurnParticipant.display_name}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {participants.map((p) => {
              const isCurrentTurn = p.initiative_order === activeEncounter.current_turn;
              const isMyCharacter = p.character && myCharacters.some(mc => mc.id === p.character!.id);

              return (
                <div
                  key={p.id}
                  className="p-3 rounded"
                  style={{
                    backgroundColor: isCurrentTurn ? 'color-mix(in srgb, var(--color-cyber-green) 15%, transparent)' : 'transparent',
                    border: `1px solid ${
                      isMyCharacter ? 'var(--color-cyber-cyan)' :
                      p.participant_type === 'npc' ? 'var(--color-cyber-purple)' :
                      'var(--color-cyber-pink)'
                    }`
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                        #{p.initiative_order} - {p.display_name}
                        {isMyCharacter && <span className="ml-2 text-xs" style={{ color: 'var(--color-cyber-green)' }}>(YOU)</span>}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6 }}>
                        {p.character && `${p.character.class} • Level ${p.character.level}`}
                        {p.npc && p.npc.type}
                      </div>
                    </div>
                    {isMyCharacter && p.display_hp !== undefined && (
                      <div className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                        HP: {p.display_hp}/{p.display_max_hp}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Notes */}
        <div className="glass-panel p-6">
          <h2 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
            MY NOTES
          </h2>

          {/* Add New Note */}
          <div className="mb-6 p-4 rounded border border-cyan-500">
            <h3 className="text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
              ADD NOTE
            </h3>
            
            <div className="mb-2">
              <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                For Turn:
              </label>
              <select
                value={selectedTurn ?? ''}
                onChange={(e) => setSelectedTurn(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full p-2 rounded bg-gray-900 border border-cyan-500"
                style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}
              >
                <option value="">Select a turn...</option>
                {participants.map((p) => (
                  <option key={p.id} value={p.initiative_order || ''}>
                    #{p.initiative_order} - {p.display_name}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              className="w-full p-2 rounded bg-gray-900 border border-cyan-500 mb-2"
              style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}
              rows={3}
              placeholder="What happened this turn..."
            />

            <button
              onClick={saveNote}
              className="neon-button w-full text-sm"
              style={{ borderColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-green)' }}
            >
              SAVE NOTE
            </button>
          </div>

          {/* Existing Notes */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {notes.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                No notes yet. Add one above!
              </p>
            ) : (
              notes.map((note) => {
                const participant = participants.find(p => p.initiative_order === note.turn_number);
                return (
                  <div key={note.id} className="p-3 rounded border border-cyan-500">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                        Round {note.round_number} • Turn #{note.turn_number}
                        {participant && ` - ${participant.display_name}`}
                      </div>
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="text-xs"
                        style={{ color: 'var(--color-cyber-pink)' }}
                      >
                        ✕
                      </button>
                    </div>
                    <div className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                      {note.note_text}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
