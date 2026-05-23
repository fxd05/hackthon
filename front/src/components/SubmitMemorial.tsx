import React, { useState, useEffect } from 'react';
import { Send, Scroll, Sparkles, User, AlertCircle, Users, Link, FileText, Bookmark } from 'lucide-react';
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

type SubmitMode = 'text' | 'url';

export default function SubmitMemorial({ onClose, onRefresh }: SubmitMemorialProps) {
  const { user } = useAuth();
  const [mode, setMode] = useState<SubmitMode>('text');
  const [rawText, setRawText] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [customSender, setCustomSender] = useState('');
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
    if (user) {
      setCustomSender(`${user.avatarTitle} ${user.displayName}`);
      if (!toUserId) setToUserId(user.id);
    }
  }, [user]);

  const handlePreset = (title: string, content: string) => {
    setRawText(`复制打开抖音，看看【${title}】\n${content}\nhttps://v.douyin.com/mock-preset/`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'text' && !rawText.trim()) {
      setError("启奏圣上：奏章正文不可空白！");
      return;
    }
    if (mode === 'url' && !videoUrl.trim()) {
      setError("启奏圣上：视频链接不可空白！");
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
      const endpoint = mode === 'url' ? '/api/memorials/from-url' : '/api/memorials';
      const body = mode === 'url'
        ? { url: videoUrl.trim(), toUserId }
        : { rawText, customSender: customSender.trim() || undefined, toUserId };

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

                {/* Mode toggle: text vs URL */}
                <div className="flex bg-[#FCFAF5] p-1 rounded-lg border border-[#DCD3BE] gap-1">
                  <button
                    type="button"
                    onClick={() => { setMode('text'); setError(null); }}
                    className={`flex-1 py-2 rounded text-xs font-serif text-center font-bold tracking-wide transition flex items-center justify-center gap-1.5 cursor-pointer ${mode === 'text' ? 'bg-[#A93226] text-white shadow-sm' : 'text-[#6E6357] hover:text-[#2F2722]'}`}
                  >
                    <FileText className="w-3.5 h-3.5" /> 粘贴文案
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode('url'); setError(null); }}
                    className={`flex-1 py-2 rounded text-xs font-serif text-center font-bold tracking-wide transition flex items-center justify-center gap-1.5 cursor-pointer ${mode === 'url' ? 'bg-[#A93226] text-white shadow-sm' : 'text-[#6E6357] hover:text-[#2F2722]'}`}
                  >
                    <Link className="w-3.5 h-3.5" /> 粘贴链接
                  </button>
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

                {mode === 'text' ? (
                  <>
                    {/* Sender name */}
                    <div>
                      <label className="block text-xs font-bold text-[#7C6647] mb-1.5 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-[#A93226]" /> 呈折臣子名号
                      </label>
                      <input
                        type="text"
                        value={customSender}
                        onChange={(e) => setCustomSender(e.target.value)}
                        placeholder="如：爱妃杨玉环、九门提督..."
                        maxLength={20}
                        className="w-full px-3 py-2 text-xs bg-[#FCFAF5] border border-[#DCD3BE] rounded-lg focus:border-[#A93226] focus:outline-none text-[#2F2722] placeholder-[#A09384] transition"
                      />
                    </div>

                    {/* Raw text */}
                    <div>
                      <label className="block text-xs font-bold text-[#7C6647] mb-1.5 flex items-center gap-1.5">
                        <Scroll className="w-3.5 h-3.5 text-[#A93226]" /> 粘贴抖音文案（包括分享链接或逗趣正文内容）
                      </label>
                      <textarea
                        rows={4}
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                        required
                        placeholder="直接粘贴好友发送给您的抖音文案，大模型将为您智能汇编成古风折本！"
                        className="w-full px-3 py-2.5 text-xs bg-[#FCFAF5] border border-[#DCD3BE] rounded-lg focus:border-[#A93226] focus:outline-none text-[#2F2722] placeholder-[#A09384] transition resize-none leading-relaxed shadow-inner"
                      />
                    </div>

                    {/* Presets */}
                    <div className="pt-2">
                      <span className="block text-[10px] font-bold text-[#7C6647] mb-2">或者，一键拟呈经典名折：</span>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => handlePreset("西双版纳泼水王", "大内大臣去西双版纳采风，被泼得全身精湿，竟当众乱舞十分丢骨气")}
                          className="px-2.5 py-1.5 text-[11px] border border-[#DCD3BE] rounded-lg bg-[#FCFAF5] text-[#6E6357] hover:border-[#A93226] hover:text-[#A93226] transition-colors cursor-pointer">
                          泼水狂舞
                        </button>
                        <button type="button" onClick={() => handlePreset("手工易拉罐烤箱", "街头巧木匠用苏打水易拉罐自制超精编烧烤炉，引得衙役聚众流口水")}
                          className="px-2.5 py-1.5 text-[11px] border border-[#DCD3BE] rounded-lg bg-[#FCFAF5] text-[#6E6357] hover:border-[#A93226] hover:text-[#A93226] transition-colors cursor-pointer">
                          街边神手
                        </button>
                        <button type="button" onClick={() => handlePreset("哈士奇空中大劫案", "爱卿家中的哈士奇飞跃围栏，在空中劫走隔壁的腊肉，坠入泥潭沦为泥狗")}
                          className="px-2.5 py-1.5 text-[11px] border border-[#DCD3BE] rounded-lg bg-[#FCFAF5] text-[#6E6357] hover:border-[#A93226] hover:text-[#A93226] transition-colors cursor-pointer">
                          傻狗飞食
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  /* URL input mode */
                  <div>
                    <label className="block text-xs font-bold text-[#7C6647] mb-1.5 flex items-center gap-1.5">
                      <Link className="w-3.5 h-3.5 text-[#A93226]" /> 粘贴抖音视频链接
                    </label>
                    <input
                      type="url"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      required
                      placeholder="https://v.douyin.com/xxxxx/ 或完整抖音视频链接"
                      className="w-full px-3 py-2.5 text-xs bg-[#FCFAF5] border border-[#DCD3BE] rounded-lg focus:border-[#A93226] focus:outline-none text-[#2F2722] placeholder-[#A09384] transition font-mono"
                    />
                    <p className="mt-1.5 text-[10px] text-[#A09384] font-serif leading-relaxed">
                      将抖音视频分享链接粘入此处，内阁学士将自动解析视频内容，编撰为古风奏本。
                    </p>
                  </div>
                )}

                <div className="pt-4 border-t border-[#D5C6AC]/50 flex justify-end gap-3 select-none">
                  <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-serif bg-[#EFE9DA] text-[#6E6357] hover:bg-[#E4DEC9] rounded-lg border border-[#DCD3BE] transition cursor-pointer">
                    暂缓呈递
                  </button>
                  <button type="submit" disabled={!toUserId}
                    className="px-4 py-2 text-xs font-serif font-black flex items-center gap-1.5 bg-[#A93226] hover:bg-[#87251B] text-white rounded-lg shadow border border-[#87251B] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                    <Send className="w-3.5 h-3.5 text-white" />
                    {isSelfSend ? '留于御案' : (mode === 'url' ? '飞马递链' : '击鼓呈送')}
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
