import type { MissionWithDetails, MissionStatus } from '../../types/mission';

interface MissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  missions: MissionWithDetails[];
  missionFilter: MissionStatus | 'all';
  setMissionFilter: (f: MissionStatus | 'all') => void;
  selectedMission: MissionWithDetails | null;
  setSelectedMission: (m: MissionWithDetails | null) => void;
}

export default function MissionsModal({ isOpen, onClose, missions, missionFilter, setMissionFilter, selectedMission, setSelectedMission }: MissionsModalProps) {
  if (!isOpen) return null;

  const filtered = missions.filter(m => missionFilter === 'all' || m.status === missionFilter);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50">
      <div
        className="w-full sm:max-w-2xl max-h-[85vh] rounded-t-xl sm:rounded-xl overflow-hidden flex flex-col"
        style={{ background: 'var(--color-dark-bg)', border: '2px solid var(--color-cyber-yellow)', boxShadow: '0 0 40px rgba(255, 215, 0, 0.15)' }}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4" style={{ borderBottom: '1px solid color-mix(in srgb, var(--color-cyber-yellow) 30%, transparent)' }}>
          <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)' }}>📋 MISSION LOG</h3>
          <button onClick={onClose} className="text-xl px-2" style={{ color: 'var(--color-cyber-magenta)' }}>✕</button>
        </div>

        {/* Filter Bar */}
        <div className="flex gap-2 p-3" style={{ borderBottom: '1px solid color-mix(in srgb, var(--color-cyber-yellow) 15%, transparent)' }}>
          {(['all', 'active', 'completed', 'failed'] as const).map(filter => (
            <button
              key={filter}
              onClick={() => setMissionFilter(filter)}
              className="px-3 py-1 text-xs rounded"
              style={{
                background: missionFilter === filter ? 'var(--color-cyber-yellow)' : 'transparent',
                color: missionFilter === filter ? 'white' : 'var(--color-cyber-cyan)',
                border: `1px solid ${missionFilter === filter ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-green)'}`,
                fontWeight: missionFilter === filter ? 'bold' : 'normal'
              }}
            >
              {filter.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4" style={{ scrollbarWidth: 'thin' }}>
          {filtered.length === 0 ? (
            <div className="text-center py-8" style={{ border: '2px dashed color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', borderRadius: '8px' }}>
              <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                No {missionFilter !== 'all' ? missionFilter : ''} missions
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(mission => (
                <div
                  key={mission.id}
                  className="p-4 rounded cursor-pointer hover:opacity-80 transition-opacity"
                  style={{
                    border: `1px solid ${mission.status === 'active' ? 'var(--color-cyber-yellow)' : 'color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)'}`,
                    background: mission.status === 'active' ? 'color-mix(in srgb, var(--color-cyber-yellow) 5%, transparent)' : 'transparent'
                  }}
                  onClick={() => setSelectedMission(selectedMission?.id === mission.id ? null : mission)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold" style={{ color: mission.status === 'active' ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>
                        {mission.title}
                      </div>
                      <div className="text-xs flex gap-2 mt-1" style={{ fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: 'var(--color-cyber-green)' }}>{mission.type}</span>
                        <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>|</span>
                        <span style={{ color: 'var(--color-cyber-cyan)' }}>{mission.difficulty}</span>
                      </div>
                    </div>
                    <span
                      className="text-xs px-2 py-1 rounded"
                      style={{
                        background: mission.status === 'active' ? 'var(--color-cyber-yellow)' :
                                   mission.status === 'completed' ? 'var(--color-cyber-cyan)' :
                                   'var(--color-cyber-magenta)',
                        color: 'white', fontWeight: 'bold'
                      }}
                    >
                      {mission.status.toUpperCase()}
                    </span>
                  </div>

                  {selectedMission?.id === mission.id && (
                    <div className="mt-4 pt-4" style={{ borderTop: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' }}>
                      <p className="text-sm mb-3" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.8 }}>{mission.description}</p>
                      {mission.objectives && mission.objectives.length > 0 && (
                        <div className="text-xs">
                          <div className="mb-1" style={{ color: 'var(--color-cyber-green)' }}>OBJECTIVES:</div>
                          {mission.objectives.map((obj: string, i: number) => (
                            <div key={i} className="flex items-center gap-2" style={{ color: 'var(--color-cyber-cyan)' }}>
                              <span style={{ color: 'var(--color-cyber-green)' }}>{i + 1}.</span>
                              <span>{obj}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {mission.reward_credits && mission.reward_credits > 0 && (
                        <div className="mt-2 text-xs" style={{ color: 'var(--color-cyber-yellow)' }}>
                          💰 ${mission.reward_credits.toLocaleString()} credit reward
                        </div>
                      )}
                      {mission.reward_item_ids && mission.reward_item_ids.length > 0 && (
                        <div className="mt-2 text-xs" style={{ color: 'var(--color-cyber-green)' }}>
                          🎁 {mission.reward_item_ids.length} reward item{mission.reward_item_ids.length > 1 ? 's' : ''} available
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
