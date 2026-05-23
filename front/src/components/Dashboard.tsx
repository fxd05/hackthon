import React, { useState, useEffect } from 'react';
import { Scroll, Sparkles, Filter, Plus, RotateCcw, CheckCircle, Search, Users, LogOut, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Memorial } from '../types';
import { authFetch } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import MemorialDetail from './MemorialDetail';
import SubmitMemorial from './SubmitMemorial';
import BriefingView from './BriefingView';
import FriendsPanel from './FriendsPanel';
import ProfilePanel from './ProfilePanel';

// @ts-ignore
import emperorCat from '../assets/images/emperor_cat_scholar_1779528358177.png';

export const replaceOldTitles = (text: string) => {
  if (!text) return "";
  return text
    .replace(/工部司/g, '创意坊')
    .replace(/工部/g, '创意坊')
    .replace(/刑部司/g, '寻乐记')
    .replace(/刑部/g, '寻乐记')
    .replace(/兵部司/g, '寻乐记')
    .replace(/兵部/g, '寻乐记')
    .replace(/户部司/g, '经略阁')
    .replace(/户部/g, '经略阁')
    .replace(/礼部司/g, '经略阁')
    .replace(/礼部/g, '经略阁');
};

export default function Dashboard() {
  const { user, logout } = useAuth();

  const [memorials, setMemorials] = useState<Memorial[]>([]);
  const [sentMemorials, setSentMemorials] = useState<Memorial[]>([]);
  const [activeTab, setActiveTab] = useState<'desk' | 'sent' | 'briefing'>('desk');
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');
  const [searchQuery, setSearchQuery] = useState('');

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedMemorial, setSelectedMemorial] = useState<Memorial | null>(null);
  const [showFriendsPanel, setShowFriendsPanel] = useState(false);
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [pendingFriendCount, setPendingFriendCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const categories = ['全部', '经略阁', '寻乐记', '创意坊'];

  const fetchMemorials = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch('/api/memorials');
      const result = await response.json();
      if (result.success) {
        setMemorials(result.data);
      } else {
        setError("无法获取奏折清单。");
      }
    } catch (err) {
      console.error(err);
      setError("朝廷飞鸽传书受阻，未能联系到大内文渊阁。");
    } finally {
      setLoading(false);
    }
  };

  const fetchSentMemorials = async () => {
    try {
      const response = await authFetch('/api/memorials/sent');
      const result = await response.json();
      if (result.success) setSentMemorials(result.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchFriendCount = async () => {
    try {
      const response = await authFetch('/api/friends');
      const result = await response.json();
      if (result.success) {
        setPendingFriendCount(result.data.pendingReceived.length);
      }
    } catch {}
  };

  useEffect(() => {
    fetchMemorials();
    fetchFriendCount();
  }, []);

  useEffect(() => {
    if (activeTab === 'sent') fetchSentMemorials();
  }, [activeTab]);

  const handleResetSystem = async () => {
    if (!confirm("确定要整顿朝纲、重置所有人呈批的折子并恢复初始奏稿吗？")) return;
    setLoading(true);
    try {
      const response = await authFetch('/api/memorials/reset', { method: 'POST' });
      const result = await response.json();
      if (result.success) {
        setMemorials(result.data);
        alert("朝廷档案整理完毕，初始奏章已重置。");
      }
    } catch (err) {
      console.error(err);
      alert("掌印太监阻拦，重置失败！");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMemorial = async (id: string) => {
    try {
      await authFetch(`/api/memorials/${id}`, { method: 'DELETE' });
      setMemorials(prev => prev.filter(m => m.id !== id));
      setSelectedMemorial(null);
    } catch (err) {
      console.error("Failed to delete memorial:", err);
    }
  };

  const handleApproveMemorial = async (id: string, status: 'approved' | 'rejected' | 'held', comment: string) => {
    try {
      const response = await authFetch(`/api/memorials/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ status, imperialComment: comment })
      });
      const result = await response.json();
      if (result.success) {
        setMemorials(prev => prev.map(m => m.id === id ? result.data : m));
        setSelectedMemorial(result.data);
      }
    } catch (err) {
      console.error("Failed to approve memorial:", err);
    }
  };

  const totalDecrees = memorials.length;
  const pendingCount = memorials.filter(m => m.status === 'pending').length;
  const approvedCount = memorials.filter(m => m.status === 'approved').length;
  const diligenceIndex = totalDecrees > 0 ? Math.round((approvedCount / totalDecrees) * 100) : 100;

  const getEmperorRankStr = (index: number) => {
    if (totalDecrees === 0) return "清静无为 · 万民升平安康";
    if (index >= 90) return "文治武功 · 励精图治千古一帝";
    if (index >= 70) return "勤勉圣朝 · 日理万机社稷大振";
    if (index >= 40) return "日常垂拱 · 无功无过循规旧制";
    if (index >= 15) return "清静散仙 · 朝中万务委之阁臣";
    return "逍遥天子 · 奏章深压垂帘罢朝";
  };

  const filteredMemorials = memorials.filter(m => {
    const matchesCategory = selectedCategory === '全部' || m.category === selectedCategory;
    const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          m.sender.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          m.keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const displayList = activeTab === 'sent' ? sentMemorials : filteredMemorials;

  return (
    <div className="min-h-screen bg-[#FAF6ED] text-[#2F2722] flex flex-col font-sans select-none pb-12 relative overflow-hidden">

      <div className="absolute top-0 left-0 w-24 h-24 opacity-5 pointer-events-none bg-[radial-gradient(circle,_#A93226_2px,_transparent_2px)] bg-[size:16px_16px]"></div>
      <div className="absolute top-0 right-0 w-24 h-24 opacity-5 pointer-events-none bg-[radial-gradient(circle,_#A93226_2px,_transparent_2px)] bg-[size:16px_16px]"></div>

      {/* Header */}
      <header className="relative bg-[#F4EFE0] border-b-2 border-[#DCD3BE] md:py-7 py-5 px-4 md:px-8 shadow-sm">
        <div className="absolute top-1 left-2 right-2 border-t border-[#D5C6AC]/60"></div>
        <div className="absolute bottom-1 left-2 right-2 border-b border-[#D5C6AC]/60"></div>

        <div className="relative max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 text-left">
            <div className="relative overflow-hidden w-16 h-16 rounded-lg border-2 border-[#C2B095] bg-[#FCFAF5] p-0.5 shadow-md flex-shrink-0 cursor-pointer hover:border-[#A93226] transition-colors" onClick={() => setShowProfilePanel(true)}>
              <img src={emperorCat} className="w-full h-full object-cover rounded" alt="学士猫" referrerPolicy="no-referrer" />
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-[#A93226] text-white rounded-tl-md text-[9px] font-serif font-black flex items-center justify-center">印</div>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-serif text-2xl font-black tracking-widest text-[#5C2318] flex items-center gap-1">
                  大内御书房 <span className="text-sm font-serif text-amber-900 border-l border-[#C2B095] pl-2">理奏大典</span>
                </h1>
              </div>
              <p className="text-xs text-[#6E6357] font-serif mt-1">
                {user?.avatarTitle} <strong className="text-[#A93226]">{user?.displayName}</strong> 驾到！朝臣恭候御笔圣裁。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Friends button */}
            <button
              onClick={() => setShowFriendsPanel(true)}
              className="relative p-2.5 px-4 bg-gradient-to-b from-[#FCFAF5] to-[#F1EAD7] hover:from-[#2E5C50] hover:to-[#1F4E3A] border border-[#DCD3BE] hover:border-[#1F4E3A] text-[#6E5D4F] hover:text-white rounded-lg transition-transform duration-200 active:scale-95 flex items-center gap-2 font-serif text-xs font-bold shadow-xs hover:shadow-md cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              朝臣名录
              {pendingFriendCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#A93226] text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
                  {pendingFriendCount}
                </span>
              )}
            </button>

            {/* Submit button */}
            <button
              onClick={() => setShowSubmitModal(true)}
              className="p-2.5 px-4 bg-gradient-to-b from-[#A93226] to-[#87251B] hover:from-[#87251B] hover:to-[#6B1D15] border border-[#87251B] text-white rounded-lg transition-transform duration-200 active:scale-95 flex items-center gap-2 font-serif text-xs font-bold shadow-md hover:shadow-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              呈递新折
            </button>

            {/* Reset button */}
            <button
              onClick={handleResetSystem}
              className="p-2.5 px-4 bg-gradient-to-b from-[#FCFAF5] to-[#F1EAD7] hover:from-[#8E221A] hover:to-[#731A12] border border-[#DCD3BE] hover:border-[#731A12] text-[#6E5D4F] hover:text-white rounded-lg transition-transform duration-200 active:scale-95 flex items-center gap-2 font-serif text-xs font-bold shadow-xs hover:shadow-md cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              整顿朝纲
            </button>

            {/* Logout button */}
            <button
              onClick={logout}
              className="p-2.5 px-4 bg-gradient-to-b from-[#FCFAF5] to-[#F1EAD7] hover:from-[#6E5D4F] hover:to-[#4A3C31] border border-[#DCD3BE] hover:border-[#4A3C31] text-[#6E5D4F] hover:text-white rounded-lg transition-transform duration-200 active:scale-95 flex items-center gap-2 font-serif text-xs font-bold shadow-xs hover:shadow-md cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              退朝
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 md:px-8 mt-10 z-10 selection:bg-amber-200">

        {/* Top scroll roller */}
        <div className="relative w-full">
          <div className="absolute -left-5 top-1 w-7 h-14 bg-gradient-to-b from-[#3A0E08] via-[#8E221A] to-[#3A0E08] rounded-l-md shadow-xl z-20 border-y border-amber-600/30"></div>
          <div className="w-full h-10 bg-gradient-to-b from-[#7A6548] via-[#D8CBAE] to-[#7A6548] rounded-md shadow-lg border-y border-[#5C4633]/20 flex items-center justify-center">
            <div className="w-[98%] h-[1px] bg-gradient-to-r from-transparent via-[#5c2318]/20 to-transparent"></div>
          </div>
          <div className="absolute -right-5 top-1 w-7 h-14 bg-gradient-to-b from-[#3A0E08] via-[#8E221A] to-[#3A0E08] rounded-r-md shadow-xl z-20 border-y border-amber-600/30"></div>
        </div>

        {/* Parchment Scroll Main Body */}
        <div className="bg-[#FCF9F2] border-x-[16px] md:border-x-[24px] border-[#C2B095] shadow-[inset_6px_0_12px_-6px_rgba(139,109,74,0.1),inset_-6px_0_12px_-6px_rgba(139,109,74,0.1)] p-6 md:p-10 relative overflow-hidden -mt-1 pb-16">

          <div className="absolute inset-y-0 left-2 w-0.5 bg-[#A93226]/12 pointer-events-none"></div>
          <div className="absolute inset-y-0 right-2 w-0.5 bg-[#A93226]/12 pointer-events-none"></div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.02] select-none">
            <span className="font-serif text-[16rem] text-red-800 font-black">密</span>
          </div>

          {/* Stats block */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 border-b-2 border-dashed border-[#C2B095]/45 pb-8">
            <div className="p-4 bg-[#FAF6ED] rounded-xl border border-[#DCD3BE] flex flex-col justify-between shadow-sm">
              <span className="text-sm md:text-base font-serif font-extrabold text-[#7C6647] tracking-wider block">今日待御批</span>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-5xl md:text-6xl font-serif font-black text-[#A93226] animate-pulse">{pendingCount}</span>
                <span className="text-[#6E6357] text-xs font-serif min-w-8">封急折</span>
              </div>
            </div>
            <div className="p-4 bg-[#FAF6ED] rounded-xl border border-[#DCD3BE] flex flex-col justify-between shadow-sm">
              <span className="text-sm md:text-base font-serif font-extrabold text-[#7C6647] tracking-wider block">天子勤政指数</span>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-5xl md:text-6xl font-serif font-black text-[#2E5C50]">{diligenceIndex}%</span>
                <span className="text-[#6E6357] text-xs font-serif min-w-8">已裁夺</span>
              </div>
            </div>
            <div className="p-4 bg-[#FAF6ED] rounded-xl border border-[#DCD3BE] flex flex-col justify-between shadow-sm font-serif">
              <span className="text-sm md:text-base font-serif font-extrabold text-[#7C6647] tracking-wider block">圣上千秋政途评价</span>
              <div className="mt-2 text-left">
                <span className="text-sm md:text-base lg:text-lg font-serif font-black text-[#A93226] block text-wrap whitespace-normal leading-relaxed break-words">
                  {getEmperorRankStr(diligenceIndex)}
                </span>
              </div>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-[#FAF6ED] p-1 rounded-lg border border-[#DCD3BE] gap-1 mb-6">
            <button
              onClick={() => setActiveTab('desk')}
              className={`flex-1 py-2.5 rounded-lg text-xs font-serif font-bold tracking-wide transition cursor-pointer flex items-center justify-center gap-1.5 ${activeTab === 'desk' ? 'bg-[#A93226] text-white shadow-sm' : 'text-[#6E6357] hover:text-[#2F2722] hover:bg-[#FCFAF5]'}`}
            >
              <Scroll className="w-3.5 h-3.5" /> 御案待批 ({pendingCount})
            </button>
            <button
              onClick={() => setActiveTab('sent')}
              className={`flex-1 py-2.5 rounded-lg text-xs font-serif font-bold tracking-wide transition cursor-pointer flex items-center justify-center gap-1.5 ${activeTab === 'sent' ? 'bg-[#A93226] text-white shadow-sm' : 'text-[#6E6357] hover:text-[#2F2722] hover:bg-[#FCFAF5]'}`}
            >
              <Send className="w-3.5 h-3.5" /> 已发折件
            </button>
            <button
              onClick={() => setActiveTab('briefing')}
              className={`flex-1 py-2.5 rounded-lg text-xs font-serif font-bold tracking-wide transition cursor-pointer flex items-center justify-center gap-1.5 ${activeTab === 'briefing' ? 'bg-[#A93226] text-white shadow-sm' : 'text-[#6E6357] hover:text-[#2F2722] hover:bg-[#FCFAF5]'}`}
            >
              <Sparkles className="w-3.5 h-3.5" /> 内阁简报
            </button>
          </div>

          {/* Briefing Tab */}
          {activeTab === 'briefing' ? (
            <BriefingView onSelectMemorial={(m) => setSelectedMemorial(m)} memorials={memorials} />
          ) : (
            <div className="space-y-6">
              {/* Filter controls - only for desk tab */}
              {activeTab === 'desk' && (
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-gradient-to-b from-[#FAF6ED] to-[#F5ECD7] p-4 rounded-xl border border-[#DCD3BE] shadow-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-[#6E6357] font-serif mr-1 flex items-center gap-1">
                      <Filter className="w-3.5 h-3.5 text-[#A93226]" /> 筛选部司:
                    </span>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-serif border transition-all duration-250 cursor-pointer shadow-xs ${
                          selectedCategory === cat
                            ? 'bg-gradient-to-b from-[#A93226] to-[#8E221A] border-[#7F170F] text-[#FCFAF5] font-extrabold shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.2),_0_2px_4px_rgba(142,34,26,0.25)] scale-[1.03]'
                            : 'bg-gradient-to-b from-[#FCFAF5] to-[#F1EAD7] border-[#DCD3BE] text-[#6E6357] hover:border-[#A93226]/50 hover:text-[#A93226]'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div className="w-full md:w-72 relative flex items-center">
                    <Search className="w-4 h-4 text-[#A93226] absolute left-3 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜索折件标题、好友、配乐..."
                      className="w-full bg-[#FCFAF5] border border-[#DCD3BE] rounded-lg pl-9 pr-3 py-2 text-xs text-[#2F2722] placeholder-[#A09384]/70 focus:outline-none focus:border-[#A93226] focus:bg-[#FFFDF9] focus:shadow-xs transition-all leading-none"
                    />
                  </div>
                </div>
              )}

              {/* Sent tab header */}
              {activeTab === 'sent' && (
                <div className="p-4 bg-gradient-to-b from-[#FAF6ED] to-[#F5ECD7] rounded-xl border border-[#DCD3BE] shadow-xs text-center">
                  <p className="text-xs font-serif text-[#7C6647]">以下为您呈递给好友的奏折记录，静候对方御笔裁夺。</p>
                </div>
              )}

              {/* Memorial list */}
              {loading ? (
                <div className="text-center py-24 bg-[#FCFAF5]/60 border border-dashed border-[#DCD3BE] rounded-xl space-y-3">
                  <div className="w-8 h-8 border-4 border-[#A93226] border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="font-serif text-xs text-[#7C6647]">大内递文挑宣中，皇上稍候...</p>
                </div>
              ) : error ? (
                <div className="p-6 text-center border border-[#A83226]/20 bg-[#FFF5F4] rounded-xl text-[#A83226]">
                  <p className="font-serif text-xs font-bold">{error}</p>
                  <button onClick={fetchMemorials} className="mt-3 px-4 py-1.5 bg-white border border-[#A93226] rounded-md text-xs font-serif hover:bg-[#A83226]/5 transition-colors cursor-pointer">
                    重新诏递
                  </button>
                </div>
              ) : displayList.length === 0 ? (
                <div className="text-center py-16 bg-[#FAF6ED]/50 rounded-xl border border-dashed border-[#DCD3BE]">
                  <Scroll className="w-12 h-12 text-[#C2B095] mb-2 mx-auto opacity-35" />
                  <p className="font-serif text-[#A93226] text-sm font-bold">
                    {activeTab === 'sent' ? '尚未递出任何折件' : '阁案空无其折'}
                  </p>
                  <p className="text-[#7C6347] text-[10px] mt-1">
                    {activeTab === 'sent' ? '点击「呈递新折」给好友发送一份趣味奏章吧。' : '当前无可批阅之奏件，皇帝陛下。'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AnimatePresence>
                    {displayList.map((m) => {
                      const isPending = m.status === 'pending';
                      const isSentTab = activeTab === 'sent';
                      return (
                        <motion.div
                          key={m.id}
                          layout
                          initial={{ opacity: 0, scale: 0.97 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.97 }}
                          whileHover={{ y: -5, scale: 1.01, transition: { duration: 0.15 } }}
                          onClick={() => !isSentTab && setSelectedMemorial(m)}
                          className={`${isSentTab ? '' : 'cursor-pointer'} overflow-hidden border border-t-2 border-b-2 rounded-xl flex flex-col justify-between min-h-[17.5rem] h-auto transition-all relative w-full max-w-[26rem] mx-auto ${
                            isPending
                              ? 'bg-gradient-to-br from-[#FCFAF5] to-[#FDFBF7] border-t-[#A93226] border-b-[#C2B095]/40 border-x-[#C2B095]/60 shadow-[0_4px_12px_rgba(194,176,149,0.1)] hover:shadow-[0_12px_24px_rgba(169,50,38,0.12)]'
                              : 'bg-gradient-to-br from-[#FAF6ED]/95 to-[#FBF8F0]/95 border-t-[#5C4F43] border-b-[#DCD3BE]/45 border-x-[#DCD3BE]/60 opacity-95 hover:opacity-100 shadow-[0_3px_8px_rgba(0,0,0,0.02)] hover:shadow-[0_10px_22px_rgba(92,79,67,0.09)]'
                          }`}
                        >
                          <div className={`absolute left-0 top-3 bottom-3 w-1.5 rounded-full bg-gradient-to-b ${
                            isPending ? 'from-transparent via-[#A93226] to-transparent' : 'from-transparent via-[#5C4F43] to-transparent'
                          }`} />
                          <div className="absolute top-0 right-0 w-16 h-16 opacity-[1.5%] pointer-events-none text-[#A93226] text-5xl font-serif select-none p-2">密</div>

                          <div className="px-5 py-3 border-b border-[#DCD3BE]/40 flex items-center justify-between bg-[#FDFDFD]/40">
                            <div className="flex items-center gap-1.5 pl-1">
                              <span className="text-[10px] px-1.5 py-0.5 bg-[#A93226]/10 text-[#A93226] border border-[#A93226]/15 rounded font-serif font-bold">
                                {m.category}
                              </span>
                            </div>
                            {isPending ? (
                              <span className="text-[10px] text-[#A83226] font-serif font-bold flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#A93226] animate-pulse"></span>
                                待批
                              </span>
                            ) : m.status === 'rejected' ? (
                              <span className="text-[10px] text-stone-500 font-serif font-bold">已驳回</span>
                            ) : m.status === 'held' ? (
                              <span className="text-[10px] text-[#2E5C50] font-serif font-bold">留中</span>
                            ) : (
                              <span className="text-[10px] text-[#2E5C50] font-serif font-bold flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-[#2E5C50]"></span>
                                准奏
                              </span>
                            )}
                          </div>

                          <div className="px-5 py-4 flex-1 flex flex-col justify-between pl-6">
                            <div className="space-y-2">
                              <h3 className="font-serif text-[15px] md:text-[16px] font-black tracking-wide text-[#5C2318] leading-snug">
                                《{m.title}》
                              </h3>
                              <p className="text-[11px] md:text-xs text-[#6E6357] font-serif leading-relaxed line-clamp-none">
                                {replaceOldTitles(m.summary)}
                              </p>
                            </div>
                          </div>

                          <div className="px-5 py-3 bg-[#FCFAF5]/85 border-t border-[#DCD3BE]/30 flex items-center justify-between text-[11px] md:text-xs text-[#7C6647] pl-6">
                            <span className="font-serif font-bold text-[11.5px] md:text-xs text-[#4E1D13] truncate max-w-[65%] flex items-center gap-1">
                              <span className="opacity-40 text-[9px]">
                                {isSentTab ? '📤' : (m.fromUserId === m.toUserId ? '📌' : '✍️')}
                              </span>
                              {m.fromUserId === m.toUserId
                                ? '自留御览'
                                : isSentTab
                                  ? `致：${(m as any).toUserDisplayName || '未知'}`
                                  : `臣：${replaceOldTitles((m.fromUserDisplayName || m.sender).split(' ')[0])}`
                              }
                            </span>
                            {m.imperialComment && !isSentTab && (
                              <span className="font-serif text-[9.5px] flex items-center gap-1 bg-[#EEF6F2] px-2 py-0.5 rounded-full border border-[#2E5C50]/20 text-[#2E5C50] font-bold shadow-2xs">
                                <CheckCircle className="w-3.5 h-3.5 text-[#2E5C50] inline" />
                                已批阅
                              </span>
                            )}
                            {isSentTab && m.imperialComment && (
                              <span className="font-serif text-[9.5px] flex items-center gap-1 bg-[#EEF6F2] px-2 py-0.5 rounded-full border border-[#2E5C50]/20 text-[#2E5C50] font-bold shadow-2xs">
                                <CheckCircle className="w-3.5 h-3.5 inline" />
                                对方已批
                              </span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom scroll roller */}
        <div className="relative w-full -mt-2">
          <div className="absolute -left-5 -top-2 w-7 h-14 bg-gradient-to-b from-[#3A0E08] via-[#8E221A] to-[#3A0E08] rounded-l-md shadow-xl z-20 border-y border-amber-600/30"></div>
          <div className="w-full h-10 bg-gradient-to-b from-[#7A6548] via-[#D8CBAE] to-[#7A6548] rounded-md shadow-lg border-y border-[#5C4633]/20 flex items-center justify-center">
            <div className="w-[98%] h-[1px] bg-gradient-to-r from-transparent via-[#5c2318]/20 to-transparent"></div>
          </div>
          <div className="absolute -right-5 -top-2 w-7 h-14 bg-gradient-to-b from-[#3A0E08] via-[#8E221A] to-[#3A0E08] rounded-r-md shadow-xl z-20 border-y border-amber-600/30"></div>
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showSubmitModal && (
          <SubmitMemorial onClose={() => setShowSubmitModal(false)} onRefresh={fetchMemorials} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {selectedMemorial && (
          <MemorialDetail
            memorial={selectedMemorial}
            onClose={() => setSelectedMemorial(null)}
            onApprove={handleApproveMemorial}
            onDelete={handleDeleteMemorial}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showFriendsPanel && (
          <FriendsPanel onClose={() => { setShowFriendsPanel(false); fetchFriendCount(); }} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showProfilePanel && (
          <ProfilePanel onClose={() => setShowProfilePanel(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
