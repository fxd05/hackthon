import React, { useState } from 'react';
import { Scroll, User, Lock, Sparkles, Crown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// @ts-ignore
import emperorCat from '../assets/images/emperor_cat_scholar_1779528358177.png';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarTitle, setAvatarTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    let err: string | null;
    if (mode === 'login') {
      err = await login(username, password);
    } else {
      err = await register(username, password, displayName || username, avatarTitle || '布衣百姓');
    }

    if (err) setError(err);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#FAF6ED] flex items-center justify-center p-4 relative overflow-hidden">

      {/* Background decorative patterns */}
      <div className="absolute top-0 left-0 w-full h-full opacity-[0.02] pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-serif text-[20rem] text-red-800 font-black select-none">殿</div>
      </div>
      <div className="absolute top-0 left-0 w-32 h-32 opacity-5 pointer-events-none bg-[radial-gradient(circle,_#A93226_2px,_transparent_2px)] bg-[size:16px_16px]"></div>
      <div className="absolute bottom-0 right-0 w-32 h-32 opacity-5 pointer-events-none bg-[radial-gradient(circle,_#A93226_2px,_transparent_2px)] bg-[size:16px_16px]"></div>

      <div className="w-full max-w-md">
        {/* Top scroll roller */}
        <div className="relative w-full mb-0">
          <div className="absolute -left-4 top-1 w-6 h-12 bg-gradient-to-b from-[#4A160E] via-[#8E221A] to-[#4A160E] rounded-l-md shadow-lg z-20"></div>
          <div className="w-full h-8 bg-gradient-to-b from-[#8C765C] via-[#DCD3BE] to-[#8C765C] rounded-md shadow-md border-y-2 border-[#5c2318]/40"></div>
          <div className="absolute -right-4 top-1 w-6 h-12 bg-gradient-to-b from-[#4A160E] via-[#8E221A] to-[#4A160E] rounded-r-md shadow-lg z-20"></div>
        </div>

        {/* Main scroll body */}
        <div className="bg-[#FCF9F2] border-x-[16px] border-[#C2B095] shadow-2xl p-8 relative -mt-1">
          {/* Red margin lines */}
          <div className="absolute inset-y-0 left-2 w-0.5 bg-[#A93226]/12 pointer-events-none"></div>
          <div className="absolute inset-y-0 right-2 w-0.5 bg-[#A93226]/12 pointer-events-none"></div>

          {/* Header with cat avatar */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative overflow-hidden w-20 h-20 rounded-full border-3 border-[#C2B095] bg-[#FCFAF5] p-0.5 shadow-lg mb-4">
              <img src={emperorCat} className="w-full h-full object-cover rounded-full" alt="学士猫" referrerPolicy="no-referrer" />
              <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 bg-[#A93226] text-white rounded-full text-[10px] font-serif font-black flex items-center justify-center border border-white">印</div>
            </div>
            <h1 className="font-serif text-2xl font-black tracking-widest text-[#5C2318] flex items-center gap-2">
              <Crown className="w-5 h-5 text-[#A93226]" />
              大内御书房
            </h1>
            <p className="text-xs text-[#6E6357] font-serif mt-1">
              {mode === 'login' ? '龙门登殿 · 皇上驾到' : '入宫注册 · 新臣报道'}
            </p>
          </div>

          {/* Tab toggle */}
          <div className="flex bg-[#FAF6ED] p-1 rounded-lg border border-[#DCD3BE] gap-1 mb-6">
            <button
              onClick={() => { setMode('login'); setError(null); }}
              className={`flex-1 py-2 rounded text-xs font-serif font-bold tracking-wide transition cursor-pointer ${mode === 'login' ? 'bg-[#A93226] text-white' : 'text-[#6E6357] hover:text-[#2F2722]'}`}
            >
              龙门登殿
            </button>
            <button
              onClick={() => { setMode('register'); setError(null); }}
              className={`flex-1 py-2 rounded text-xs font-serif font-bold tracking-wide transition cursor-pointer ${mode === 'register' ? 'bg-[#A93226] text-white' : 'text-[#6E6357] hover:text-[#2F2722]'}`}
            >
              入宫注册
            </button>
          </div>

          {error && (
            <div className="p-3 mb-4 text-xs rounded-lg bg-[#FFF5F4] border border-[#A83226]/30 text-[#A83226] font-serif">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 font-serif">
            <div>
              <label className="block text-xs font-bold text-[#7C6647] mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#A93226]" /> 名号 (用户名)
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="如：李太白、苏东坡..."
                required
                maxLength={20}
                className="w-full px-3 py-2.5 text-sm bg-[#FCFAF5] border border-[#DCD3BE] rounded-lg focus:border-[#A93226] focus:outline-none text-[#2F2722] placeholder-[#A09384] transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#7C6647] mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#A93226]" /> 入宫口令 (密码)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少三位口令"
                required
                minLength={3}
                className="w-full px-3 py-2.5 text-sm bg-[#FCFAF5] border border-[#DCD3BE] rounded-lg focus:border-[#A93226] focus:outline-none text-[#2F2722] placeholder-[#A09384] transition"
              />
            </div>

            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-[#7C6647] mb-1.5 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#A93226]" /> 殿堂显名 (选填)
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="在朝中显示的名号，如：翰林学士 李白"
                    maxLength={20}
                    className="w-full px-3 py-2.5 text-sm bg-[#FCFAF5] border border-[#DCD3BE] rounded-lg focus:border-[#A93226] focus:outline-none text-[#2F2722] placeholder-[#A09384] transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#7C6647] mb-1.5 flex items-center gap-1.5">
                    <Scroll className="w-3.5 h-3.5 text-[#A93226]" /> 官职封号 (选填)
                  </label>
                  <input
                    type="text"
                    value={avatarTitle}
                    onChange={(e) => setAvatarTitle(e.target.value)}
                    placeholder="如：九门提督、御猫展昭、翰林侍读..."
                    maxLength={15}
                    className="w-full px-3 py-2.5 text-sm bg-[#FCFAF5] border border-[#DCD3BE] rounded-lg focus:border-[#A93226] focus:outline-none text-[#2F2722] placeholder-[#A09384] transition"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 text-sm font-serif font-black tracking-widest rounded-xl bg-[#A93226] hover:bg-[#87251B] text-white shadow-md border border-[#87251B] transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  验符通关中...
                </>
              ) : mode === 'login' ? (
                '龙驾入殿'
              ) : (
                '册封入朝'
              )}
            </button>
          </form>

          <p className="text-center text-[10px] text-[#A09384] font-serif mt-6">
            大内御书房 · 理奏大典 · 抖音脑洞简报系统
          </p>
        </div>

        {/* Bottom scroll roller */}
        <div className="relative w-full -mt-1">
          <div className="absolute -left-4 -top-1 w-6 h-12 bg-gradient-to-b from-[#4A160E] via-[#8E221A] to-[#4A160E] rounded-l-md shadow-lg z-20"></div>
          <div className="w-full h-8 bg-gradient-to-b from-[#8C765C] via-[#DCD3BE] to-[#8C765C] rounded-md shadow-md border-y-2 border-[#5c2318]/40"></div>
          <div className="absolute -right-4 -top-1 w-6 h-12 bg-gradient-to-b from-[#4A160E] via-[#8E221A] to-[#4A160E] rounded-r-md shadow-lg z-20"></div>
        </div>
      </div>
    </div>
  );
}
