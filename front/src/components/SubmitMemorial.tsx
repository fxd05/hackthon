import React, { useState, useEffect } from 'react';
import { Send, Scroll, Sparkles, User, AlertCircle, Users, Link, Bookmark } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { authFetch } from '../utils/api';
import { useAuth } from '../context/AuthContext';

interface SubmitMemorialProps {
  onClose: () => void;
  onRefresh: () => void;
}

interface FriendItem {
  id: string;
  displayName: string;
  avatarTitle: string;
  username: string;
}

function extractDouyinUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s，。；;]+/);
  return match ? match[0] : null;
}

export default function SubmitMemorial({ onClose, onRefresh }: SubmitMemorialProps) {
  const { user } = useAuth();
  const [rawText, setRawText] = useState('');
  const [toUserId, setToUserId] = useState<string>(user?.id || '');
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [friendsLoading, setFriendsLoading] = useState(true);

  const isSelfSend = toUserId === user?.id;

  const loadingSteps = [
    "驿骑已执鞭接旨，备妥汗血宝马...",
    "快马出关，日夜兼程疾行三千里...",
    "密信百里飞递已进午门，通政司学士正火速理验...",
    "翰林侍读正研磨朱笔，全力翻译成大内奏章...",
    "万岁爷龙案微颤，折子已呈递至金丝案头！"
  ];

  useEffect(() => {
    const fetchFriends = async () => {
      try {
        const res = await authFetch('/api/friends');
        const data = await res.json();
        if (data.success) {
          setFriends(data.data.friends);
        }
      } catch (err) {
        console.error("Failed to fetch friends:", err);
      } finally {
        setFriendsLoading(false);
      }
    };
    fetchFriends();
  }, []);

  useEffect(() => {
    if (user && !toUserId) setToUserId(user.id);
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const textValue = rawText.trim();

    if (!textValue) {
      setError("启奏圣上：分享文案或链接不可空白！");
      return;
    }
    if (!extractDouyinUrl(textValue)) {
      setError("启奏圣上：未识别到抖音链接！");
      return;
    }
    if (!toUserId) {
      setError("请先选择递折对象！");
      return;
    }

    setLoading(true);
    setError(null);

    let stepIndex = 0;
    setLoadingMessage(loadingSteps[0]);
    const timer = setInterval(() => {
      stepIndex = (stepIndex + 1) % loadingSteps.length;
      setLoadingMessage(loadingSteps[stepIndex]);
    }, 2000);

    try {
      const endpoint = '/api/memorials/from-url';
      const body = { url: textValue, toUserId };

      const response = await authFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
      });

      const result = await response.json();
      clearInterval(timer);

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          onRefresh();
          onClose();
        }, 1500);
      } else {
        setError(result.error || "驿站驿卒罢工，奏折呈呈落空，请稍后再试。");
        setLoading(false);
      }
    } catch (err: any) {
      clearInterval(timer);
      console.error(err);
      setError("兵荒马乱！路途受阻，大内奏折未能及时递达。");
      setLoading(false);
    }
  };

  const selectedFriend = friends.find(f => f.id === toUserId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E1A17]/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg overflow-hidden border-4 border-double border-[#A93226]/60 rounded-xl bg-[#FAF6ED] text-[#2F2722] shadow-2xl max-h-[90vh] flex flex-col">

        <div className="flex items-center justify-between p-4 bg-[#A93226] border-b border-[#87251B] shrink-0">
          <div className="flex items-center gap-2">
            <Scroll className="w-5 h-5 text-amber-200 animate-pulse" />
            <h2 className="font-serif text-md font-bold text-white tracking-widest">百里急报 · 录入新奏本</h2>
          </div>
          <button onClick={onClose} className="px-3 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/20 text-white font-serif tracking-wider transition-colors cursor-pointer">
            退下
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-12 text-center">
                <div className="relative flex items-center justify-center w-16 h-16 mb-6">
                  <div className="absolute inset-0 border-4 border-[#A93226] border-t-transparent rounded-full animate-spin"></div>
                  <Scroll className="w-8 h-8 text-[#A83226]" />
                </div>
                <h3 className="font-serif text-lg font-bold text-[#A93226] mb-2">圣驾稍候...</h3>
                <p className="text-[#6E6357] text-xs max-w-xs h-10 flex items-center justify-center leading-relaxed font-serif">{loadingMessage}</p>
                <span className="mt-8 text-[9px] text-[#A09384] font-mono tracking-widest animate-pulse">ROYAL COURIER SECURE LINE</span>
              </motion.div>
            ) : success ? (
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-[#EBF7EE] text-[#2E5C50] border border-[#2E5C50]/30 shadow-inner">
                  <Sparkles className="w-8 h-8 animate-bounce" />
                </div>
                <h3 className="font-serif text-xl font-bold text-[#2E5C50] mb-2">
                  {isSelfSend ? '自留成功！' : '上宣成功！'}
                </h3>
                <p className="text-[#6E6357] text-xs font-serif leading-relaxed max-w-xs">
                  {isSelfSend
                    ? '折本已留于龙案御览，静候圣上亲自批阅。'
                    : <>折本已飞递至 <strong>{selectedFriend?.displayName || '好友'}</strong> 的龙案之上，等候御玺钦点朱批。</>
                  }
                </p>
              </motion.div>
            ) : (
              <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={handleSubmit} className="space-y-4 font-serif">
                {error && (
                  <div className="p-3 text-xs rounded-lg bg-[#FFF5F4] border border-[#A83226]/30 text-[#A83226] flex items-center gap-2 font-serif">
                    <AlertCircle className="w-4 h-4 shrink-0 text-[#A93226]" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="rounded-lg border border-[#DCD3BE] bg-[#FCFAF5] px-3 py-2 text-[10px] leading-relaxed text-[#7C6647] font-serif">
                  这里只走视频解析链。把抖音分享文案或链接整段贴进来，后端会自动抽取链接并生成卡片。
                </div>

                {/* Recipient selector: self + friends */}
                <div>
                  <label className="block text-xs font-bold text-[#7C6647] mb-1.5 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#A93226]" /> 递折给谁？
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {/* Self option */}
                    {user && (
                      <button
                        type="button"
                        onClick={() => setToUserId(user.id)}
                        className={`px-3 py-2 rounded-lg text-xs border transition-all cursor-pointer flex items-center gap-1.5 ${
                          toUserId === user.id
                            ? 'bg-[#2E5C50] border-[#2E5C50] text-white font-bold shadow-sm'
                            : 'bg-[#FCFAF5] border-[#DCD3BE] text-[#6E6357] hover:border-[#2E5C50]/50 hover:text-[#2E5C50]'
                        }`}
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${toUserId === user.id ? 'text-amber-200' : 'text-[#2E5C50]'}`} />
                        自留御览
                      </button>
                    )}
                    {/* Friends list */}
                    {friendsLoading ? (
                      <span className="text-[10px] text-[#7C6647] font-serif py-2 px-3">名册调取中...</span>
                    ) : (
                      friends.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setToUserId(f.id)}
                          className={`px-3 py-2 rounded-lg text-xs border transition-all cursor-pointer flex items-center gap-1.5 ${
                            toUserId === f.id
                              ? 'bg-[#A93226] border-[#A93226] text-white font-bold shadow-sm'
                              : 'bg-[#FCFAF5] border-[#DCD3BE] text-[#6E6357] hover:border-[#A93226]/50 hover:text-[#A93226]'
                          }`}
                        >
                          <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center ${toUserId === f.id ? 'bg-white/20 text-white' : 'bg-[#A93226]/10 text-[#A93226]'}`}>
                            {f.displayName[0]}
                          </span>
                          {f.displayName}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#7C6647] mb-1.5 flex items-center gap-1.5">
                    <Link className="w-3.5 h-3.5 text-[#A93226]" /> 粘贴抖音分享文案
                  </label>
                  <textarea
                    rows={4}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    required
                    placeholder="直接粘贴抖音分享文案"
                    className="w-full px-3 py-2.5 text-xs bg-[#FCFAF5] border border-[#DCD3BE] rounded-lg focus:border-[#A93226] focus:outline-none text-[#2F2722] placeholder-[#A09384] transition resize-none leading-relaxed shadow-inner"
                  />
                </div>

                <div className="pt-4 border-t border-[#D5C6AC]/50 flex justify-end gap-3 select-none">
                  <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-serif bg-[#EFE9DA] text-[#6E6357] hover:bg-[#E4DEC9] rounded-lg border border-[#DCD3BE] transition cursor-pointer">
                    暂缓呈递
                  </button>
                  <button type="submit" disabled={!toUserId}
                    className="px-4 py-2 text-xs font-serif font-black flex items-center gap-1.5 bg-[#A93226] hover:bg-[#87251B] text-white rounded-lg shadow border border-[#87251B] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                    <Send className="w-3.5 h-3.5 text-white" />
                    {isSelfSend ? '留于御案' : '飞马递链'}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
