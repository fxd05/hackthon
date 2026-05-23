import React, { useState, useEffect } from 'react';
import { Scroll, Crown, BarChart3, X } from 'lucide-react';
import { motion } from 'motion/react';
import { authFetch } from '../utils/api';

interface ProfileData {
  user: { displayName: string; avatarTitle: string; username: string; createdAt: string };
  stats: {
    totalReceived: number; totalReviewed: number;
    approveRate: number; rejectRate: number; holdRate: number;
    favCategory: string; avgEntertainment: number;
  };
  portrait: string;
}

interface ProfilePanelProps {
  onClose: () => void;
}

export default function ProfilePanel({ onClose }: ProfilePanelProps) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch('/api/profile');
        const result = await res.json();
        if (result.success) setData(result.data);
      } catch (err) {
        console.error("Failed to fetch profile:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E1A17]/80 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-md overflow-hidden border-4 border-double border-[#C2B095] rounded-xl bg-[#FAF6ED] text-[#2F2722] shadow-2xl max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[#5C2318] to-[#8E221A] border-b border-[#87251B] shrink-0">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-200" />
            <h2 className="font-serif text-md font-bold text-white tracking-widest">帝王本纪 · 御笔风范</h2>
          </div>
          <button onClick={onClose} className="px-3 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/20 text-white font-serif tracking-wider transition-colors cursor-pointer">
            退下
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-[#A93226] border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-xs text-[#6E6357] font-serif">史官正翻阅御档...</p>
            </div>
          ) : !data ? (
            <div className="text-center py-12 text-[#A09384] font-serif text-xs">御档调取失败，请稍后再试。</div>
          ) : (
            <div className="space-y-5">
              {/* User identity */}
              <div className="text-center pb-4 border-b border-[#D5C6AC]/50">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-[#A93226] to-[#5C2318] text-white font-serif font-black text-xl mb-2 shadow-lg">
                  {data.user.displayName[0]}
                </div>
                <h3 className="font-serif text-lg font-black text-[#5C2318]">{data.user.displayName}</h3>
                <p className="text-xs text-[#7C6647] font-serif">{data.user.avatarTitle}</p>
              </div>

              {/* AI Portrait */}
              <div className="relative p-4 bg-[#FCFAF5] border border-[#DCD3BE] rounded-lg">
                <div className="absolute -top-2.5 left-4 px-2 bg-[#FAF6ED] text-[10px] font-bold text-[#A93226] font-serif tracking-wider flex items-center gap-1">
                  <Scroll className="w-3 h-3" /> 史官评曰
                </div>
                <p className="text-sm text-[#2F2722] font-serif leading-relaxed mt-1 italic">{data.portrait}</p>
              </div>

              {/* Stats */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#7C6647] font-serif">
                  <BarChart3 className="w-3.5 h-3.5 text-[#A93226]" /> 御笔批览统要
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <StatCard label="收折总数" value={data.stats.totalReceived} />
                  <StatCard label="已批阅" value={data.stats.totalReviewed} />
                  <StatCard label="娱乐均值" value={data.stats.avgEntertainment} suffix="分" />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <RateCard label="准奏率" value={data.stats.approveRate} color="#2E5C50" />
                  <RateCard label="驳回率" value={data.stats.rejectRate} color="#A93226" />
                  <RateCard label="留中率" value={data.stats.holdRate} color="#7C6647" />
                </div>

                <div className="flex items-center gap-2 p-2.5 bg-[#FCFAF5] border border-[#DCD3BE] rounded-lg text-xs font-serif">
                  <span className="text-[#7C6647]">偏好司署：</span>
                  <span className="font-bold text-[#A93226]">{data.stats.favCategory}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function StatCard({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="p-2.5 bg-[#FCFAF5] border border-[#DCD3BE] rounded-lg text-center">
      <div className="text-lg font-black text-[#5C2318] font-mono">{value}{suffix}</div>
      <div className="text-[10px] text-[#7C6647] font-serif">{label}</div>
    </div>
  );
}

function RateCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="p-2.5 bg-[#FCFAF5] border border-[#DCD3BE] rounded-lg text-center">
      <div className="text-lg font-black font-mono" style={{ color }}>{value}%</div>
      <div className="text-[10px] text-[#7C6647] font-serif">{label}</div>
    </div>
  );
}
