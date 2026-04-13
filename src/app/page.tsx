'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LogOut } from 'lucide-react';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login');
      } else {
        setUser(session.user);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push('/login');
      else setUser(session.user);
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) return null; // Or a loading spinner

  return (
    <main className="page-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      
      <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '0.9rem', color: 'hsl(var(--text-muted))' }}>{user?.email}</span>
        <button onClick={handleLogout} className="btn-secondary" style={{ padding: '8px 16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <LogOut size={16} /> Sair
        </button>
      </div>

      <div className="glass-panel animate-fade-in" style={{ maxWidth: '700px', width: '100%' }}>
        <h1 style={{ fontSize: '3.5rem', color: 'hsl(var(--primary))', marginBottom: '8px' }}>PaviLab</h1>
        <p style={{ fontSize: '1.25rem', color: 'hsl(var(--text-muted))', marginBottom: '40px' }}>
          Sistema Integrado de Digitalização e Gestão de Ensaios Laboratoriais.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          
          <Link href="/field" style={{ textDecoration: 'none' }}>
            <div className="glass-panel" style={{ cursor: 'pointer', transition: 'all 0.2s', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'hsla(var(--primary) / 0.05)', border: '1px solid hsla(var(--primary) / 0.2)' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📱</div>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Módulo Campo</h2>
              <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.95rem', lineHeight: '1.4' }}>
                Interface mobile para laboratoristas. Selecione sua obra, obtenha o GPS e preencha os dados do ensaio.
              </p>
              <div className="btn-primary" style={{ marginTop: '24px', width: '100%' }}>Acessar como Laboratorista</div>
            </div>
          </Link>

          <Link href="/admin" style={{ textDecoration: 'none' }}>
            <div className="glass-panel" style={{ cursor: 'pointer', transition: 'all 0.2s', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'hsla(var(--secondary) / 0.05)', border: '1px solid hsla(var(--secondary) / 0.2)' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>💻</div>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Painel Gestão</h2>
              <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.95rem', lineHeight: '1.4' }}>
                Dashboard avançado, gestão de formulário, e auditoria de ensaios na nuvem.
              </p>
              <div className="btn-secondary" style={{ marginTop: '24px', width: '100%', borderColor: 'hsl(var(--secondary))', color: 'hsl(var(--secondary))' }}>Acessar Dashboard</div>
            </div>
          </Link>

        </div>
      </div>

      <div style={{ marginTop: '48px', fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>
        Status do Sistema: <span style={{ color: 'hsl(var(--primary))', fontWeight: 'bold' }}>Online (Conectado ao Supabase)</span>
      </div>
    </main>
  );
}
