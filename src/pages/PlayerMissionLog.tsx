import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { MissionWithDetails, MissionType, MissionDifficulty, MissionStatus } from '../types/mission';

interface Character {
  id: string;
  name: string;
  class: string;
}

export default function PlayerMissionLog() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [missions, setMissions] = useState<MissionWithDetails[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<MissionStatus | 'all'>('active');
  const [selectedMission, setSelectedMission] = useState<MissionWithDetails | null>(null);

  useEffect(() => {
    fetchData();
  }, [profile]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch player's characters
      const { data: charsData, error: charsError } = await supabase
        .from('characters')
        .select('id, name, class')
        .eq('user_id', profile?.id);
      
      if (charsError) throw charsError;
      setCharacters(charsData || []);
      
      const characterIds = charsData?.map(c => c.id) || [];
      
      // Fetch missions (party-wide or assigned to player's characters)
      const { data: missionsData, error: missionsError } = await supabase
        .from('missions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (missionsError) throw missionsError;
      
      // Filter to missions assigned to this player
      const playerMissions = (missionsData || []).filter(mission => 
        mission.assigned_to === null || // Party-wide
        mission.assigned_to?.some((charId: string) => characterIds.includes(charId)) // Assigned to player's character
      );
      
      // Fetch item details for rewards
      const allRewardIds = playerMissions
        .flatMap(m => m.reward_item_ids || [])
        .filter((id, idx, arr) => arr.indexOf(id) === idx); // unique
      
      let itemsData: any[] = [];
      if (allRewardIds.length > 0) {
        const { data, error } = await supabase
          .from('items')
          .select('id, name, rarity, type')
          .in('id', allRewardIds);
        
        if (!error) itemsData = data || [];
      }
      
      // Enrich missions with reward details
      const enrichedMissions = playerMissions.map(mission => ({
        ...mission,
        reward_items: mission.reward_item_ids
          ? itemsData.filter(i => mission.reward_item_ids?.includes(i.id))
          : []
      }));
      
      setMissions(enrichedMissions);
      
    } catch (err: any) {
      console.error('Error fetching missions:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredMissions = missions.filter(mission => {
    if (statusFilter !== 'all' && mission.status !== statusFilter) return false;
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
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="neon-button px-4 py-2 mb-4"
          >
            ← BACK TO DASHBOARD
          </button>
          <h1 className="text-4xl mb-2" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-green)' }}>
            📋 MISSION LOG
          </h1>
          <p style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
            Track your active and completed missions
          </p>
        </div>

        {/* Status Filter */}
        <div className="glass-panel p-4 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className="neon-button px-4 py-2 text-sm"
              style={{
                backgroundColor: statusFilter === 'all' ? 'var(--color-cyber-green)' : 'transparent',
                color: statusFilter === 'all' ? 'var(--color-cyber-darker)' : 'var(--color-cyber-green)'
              }}
            >
              ALL
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className="neon-button px-4 py-2 text-sm"
              style={{
                backgroundColor: statusFilter === 'active' ? 'var(--color-cyber-green)' : 'transparent',
                color: statusFilter === 'active' ? 'var(--color-cyber-darker)' : 'var(--color-cyber-green)'
              }}
            >
              ACTIVE
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className="neon-button px-4 py-2 text-sm"
              style={{
                backgroundColor: statusFilter === 'completed' ? 'var(--color-cyber-green)' : 'transparent',
                color: statusFilter === 'completed' ? 'var(--color-cyber-darker)' : 'var(--color-cyber-green)'
              }}
            >
              COMPLETED
            </button>
            <button
              onClick={() => setStatusFilter('failed')}
              className="neon-button px-4 py-2 text-sm"
              style={{
                backgroundColor: statusFilter === 'failed' ? 'var(--color-cyber-green)' : 'transparent',
                color: statusFilter === 'failed' ? 'var(--color-cyber-darker)' : 'var(--color-cyber-green)'
              }}
            >
              FAILED
            </button>
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
                {statusFilter !== 'all' 
                  ? 'No missions with this status' 
                  : 'You don\'t have any missions yet'}
              </p>
            </div>
          ) : (
            filteredMissions.map(mission => (
              <div 
                key={mission.id}
                className="glass-panel p-6 cursor-pointer hover:brightness-110 transition-all"
                style={{ border: `2px solid ${getTypeColor(mission.type)}` }}
                onClick={() => setSelectedMission(mission)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
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
                    
                    <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                      <span>📝 {mission.objectives.length} Objectives</span>
                      {mission.reward_items && mission.reward_items.length > 0 && (
                        <span>🎁 {mission.reward_items.length} Rewards</span>
                      )}
                      {mission.assigned_to === null || mission.assigned_to.length === 0 ? (
                        <span>🎭 Party Mission</span>
                      ) : (
                        <span>👤 Personal Mission</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right ml-4">
                    <button
                      className="text-sm px-4 py-2 rounded"
                      style={{
                        backgroundColor: 'var(--color-cyber-green)',
                        color: 'var(--color-cyber-darker)',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 'bold'
                      }}
                    >
                      VIEW DETAILS →
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Mission Detail Modal */}
      {selectedMission && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)' }}
          onClick={() => setSelectedMission(null)}
        >
          <div 
            className="glass-panel p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            style={{ border: `3px solid ${getTypeColor(selectedMission.type)}` }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <h2 className="text-3xl" style={{ fontFamily: 'var(--font-cyber)', color: getTypeColor(selectedMission.type) }}>
                  {selectedMission.title}
                </h2>
                <span 
                  className="text-sm px-3 py-1 rounded"
                  style={{ 
                    backgroundColor: getTypeColor(selectedMission.type),
                    color: 'var(--color-cyber-darker)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 'bold'
                  }}
                >
                  {selectedMission.type}
                </span>
                <span 
                  className="text-sm px-3 py-1 rounded"
                  style={{ 
                    backgroundColor: getDifficultyColor(selectedMission.difficulty),
                    color: 'var(--color-cyber-darker)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 'bold'
                  }}
                >
                  {selectedMission.difficulty}
                </span>
                <span 
                  className="text-sm px-3 py-1 rounded"
                  style={{ 
                    backgroundColor: selectedMission.status === 'active' ? 'var(--color-cyber-green)' : selectedMission.status === 'completed' ? 'var(--color-cyber-cyan)' : 'var(--color-cyber-red)',
                    color: 'var(--color-cyber-darker)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 'bold'
                  }}
                >
                  {selectedMission.status.toUpperCase()}
                </span>
              </div>
              
              {selectedMission.description && (
                <p className="text-base mb-4" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', lineHeight: '1.6' }}>
                  {selectedMission.description}
                </p>
              )}
            </div>

            {/* Objectives */}
            <div className="mb-6">
              <h3 className="text-xl mb-3" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-green)' }}>
                📝 OBJECTIVES
              </h3>
              <div className="space-y-2">
                {selectedMission.objectives.map((obj, idx) => (
                  <div 
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--color-cyber-green) 10%, transparent)' }}
                  >
                    <span className="text-lg" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                      {idx + 1}.
                    </span>
                    <p style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', flex: 1 }}>
                      {obj}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Rewards */}
            {selectedMission.reward_items && selectedMission.reward_items.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xl mb-3" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-green)' }}>
                  🎁 REWARDS
                </h3>
                <div className="grid md:grid-cols-2 gap-3">
                  {selectedMission.reward_items.map(item => (
                    <div 
                      key={item.id}
                      className="p-3 rounded"
                      style={{ backgroundColor: 'color-mix(in srgb, var(--color-cyber-green) 10%, transparent)', border: '1px solid var(--color-cyber-green)' }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-cyber)' }}>
                          {item.name}
                        </span>
                        <span 
                          className="text-xs px-2 py-1 rounded"
                          style={{ backgroundColor: 'var(--color-cyber-cyan)', color: 'var(--color-cyber-darker)', fontFamily: 'var(--font-mono)' }}
                        >
                          {item.rarity}
                        </span>
                      </div>
                      <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                        {item.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Assignment Info */}
            <div className="mb-6 p-4 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)' }}>
              <span className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                ASSIGNED TO:{' '}
              </span>
              <span className="text-base" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                {selectedMission.assigned_to === null || selectedMission.assigned_to.length === 0
                  ? '🎭 ENTIRE PARTY'
                  : '👤 PERSONAL MISSION'}
              </span>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setSelectedMission(null)}
              className="w-full neon-button py-3"
              style={{ backgroundColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-darker)' }}
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
