import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Mission, MissionWithDetails, MissionType, MissionDifficulty, MissionStatus, RewardDistribution } from '../types/mission';

interface Character {
  id: string;
  name: string;
  class: string;
  user_id: string;
}

interface Item {
  id: string;
  name: string;
  rarity: string;
  type: string;
}

export default function DMMissionManager() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [missions, setMissions] = useState<MissionWithDetails[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<MissionStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<MissionType | 'all'>('all');
  
  // Create mission modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newObjectives, setNewObjectives] = useState<string[]>(['']);
  const [newType, setNewType] = useState<MissionType>('Side Mission');
  const [newDifficulty, setNewDifficulty] = useState<MissionDifficulty>('Moderate');
  const [newAssignedTo, setNewAssignedTo] = useState<string[]>([]);
  const [newRewardIds, setNewRewardIds] = useState<string[]>([]);
  const [isPartyWide, setIsPartyWide] = useState(true);
  
  // Reward distribution modal
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [completingMission, setCompletingMission] = useState<MissionWithDetails | null>(null);
  const [rewardDistributions, setRewardDistributions] = useState<RewardDistribution[]>([]);

  useEffect(() => {
    if (profile?.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [profile]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch missions
      const { data: missionsData, error: missionsError } = await supabase
        .from('missions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (missionsError) throw missionsError;
      
      // Fetch characters
      const { data: charsData, error: charsError } = await supabase
        .from('characters')
        .select('id, name, class, user_id');
      
      if (charsError) throw charsError;
      setCharacters(charsData || []);
      
      // Fetch items
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('id, name, rarity, type');
      
      if (itemsError) throw itemsError;
      setItems(itemsData || []);
      
      // Enrich missions with details
      const enrichedMissions = (missionsData || []).map(mission => {
        const assigned_characters = mission.assigned_to
          ? charsData?.filter(c => mission.assigned_to?.includes(c.id))
          : undefined;
        
        const reward_items = mission.reward_item_ids
          ? itemsData?.filter(i => mission.reward_item_ids?.includes(i.id))
          : undefined;
        
        return {
          ...mission,
          assigned_characters,
          reward_items
        };
      });
      
      setMissions(enrichedMissions);
      
    } catch (err: any) {
      console.error('Error fetching data:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMission = async () => {
    if (!newTitle.trim()) {
      alert('Please enter a mission title');
      return;
    }
    
    // Filter out empty objectives
    const filteredObjectives = newObjectives.filter(obj => obj.trim() !== '');
    if (filteredObjectives.length === 0) {
      alert('Please add at least one objective');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('missions')
        .insert({
          title: newTitle,
          description: newDescription || null,
          objectives: filteredObjectives,
          type: newType,
          difficulty: newDifficulty,
          status: 'active',
          assigned_to: isPartyWide ? null : (newAssignedTo.length > 0 ? newAssignedTo : null),
          reward_item_ids: newRewardIds.length > 0 ? newRewardIds : null,
          created_by: profile?.id
        });
      
      if (error) throw error;
      
      alert('Mission created successfully!');
      setShowCreateModal(false);
      resetCreateForm();
      fetchData();
      
    } catch (err: any) {
      console.error('Error creating mission:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const resetCreateForm = () => {
    setNewTitle('');
    setNewDescription('');
    setNewObjectives(['']);
    setNewType('Side Mission');
    setNewDifficulty('Moderate');
    setNewAssignedTo([]);
    setNewRewardIds([]);
    setIsPartyWide(true);
  };

  const handleMarkComplete = (mission: MissionWithDetails) => {
    if (!mission.reward_items || mission.reward_items.length === 0) {
      // No rewards, just mark complete
      completeWithoutRewards(mission.id);
    } else {
      // Show reward distribution modal
      setCompletingMission(mission);
      setRewardDistributions(mission.reward_items.map(item => ({
        item_id: item.id,
        item_name: item.name,
        assigned_character_id: null
      })));
      setShowRewardModal(true);
    }
  };

  const completeWithoutRewards = async (missionId: string) => {
    try {
      const { error } = await supabase
        .from('missions')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', missionId);
      
      if (error) throw error;
      
      alert('Mission marked as completed!');
      fetchData();
      
    } catch (err: any) {
      console.error('Error completing mission:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleDistributeRewards = async () => {
    if (!completingMission) return;
    
    // Check that all rewards have been assigned
    const unassigned = rewardDistributions.filter(rd => !rd.assigned_character_id);
    if (unassigned.length > 0) {
      alert(`Please assign all rewards. ${unassigned.length} reward(s) still unassigned.`);
      return;
    }
    
    try {
      // Mark mission as completed
      const { error: missionError } = await supabase
        .from('missions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', completingMission.id);
      
      if (missionError) throw missionError;
      
      // Insert reward distributions
      const distributions = rewardDistributions.map(rd => ({
        mission_id: completingMission.id,
        character_id: rd.assigned_character_id!,
        item_id: rd.item_id,
        distributed_by: profile?.id
      }));
      
      const { error: distError } = await supabase
        .from('mission_rewards_distributed')
        .insert(distributions);
      
      if (distError) throw distError;
      
      // Add items to character inventories
      for (const rd of rewardDistributions) {
        const item = items.find(i => i.id === rd.item_id);
        await supabase
          .from('inventory')
          .insert({
            character_id: rd.assigned_character_id!,
            item_id: rd.item_id,
            quantity: 1,
            is_equipped: false,
            current_uses: null // DM can handle consumable uses separately
          });
      }
      
      alert('Mission completed and rewards distributed!');
      setShowRewardModal(false);
      setCompletingMission(null);
      setRewardDistributions([]);
      fetchData();
      
    } catch (err: any) {
      console.error('Error distributing rewards:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteMission = async (missionId: string) => {
    if (!confirm('Are you sure you want to delete this mission? This action cannot be undone.')) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('missions')
        .delete()
        .eq('id', missionId);
      
      if (error) throw error;
      
      alert('Mission deleted successfully!');
      fetchData();
      
    } catch (err: any) {
      console.error('Error deleting mission:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const addObjectiveField = () => {
    setNewObjectives([...newObjectives, '']);
  };

  const updateObjective = (index: number, value: string) => {
    const updated = [...newObjectives];
    updated[index] = value;
    setNewObjectives(updated);
  };

  const removeObjective = (index: number) => {
    setNewObjectives(newObjectives.filter((_, i) => i !== index));
  };

  const filteredMissions = missions.filter(mission => {
    if (statusFilter !== 'all' && mission.status !== statusFilter) return false;
    if (typeFilter !== 'all' && mission.type !== typeFilter) return false;
    return true;
  });

  const getDifficultyColor = (difficulty: MissionDifficulty): string => {
    switch (difficulty) {
      case 'Low': return 'var(--color-cyber-cyan)';
      case 'Easy': return 'var(--color-cyber-green)';
      case 'Moderate': return 'var(--color-cyber-yellow)';
      case 'Difficult': return 'var(--color-cyber-orange)';
      case 'Dangerous': return 'var(--color-cyber-red)';
      case 'Extreme': return 'var(--color-cyber-pink)';
      case 'Suicide Mission': return 'var(--color-cyber-purple)';
      default: return 'var(--color-cyber-cyan)';
    }
  };

  const getTypeColor = (type: MissionType): string => {
    switch (type) {
      case 'MAIN MISSION': return 'var(--color-cyber-red)';
      case 'Character Mission': return 'var(--color-cyber-purple)';
      case 'Encounter': return 'var(--color-cyber-orange)';
      case 'Side Mission': return 'var(--color-cyber-cyan)';
      case 'Past Time': return 'var(--color-cyber-yellow)';
      default: return 'var(--color-cyber-cyan)';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-cyber-darker)' }}>
        <div className="glass-panel p-8 text-center">
          <div className="animate-spin w-12 h-12 border-4 rounded-full mx-auto mb-4" 
               style={{ borderColor: 'var(--color-cyber-green)', borderTopColor: 'transparent' }}></div>
          <p style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>LOADING MISSIONS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: 'var(--color-cyber-darker)' }}>
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button
              onClick={() => navigate('/dm/dashboard')}
              className="neon-button px-4 py-2 mb-4"
            >
              ← BACK TO DASHBOARD
            </button>
            <h1 className="text-4xl mb-2" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-green)' }}>
              📋 MISSION MANAGER
            </h1>
            <p style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
              Create and manage missions for your players
            </p>
          </div>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="neon-button px-6 py-3 text-lg"
            style={{ backgroundColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-darker)' }}
          >
            + CREATE MISSION
          </button>
        </div>

        {/* Filters */}
        <div className="glass-panel p-4 mb-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                STATUS FILTER
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as MissionStatus | 'all')}
                className="w-full px-4 py-2 rounded"
                style={{
                  backgroundColor: 'var(--color-cyber-dark)',
                  color: 'var(--color-cyber-cyan)',
                  border: '1px solid var(--color-cyber-green)',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                <option value="all">ALL</option>
                <option value="active">ACTIVE</option>
                <option value="completed">COMPLETED</option>
                <option value="failed">FAILED</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                TYPE FILTER
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as MissionType | 'all')}
                className="w-full px-4 py-2 rounded"
                style={{
                  backgroundColor: 'var(--color-cyber-dark)',
                  color: 'var(--color-cyber-cyan)',
                  border: '1px solid var(--color-cyber-green)',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                <option value="all">ALL TYPES</option>
                <option value="MAIN MISSION">MAIN MISSION</option>
                <option value="Character Mission">Character Mission</option>
                <option value="Side Mission">Side Mission</option>
                <option value="Encounter">Encounter</option>
                <option value="Past Time">Past Time</option>
              </select>
            </div>
          </div>
        </div>

        {/* Missions List */}
        <div className="space-y-4">
          {filteredMissions.length === 0 ? (
            <div className="glass-panel p-12 text-center">
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-2xl mb-2" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-green)' }}>
                NO MISSIONS FOUND
              </h3>
              <p style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                {statusFilter !== 'all' || typeFilter !== 'all' 
                  ? 'Try adjusting your filters' 
                  : 'Create your first mission to get started'}
              </p>
            </div>
          ) : (
            filteredMissions.map(mission => (
              <div 
                key={mission.id}
                className="glass-panel p-6"
                style={{ border: `2px solid ${getTypeColor(mission.type)}` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-2xl" style={{ fontFamily: 'var(--font-cyber)', color: getTypeColor(mission.type) }}>
                        {mission.title}
                      </h3>
                      <span 
                        className="text-xs px-3 py-1 rounded"
                        style={{ 
                          backgroundColor: getTypeColor(mission.type),
                          color: 'var(--color-cyber-darker)',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 'bold'
                        }}
                      >
                        {mission.type}
                      </span>
                      <span 
                        className="text-xs px-3 py-1 rounded"
                        style={{ 
                          backgroundColor: getDifficultyColor(mission.difficulty),
                          color: 'var(--color-cyber-darker)',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 'bold'
                        }}
                      >
                        {mission.difficulty}
                      </span>
                      <span 
                        className="text-xs px-3 py-1 rounded"
                        style={{ 
                          backgroundColor: mission.status === 'active' ? 'var(--color-cyber-green)' : mission.status === 'completed' ? 'var(--color-cyber-cyan)' : 'var(--color-cyber-red)',
                          color: 'var(--color-cyber-darker)',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 'bold'
                        }}
                      >
                        {mission.status.toUpperCase()}
                      </span>
                    </div>
                    
                    {mission.description && (
                      <p className="text-sm mb-3" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.8, fontFamily: 'var(--font-mono)' }}>
                        {mission.description}
                      </p>
                    )}
                    
                    {/* Objectives */}
                    <div className="mb-3">
                      <h4 className="text-sm mb-2" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                        OBJECTIVES:
                      </h4>
                      <ul className="list-disc list-inside space-y-1">
                        {mission.objectives.map((obj, idx) => (
                          <li key={idx} className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                            {obj}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    {/* Assignment */}
                    <div className="mb-3">
                      <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                        ASSIGNED TO:{' '}
                      </span>
                      <span className="text-sm" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                        {mission.assigned_to === null || mission.assigned_to.length === 0
                          ? '🎭 ENTIRE PARTY'
                          : mission.assigned_characters?.map(c => c.name).join(', ') || 'Unknown'}
                      </span>
                    </div>
                    
                    {/* Rewards */}
                    {mission.reward_items && mission.reward_items.length > 0 && (
                      <div className="mb-3">
                        <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                          REWARDS:{' '}
                        </span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {mission.reward_items.map(item => (
                            <span 
                              key={item.id}
                              className="text-xs px-2 py-1 rounded"
                              style={{ 
                                backgroundColor: 'var(--color-cyber-green)',
                                color: 'var(--color-cyber-darker)',
                                fontFamily: 'var(--font-mono)'
                              }}
                            >
                              {item.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex flex-col gap-2 ml-4">
                    {mission.status === 'active' && (
                      <button
                        onClick={() => handleMarkComplete(mission)}
                        className="neon-button px-4 py-2 text-sm whitespace-nowrap"
                        style={{ backgroundColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-darker)' }}
                      >
                        ✓ COMPLETE
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteMission(mission.id)}
                      className="neon-button px-4 py-2 text-sm whitespace-nowrap"
                      style={{ backgroundColor: 'var(--color-cyber-red)', color: 'var(--color-cyber-darker)' }}
                    >
                      🗑️ DELETE
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Mission Modal */}
      {showCreateModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)' }}
          onClick={() => setShowCreateModal(false)}
        >
          <div 
            className="glass-panel p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            style={{ border: '2px solid var(--color-cyber-green)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl mb-6" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-green)' }}>
              CREATE NEW MISSION
            </h2>
            
            {/* Title */}
            <div className="mb-4">
              <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                MISSION TITLE *
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Enter mission title..."
                className="w-full px-4 py-2 rounded"
                style={{
                  backgroundColor: 'var(--color-cyber-dark)',
                  color: 'var(--color-cyber-cyan)',
                  border: '1px solid var(--color-cyber-green)',
                  fontFamily: 'var(--font-mono)'
                }}
              />
            </div>
            
            {/* Description */}
            <div className="mb-4">
              <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                DESCRIPTION
              </label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Enter mission description..."
                rows={3}
                className="w-full px-4 py-2 rounded"
                style={{
                  backgroundColor: 'var(--color-cyber-dark)',
                  color: 'var(--color-cyber-cyan)',
                  border: '1px solid var(--color-cyber-green)',
                  fontFamily: 'var(--font-mono)'
                }}
              />
            </div>
            
            {/* Type and Difficulty */}
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  MISSION TYPE *
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as MissionType)}
                  className="w-full px-4 py-2 rounded"
                  style={{
                    backgroundColor: 'var(--color-cyber-dark)',
                    color: 'var(--color-cyber-cyan)',
                    border: '1px solid var(--color-cyber-green)',
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  <option value="Side Mission">Side Mission</option>
                  <option value="Character Mission">Character Mission</option>
                  <option value="Encounter">Encounter</option>
                  <option value="Past Time">Past Time</option>
                  <option value="MAIN MISSION">MAIN MISSION</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  DIFFICULTY *
                </label>
                <select
                  value={newDifficulty}
                  onChange={(e) => setNewDifficulty(e.target.value as MissionDifficulty)}
                  className="w-full px-4 py-2 rounded"
                  style={{
                    backgroundColor: 'var(--color-cyber-dark)',
                    color: 'var(--color-cyber-cyan)',
                    border: '1px solid var(--color-cyber-green)',
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  <option value="Low">Low</option>
                  <option value="Easy">Easy</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Difficult">Difficult</option>
                  <option value="Dangerous">Dangerous</option>
                  <option value="Extreme">Extreme</option>
                  <option value="Suicide Mission">Suicide Mission</option>
                </select>
              </div>
            </div>
            
            {/* Objectives */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  OBJECTIVES *
                </label>
                <button
                  onClick={addObjectiveField}
                  className="neon-button px-3 py-1 text-xs"
                  style={{ backgroundColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-darker)' }}
                >
                  + ADD OBJECTIVE
                </button>
              </div>
              {newObjectives.map((obj, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={obj}
                    onChange={(e) => updateObjective(idx, e.target.value)}
                    placeholder={`Objective ${idx + 1}...`}
                    className="flex-1 px-4 py-2 rounded"
                    style={{
                      backgroundColor: 'var(--color-cyber-dark)',
                      color: 'var(--color-cyber-cyan)',
                      border: '1px solid var(--color-cyber-green)',
                      fontFamily: 'var(--font-mono)'
                    }}
                  />
                  {newObjectives.length > 1 && (
                    <button
                      onClick={() => removeObjective(idx)}
                      className="neon-button px-3 py-2"
                      style={{ backgroundColor: 'var(--color-cyber-red)', color: 'var(--color-cyber-darker)' }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            {/* Assignment */}
            <div className="mb-4">
              <label className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={isPartyWide}
                  onChange={(e) => {
                    setIsPartyWide(e.target.checked);
                    if (e.target.checked) setNewAssignedTo([]);
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  ASSIGN TO ENTIRE PARTY
                </span>
              </label>
              
              {!isPartyWide && (
                <div>
                  <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                    SELECT CHARACTERS
                  </label>
                  <div className="grid md:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 rounded"
                       style={{ backgroundColor: 'var(--color-cyber-dark)', border: '1px solid var(--color-cyber-green)' }}>
                    {characters.map(char => (
                      <label key={char.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={newAssignedTo.includes(char.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewAssignedTo([...newAssignedTo, char.id]);
                            } else {
                              setNewAssignedTo(newAssignedTo.filter(id => id !== char.id));
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                          {char.name} ({char.class})
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Rewards */}
            <div className="mb-6">
              <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                REWARD ITEMS (Players will decide who gets what)
              </label>
              <div className="grid md:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 rounded"
                   style={{ backgroundColor: 'var(--color-cyber-dark)', border: '1px solid var(--color-cyber-green)' }}>
                {items.map(item => (
                  <label key={item.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newRewardIds.includes(item.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewRewardIds([...newRewardIds, item.id]);
                        } else {
                          setNewRewardIds(newRewardIds.filter(id => id !== item.id));
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                      {item.name} ({item.rarity})
                    </span>
                  </label>
                ))}
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={handleCreateMission}
                className="flex-1 neon-button py-3"
                style={{ backgroundColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-darker)' }}
              >
                CREATE MISSION
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 neon-button py-3"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reward Distribution Modal */}
      {showRewardModal && completingMission && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)' }}
          onClick={() => setShowRewardModal(false)}
        >
          <div 
            className="glass-panel p-6 max-w-2xl w-full"
            style={{ border: '2px solid var(--color-cyber-green)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-green)' }}>
              DISTRIBUTE REWARDS
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
              Assign each reward item to a character. The party should have already decided who gets what.
            </p>
            
            <div className="space-y-4 mb-6">
              {rewardDistributions.map((reward, idx) => (
                <div key={idx} className="glass-panel p-4">
                  <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                    {reward.item_name}
                  </label>
                  <select
                    value={reward.assigned_character_id || ''}
                    onChange={(e) => {
                      const updated = [...rewardDistributions];
                      updated[idx].assigned_character_id = e.target.value || null;
                      setRewardDistributions(updated);
                    }}
                    className="w-full px-4 py-2 rounded"
                    style={{
                      backgroundColor: 'var(--color-cyber-dark)',
                      color: 'var(--color-cyber-cyan)',
                      border: '1px solid var(--color-cyber-green)',
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    <option value="">-- Select Character --</option>
                    {characters.map(char => (
                      <option key={char.id} value={char.id}>
                        {char.name} ({char.class})
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={handleDistributeRewards}
                className="flex-1 neon-button py-3"
                style={{ backgroundColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-darker)' }}
              >
                COMPLETE & DISTRIBUTE
              </button>
              <button
                onClick={() => setShowRewardModal(false)}
                className="flex-1 neon-button py-3"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
