import React, { useState } from 'react';
import { Shield, Lock, User, Mail } from 'lucide-react';

interface AuthViewProps {
  onLogin: (u: string, p: string) => Promise<void>;
  onRegister: (u: string, e: string, p: string) => Promise<void>;
}

export const AuthView: React.FC<AuthViewProps> = ({ onLogin, onRegister }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isLogin && password !== confirmPassword) {
      setError('SECURITY KEYS DO NOT MATCH');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await onLogin(username, password);
      } else {
        await onRegister(username, email, password);
      }
    } catch (err: any) {
      // If we have a complex error object from a failed fetch
      if (err.details?.fieldErrors) {
        const firstField = Object.keys(err.details.fieldErrors)[0];
        const firstMsg = err.details.fieldErrors[firstField][0];
        setError(`${firstField.toUpperCase()}: ${firstMsg.toUpperCase()}`);
      } else {
        setError(err.message.toUpperCase());
      }
    } finally {
      setLoading(false);
    }
  };

  const CornerAccents = () => (
    <>
      <div className="corner-accent corner-tl" />
      <div className="corner-accent corner-tr" />
      <div className="corner-accent corner-bl" />
      <div className="corner-accent corner-br" />
    </>
  );

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#020402] text-[#00ff41] font-mono crt p-4">
      <div className="w-full max-w-md neon-panel p-8 bg-grid">
        <CornerAccents />
        
        <div className="flex flex-col items-center mb-8">
          <div className="text-3xl font-bold tracking-[0.3em] text-glow mb-2">NEON REQUIEM</div>
          <div className="text-[10px] uppercase tracking-[0.5em] opacity-50 italic">Neural Interface Portal</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" size={16} />
              <input
                type="text"
                placeholder="USERNAME"
                className="w-full bg-[#050505] border border-[#00ff41]/30 p-3 pl-10 text-sm focus:outline-none focus:border-[#00ff41] transition-colors placeholder:text-[#00ff41]/20"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            {!isLogin && (
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" size={16} />
                <input
                  type="email"
                  placeholder="EMAIL ADDRESS"
                  className="w-full bg-[#050505] border border-[#00ff41]/30 p-3 pl-10 text-sm focus:outline-none focus:border-[#00ff41] transition-colors placeholder:text-[#00ff41]/20"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" size={16} />
              <input
                type="password"
                placeholder="SECURITY KEY"
                className="w-full bg-[#050505] border border-[#00ff41]/30 p-3 pl-10 text-sm focus:outline-none focus:border-[#00ff41] transition-colors placeholder:text-[#00ff41]/20"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {!isLogin && (
              <div className="relative animate-in fade-in slide-in-from-top-2 duration-300">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" size={16} />
                <input
                  type="password"
                  placeholder="CONFIRM SECURITY KEY"
                  className="w-full bg-[#050505] border border-[#00ff41]/30 p-3 pl-10 text-sm focus:outline-none focus:border-[#00ff41] transition-colors placeholder:text-[#00ff41]/20"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            )}
          </div>

          {error && (
            <div className="text-pink-500 text-[10px] uppercase tracking-wider text-center bg-pink-500/10 p-2 border border-pink-500/30">
              ERROR: {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full border border-[#00ff41]/50 bg-[#00ff41]/10 p-4 text-xs font-bold tracking-[0.4em] hover:bg-[#00ff41]/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? 'INITIALIZING...' : isLogin ? 'ESTABLISH LINK' : 'CREATE NEURAL SIGNATURE'}
            {!loading && <Shield size={14} />}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-[#00ff41]/10 flex justify-between items-center text-[10px]">
          <span className="opacity-40">{isLogin ? "NO IDENTITY?" : "ALREADY SIGNED?"}</span>
          <button 
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-[#00ff41] hover:text-white transition-colors tracking-widest uppercase font-bold"
          >
            {isLogin ? "[ REGISTER ]" : "[ LOGIN ]"}
          </button>
        </div>
      </div>
    </div>
  );
};
