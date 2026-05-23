import React, { useState, useEffect } from 'react';
import { Scroll, Sparkles, TrendingUp, BarChart, Users, ArrowRight, RefreshCw, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import { DailyBriefing, Memorial } from '../types';
import { authFetch } from '../utils/api';

interface BriefingViewProps {
  onSelectMemorial: (m: Memorial) => void;
  memorials: Memorial[];
}

export default function BriefingView({ onSelectMemorial, memorials }: BriefingViewProps) {
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBriefing = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch('/api/briefing');
      const result = await response.json();
      if (result.success) {
        setBriefing(result.data);
      } else {
        setError(result.error || "大朝密折汇总编制失败。");
      }
    } catch (err) {
      console.error(err);
      setError("兵部快马在午门滑倒，未能成功取今日阁臣简报。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBriefing();
  }, [memorials]);

  // Find memorials by category
  const getMemorialsByCategory = (category: string) => {
    return memorials.filter(m => m.category === category);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-[#FCFAF5] border-2 border-dashed border-[#DCD3BE] rounded-xl">
        <RefreshCw className="w-8 h-8 text-[#A93226] animate-spin mb-4" />
        <p className="font-serif text-sm text-[#7C6647] tracking-widest animate-pulse font-bold">翰林学士正在起草大内《治国狂笑总揽》中...</p>
      </div>
    );
  }

  if (error || !briefing) {
    return (
      <div className="p-8 text-center bg-[#FCFAF5] rounded-xl border-2 border-[#A83226]/30 text-[#A83226]">
        <Scroll className="w-12 h-12 text-[#A93226] mx-auto mb-3" />
        <p className="font-serif text-[#A93226] text-base font-bold mb-2">翰林大理院失察</p>
        <p className="text-[#6E6357] text-xs mb-4">{error || "暂物可供呈报的奏章摘要。"}</p>
        <button
          onClick={fetchBriefing}
          className="px-4 py-2 text-xs font-serif bg-[#A93226] text-white rounded-lg hover:brightness-110 transition"
        >
          重新撰起
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Golden Silk Imperial Proclamation Banner */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-br from-[#FCF9ED] to-[#FAF1DB] border-l-[12px] border-[#A93226] p-6 rounded-r-xl shadow-md border-t border-r border-b border-[#D5C6AC]"
      >
        {/* Intricate traditional corner borders */}
        <div className="absolute top-0 right-0 w-16 h-16 opacity-30 border-t-4 border-r-4 border-[#A93226] rounded-tr-md"></div>
        <div className="absolute bottom-0 right-0 w-16 h-16 opacity-30 border-b-4 border-r-4 border-[#A93226] rounded-br-md"></div>

        <div className="flex items-start justify-between">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded bg-[#A93226] text-white font-serif">
                殿阁大学士 · 密奏总览书
              </span>
              <span className="text-xs text-[#7C6647] font-serif font-black">
                天朝万国 · 圣历五年五月
              </span>
            </div>
            <h2 className="font-serif text-2xl font-black text-[#5C2318] flex items-center gap-1 leading-relaxed">
              今日社稷气象：<span className="text-[#A93226] underline decoration-[#C2B095] decoration-wavy underline-offset-4 font-black">{briefing.overallHealth}</span>
            </h2>
          </div>
          <button
            onClick={fetchBriefing}
            className="p-1.5 px-3 flex items-center gap-1 text-xs font-serif border border-[#A93226]/30 text-[#A93226] hover:bg-[#A93226]/5 rounded-lg transition"
            title="重新编译大殿汇报"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            重拟朱批
          </button>
        </div>

        {/* Prime Minister's Official Narrative Submission Scroll */}
        <div className="mt-5 p-4 rounded-lg bg-[#FAF6ED] text-[#2F2722] border-l-4 border-[#87251B] shadow-inner">
          <div className="flex items-center gap-1.5 text-xs text-[#A93226] font-serif font-extrabold mb-2 bg-[#A93226]/5 py-1 px-2 rounded w-fit">
            <Sparkles className="w-3.5 h-3.5" /> 大内阁相叩首御览：
          </div>
          <p className="text-xs md:text-sm leading-relaxed whitespace-pre-wrap font-serif text-[#4A3C31] font-medium">
            {briefing.imperialReport}
          </p>
        </div>
      </motion.div>

      {/* Grid: Six Boards Balance and Active Courtiers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Six Board Balance Chart (Ministries workload) */}
        <div className="md:col-span-2 bg-[#FCFAF5] p-5 rounded-xl border-2 border-[#DCD3BE] shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-[#DCD3BE]/50 pb-2">
            <h3 className="font-serif text-sm font-extrabold text-[#5C2318] flex items-center gap-1.5">
              <BarChart className="w-4 h-4 text-[#A93226]" /> 大内分部机要职守 (运转名册)
            </h3>
            <span className="text-[10px] text-[#7C6C5E] font-mono">
              总奏折本: {memorials.length}
            </span>
          </div>

          <div className="space-y-4">
            {briefing.categoryStatistics.map((stat) => {
              const count = stat.count;
              // Calc percent relative to maximum or set absolute base
              const maxCount = Math.max(...briefing.categoryStatistics.map(s => s.count), 1);
              const percentage = (count / maxCount) * 100;
              const subMemorials = getMemorialsByCategory(stat.category);

              // Unique board descriptions
              const boardLabels: Record<string, string> = {
                '经略阁': '知识普及/实用窍门/教程/技能学习',
                '寻乐记': '沙雕爆笑/宠物整活/翻车大惨案/幽默',
                '创意坊': '奇思妙想发明/手工改造/程序员自制'
              };

              return (
                <div key={stat.category} className="group">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-serif text-[#4E3D30]">
                      <strong className="text-[#A93226] font-serif font-black">{stat.category}</strong> · <span className="text-[#7C6C5E] font-serif">{boardLabels[stat.category] || ''}</span>
                    </span>
                    <span className="text-[#6E6357] flex items-center gap-1.5 font-mono text-[11px]">
                      {count} 件 / 均分 {stat.avgEntertainment} 乐
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {/* Progress bar container */}
                    <div className="flex-1 h-3.5 bg-[#FAF6ED] rounded-full overflow-hidden p-[2px] border border-[#DCD3BE]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.8 }}
                        className="h-full rounded-full bg-gradient-to-r from-[#A93226] to-[#C2B095]"
                      />
                    </div>

                    {/* Action links */}
                    {count > 0 && (
                      <div className="flex gap-1.5 shrink-0 select-none">
                        {subMemorials.slice(0, 2).map((m) => (
                          <button
                            key={m.id}
                            onClick={() => onSelectMemorial(m)}
                            className="p-1 px-2.5 bg-[#FAF6ED] hover:bg-[#A93226] text-[10px] rounded border border-[#DCD3BE] hover:border-[#A93226] text-[#7C6647] hover:text-white font-serif tracking-tighter transition shadow-sm"
                            title={`御笔批阅 《${m.title}》`}
                          >
                            品审 {m.status === 'pending' ? '🔴' : '✅'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Loyal Friends / Active Courtiers ranking list */}
        <div className="bg-[#FCFAF5] p-5 rounded-xl border-2 border-[#DCD3BE] flex flex-col justify-between shadow-sm">
          <div>
            <h3 className="font-serif text-sm font-extrabold text-[#5C2318] flex items-center gap-1.5 mb-4 border-b border-[#DCD3BE]/50 pb-2">
              <Trophy className="w-4 h-4 text-[#A93226] animate-bounce" /> 大内奉旨呈递爱卿功绩单
            </h3>

            {briefing.activeSenders.length > 0 ? (
              <div className="space-y-3">
                {briefing.activeSenders.map((senderName, index) => {
                  const sendCount = memorials.filter(m => m.sender.startsWith(senderName)).length;
                  const ranksStr = ['国之重臣 · 赏双黄猫罐', '直隶督察 · 赐红锦卫章', '大内提督 · 赏金御令', '承奉太守', '参军侍郎'];
                  const rank = ranksStr[index] || '呈折忠直爱卿';

                  return (
                    <div key={senderName} className="flex items-center justify-between p-2 rounded-lg bg-[#FAF6ED] border border-[#DCD3BE] hover:border-[#A93226]/40 transition duration-200">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#A93226] text-white border border-[#87251B] flex items-center justify-center text-xs font-black select-none">
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-xs font-bold font-serif text-[#2F2722]">{senderName}</p>
                          <p className="text-[10px] text-[#7C6C5E] font-serif">{rank}</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono px-2 py-0.5 bg-[#EFE9DA] text-[#6E6357] border border-[#DCD3BE]/50 rounded font-bold">
                        进呈 {sendCount} 折
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 text-[#A09384] font-serif">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-35 text-[#C2B095]" />
                <p className="text-xs">暂无爱卿密呈。皇上，试着呈送折子丰富阁殿吧。</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[#DCD3BE]/50 mt-4 flex items-center justify-between">
            <span className="text-[9px] text-[#A09384] font-mono select-none">AI SUMMARIZED ADVISORY SYSTEM</span>
            <div className="flex items-center gap-1 text-[11px] font-serif text-[#2E5C50] font-bold">
              海内晏如 · 社稷稳固 <span className="text-xs text-[#2E5C50] font-extrabold animate-pulse">100%</span>
            </div>
          </div>

        </div>

      </div>

      {/* Grid of Pending Quick Picks inside Briefing styled like traditional envelope blocks */}
      <div className="bg-[#FCFAF5] p-5 rounded-xl border-2 border-[#DCD3BE] shadow-sm">
        <h3 className="font-serif text-sm font-extrabold text-[#5C2318] flex items-center gap-1.5 mb-4">
          <Scroll className="w-4 h-4 text-[#A93226]" /> 急递：候皇上朱批密案名册
        </h3>
        {memorials.filter(m => m.status === 'pending').length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {memorials.filter(m => m.status === 'pending').slice(0, 4).map((m) => (
              <div
                key={m.id}
                onClick={() => onSelectMemorial(m)}
                className="p-3 rounded-lg bg-[#FAF6ED] hover:bg-white border-2 border-[#DCD3BE]/60 hover:border-[#A93226]/50 cursor-pointer flex items-center justify-between transition group"
              >
                <div className="space-y-1.5 max-w-[80%]">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.2 bg-[#87251B]/10 text-[#87251B] border border-[#87251B]/20 rounded font-serif font-black">
                      {m.category}司
                    </span>
                    <span className="text-[10px] text-[#7C6647] font-serif">
                      上折臣：{m.sender.split(' ')[0]}
                    </span>
                  </div>
                  <h4 className="text-xs font-serif font-black text-[#5C2318] group-hover:text-[#A93226] transition-colors truncate">
                    {m.title}
                  </h4>
                </div>
                <div className="flex items-center text-xs text-[#A93226] px-2 py-1 hover:bg-[#A93226]/5 rounded-lg shrink-0 font-serif font-bold gap-0.5">
                  批阅 <ArrowRight className="w-3" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-[#A09384] font-serif">
            <p className="text-xs">皇上垂帘大治，宇内澄清，天下暂无待裁之本。圣君安泰！</p>
          </div>
        )}
      </div>

    </div>
  );
}
