import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lyvrrtnhjkjhqhbarngp.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(req: Request) {
  try {
    const { email, password, nome, cargo } = await req.json();

    if (!email || !password || !nome || !cargo) {
      return NextResponse.json({ error: 'Preencha todos os campos corretamente.' }, { status: 400 });
    }

    if (!supabaseServiceKey) {
      return NextResponse.json({ error: 'Chave Service Role não configurada no servidor.' }, { status: 500 });
    }

    // Cria as instâncias do supabase usando a Service Key (Permissão de Deus/Root)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 1. Criar Usuário no Banco Auth.Users silenciosamente
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true // Pula a confirmação de email
    });

    if (authError) {
      return NextResponse.json({ error: `Erro Auth: ${authError.message}` }, { status: 400 });
    }

    const userId = authData.user.id;

    // 2. Inserir metadados e hierarquia na tabela public.perfis
    const { error: profileError } = await supabaseAdmin.from('perfis').insert({
      nome: nome,
      matricula: email, // Reutilizando a variável 'matricula' como email local
      cargo: cargo // 'laboratorista' | 'encarregado' | 'engenheiro'
    });

    if (profileError) {
       // Se der erro ao inserir na tabela perfis, tentar fazer um rollback na conta Auth apangado ela
       await supabaseAdmin.auth.admin.deleteUser(userId);
       return NextResponse.json({ error: `Erro Profile: ${profileError.message}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, user: { id: userId, email, nome, cargo } });
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro generalizado no servidor: ' + error.message }, { status: 500 });
  }
}
