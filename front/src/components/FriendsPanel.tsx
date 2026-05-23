import React, { useState, useEffect } from 'react';
import { Search, UserPlus, Users, Check, X, Clock, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';
import { authFetch } from '../utils/api';

interface FriendsPanelProps {
  onClose: () => void;
}

export default function FriendsPanel({ onClose }: FriendsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [friends, setFriends] = useState<User[]>([]);
  const [pendingReceived, setPendingReceived] = useState<any[]>([]);
  const [pendingSent, setPendingSent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchFriends = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/friends');
      const data = await res.json();
      if (data.success) {
        setFriends(data.data.friends);
        setPendingReceived(data.data.pendingReceived);
        setPendingSent(data.data.pendingSent);
      }
    } catch (err) {
      console.error("Failed to fetch friends:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFriends(); }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await authFetch(`/api/users/search?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      if (data.success) setSearchResults(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (toUserId: string) => {
    try {
      const res = await authFetch('/api/friends/request', {
        method: 'POST',
        body: JSON.stringify({ toUserId }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg("名帖已递，静候回音。");
        setSearchResults([]);
        setSearchQuery('');
        fetchFriends();
      } else {
        setActionMsg(data.error);
      }
    } catch { setActionMsg("递帖失败。"); }
    setTimeout(() => setActionMsg(null), 2500);
  };

  const handleAccept = async (id: string) => {
    try {
      const res = await authFetch(`/api/friends/${id}/accept`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setActionMsg("已纳为朝中挚友！");
        fetchFriends();
      }
    } catch { setActionMsg("操作失败。"); }
    setTimeout(() => setActionMsg(null), 2500);
  };

  const handleReject = async (id: string) => {
    try {
      const res = await authFetch(`/api/friends/${id}/reject`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setActionMsg("已婉拒此帖。");
        fetchFriends();
      }
    } catch { setActionMsg("操作失败。"); }
    setTimeout(() => setActionMsg(null), 2500);
  };

  const isFriendOrPending = (userId: string) => {
    return friends.some((f: any) => f.id === userId) ||
      pendingSent.some((p: any) => p.toUserId === userId || p.toUser?.id === userId) ||
      pendingReceived.some((p: any) => p.fromUserId === userId || p.fromUser?.id === userId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E1A17]/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg overflow-hidden border-4 border-double border-[#A93226]/60 rounded-xl bg-[#FAF6ED] text-[#2F2722] shadow-2xl max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-[#A93226] border-b border-[#87251B] shrink-0">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-200" />
            <h2 className="font-serif text-md font-bold text-white tracking-widest">朝臣名录 · 好友通讯</h2>
          </div>
          <button onClick={onClose} className="px-3 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/20 text-white font-serif tracking-wider transition-colors cursor-pointer">
            退下
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {/* Action message toast */}
          <AnimatePresence>
            {actionMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-2.5 text-xs rounded-lg bg-[#2E5C50]/10 border border-[#2E5C50]/30 text-[#2E5C50] font-serif font-bold text-center"
              >
                {actionMsg}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search users section */}
          <div className="space-y-3">
            <h3 className="text-xs font-serif font-bold text-[#7C6647] flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-[#A93226]" /> 搜寻朝中同僚
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="输入名号或用户名..."
                className="flex-1 px-3 py-2 text-xs bg-[#FCFAF5] border border-[#DCD3BE] rounded-lg focus:border-[#A93226] focus:outline-none text-[#2F2722] placeholder-[#A09384] transition"
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                className="px-4 py-2 text-xs font-serif font-bold bg-[#A93226] hover:bg-[#87251B] text-white rounded-lg transition cursor-pointer disabled:opacity-60"
              >
                {searching ? '寻...' : '搜寻'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-[#FCFAF5] border border-[#DCD3BE]">
                    <div>
                      <p className="text-xs font-serif font-bold text-[#2F2722]">{u.displayName}</p>
                      <p className="text-[10px] text-[#7C6647] font-serif">@{u.username} · {u.avatarTitle}</p>
                    </div>
                    {isFriendOrPending(u.id) ? (
                      <span className="text-[10px] text-[#2E5C50] font-serif font-bold px-2 py-1 bg-[#2E5C50]/10 rounded border border-[#2E5C50]/20">已关联</span>
                    ) : (
                      <button
                        onClick={() => handleSendRequest(u.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-serif font-bold bg-[#FAF6ED] hover:bg-[#A93226] hover:text-white text-[#A93226] border border-[#A93226]/30 hover:border-[#A93226] rounded-lg transition cursor-pointer"
                      >
                        <UserPlus className="w-3 h-3" /> 递交名帖
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending received requests */}
          {pendingReceived.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-serif font-bold text-[#A93226] flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" /> 待接纳的名帖 ({pendingReceived.length})
              </h3>
              <div className="space-y-2">
                {pendingReceived.map((req: any) => (
                  <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-[#FFF5F4] border border-[#A93226]/20">
                    <div>
                      <p className="text-xs font-serif font-bold text-[#2F2722]">{req.fromUser?.displayName || '未知'}</p>
                      <p className="text-[10px] text-[#7C6647] font-serif">@{req.fromUser?.username} · {req.fromUser?.avatarTitle}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleAccept(req.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-serif font-bold bg-[#2E5C50] text-white rounded-lg hover:brightness-110 transition cursor-pointer"
                      >
                        <Check className="w-3 h-3" /> 接纳
                      </button>
                      <button
                        onClick={() => handleReject(req.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-serif font-bold bg-[#FAF6ED] text-[#6E6357] border border-[#DCD3BE] rounded-lg hover:bg-[#EFE9DA] transition cursor-pointer"
                      >
                        <X className="w-3 h-3" /> 婉拒
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending sent */}
          {pendingSent.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-serif font-bold text-[#7C6647] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#A93226]" /> 已递出的名帖
              </h3>
              <div className="space-y-2">
                {pendingSent.map((req: any) => (
                  <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-[#FAF6ED] border border-[#DCD3BE]">
                    <div>
                      <p className="text-xs font-serif font-bold text-[#2F2722]">{req.toUser?.displayName || '未知'}</p>
                      <p className="text-[10px] text-[#7C6647] font-serif">@{req.toUser?.username}</p>
                    </div>
                    <span className="text-[10px] text-[#A09384] font-serif flex items-center gap-1">
                      <Clock className="w-3 h-3" /> 等候回音
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Friends list */}
          <div className="space-y-3">
            <h3 className="text-xs font-serif font-bold text-[#7C6647] flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#A93226]" /> 朝中挚友 ({friends.length})
            </h3>
            {loading ? (
              <div className="text-center py-8">
                <div className="w-6 h-6 border-3 border-[#A93226] border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-[10px] text-[#7C6647] font-serif mt-2">名册调取中...</p>
              </div>
            ) : friends.length === 0 ? (
              <div className="text-center py-8 text-[#A09384] font-serif">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-25" />
                <p className="text-xs">尚无朝中挚友，搜寻同僚递交名帖结交吧。</p>
              </div>
            ) : (
              <div className="space-y-2">
                {friends.map((f: any) => (
                  <div key={f.id} className="flex items-center justify-between p-3 rounded-lg bg-[#FCFAF5] border border-[#DCD3BE] hover:border-[#A93226]/40 transition">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#A93226] text-white flex items-center justify-center text-xs font-serif font-black">
                        {(f.displayName || '?')[0]}
                      </div>
                      <div>
                        <p className="text-xs font-serif font-bold text-[#2F2722]">{f.displayName}</p>
                        <p className="text-[10px] text-[#7C6647] font-serif">{f.avatarTitle} · @{f.username}</p>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 bg-[#2E5C50]/10 text-[#2E5C50] border border-[#2E5C50]/20 rounded font-serif font-bold">挚友</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
