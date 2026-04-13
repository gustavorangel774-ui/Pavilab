'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { HardHat, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const router = useRouter();

  const showToast = (message: string, type: 'error' | 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setToast(null);
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        showToast("E-mail ou senha incorretos", "error");
      } else if (error.message.includes("Email not confirmed")) {
        showToast("E-mail não confirmado pelo gestor", "error");
      } else {
        showToast("Erro na autenticação: " + error.message, "error");
      }
      setLoading(false);
    } else {
      showToast("Conectado com sucesso!", "success");
      setTimeout(() => router.push('/'), 500); 
    }
  };

  return (
    <div className="page-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <div className="glass-panel animate-fade-in" style={{ padding: '40px', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <HardHat size={48} color="hsl(var(--primary))" style={{ margin: '0 auto 16px auto' }} />
          <h1 style={{ fontSize: '1.8rem', color: 'hsl(var(--primary))' }}>PaviLab</h1>
          <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.9rem' }}>Acesso Restrito ao Sistema</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="input-group" style={{ margin: 0 }}>
            <label className="input-label">E-mail Corporativo</label>
            <input 
              type="email" 
              className="input-field" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="tecnico@pavilab.com"
              required 
            />
          </div>
          <div className="input-group" style={{ margin: 0 }}>
            <label className="input-label">Senha</label>
            <input 
              type="password" 
              className="input-field" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="••••••••"
              required 
            />
          </div>
          
          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginTop: '8px', height: '48px' }}>
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Acessar Plataforma'}
          </button>
        </form>

        <div style={{ textAlign: 'center', borderTop: '1px solid hsl(var(--border))', paddingTop: '24px' }}>
          <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.85rem' }}>
            Não possui conta? Solicite ao seu Administrador / Gestor do sistema.
          </p>
        </div>
      </div>

      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
