import React, { useState, useEffect } from 'react';
import { Scroll, Check, AlertTriangle, Play, Sparkles, PencilLine, Trash2, X, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Memorial } from '../types';
import { authFetch } from '../utils/api';

const replaceOldTitles = (text: string) => {
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

interface MemorialDetailProps {
  memorial: Memorial;
  onClose: () => void;
  onApprove: (id: string, status: 'approved' | 'rejected' | 'held', comment: string) => void;
  onDelete: (id: string) => void;
}

export default function MemorialDetail({ memorial, onClose, onApprove, onDelete }: MemorialDetailProps) {
  const [stampActive, setStampActive] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [commentText, setCommentText] = useState(memorial.imperialComment || '');
  const [selectedTone, setSelectedTone] = useState<'pleased' | 'angry' | 'laugh' | 'reward' | 'held'>('pleased');
  const [currentStatus, setCurrentStatus] = useState<'approved' | 'rejected' | 'held'>(
    (memorial.status === 'pending' ? 'approved' : memorial.status) as any
  );
  
  // Update local comment when memorial changes
  useEffect(() => {
    setCommentText(memorial.imperialComment || '');
    if (memorial.status !== 'pending') {
      setCurrentStatus(memorial.status as any);
    }
  }, [memorial]);

  // Request AI Draft comment from server
  const handleAiDraft = async (tone: typeof selectedTone) => {
    setDrafting(true);
    setSelectedTone(tone);
    try {
      const response = await authFetch('/api/generate-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: memorial.title,
          category: memorial.category,
          sender: memorial.sender,
          tone: tone
        })
      });
      const result = await response.json();
      if (result.success) {
        setCommentText(result.comment);
        // Map tone to status
        if (tone === 'angry') {
          setCurrentStatus('rejected'); // 驳回
        } else if (tone === 'held') {
          setCurrentStatus('held'); // 留中
        } else {
          setCurrentStatus('approved'); // 准奏
        }
      }
    } catch (err) {
      console.error("Failed to generate AI commentDraft:", err);
    } finally {
      setDrafting(false);
    }
  };

  // Stamp seal action
  const handleApplySeal = () => {
    setStampActive(true);
    // Short stagger before saving for a satisfying vibration/stamping simulation
    setTimeout(() => {
      onApprove(memorial.id, currentStatus, commentText || "朕已批示，钦此！");
      setStampActive(false);
    }, 1100);
  };

  // Map severity level colors inside traditional scroll
  const severityColors: Record<string, string> = {
    '日常请安': 'bg-[#2E5C50]/10 text-[#2E5C50] border-[#2E5C50]/30',
    '微臣急奏': 'bg-[#1F4E75]/10 text-[#1F4E75] border-[#1F4E75]/30',
    '十万火急': 'bg-[#A93226]/10 text-[#A93226] border-[#A93226]/30 animate-pulse',
    '弹劾奏章': 'bg-stone-900/10 text-stone-800 border-stone-850/30 font-bold'
  };

  // Stamp labels corresponding to status
  const getStampText = () => {
    if (currentStatus === 'rejected') return "荒谬驳回";
    if (currentStatus === 'held') return "留中不发";
    return "准奏御览";
  };

  return (
    <div id="memorial-detail-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E1A17]/80 backdrop-blur-sm overflow-y-auto">
      
      {/* Traditional Palace Styled Scroll Panel Dialog Frame */}
      <div className="relative w-full max-w-4xl bg-[#FAF6ED] border-4 border-double border-[#A93226]/60 rounded-2xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 max-h-[90vh]">
        
        {/* Left Side: Traditional Rice-parchment Scroll */}
        <div className="col-span-1 md:col-span-7 bg-[#FCF9F2] relative p-6 md:p-8 flex flex-col min-h-0 overflow-hidden h-[50vh] md:h-[90vh] border-b md:border-b-0 md:border-r border-[#DCD3BE]">
          
          {/* Scroll Wooden Slats Decoration on Left and Right borders */}
          <div className="absolute top-0 bottom-0 left-0 w-3 bg-gradient-to-r from-[#87251B] via-[#E4D5B9] to-[#87251B] border-r border-[#87251B]/20 shadow-md"></div>
          <div className="absolute top-0 bottom-0 right-0 w-3 bg-gradient-to-l from-[#87251B] via-[#E4D5B9] to-[#87251B] border-l border-[#87251B]/20 shadow-md"></div>

          {/* Golden Seal watermark lookalike in style profile */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.035] select-none">
            <span className="font-serif text-[18rem] text-red-800 font-black">诏</span>
          </div>

          <div className="pl-4 pr-4 flex flex-col min-h-0 flex-1">
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-5">
              {/* Header: Courter, Severity, Category */}
              <div className="flex flex-wrap items-center justify-start gap-2 border-b border-[#D5C6AC]/60 pb-3">
                <span className="font-serif text-[#A93226] text-xs font-bold tracking-widest bg-[#A93226]/5 px-2.5 py-0.5 rounded border border-[#A93226]/14 select-none">
                  {replaceOldTitles(memorial.category)} 呈批
                </span>
              </div>

              {/* Title */}
              <div className="space-y-1">
                <span className="text-[10px] text-[#7C6647] font-serif block">奏章标题:</span>
                <h1 className="font-serif text-2xl font-black text-[#5C2318] leading-relaxed">
                  《{memorial.title}》
                </h1>
              </div>

              {/* Senders */}
              <div className="flex items-center gap-1.5 text-xs text-[#6E6357] font-serif pb-2">
                <span className="text-[#8C7A63] font-serif font-medium">呈折爱卿：</span>
                <strong className="text-[#A93226] font-bold">{replaceOldTitles(memorial.sender.split(' ')[0])}</strong>
                <span className="text-[#A09384] ml-2 font-mono text-[10px]">{new Date(memorial.createdTime).toLocaleTimeString()} 递达御前</span>
              </div>

              {/* Classical Styled Translation Box */}
              <div className="relative p-5 bg-[#FAF6ED]/80 border-l-4 border-[#A93226] rounded-r shadow-inner my-4">
                <div className="font-serif text-xs font-bold text-[#A93226] mb-2 flex items-center gap-1">
                  <Scroll className="w-4 h-4 text-[#A93226]" /> 内阁译拟之：奏章正文 (AI总结短视频)
                </div>
                <p className="text-sm font-serif leading-relaxed text-[#2F2722] whitespace-pre-wrap select-text">
                  {replaceOldTitles(memorial.summary)}
                </p>
              </div>

              {/* Tags keywords */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {memorial.keywords.map((kw, i) => (
                  <span key={i} className="px-2.5 py-0.5 text-[10px] font-serif font-bold rounded-full bg-[#EFE9DA] text-[#6E6357] border border-[#D5C6AC]/50">
                    #{kw}
                  </span>
                ))}
              </div>

              {/* Original Source share */}
              <div className="p-3 bg-[#EFE9DA]/30 rounded border border-[#D5C6AC]/30 mt-4">
                <p className="text-[10px] text-[#7C6647] font-serif mb-1">
                  来自市井胡同分享原文 (抖音原帖文案/原文):
                </p>
                <p className="text-xs text-[#5C5144] italic font-sans max-h-16 overflow-y-auto bg-white/70 p-2 rounded select-all selection:bg-amber-200">
                  {memorial.rawText}
                </p>
              </div>
            </div>

            <div className="shrink-0 pt-4 mt-4 border-t border-[#D5C6AC]/50 flex justify-center">
            {/* Click to Watch jump button using elegant ink button styling */}
            <a
              id="watch-video-btn"
              href={memorial.url}
              target="_blank"
              rel="noreferrer noopener"
              className="px-8 py-2.5 text-xs font-serif font-semibold text-white bg-gradient-to-r from-[#A93226] to-[#80231B] rounded-lg shadow-md border border-[#80231B]/50 hover:brightness-115 flex items-center justify-center gap-1.5 transition-transform active:scale-95 w-full md:w-auto"
            >
              <Play className="w-3.5 h-3.5 text-amber-200 fill-amber-200" />
              御前审看抖音视频 (品鉴)
            </a>
          </div>
          </div>

          {/* Authentic Hologram Stamp Seal rendering when approved or active */}
          <AnimatePresence>
            {(stampActive || memorial.status !== 'pending') && (
              <motion.div
                initial={stampActive ? { scale: 3.5, opacity: 0, rotate: -25 } : { scale: 1, opacity: 0.9, rotate: -12 }}
                animate={{ scale: 1, opacity: 0.85, rotate: -12 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 220, damping: 14 }}
                className="absolute right-12 bottom-20 z-20 pointer-events-none"
              >
                <div className={`w-28 h-28 border-4 border-double ${currentStatus === 'rejected' ? 'border-[#87251B] text-[#87251B]' : currentStatus === 'held' ? 'border-[#2E5C50] text-[#2E5C50]' : 'border-[#A93226] text-[#A93226]'} rounded-full flex flex-col items-center justify-center p-1 text-center font-serif select-none shadow-md`}>
                  <div className={`border-t border-b ${currentStatus === 'rejected' ? 'border-[#87251B]/60' : currentStatus === 'held' ? 'border-[#2E5C50]/60' : 'border-[#A93226]/60'} py-0.5 px-2 font-serif font-black text-sm tracking-wider`}>
                    {getStampText()}
                  </div>
                  <span className="text-[8px] font-sans font-black tracking-widest mt-1 opacity-70">
                    玺印制书
                  </span>
                  <span className="text-[8px] font-mono opacity-50 mt-0.5">2026-05-23</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
        </div>

        {/* Right Side: Royal Desk Mahogany Styled Panel for Actions */}
        <div className="col-span-1 md:col-span-5 bg-[#F2ECE0] p-6 md:p-8 flex flex-col justify-between border-t md:border-t-0 md:border-l border-[#DCD3BE] max-h-[90vh] md:max-h-none overflow-y-auto">
          
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#D5C6AC]/60">
              <h2 className="font-serif text-base font-extrabold tracking-wide text-[#5C2318] flex items-center gap-1.5">
                <PencilLine className="w-5 h-5 text-[#A93226]" />
                御笔裁夺 · 钤印朱批
              </h2>
              <button 
                id="close-detail-btn"
                onClick={onClose}
                className="p-1 text-[#7C6647] hover:text-[#A93226] transition"
                title="退朝阁关折"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* AI assisted tones panel configured as Chinese lacquer seals */}
            <div className="space-y-3">
              <label className="block text-xs font-serif text-[#6E6357] font-bold">
                1. 命大秘书代撰拟定评批 (选择圣眷态度):
              </label>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  id="tone-pleased-btn"
                  type="button"
                  onClick={() => handleAiDraft('pleased')}
                  disabled={drafting}
                  className={`p-2 rounded-lg text-xs text-left font-serif border transition-all flex items-center gap-1.5 ${selectedTone === 'pleased' ? 'bg-[#A93226] border-[#A93226] text-white font-bold shadow-sm' : 'bg-[#FCFAF5] border-[#DCD3BE] text-[#6E6357] hover:bg-white hover:text-black'}`}
                >
                  😌 龙颜甚悦 (准)
                </button>
                <button
                  id="tone-laugh-btn"
                  type="button"
                  onClick={() => handleAiDraft('laugh')}
                  disabled={drafting}
                  className={`p-2 rounded-lg text-xs text-left font-serif border transition-all flex items-center gap-1.5 ${selectedTone === 'laugh' ? 'bg-[#A93226] border-[#A93226] text-white font-bold shadow-sm' : 'bg-[#FCFAF5] border-[#DCD3BE] text-[#6E6357] hover:bg-white hover:text-black'}`}
                >
                  😂 拂袖狂笑 (准)
                </button>
                <button
                  id="tone-angry-btn"
                  type="button"
                  onClick={() => handleAiDraft('angry')}
                  disabled={drafting}
                  className={`p-2 rounded-lg text-xs text-left font-serif border transition-all flex items-center gap-1.5 ${selectedTone === 'angry' ? 'bg-[#87251B] border-[#87251B] text-white font-bold shadow-sm' : 'bg-[#FCFAF5] border-[#DCD3BE] text-[#6E6357] hover:bg-white hover:text-black'}`}
                >
                  😡 圣上拍案 (驳)
                </button>
                <button
                  id="tone-reward-btn"
                  type="button"
                  onClick={() => handleAiDraft('reward')}
                  disabled={drafting}
                  className={`p-2 rounded-lg text-xs text-left font-serif border transition-all flex items-center gap-1.5 ${selectedTone === 'reward' ? 'bg-[#A93226] border-[#A93226] text-white font-bold shadow-sm' : 'bg-[#FCFAF5] border-[#DCD3BE] text-[#6E6357] hover:bg-white hover:text-black'}`}
                >
                  🐟 赏赐猫干 (赏)
                </button>
              </div>
            </div>

            {/* Custom comment edit box */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-serif text-[#6E6357] font-bold">
                  2. 皇帝朱批亲笔手书诏书:
                </label>
                {drafting && (
                  <span className="text-[10px] text-[#A93226] font-serif animate-pulse flex items-center gap-1">
                    <Sparkles className="w-3 h-3 animate-spin" /> 学士代拟中...
                  </span>
                )}
              </div>

              <textarea
                id="imperial-comment-textarea"
                rows={5}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="在此批阅折件起草意见。亦可在上方命大学士拟旨，再在此微调朱批内容..."
                className="w-full px-3 py-2 text-sm bg-white border border-[#DCD3BE] rounded-lg text-[#2F2722] focus:outline-none focus:border-[#A93226] focus:ring-1 focus:ring-[#A93226]/30 font-serif leading-relaxed"
              />
            </div>

            {/* Approval status selectors */}
            <div className="space-y-1.5">
              <span className="text-xs font-serif text-[#6E6357] font-bold">3. 决断御印类别:</span>
              <div className="flex bg-[#FCFAF5] p-1 rounded-lg border border-[#DCD3BE] gap-1.5">
                <button
                  id="decision-approve-btn"
                  type="button"
                  onClick={() => setCurrentStatus('approved')}
                  className={`flex-1 py-2 rounded text-xs font-serif text-center font-bold tracking-wide transition ${currentStatus === 'approved' ? 'bg-[#2E5C50] text-[#FCFAF5]' : 'text-[#6E6357] hover:text-[#2F2722]'}`}
                >
                  准奏印 (批准)
                </button>
                <button
                  id="decision-reject-btn"
                  type="button"
                  onClick={() => setCurrentStatus('rejected')}
                  className={`flex-1 py-2 rounded text-xs font-serif text-center font-bold tracking-wide transition ${currentStatus === 'rejected' ? 'bg-[#87251B] text-[#FCFAF5]' : 'text-[#6E6357] hover:text-[#2F2722]'}`}
                >
                  不准驳 (放肆)
                </button>
              </div>
            </div>

          </div>

          {/* BRIGHT SEaL ACTION COMPONENT STAMP */}
          <div className="pt-6 border-t border-[#D5C6AC]/60 mt-6 space-y-3">
            <button
              id="stamp-seal-action-btn"
              onClick={handleApplySeal}
              disabled={stampActive || drafting}
              className={`w-full py-3.5 px-4 font-serif text-sm font-black tracking-widest rounded-xl hover:brightness-110 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-1.5 border-b-4 border-[#782017] ${stampActive ? 'bg-[#87251B] text-white scale-[0.99]' : 'bg-[#A93226] text-white shadow-md'}`}
            >
              <Trophy className="w-4 h-4 text-amber-200" />
              朱砂下印 · 龙章钤盖
            </button>
            <p className="text-[10px] text-center text-[#7C6647] font-serif">
              提示：重击拍章拟可当即御章存档并颁布。
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
