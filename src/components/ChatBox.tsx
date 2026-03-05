import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCampaign } from '../contexts/CampaignContext';

interface Message {
  id: string;
  campaign_id: string;
  sender_id: string;
  content: string;
  target_type: 'all' | 'dm' | 'player';
  target_player_id: string | null;
  created_at: string;
  sender?: { username: string };
  target_player?: { username: string };
}

interface CampaignMember {
  user_id: string;
  role: string;
  profile: { username: string };
}

export default function ChatBox() {
  const { user } = useAuth();
  const { campaignId } = useCampaign();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [members, setMembers] = useState<CampaignMember[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionFilter, setSuggestionFilter] = useState('');
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatBodyRef = useRef<HTMLDivElement>(null);

  // Fetch campaign members for autocomplete
  useEffect(() => {
    if (!campaignId) return;
    const fetchMembers = async () => {
      const { data } = await supabase
        .from('campaign_members')
        .select('user_id, role, profile:profiles(username)')
        .eq('campaign_id', campaignId);
      if (data) {
        setMembers(data.map((m: any) => ({
          user_id: m.user_id,
          role: m.role,
          profile: { username: m.profile?.username || 'Unknown' }
        })));
      }
    };
    fetchMembers();
  }, [campaignId]);

  // Fetch existing messages
  const fetchMessages = useCallback(async () => {
    if (!campaignId) return;
    const { data } = await supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(username), target_player:profiles!target_player_id(username)')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true })
      .limit(100);
    if (data) {
      setMessages(data as Message[]);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!campaignId) return;
    const channel = supabase
      .channel(`chat-${campaignId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `campaign_id=eq.${campaignId}`
      }, async (payload) => {
        // Fetch the full message with sender info
        const { data } = await supabase
          .from('messages')
          .select('*, sender:profiles!sender_id(username), target_player:profiles!target_player_id(username)')
          .eq('id', payload.new.id)
          .single();
        if (data) {
          setMessages(prev => [...prev, data as Message]);
          if (!isOpen) {
            setUnreadCount(c => c + 1);
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [campaignId, isOpen]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Parse input for slash commands
  const parseInput = (text: string): { type: 'all' | 'dm' | 'player'; targetName?: string; content: string } => {
    if (text.startsWith('/dm ') || text === '/dm') {
      return { type: 'dm', content: text.slice(3).trim() };
    }
    if (text.startsWith('/')) {
      const spaceIdx = text.indexOf(' ');
      if (spaceIdx === -1) {
        return { type: 'player', targetName: text.slice(1), content: '' };
      }
      return { type: 'player', targetName: text.slice(1, spaceIdx), content: text.slice(spaceIdx + 1).trim() };
    }
    return { type: 'all', content: text };
  };

  // Handle input change with autocomplete
  const handleInputChange = (value: string) => {
    setInput(value);
    
    // Check for / prefix to show player suggestions
    if (value.startsWith('/') && !value.startsWith('/dm')) {
      const partial = value.slice(1).split(' ')[0].toLowerCase();
      // Only show suggestions if we're still typing the name (no space yet or just the slash)
      if (!value.includes(' ') || value.indexOf(' ') > value.lastIndexOf('/')) {
        setSuggestionFilter(partial);
        setShowSuggestions(true);
        setSelectedSuggestion(0);
        return;
      }
    }
    setShowSuggestions(false);
  };

  // Filtered members for autocomplete
  const filteredMembers = members.filter(m => {
    if (m.user_id === user?.id) return false; // Don't suggest yourself
    return m.profile.username.toLowerCase().includes(suggestionFilter);
  });

  // Handle suggestion selection
  const selectSuggestion = (member: CampaignMember) => {
    // If the member is a DM, use /dm shortcut
    if (member.role === 'admin' || member.role === 'dm') {
      setInput(`/dm `);
    } else {
      setInput(`/${member.profile.username} `);
    }
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  // Send message
  const handleSend = async () => {
    if (!input.trim() || !campaignId || !user) return;
    
    const parsed = parseInput(input);
    if (!parsed.content) return;

    let targetPlayerId: string | null = null;

    if (parsed.type === 'dm') {
      // Find the DM/admin
      const dm = members.find(m => m.role === 'admin' || m.role === 'dm');
      if (dm) targetPlayerId = dm.user_id;
    } else if (parsed.type === 'player' && parsed.targetName) {
      const target = members.find(m => 
        m.profile.username.toLowerCase() === parsed.targetName!.toLowerCase()
      );
      if (!target) {
        // Invalid player name — don't send
        return;
      }
      targetPlayerId = target.user_id;
    }

    const { error } = await supabase.from('messages').insert({
      campaign_id: campaignId,
      sender_id: user.id,
      content: parsed.content,
      target_type: parsed.type,
      target_player_id: targetPlayerId,
    });

    if (!error) {
      setInput('');
      setShowSuggestions(false);
    }
  };

  // Key handler for autocomplete navigation + send
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestion(s => Math.min(s + 1, filteredMembers.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestion(s => Math.max(s - 1, 0));
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        if (filteredMembers[selectedSuggestion]) {
          e.preventDefault();
          selectSuggestion(filteredMembers[selectedSuggestion]);
          return;
        }
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        return;
      }
    }
    if (e.key === 'Enter' && !showSuggestions) {
      e.preventDefault();
      handleSend();
    }
  };

  // Determine message label color/prefix
  const getMessageMeta = (msg: Message) => {
    const isMine = msg.sender_id === user?.id;
    const senderName = (msg.sender as any)?.username || 'Unknown';
    
    if (msg.target_type === 'dm') {
      return {
        prefix: isMine ? `To DM` : `Whisper`,
        color: 'var(--color-cyber-purple)',
        senderName,
        isWhisper: true,
      };
    }
    if (msg.target_type === 'player') {
      const targetName = (msg.target_player as any)?.username || 'someone';
      return {
        prefix: isMine ? `To ${targetName}` : `Whisper`,
        color: 'var(--color-cyber-purple)',
        senderName,
        isWhisper: true,
      };
    }
    return {
      prefix: null,
      color: 'var(--color-cyber-cyan)',
      senderName,
      isWhisper: false,
    };
  };

  const handleOpen = () => {
    setIsOpen(true);
    setUnreadCount(0);
  };

  // Get input hint  
  const getInputHint = () => {
    if (input.startsWith('/dm ')) return '🔒 Whispering to DM';
    if (input.startsWith('/') && !input.startsWith('/dm')) {
      const name = input.slice(1).split(' ')[0];
      if (name && input.includes(' ')) return `🔒 Whispering to ${name}`;
      return '🔍 Type a player name...';
    }
    return '📢 Message everyone';
  };

  if (!campaignId) return null;

  return (
    <>
      {/* Floating chat toggle button */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110"
          style={{
            background: 'var(--color-cyber-cyan)',
            color: 'white',
            fontFamily: 'var(--font-mono)',
            fontSize: '1.25rem',
          }}
        >
          💬
          {unreadCount > 0 && (
            <span
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold"
              style={{ background: 'var(--color-cyber-magenta)', color: 'white' }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed bottom-4 right-4 z-50 flex flex-col shadow-xl rounded-lg overflow-hidden"
          style={{
            width: '340px',
            height: '420px',
            background: 'var(--color-cyber-darker)',
            border: '1px solid var(--color-cyber-green)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-3 py-2 shrink-0"
            style={{ background: 'var(--color-cyber-dark)', borderBottom: '1px solid var(--color-cyber-green)' }}
          >
            <span className="text-sm font-bold" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
              💬 COMMS
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-xs px-2 py-1 rounded"
              style={{ color: 'var(--color-cyber-magenta)', border: '1px solid var(--color-cyber-magenta)' }}
            >
              ✕
            </button>
          </div>

          {/* Messages area */}
          <div
            ref={chatBodyRef}
            className="flex-1 overflow-y-auto px-3 py-2 space-y-2"
            style={{ fontSize: '0.8rem' }}
          >
            {messages.length === 0 && (
              <div className="text-center py-8" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4, fontFamily: 'var(--font-mono)' }}>
                No messages yet. Say hello!
              </div>
            )}
            {messages.map(msg => {
              const meta = getMessageMeta(msg);
              const isMine = msg.sender_id === user?.id;
              return (
                <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="text-xs font-bold" style={{ color: meta.color, fontFamily: 'var(--font-mono)' }}>
                      {meta.senderName}
                    </span>
                    {meta.prefix && (
                      <span className="text-xs px-1 rounded" style={{ background: 'rgba(128,0,255,0.2)', color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)' }}>
                        {meta.prefix}
                      </span>
                    )}
                    <span className="text-xs" style={{ opacity: 0.3 }}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div
                    className="px-2 py-1 rounded max-w-[85%]"
                    style={{
                      background: meta.isWhisper
                        ? 'rgba(128,0,255,0.15)'
                        : isMine
                          ? 'color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)'
                          : 'color-mix(in srgb, var(--color-cyber-dark) 80%, transparent)',
                      border: meta.isWhisper
                        ? '1px solid rgba(128,0,255,0.3)'
                        : '1px solid color-mix(in srgb, var(--color-cyber-green) 30%, transparent)',
                      color: 'var(--color-text, #E6EDF3)',
                      fontFamily: 'var(--font-mono)',
                      wordBreak: 'break-word',
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="shrink-0 px-3 py-2 relative" style={{ borderTop: '1px solid var(--color-cyber-green)' }}>
            {/* Input hint */}
            <div className="text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
              {getInputHint()}
            </div>

            {/* Autocomplete suggestions */}
            {showSuggestions && filteredMembers.length > 0 && (
              <div
                className="absolute bottom-full left-3 right-3 mb-1 rounded overflow-hidden shadow-lg"
                style={{ background: 'var(--color-cyber-dark)', border: '1px solid var(--color-cyber-green)', maxHeight: '150px', overflowY: 'auto' }}
              >
                {filteredMembers.map((m, idx) => (
                  <button
                    key={m.user_id}
                    className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2"
                    style={{
                      background: idx === selectedSuggestion ? 'color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' : 'transparent',
                      color: 'var(--color-cyber-cyan)',
                      fontFamily: 'var(--font-mono)',
                    }}
                    onMouseEnter={() => setSelectedSuggestion(idx)}
                    onClick={() => selectSuggestion(m)}
                  >
                    <span style={{ color: (m.role === 'admin' || m.role === 'dm') ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-cyan)' }}>
                      {(m.role === 'admin' || m.role === 'dm') ? '👑' : '🧑'}
                    </span>
                    <span>{m.profile.username}</span>
                    {(m.role === 'admin' || m.role === 'dm') && (
                      <span className="text-xs" style={{ opacity: 0.5 }}>DM</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="/dm, /name, or message all..."
                className="flex-1 px-2 py-1.5 rounded text-sm"
                style={{
                  background: 'var(--color-cyber-dark)',
                  border: '1px solid var(--color-cyber-green)',
                  color: 'var(--color-text, #E6EDF3)',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleSend}
                className="px-3 py-1.5 rounded text-sm font-bold"
                style={{
                  background: 'var(--color-cyber-cyan)',
                  color: 'white',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
