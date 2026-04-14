'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  graficoBetume, graficoGranulometria
} from '@/lib/mockData';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { ArrowLeft, HardHat, FileSpreadsheet, Filter, Building2, UserPlus, SlidersHorizontal, PlusCircle } from 'lucide-react';

export default function AdminDashboard() {
  const [tab, setTab] = useState('dashboard'); // dashboard | cadastros
  const [subTab, setSubTab] = useState('obras'); // obras | usuarios | ensaios
  
  const [filtroObra, setFiltroObra] = useState('global');
  const [filtroData, setFiltroData] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');

  // Form states
  const [novaObraNome, setNovaObraNome] = useState('');
  const [novaObraCidade, setNovaObraCidade] = useState('');
  const [novaObraEstado, setNovaObraEstado] = useState('SP');
  const [novaObraTipo, setNovaObraTipo] = useState('estrada'); // estrada | loteamento
  
  // States para Estrada
  const [estradaInicial, setEstradaInicial] = useState<number | ''>('');
  const [estradaFinal, setEstradaFinal] = useState<number | ''>('');
  
  // States para Loteamento
  const [loteamentoRuas, setLoteamentoRuas] = useState<{nome: string, quadras: number}[]>([{nome: '', quadras: 1}]);
  const [novoUserNome, setNovoUserNome] = useState('');
  const [novoUserEmail, setNovoUserEmail] = useState('');
  const [novoUserSenha, setNovoUserSenha] = useState('');
  const [novoUserRole, setNovoUserRole] = useState('laboratorista');
  const [equipe, setEquipe] = useState<any[]>([]);

  const [novoEnsaioNome, setNovoEnsaioNome] = useState('');
  const [novoEnsaioSlug, setNovoEnsaioSlug] = useState('');
  const [novoEnsaioCampos, setNovoEnsaioCampos] = useState('');
  const [novoEnsaioPlanilha, setNovoEnsaioPlanilha] = useState<File | null>(null);
  const [ensaioPreview, setEnsaioPreview] = useState<any>(null);
  
  const [projetos, setProjetos] = useState<any[]>([]);
  const [ensaiosAtivos, setEnsaiosAtivos] = useState<any[]>([]);
  const [logsAudit, setLogsAudit] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login');
      else setUser(session.user);
    });

    const carregarDados = async () => {
      const { data: p } = await supabase.from('projetos').select('*');
      if (p) setProjetos(p);

      const { data: e } = await supabase.from('ensaios_tipos').select('*');
      if (e) setEnsaiosAtivos(e);

      const { data: perfisFetch } = await supabase.from('perfis').select('*');
      if (perfisFetch) setEquipe(perfisFetch);

      const { data: testes } = await supabase
        .from('testes_realizados')
        .select(`
          id, ensaio_id, estaca, resultado_status, dados_norma, created_at, projeto_id, valores,
          projetos (id, nome)
        `)
        .neq('resultado_status', 'Arquivado') /* Soft delete filter */
        .order('created_at', { ascending: false });
      
      if (testes) setLogsAudit(testes);
    };

    carregarDados();
  }, [router]);

  const deletarEnsaio = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta coleta da base principal? Ela será ocultada para fins de auditoria.')) {
      const { error } = await supabase.from('testes_realizados').update({ resultado_status: 'Arquivado' }).eq('id', id);
      if (!error) {
        setLogsAudit(logsAudit.filter(l => l.id !== id));
      } else {
        alert('Falha ao excluir ensaio: ' + error.message);
      }
    }
  };

  const handleCriarObra = async () => {
    if (!novaObraNome || !novaObraCidade) return alert('O Nome e a Cidade são obrigatórios.');
    
    let arrayUnificado: string[] = [];

    if (novaObraTipo === 'estrada') {
       if (estradaInicial === '' || estradaFinal === '') return alert('Defina a estaca inicial e final da estrada.');
       const inNum = Number(estradaInicial);
       const outNum = Number(estradaFinal);
       if (inNum > outNum) return alert('A estaca inicial não pode ser maior que a final.');
       for (let i = inNum; i <= outNum; i++) {
          arrayUnificado.push(`Estaca ${i}`);
       }
    } else {
       // loteamento
       loteamentoRuas.forEach(rua => {
          if (!rua.nome) return;
          for (let q = 1; q <= rua.quadras; q++) {
             let formatQd = q < 10 ? `0${q}` : q.toString();
             arrayUnificado.push(`${rua.nome.trim()} - Quadra ${formatQd}`);
          }
       });
       if(arrayUnificado.length === 0) return alert('Defina ao menos o nome de uma Rua validamente.');
    }

    const { data, error } = await supabase.from('projetos').insert({ 
      nome: novaObraNome, 
      cidade: novaObraCidade,
      estado: novaObraEstado,
      tipo: novaObraTipo,
      estacas: arrayUnificado 
    }).select();

    if (!error && data) {
       setProjetos([...projetos, data[0]]);
       setNovaObraNome('');
       setNovaObraCidade('');
       if(novaObraTipo === 'estrada') {
          setEstradaInicial(''); setEstradaFinal('');
       } else {
          setLoteamentoRuas([{nome: '', quadras: 1}]);
       }
       alert('Sincronizado via Satélite! Frente de Obra ativa com base espacial gerada automaticamente.');
    } else alert('Erro na requisição Supabase: ' + error?.message);
  };

  const deletarProjeto = async (id: string) => {
    if(window.confirm('Excluir esta Obra? Ensaios vinculados a ela ficarão órfãos e marcados como "Obra Excluída" na base principal.')) {
      // TRATATIVA DE VIOLAÇÃO DE FOREIGN KEY CONSTRAIN:
      // Como testes_realizados apontam para o ID da obra, o Supabase bloqueia a exclusão da "Mãe" sem desligar as "Crianças" primeiro.
      await supabase.from('testes_realizados').update({ projeto_id: null }).eq('projeto_id', id);

      const { error } = await supabase.from('projetos').delete().eq('id', id);
      if(!error) setProjetos(projetos.filter(p => p.id !== id));
      else alert('Erro ao deletar: ' + error.message);
    }
  };

  const handleCriarEquipe = async () => {
     if (!novoUserNome || !novoUserEmail || !novoUserSenha) return alert('Todos os campos são obrigatórios.');
     
     const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
           email: novoUserEmail, 
           password: novoUserSenha, 
           nome: novoUserNome, 
           cargo: novoUserRole 
        })
     });

     const data = await res.json();

     if (res.ok && data.success) {
         setEquipe([...equipe, {
            id: data.user.id,
            nome: data.user.nome,
            matricula: data.user.email,
            cargo: data.user.cargo
         }]);
         setNovoUserNome('');
         setNovoUserEmail('');
         setNovoUserSenha('');
         alert('Credenciais criadas e sincronizadas com o servidor de Autenticação Oficial!');
     } else {
         alert('Erro no registro: ' + (data.error || 'Falha ao conectar com auth system.'));
     }
  };

  const deletarEquipe = async (id: string) => {
      const targetUser = equipe.find(e => e.id === id);
      if (myRole === 'engenheiro' && targetUser?.cargo === 'administrador') {
          return alert('Acesso negado: Engenheiros não podem destituir Administradores.');
      }
      if(window.confirm('Tirar acesso deste membro?')) {
          const { error } = await supabase.from('perfis').delete().eq('id', id);
          if(!error) setEquipe(equipe.filter(e => e.id !== id));
          else alert('Erro: ' + error.message);
      }
  };

  const handleCriarEnsaio = async () => {
     if(!novoEnsaioNome || !novoEnsaioSlug || !novoEnsaioCampos) return alert('Preencha os dados estruturais do Ensaio.');
     const camposFormatados = novoEnsaioCampos.split(',').map(str => {
        const tr = str.trim();
        return { id: tr.toLowerCase().replace(/[^a-z0-9]/g, '_'), label: tr, tipo: 'number' };
     }).filter(c => c.id !== '');

     let uploadedTemplatePath = null;
     
     if (novoEnsaioPlanilha) {
        const fileExt = novoEnsaioPlanilha.name.split('.').pop();
        const fileName = `${novoEnsaioSlug.trim().toLowerCase()}_${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
           .from('modelos_ensaios')
           .upload(fileName, novoEnsaioPlanilha, { upsert: true });
        
        if (uploadError) return alert('Falha ao subir a planilha base: ' + uploadError.message);
        
        const { data: publicData } = supabase.storage.from('modelos_ensaios').getPublicUrl(fileName);
        uploadedTemplatePath = publicData.publicUrl;
        
        camposFormatados.push({
           id: '__sys_template_path',
           label: 'Caminho Digital do Excel',
           tipo: 'system',
           path: uploadedTemplatePath
        } as any);
     }

     const { data, error } = await supabase.from('ensaios_tipos').insert({
         id: novoEnsaioSlug.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''),
         nome: novoEnsaioNome,
         campos: camposFormatados
     }).select();

     if(!error && data) {
         setEnsaiosAtivos([...ensaiosAtivos, data[0]]);
         setNovoEnsaioNome('');
         setNovoEnsaioSlug('');
         setNovoEnsaioCampos('');
         setNovoEnsaioPlanilha(null);
         alert(uploadedTemplatePath ? 'Ensaio e Planilha Base sincronizados com a Nuvem!' : 'Ensaio criado na Biblioteca sem Planilha anexada.');
     } else alert('Falha ao compilar JSON de ensaio: ' + error?.message);
  };

  const logsFiltrados = logsAudit.filter(log => {
    if (filtroObra !== 'global' && log.projeto_id !== filtroObra) return false;
    if (filtroTipo !== 'todos' && log.ensaio_id !== filtroTipo) return false;
    if (filtroData) {
      const dataStr = new Date(log.created_at).toISOString().split('T')[0];
      if (dataStr !== filtroData) return false;
    }
    return true;
  });

  const calcularMecanicaKPI = (listaLogs: any[]) => {
    let gcSum = 0, gcCount = 0;
    let betumeSum = 0, betumeCount = 0;
    let eaSum = 0, eaCount = 0;

    listaLogs.forEach(log => {
       if (log.ensaio_id === 'compactacao' && log.dados_norma?.includes('GC:')) {
           const val = parseFloat(log.dados_norma.replace('GC:', '').replace('%', '').trim());
           if (!isNaN(val)) { gcSum += val; gcCount++;}
       }
       if (log.ensaio_id === 'betume_granulometria' && log.dados_norma?.includes('Teor:')) {
           const val = parseFloat(log.dados_norma.split('-')[0].replace('Teor:', '').replace('%', '').trim());
           if (!isNaN(val)) { betumeSum += val; betumeCount++;}
       }
       if (log.ensaio_id === 'equivalente_areia' && log.dados_norma?.includes('EA:')) {
           const val = parseFloat(log.dados_norma.replace('EA:', '').replace('%', '').trim());
           if (!isNaN(val)) { eaSum += val; eaCount++;}
       }
    });

    return {
      gcRaw: gcCount ? (gcSum/gcCount) : 0,
      betumeRaw: betumeCount ? (betumeSum/betumeCount) : 0,
      eaRaw: eaCount ? (eaSum/eaCount) : 0,
      gc: gcCount ? (gcSum/gcCount).toFixed(1) + '%' : 'N/A',
      betume: betumeCount ? (betumeSum/betumeCount).toFixed(2) + '%' : 'N/A',
      ea: eaCount ? Math.round(eaSum/eaCount) + '%' : 'N/A'
    };
  };

  const kpisDinamicos = calcularMecanicaKPI(logsFiltrados);
  const kpisGlobais = calcularMecanicaKPI(logsAudit);

  const renderTrend = (rawDinamico: number, rawGlobal: number, symbol: string = '%') => {
      if (!rawDinamico || !rawGlobal) return null;
      const diff = rawDinamico - rawGlobal;
      if (Math.abs(diff) <= 0.05) return <span style={{fontSize: '0.8rem', color: 'hsl(var(--text-muted))'}}>Estável</span>;
      const isPositive = diff > 0;
      return (
         <span style={{fontSize: '0.85rem', color: isPositive ? '#10b981' : '#ef4444', fontWeight: 600, marginLeft: '8px'}}>
             {isPositive ? '🔼 +' : '🔽 '}{diff.toFixed(2)}{symbol}
         </span>
      );
  };

  // Motor: Grafico Betume
  const graficoBetumeDinamico = logsFiltrados
      .filter(l => l.ensaio_id === 'betume_granulometria' && l.dados_norma?.includes('Teor:'))
      .map(l => {
         const val = parseFloat(l.dados_norma.split('-')[0].replace('Teor:', '').replace('%', '').trim());
         return {
             name: l.projetos?.nome ? l.projetos.nome.split(' ')[0] + ' ' + l.estaca : (l.estaca || l.id.slice(0,4)),
             valor: isNaN(val) ? 0 : val
         };
      }).reverse(); // cronológico

  const limitesGranulometricos: Record<string, any> = {
     'Faixa A (DNIT)': { '2"': [100,100], '1 1/2"': [100,100], '1"': [100,100], '3/4"': [100,100], '1/2"': [75,100], '3/8"': [60,90], 'Nº 4': [35,65], 'Nº 10': [20,50], 'Nº 40': [10,30], 'Nº 80': [5,20], 'Nº 200': [3,7] },
     'Faixa B (DNIT)': { '2"': [100,100], '1 1/2"': [100,100], '1"': [100,100], '3/4"': [100,100], '1/2"': [75,100], '3/8"': [60,90], 'Nº 4': [35,65], 'Nº 10': [20,50], 'Nº 40': [10,30], 'Nº 80': [5,20], 'Nº 200': [3,7] },
     'Faixa C (DNIT)': { '2"': [100,100], '1 1/2"': [100,100], '1"': [100,100], '3/4"': [100,100], '1/2"': [85,100], '3/8"': [75,100], 'Nº 4': [50,85], 'Nº 10': [30,75], 'Nº 40': [15,40], 'Nº 80': [8,30], 'Nº 200': [5,9] },
     'Faixa A (DER-PR)': { '2"': [100,100], '1 1/2"': [100,100], '1"': [100,100], '3/4"': [100,100], '1/2"': [75,100], '3/8"': [60,90], 'Nº 4': [35,65], 'Nº 10': [20,50], 'Nº 40': [10,30], 'Nº 80': [5,20], 'Nº 200': [3,7] },
     'Faixa B (DER-PR)': { '2"': [100,100], '1 1/2"': [100,100], '1"': [100,100], '3/4"': [100,100], '1/2"': [85,100], '3/8"': [75,100], 'Nº 4': [50,85], 'Nº 10': [30,75], 'Nº 40': [15,40], 'Nº 80': [8,30], 'Nº 200': [4,8] },
     'Faixa C (DER-PR)': { '2"': [100,100], '1 1/2"': [100,100], '1"': [100,100], '3/4"': [100,100], '1/2"': [100,100], '3/8"': [85,100], 'Nº 4': [55,75], 'Nº 10': [40,60], 'Nº 40': [20,35], 'Nº 80': [10,22], 'Nº 200': [5,9] }
  };

  const limitesGranulometricosBGS: Record<string, any> = {
     'Faixa A (DER-PR)': { '2"': [100,100], '1 1/2"': [100,100], '1"': [75,100], '3/4"': [60,90], '1/2"': [50,80], '3/8"': [45,75], 'Nº 4': [30,60], 'Nº 10': [20,45], 'Nº 40': [15,30], 'Nº 80': [10,20], 'Nº 200': [5,15] },
     'Faixa B (DER-PR)': { '2"': [100,100], '1 1/2"': [100,100], '1"': [75,100], '3/4"': [60,90], '1/2"': [50,80], '3/8"': [45,75], 'Nº 4': [30,60], 'Nº 10': [20,45], 'Nº 40': [15,30], 'Nº 80': [10,20], 'Nº 200': [5,15] },
     'Faixa C (DER-PR)': { '2"': [100,100], '1 1/2"': [100,100], '1"': [100,100], '3/4"': [75,100], '1/2"': [60,90], '3/8"': [55,85], 'Nº 4': [35,65], 'Nº 10': [25,50], 'Nº 40': [15,30], 'Nº 80': [10,20], 'Nº 200': [5,15] },
     'Faixa A (DNIT)': { '2"': [100,100], '1 1/2"': [100,100], '1"': [75,100], '3/4"': [60,90], '1/2"': [50,80], '3/8"': [45,75], 'Nº 4': [30,60], 'Nº 10': [20,45], 'Nº 40': [15,30], 'Nº 80': [10,20], 'Nº 200': [5,15] },
     'Faixa B (DNIT)': { '2"': [100,100], '1 1/2"': [100,100], '1"': [75,100], '3/4"': [60,90], '1/2"': [50,80], '3/8"': [45,75], 'Nº 4': [30,60], 'Nº 10': [20,45], 'Nº 40': [15,30], 'Nº 80': [10,20], 'Nº 200': [5,15] },
     'Faixa C (DNIT)': { '2"': [100,100], '1 1/2"': [100,100], '1"': [100,100], '3/4"': [75,100], '1/2"': [60,90], '3/8"': [55,85], 'Nº 4': [35,65], 'Nº 10': [25,50], 'Nº 40': [15,30], 'Nº 80': [10,20], 'Nº 200': [5,15] }
  };

  const extrairCurvaMaterial = (materialFn: (l: any) => boolean, applyLimits: boolean, typeDict: 'CBUQ' | 'BGS' = 'CBUQ') => {
      let gCount = 0;
      const accPassantes: Record<string, number> = {};
      const filtrados = logsFiltrados.filter(materialFn);
      
      filtrados.forEach(log => {
          if (log.valores?.pesoMistura) {
              const pm = Number(log.valores.pesoMistura);
              if (pm > 0 && typeof log.valores.ret_200 !== 'undefined') {
                  gCount++;
                  let sumRet = 0;
                  const peneiras = ['2', '1_5', '1', '3_4', '1_2', '3_8', '4', '10', '40', '80', '200'];
                  peneiras.forEach(p => {
                      if(!accPassantes[p]) accPassantes[p] = 0;
                      const valRet = Number(log.valores[`ret_${p}`] || 0);
                      sumRet += valRet;
                      const passante = Math.max(0, 100 - ((sumRet/pm)*100));
                      accPassantes[p] += passante;
                  });
              }
          }
      });

      let ultFaixaNome = 'Faixa C (DER-PR)';
      if (applyLimits) {
          const ultimoLogFaixa = filtrados.find(l => l.valores?.faixa);
          if (ultimoLogFaixa) ultFaixaNome = ultimoLogFaixa.valores.faixa;
      }
      
      const dicionario = typeDict === 'BGS' ? limitesGranulometricosBGS : limitesGranulometricos;
      const tol = dicionario[ultFaixaNome] || dicionario['Faixa C (DER-PR)'];

      return {
          faixaNome: ultFaixaNome,
          dados: [
              { peneira: '2"', size: 50.8, min: applyLimits ? tol['2"'][0] : null, max: applyLimits ? tol['2"'][1] : null, ensaio: gCount ? accPassantes['2']/gCount : null },
              { peneira: '1 1/2"', size: 38.1, min: applyLimits ? tol['1 1/2"'][0] : null, max: applyLimits ? tol['1 1/2"'][1] : null, ensaio: gCount ? accPassantes['1_5']/gCount : null },
              { peneira: '1"', size: 25.4, min: applyLimits ? tol['1"'][0] : null, max: applyLimits ? tol['1"'][1] : null, ensaio: gCount ? accPassantes['1']/gCount : null },
              { peneira: '3/4"', size: 19.1, min: applyLimits ? tol['3/4"'][0] : null, max: applyLimits ? tol['3/4"'][1] : null, ensaio: gCount ? accPassantes['3_4']/gCount : null },
              { peneira: '1/2"', size: 12.7, min: applyLimits ? tol['1/2"'][0] : null, max: applyLimits ? tol['1/2"'][1] : null, ensaio: gCount ? accPassantes['1_2']/gCount : null },
              { peneira: '3/8"', size: 9.5, min: applyLimits ? tol['3/8"'][0] : null, max: applyLimits ? tol['3/8"'][1] : null, ensaio: gCount ? accPassantes['3_8']/gCount : null },
              { peneira: 'Nº 4', size: 4.8, min: applyLimits ? tol['Nº 4'][0] : null, max: applyLimits ? tol['Nº 4'][1] : null, ensaio: gCount ? accPassantes['4']/gCount : null },
              { peneira: 'Nº 10', size: 2.0, min: applyLimits ? tol['Nº 10'][0] : null, max: applyLimits ? tol['Nº 10'][1] : null, ensaio: gCount ? accPassantes['10']/gCount : null },
              { peneira: 'Nº 40', size: 0.42, min: applyLimits ? tol['Nº 40'][0] : null, max: applyLimits ? tol['Nº 40'][1] : null, ensaio: gCount ? accPassantes['40']/gCount : null },
              { peneira: 'Nº 80', size: 0.18, min: applyLimits ? tol['Nº 80'][0] : null, max: applyLimits ? tol['Nº 80'][1] : null, ensaio: gCount ? accPassantes['80']/gCount : null },
              { peneira: 'Nº 200', size: 0.075, min: applyLimits ? tol['Nº 200'][0] : null, max: applyLimits ? tol['Nº 200'][1] : null, ensaio: gCount ? accPassantes['200']/gCount : null },
          ].reverse()
      };
  };

  const curvasDisponiveis = [
      { id: 'cbuq', titulo: 'Curva Granulométrica (CBUQ)', sub: 'Mistura Betuminosa (Teor e Granulometria)', motor: extrairCurvaMaterial(l => l.ensaio_id === 'betume_granulometria', true, 'CBUQ'), color: 'hsl(var(--primary))' },
      { id: 'bgs', titulo: 'Curva Granulométrica (BGS)', sub: 'Brita Graduada Simples', motor: extrairCurvaMaterial(l => l.ensaio_id === 'granulometria' && l.valores?.material === 'BGS', true, 'BGS'), color: '#3b82f6' },
      { id: 'brita12', titulo: 'Curva Granulométrica (Brita 1/2")', sub: 'Insumo Simples', motor: extrairCurvaMaterial(l => l.ensaio_id === 'granulometria' && l.valores?.material === 'Brita 1/2"', false), color: '#8b5cf6' },
      { id: 'brita34', titulo: 'Curva Granulométrica (Brita 3/4")', sub: 'Insumo Simples', motor: extrairCurvaMaterial(l => l.ensaio_id === 'granulometria' && l.valores?.material === 'Brita 3/4"', false), color: '#d946ef' },
      { id: 'pedrisco', titulo: 'Curva (Pedrisco)', sub: 'Insumo Simples', motor: extrairCurvaMaterial(l => l.ensaio_id === 'granulometria' && l.valores?.material === 'Pedrisco', false), color: '#f97316' },
      { id: 'po_pedra', titulo: 'Curva (Pó de Pedra)', sub: 'Insumo Fino', motor: extrairCurvaMaterial(l => l.ensaio_id === 'granulometria' && l.valores?.material === 'Pó de pedra', false), color: '#14b8a6' },
  ];

  // Motor: Compliance Bar (Progress)
  const totalEnsaiosAvaliativos = logsFiltrados.filter(l => l.resultado_status === 'Aprovado' || l.resultado_status === 'Reprovado');
  const aprovadosCount = totalEnsaiosAvaliativos.filter(l => l.resultado_status === 'Aprovado').length;
  const reprovadosCount = totalEnsaiosAvaliativos.length - aprovadosCount;
  const complianceRate = totalEnsaiosAvaliativos.length > 0 ? Math.round((aprovadosCount / totalEnsaiosAvaliativos.length) * 100) : 100;

  // == RBAC Logic ==
  // Fetch current profile using state (The `user.id` is a UUID from Auth, but `perfis.id` is an integer auto-increment).
  // We must match them via EMAIL / MATRICULA.
  const myRole = user ? equipe.find(e => e.matricula === user.email)?.cargo : null;

  if (myRole === 'laboratorista') {
      return (
         <div className="page-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <h1 style={{color: '#ef4444'}}>Acesso Restrito</h1>
            <p style={{color: 'hsl(var(--text-muted))'}}>Seu perfil de Laboratorista possui acesso exclusivo através do Aplicativo Mobile para coletas em pista.</p>
            <Link href="/login"><button className="btn-secondary" style={{marginTop: '24px'}}>Voltar ao Login</button></Link>
         </div>
      );
  }

  return (
    <div className="page-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '24px', borderBottom: '1px solid hsl(var(--border))' }}>
        <div>
          <h1 style={{ fontSize: '2rem', color: 'hsl(var(--primary))', marginBottom: '8px', letterSpacing: '-0.03em' }}>Portal Inteligência - PaviLab</h1>
          <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.95rem' }}>Monitoramento de ensaios analíticos e conformidade estrutural.</p>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 8px', borderRadius: '4px', textTransform: 'uppercase', background: 'hsla(var(--primary)/0.1)', color: 'hsl(var(--primary))', marginTop: '12px', display: 'inline-block' }}>Acesso: {myRole || 'Aguardando'}</span>
        </div>
        <Link href="/">
          <button className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}><ArrowLeft size={16} /> Sair do Painel</button>
        </Link>
      </header>

      {/* Navegação Segmentada Principal */}
      <div style={{ display: 'flex', gap: '12px', padding: '4px', background: 'hsl(var(--surface))', border: '1px solid hsl(var(--border))', borderRadius: '12px', width: 'max-content' }}>
        <button 
          className={`btn-secondary`} 
          style={{ 
            border: 'none', background: tab === 'dashboard' ? 'hsl(var(--primary))' : 'transparent', 
            color: tab === 'dashboard' ? 'white' : 'hsl(var(--text-muted))',
            boxShadow: tab === 'dashboard' ? '0 2px 8px hsla(var(--primary)/0.2)' : 'none'
          }}
          onClick={() => setTab('dashboard')}
        >
          Análise e Relatórios
        </button>
        {['engenheiro', 'administrador'].includes(myRole) && (
           <button 
             className={`btn-secondary`} 
             style={{ 
               border: 'none', background: tab === 'cadastros' ? 'hsl(var(--primary))' : 'transparent', 
               color: tab === 'cadastros' ? 'white' : 'hsl(var(--text-muted))',
               boxShadow: tab === 'cadastros' ? '0 2px 8px hsla(var(--primary)/0.2)' : 'none'
             }}
             onClick={() => setTab('cadastros')}
           >
             Gestão de Aplicação
           </button>
        )}
      </div>

      <div className="animate-fade-in" style={{ flex: 1, marginTop: '16px' }}>
        
        {/* TAB 1: BENTO DASHBOARD */}
        {tab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {/* Header de Filtros */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'hsla(var(--surface)/0.6)', padding: '16px 24px', borderRadius: '12px', border: '1px solid hsl(var(--border))' }}>
              <Filter size={18} color="hsl(var(--primary))" />
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Filtro de Amostragem do Painel:</span>
              <select className="input-field" style={{ width: '300px', cursor: 'pointer', margin: 0, padding: '8px 16px' }} value={filtroObra} onChange={(e) => setFiltroObra(e.target.value)}>
                <option value="global">Todas as Obras Específicadas</option>
                {projetos.map(proj => <option key={proj.id} value={proj.id}>{proj.nome}</option>)}
              </select>
            </div>

            {/* KPI Cards (Atendendo aos resultados dinâmicos da engenharia) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
              <div className="glass-panel" style={{ padding: '24px', borderTop: '4px solid hsl(var(--primary))' }}>
                <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))', marginBottom: '16px', letterSpacing: '0.05em' }}>GC Médio (Compactação)</h3>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1 }}>{kpisDinamicos.gc}</span>
                  {renderTrend(kpisDinamicos.gcRaw, kpisGlobais.gcRaw, '%')}
                </div>
              </div>
              <div className="glass-panel" style={{ padding: '24px', borderTop: '4px solid #f97316' }}>
                <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))', marginBottom: '16px', letterSpacing: '0.05em' }}>Teor Médio de Betume</h3>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1 }}>{kpisDinamicos.betume}</span>
                  {renderTrend(kpisDinamicos.betumeRaw, kpisGlobais.betumeRaw, '%')}
                </div>
              </div>
              <div className="glass-panel" style={{ padding: '24px', borderTop: '4px solid #eab308' }}>
                <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))', marginBottom: '16px', letterSpacing: '0.05em' }}>Equivalente de Areia (EA) Médio</h3>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1 }}>{kpisDinamicos.ea}</span>
                  {renderTrend(kpisDinamicos.eaRaw, kpisGlobais.eaRaw, '%')}
                </div>
              </div>
            </div>

            {/* Bento Grid dos Gráficos */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '24px' }}>
              
              {curvasDisponiveis.map((curva) => (
                 <div key={curva.id} className="glass-panel" style={{ padding: '24px', gridColumn: ['cbuq', 'bgs'].includes(curva.id) ? '1 / -1' : 'auto', minWidth: 0 }}>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>{curva.titulo}</h3>
                  <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.85rem', marginBottom: '24px' }}>
                     {curva.motor.dados[0].min !== null 
                        ? `Comparativo Média Amostral vs Limites baseados na última coleta (${curva.motor.faixaNome}).`
                        : `Média amostral contínua extraída de ${curva.sub}.`}
                  </p>
                  <div style={{ width: '100%', height: 350, minWidth: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={curva.motor.dados} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsla(var(--border)/0.5)" />
                        <XAxis 
                            dataKey="size" 
                            type="number" 
                            scale="log" 
                            domain={[0.01, 100]} 
                            tick={{fill: 'hsl(var(--text-muted))'}} 
                            label={{ value: 'Abertura da Peneira (mm)', position: 'bottom', offset: 0, fill: 'hsl(var(--text-muted))', fontSize: '0.8rem' }}
                            tickFormatter={(val) => val}
                        />
                        <YAxis 
                            domain={[0, 100]} 
                            ticks={[0, 20, 40, 60, 80, 100]}
                            tick={{fill: 'hsl(var(--text-muted))'}} 
                        />
                        <Tooltip contentStyle={{ background: 'hsl(var(--surface))', borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px hsla(0,0%,0%,0.1)' }} />
                        <Legend verticalAlign="top" height={36}/>
                        {curva.motor.dados[0].max !== null && <Line type="linear" dataKey="max" name="Superior (%)" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="5 5" />}
                        {curva.motor.dados[0].min !== null && <Line type="linear" dataKey="min" name="Inferior (%)" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="5 5" />}
                        <Line type="linear" dataKey="ensaio" name="Média Base Obras" stroke={curva.color} strokeWidth={4} activeDot={{ r: 8 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}

               <div className="glass-panel" style={{ padding: '24px', minWidth: '400px', overflow: 'hidden' }}>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Picos Históricos do Teor Betuminoso (%)</h3>
                <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.85rem', marginBottom: '24px' }}>Análise transversal da margem operacional entre lotes de pista e usina.</p>
                <div style={{ width: '100%', height: 300, minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={graficoBetumeDinamico} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsla(var(--border)/0.5)" vertical={false} />
                      <XAxis dataKey="name" tick={{fill: 'hsl(var(--text-muted))', fontSize: '0.8rem'}} />
                      <YAxis domain={['auto', 'auto']} tick={{fill: 'hsl(var(--text-muted))'}} />
                      <Tooltip cursor={{fill: 'hsla(var(--primary)/0.05)'}} contentStyle={{ background: 'hsl(var(--surface))', borderRadius: '8px', border: 'none' }} />
                      <ReferenceLine y={5.5} label="Máx (5.5%)" stroke="#ef4444" strokeDasharray="3 3" />
                      <ReferenceLine y={4.5} label="Mín (4.5%)" stroke="#ef4444" strokeDasharray="3 3" />
                      <Bar dataKey="valor" name="Teor Coletado" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

               <div className="glass-panel" style={{ padding: '24px', minWidth: '400px' }}>
                 <div style={{ margin: '16px 0' }}>
                   <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Métrica de Aprovações (Obras)</h3>
                   <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.85rem', marginBottom: '16px' }}>Proporção quantitativa dos Laudos emitidos nesta amostra.</p>
                   
                   <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                     <span style={{ fontSize: '2.5rem', fontWeight: 800 }}>{complianceRate}%</span>
                     <span style={{ color: 'hsl(var(--text-muted))' }}>taxa de aprovação.</span>
                   </div>
                   
                   <div style={{ height: '12px', background: 'hsla(0,0%,50%,0.1)', borderRadius: '6px', overflow: 'hidden', display: 'flex', marginBottom: '16px' }}>
                     <div style={{ width: `${complianceRate}%`, background: 'hsl(var(--secondary))', height: '100%' }}></div>
                     <div style={{ width: `${100 - complianceRate}%`, background: '#ef4444', height: '100%' }}></div>
                   </div>

                   <div style={{ display: 'flex', gap: '24px', fontSize: '0.9rem' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                       <div style={{ width: 12, height: 12, borderRadius: 2, background: 'hsl(var(--secondary))' }}></div>
                       <span>{aprovadosCount} Aprovados</span>
                     </div>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                       <div style={{ width: 12, height: 12, borderRadius: 2, background: '#ef4444' }}></div>
                       <span>{reprovadosCount} Reprovados</span>
                     </div>
                   </div>

                 </div>
               </div>
            </div>
            
            <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ padding: '24px', borderBottom: '1px solid hsl(var(--border))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <h3 style={{ fontSize: '1.2rem' }}>Acervo de Ensaios Realizados</h3>
                
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input type="date" className="input-field" style={{ margin: 0, padding: '8px', width: 'auto' }} value={filtroData} onChange={e => setFiltroData(e.target.value)} title="Filtrar por Data" />
                  <select className="input-field" style={{ margin: 0, padding: '8px', width: 'auto' }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
                     <option value="todos">Todos os Tipos</option>
                     {ensaiosAtivos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
                  <thead>
                    <tr style={{ background: 'hsla(var(--primary) / 0.03)' }}>
                      <th style={{ padding: '16px 24px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>ID Ensaio / Data</th>
                      <th style={{ padding: '16px 24px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Obra / Estaca</th>
                      <th style={{ padding: '16px 24px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Tipo do Ensaio</th>
                      <th style={{ padding: '16px 24px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Parâmetro Calculado</th>
                      <th style={{ padding: '16px 24px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))', textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsFiltrados.map((ensaio) => (
                      <tr key={ensaio.id} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                        <td style={{ padding: '16px 24px' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{ensaio.id.slice(0,8)}...</div>
                          <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>{new Date(ensaio.created_at).toLocaleString()}</div>
                        </td>
                        <td style={{ padding: '16px 24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>{ensaio.projetos?.nome || 'Obra Excluída'}</div>
                          <div style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>{ensaio.estaca}</div>
                        </td>
                        <td style={{ padding: '16px 24px', fontWeight: 500, fontSize: '0.9rem' }}>{ensaiosAtivos.find(e => e.id === ensaio.ensaio_id)?.nome || ensaio.ensaio_id}</td>
                        <td style={{ padding: '16px 24px' }}>
                           <span style={{ 
                            display: 'inline-flex', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px',
                            background: ensaio.resultado_status === 'Aprovado' ? 'hsla(var(--secondary) / 0.1)' : 'hsla(0, 84%, 60%, 0.1)',
                            color: ensaio.resultado_status === 'Aprovado' ? 'hsl(var(--secondary))' : '#ef4444'
                          }}>{ensaio.resultado_status}</span>
                          <div style={{ fontSize: '0.85rem', color: 'hsl(var(--text-main))' }}>{ensaio.dados_norma}</div>
                        </td>
                        <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                             {['engenheiro', 'administrador'].includes(myRole) && (
                                <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#ef4444', borderColor: '#ef4444' }} onClick={() => deletarEnsaio(ensaio.id)}>Excluir</button>
                             )}
                             <Link href={`/admin/ensaio/${ensaio.id}`}>
                               <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Visualizar PDF</button>
                             </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {logsFiltrados.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '24px' }}>Nenhuma coleta encontrada para este filtro.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CENTRAL DE CADASTROS */}
        {tab === 'cadastros' && (
          <div style={{ display: 'flex', gap: '32px', minHeight: '600px' }}>
            
            {/* Nav Lateral */}
            <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h3 style={{ fontSize: '0.9rem', color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>Menu de Dados</h3>
              
              <button 
                className={`btn-secondary`} 
                style={{ justifyContent: 'flex-start', border: 'none', background: subTab === 'obras' ? 'hsla(var(--primary)/0.1)' : 'transparent', color: subTab === 'obras' ? 'hsl(var(--primary))' : 'hsl(var(--text-main))' }}
                onClick={() => setSubTab('obras')}
              ><Building2 size={18} /> Inserir Obra Nova</button>
              
              <button 
                className={`btn-secondary`} 
                style={{ justifyContent: 'flex-start', border: 'none', background: subTab === 'usuarios' ? 'hsla(var(--primary)/0.1)' : 'transparent', color: subTab === 'usuarios' ? 'hsl(var(--primary))' : 'hsl(var(--text-main))' }}
                onClick={() => setSubTab('usuarios')}
              ><UserPlus size={18} /> Registrar Equipe</button>

              <button 
                className={`btn-secondary`} 
                style={{ justifyContent: 'flex-start', border: 'none', background: subTab === 'ensaios' ? 'hsla(var(--primary)/0.1)' : 'transparent', color: subTab === 'ensaios' ? 'hsl(var(--primary))' : 'hsl(var(--text-main))' }}
                onClick={() => setSubTab('ensaios')}
              ><SlidersHorizontal size={18} /> Modelos de Ensaios</button>
            </div>

            {/* View do Formulário Mestre */}
            <div className="glass-panel" style={{ flex: 1 }}>
              
              {subTab === 'obras' && (
                <div className="animate-fade-in">
                  <h2 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}><Building2 color="hsl(var(--primary))" /> Gerenciador de Contratos (Obras)</h2>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 1fr) 2fr', gap: '32px' }}>
                    <div style={{ borderRight: '1px solid hsl(var(--border))', paddingRight: '32px' }}>
                       <h3 style={{ fontSize: '1rem', marginBottom: '16px' }}>Nova Frente de Serviço</h3>
                       
                       <div className="input-group">
                        <label className="input-label">Nome Oficial do Contrato / Indicação</label>
                        <input className="input-field" placeholder="Ex: Ampliação BR-040" value={novaObraNome} onChange={e => setNovaObraNome(e.target.value)} />
                       </div>
                       
                       <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '16px' }}>
                          <div className="input-group" style={{ margin: 0 }}>
                            <label className="input-label">Cidade</label>
                            <input className="input-field" placeholder="Município" value={novaObraCidade} onChange={e => setNovaObraCidade(e.target.value)} />
                          </div>
                          <div className="input-group" style={{ margin: 0 }}>
                            <label className="input-label">UF</label>
                            <input className="input-field" placeholder="Ex: SP" maxLength={2} value={novaObraEstado} onChange={e => setNovaObraEstado(e.target.value.toUpperCase())} />
                          </div>
                       </div>

                       <div className="input-group">
                        <label className="input-label">Tipologia Governamental</label>
                         <select className="input-field" value={novaObraTipo} onChange={e => setNovaObraTipo(e.target.value)}>
                           <option value="estrada">Rodovia / Estrada (Segmentação Linear)</option>
                           <option value="loteamento">Loteamento (Rua e Quadra)</option>
                         </select>
                       </div>

                       {novaObraTipo === 'estrada' && (
                         <div style={{ display: 'flex', gap: '12px', background: 'hsla(var(--primary)/0.05)', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
                            <div className="input-group" style={{ margin: 0, flex: 1 }}>
                              <label className="input-label">Estaca Inicial</label>
                              <input type="number" className="input-field" placeholder="0" value={estradaInicial} onChange={e => setEstradaInicial(e.target.value ? Number(e.target.value) : '')} />
                            </div>
                            <div className="input-group" style={{ margin: 0, flex: 1 }}>
                              <label className="input-label">Estaca Final</label>
                              <input type="number" className="input-field" placeholder="500" value={estradaFinal} onChange={e => setEstradaFinal(e.target.value ? Number(e.target.value) : '')} />
                            </div>
                         </div>
                       )}

                       {novaObraTipo === 'loteamento' && (
                         <div style={{ background: 'hsla(var(--primary)/0.05)', padding: '16px', borderRadius: '8px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {loteamentoRuas.map((rua, idx) => (
                               <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                                 <div className="input-group" style={{ margin: 0, flex: 2 }}>
                                   <label className="input-label">Nome da Rua {idx+1}</label>
                                   <input className="input-field" placeholder="Rua..." value={rua.nome} onChange={e => {
                                      const arr = [...loteamentoRuas]; arr[idx].nome = e.target.value; setLoteamentoRuas(arr);
                                   }} />
                                 </div>
                                 <div className="input-group" style={{ margin: 0, flex: 1 }}>
                                   <label className="input-label">Qts Quadras</label>
                                   <input type="number" min="1" className="input-field" placeholder="10" value={rua.quadras} onChange={e => {
                                      const arr = [...loteamentoRuas]; arr[idx].quadras = Number(e.target.value); setLoteamentoRuas(arr);
                                   }} />
                                 </div>
                                 {idx > 0 && (
                                   <button className="btn-secondary" style={{ padding: '8px', color: '#ef4444', borderColor: 'transparent' }} 
                                      onClick={() => setLoteamentoRuas(loteamentoRuas.filter((_, i) => i !== idx))}>X</button>
                                 )}
                               </div>
                            ))}
                            <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '6px' }} 
                               onClick={() => setLoteamentoRuas([...loteamentoRuas, {nome: '', quadras: 1}])}>+ Adicionar Outra Rua</button>
                         </div>
                       )}

                       <button className="btn-primary" style={{ width: '100%' }} onClick={handleCriarObra}><PlusCircle size={18} /> Cadastrar e Sincronizar Obra</button>
                    </div>

                    <div>
                       <h3 style={{ fontSize: '1rem', marginBottom: '16px' }}>Obras Catalogadas na Base Central</h3>
                       <div style={{ background: 'hsla(var(--surface))', border: '1px solid hsl(var(--border))', borderRadius: '8px', overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                             <thead>
                               <tr style={{ background: 'hsla(var(--primary)/0.05)' }}>
                                 <th style={{ padding: '12px 16px', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Identificação / Endereço</th>
                                 <th style={{ padding: '12px 16px', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Natureza e Escala</th>
                                 <th style={{ padding: '12px 16px', textAlign: 'right' }}></th>
                               </tr>
                             </thead>
                             <tbody>
                               {projetos.map(proj => (
                                  <tr key={proj.id} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                                    <td style={{ padding: '12px 16px' }}>
                                        <div style={{ fontWeight: 600 }}>{proj.nome}</div>
                                        {proj.cidade && <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>{proj.cidade} - {proj.estado}</div>}
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                       <div style={{ textTransform: 'capitalize', fontWeight: 600, color: 'hsl(var(--text-main))' }}>{proj.tipo || 'estrada'}</div>
                                       <div style={{ color: 'hsl(var(--text-muted))', fontSize: '0.8rem' }}>{proj.estacas?.length || 0} sub-áreas</div>
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                       <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem', color: '#ef4444', borderColor: 'transparent' }} onClick={() => deletarProjeto(proj.id)}>Excluir</button>
                                    </td>
                                  </tr>
                               ))}
                               {projetos.length === 0 && <tr><td colSpan={3} style={{ padding: '16px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>Nenhuma obra ativa.</td></tr>}
                             </tbody>
                          </table>
                       </div>
                    </div>
                  </div>
                </div>
              )}

              {subTab === 'usuarios' && (
                <div className="animate-fade-in">
                  <h2 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}><UserPlus color="hsl(var(--primary))" /> Gestão de Equipes (Sinalização e IAM)</h2>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 1fr) 2fr', gap: '32px' }}>
                    <div style={{ borderRight: '1px solid hsl(var(--border))', paddingRight: '32px' }}>
                       <h3 style={{ fontSize: '1rem', marginBottom: '16px' }}>Autenticação / Credenciamento</h3>
                       <div className="input-group">
                        <label className="input-label">Nome Físico</label>
                        <input className="input-field" placeholder="Ex: Roberto Justos" value={novoUserNome} onChange={e => setNovoUserNome(e.target.value)} />
                       </div>
                       <div className="input-group">
                        <label className="input-label">Username / E-mail de Login</label>
                        <input type="email" className="input-field" placeholder="roberto@pavilab.com" value={novoUserEmail} onChange={e => setNovoUserEmail(e.target.value)} />
                       </div>
                       <div className="input-group">
                        <label className="input-label">Senha Inicial do Trabalhador</label>
                        <input type="text" className="input-field" placeholder="***" value={novoUserSenha} onChange={e => setNovoUserSenha(e.target.value)} />
                       </div>
                       <div className="input-group" style={{ marginBottom: '24px' }}>
                        <label className="input-label">Licença Governamental</label>
                         <select className="input-field" value={novoUserRole} onChange={e => setNovoUserRole(e.target.value)}>
                           <option value="laboratorista">Laboratorista</option>
                           <option value="encarregado">Encarregado</option>
                           <option value="engenheiro">Engenheiro</option>
                         </select>
                       </div>
                       <button className="btn-primary" style={{ width: '100%' }} onClick={handleCriarEquipe}><PlusCircle size={18} /> Fornecer Credenciais Seguras</button>
                    </div>

                    <div>
                       <h3 style={{ fontSize: '1rem', marginBottom: '16px' }}>Colaboradores Ativos (<span style={{color: 'hsl(var(--primary))'}}>{equipe.length}</span>)</h3>
                       <div style={{ background: 'hsla(var(--surface))', border: '1px solid hsl(var(--border))', borderRadius: '8px', overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                             <thead>
                               <tr style={{ background: 'hsla(var(--primary)/0.05)' }}>
                                 <th style={{ padding: '12px 16px', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Identificação</th>
                                 <th style={{ padding: '12px 16px', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Permissão de Voo</th>
                                 <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ações</th>
                               </tr>
                             </thead>
                             <tbody>
                               {equipe.map(mem => (
                                  <tr key={mem.id} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                                    <td style={{ padding: '12px 16px' }}>
                                       <div style={{ fontWeight: 600 }}>{mem.nome}</div>
                                       <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>ID: {mem.matricula}</div>
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                       <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', background: 'hsla(var(--primary)/0.1)', color: 'hsl(var(--primary))' }}>
                                          {mem.cargo}
                                       </span>
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                       <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem', color: '#ef4444', borderColor: 'transparent' }} onClick={() => deletarEquipe(mem.id)}>Exonerar</button>
                                    </td>
                                  </tr>
                               ))}
                               {equipe.length === 0 && <tr><td colSpan={3} style={{ padding: '16px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>Nenhuma matrícula cadastrada na Tabela Perfis.</td></tr>}
                             </tbody>
                          </table>
                       </div>
                    </div>
                  </div>
                </div>
              )}

              {subTab === 'ensaios' && (
                <div className="animate-fade-in">
                  <h2 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}><SlidersHorizontal color="hsl(var(--primary))" /> Engenharia dos Ensaio (Upload & Design)</h2>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '32px' }}>
                    <div style={{ borderRight: '1px solid hsl(var(--border))', paddingRight: '32px' }}>
                      <h3 style={{ marginBottom: '16px', fontSize: '1.2rem' }}>Biblioteca Ativa</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {ensaiosAtivos.map(ensaio => (
                          <div 
                             key={ensaio.id} 
                             onClick={() => setEnsaioPreview(ensaio)}
                             style={{ 
                                padding: '12px 16px', border: '1px solid hsl(var(--border))', borderRadius: '8px', 
                                background: ensaioPreview?.id === ensaio.id ? 'hsla(var(--primary)/0.1)' : 'hsla(var(--background)/0.5)', 
                                borderColor: ensaioPreview?.id === ensaio.id ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                                display: 'flex', flexDirection: 'column',
                                cursor: 'pointer', transition: 'all 0.2s ease'
                             }}
                          >
                            <strong style={{ fontSize: '0.9rem', color: ensaioPreview?.id === ensaio.id ? 'hsl(var(--primary))' : 'inherit' }}>{ensaio.nome}</strong>
                            <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.8rem' }}>{ensaio.campos?.length || 0} campos ativados.</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div style={{ padding: '0 32px' }}>
                        {ensaioPreview ? (
                           <div style={{ animation: 'fade-in 0.3s ease-out' }}>
                               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                   <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                      <div style={{ padding: '12px', background: 'hsla(var(--primary)/0.1)', color: 'hsl(var(--primary))', borderRadius: '8px' }}>
                                          <FileSpreadsheet size={24} />
                                      </div>
                                      <div>
                                          <h3 style={{ fontSize: '1.2rem', margin: 0 }}>{ensaioPreview.nome}</h3>
                                          <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.8rem', margin: 0 }}>ID Técnico: {ensaioPreview.id}</p>
                                      </div>
                                   </div>
                                   <button className="btn-secondary" onClick={() => setEnsaioPreview(null)}>Fechar Ficha</button>
                               </div>

                               <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '0px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', maxWidth: '800px', color: '#1e293b', overflowX: 'auto' }}>
                                   <div style={{ textAlign: 'center', padding: '16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                       <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, textTransform: 'uppercase', color: 'hsl(var(--primary))' }}>Modo Documento (Visualização Gerencial)</h2>
                                       <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>Simulação em tempo real da impressão do Laudo Final.</p>
                                   </div>

                                   {/* A4 Container Mock */}
                                   <div style={{ padding: '32px', fontFamily: 'Arial, sans-serif' }}>
                                     {/* CABEÇALHO (MOCK) */}
                                     <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', fontSize: '13px', marginBottom: '16px' }}>
                                       <tbody>
                                         <tr>
                                           <td rowSpan={2} style={{ width: '30%', border: '1px solid black', textAlign: 'center', padding: '16px 8px' }}>
                                              <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 4px 0' }}>PAVILAB</h1>
                                              <span style={{ fontSize: '10px', textTransform: 'uppercase' }}>Sistema Digital de<br/>Controle Tecnológico</span>
                                           </td>
                                           <td style={{ width: '45%', border: '1px solid black', padding: '8px', textAlign: 'center', fontWeight: 'bold', fontSize: '15px' }}>
                                              RELATÓRIO DE ENSAIO DE {ensaioPreview.nome?.toUpperCase() || ensaioPreview.id?.toUpperCase()}
                                           </td>
                                           <td style={{ width: '25%', border: '1px solid black', padding: '8px 12px' }}>
                                              <div style={{ fontSize: '10px' }}>ID DE RASTREABILIDADE</div>
                                              <strong>LAU-MOCK</strong>
                                           </td>
                                         </tr>
                                       </tbody>
                                     </table>

                                      {/* INFOS BÁSICAS DA OBRA (MOCK) */}
                                      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', fontSize: '12px', marginBottom: '32px' }}>
                                        <tbody>
                                          <tr>
                                            <td style={{ border: '1px solid black', padding: '6px' }}><strong>OBRA / TRECHO:</strong> <span style={{ textTransform: 'uppercase' }}>Obras BR-Mock</span></td>
                                            <td style={{ border: '1px solid black', padding: '6px', width: '180px' }}><strong>DATA COLETA:</strong> {new Date().toLocaleDateString()}</td>
                                          </tr>
                                          <tr>
                                            <td style={{ border: '1px solid black', padding: '6px' }}><strong>LOCAL / ESTACA:</strong> [Estaca X]</td>
                                            <td style={{ border: '1px solid black', padding: '6px' }}><strong>MATERIAL:</strong> Banco/Pista</td>
                                          </tr>
                                        </tbody>
                                      </table>
                                      
                                      <div>
                                         <h3 style={{ fontSize: '14px', textTransform: 'uppercase', borderBottom: '1px solid black', paddingBottom: '4px', marginBottom: '12px' }}>DETERMINAÇÕES E RESULTADOS ANALÍTICOS</h3>

                                   {(() => {
                                      const eid = ensaioPreview.id;
                                      
                                      if (eid === 'compactacao') {
                                         return (
                                           <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px', fontSize: '12px', border: '1px solid black' }}>
                                             <thead>
                                               <tr style={{ background: '#f0f0f0' }}>
                                                 <th style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }} colSpan={3}>RESULTADOS OBTIDOS: GRAU DE COMPACTAÇÃO</th>
                                               </tr>
                                               <tr>
                                                 <th style={{ border: '1px solid black', padding: '8px', width: '33%' }}>Parâmetro Avaliado</th>
                                                 <th style={{ border: '1px solid black', padding: '8px', width: '34%' }}>Valor Aferido</th>
                                                 <th style={{ border: '1px solid black', padding: '8px', width: '33%' }}>Unidade</th>
                                               </tr>
                                             </thead>
                                             <tbody>
                                                <tr>
                                                  <td style={{ border: '1px solid black', padding: '6px' }}>Densidade Máxima Seca (Projeto)</td>
                                                  <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center', color: '#94a3b8' }}>[ x.xxx ]</td>
                                                  <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>g/cm³</td>
                                                </tr>
                                                <tr>
                                                  <td style={{ border: '1px solid black', padding: '6px' }}>Densidade Aparente Seca (Furo/Areia)</td>
                                                  <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center', color: '#94a3b8' }}>[ x.xxx ]</td>
                                                  <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>g/cm³</td>
                                                </tr>
                                                <tr style={{ background: '#f8f8f8', fontWeight: 'bold' }}>
                                                  <td style={{ border: '1px solid black', padding: '8px', textTransform: 'uppercase' }}>Cálculo Final (Grau de Compactação)</td>
                                                  <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontSize: '14px', color: '#94a3b8' }}>[ XX.X ]</td>
                                                  <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>%</td>
                                                </tr>
                                             </tbody>
                                           </table>
                                         );
                                      }

                                      if (eid === 'betume' || eid === 'betume_granulometria') {
                                         return (
                                           <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                             <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px', fontSize: '12px', border: '1px solid black' }}>
                                               <thead>
                                                 <tr style={{ background: '#f0f0f0' }}>
                                                   <th style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }} colSpan={3}>RESULTADOS OBTIDOS: EXTRAÇÃO DE BETUME</th>
                                                 </tr>
                                                 <tr>
                                                   <th style={{ border: '1px solid black', padding: '8px', width: '33%' }}>Ensaios / Coletas</th>
                                                   <th style={{ border: '1px solid black', padding: '8px', width: '34%' }}>Massa / Valor</th>
                                                   <th style={{ border: '1px solid black', padding: '8px', width: '33%' }}>Unidade</th>
                                                 </tr>
                                               </thead>
                                               <tbody>
                                                 <tr>
                                                   <td style={{ border: '1px solid black', padding: '6px' }}>Massa Total da Mistura Asfáltica (A)</td>
                                                   <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center', color: '#94a3b8' }}>[ XXX ]</td>
                                                   <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>g</td>
                                                 </tr>
                                                 <tr>
                                                   <td style={{ border: '1px solid black', padding: '6px' }}>Massa do Filtro Seco (E)</td>
                                                   <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center', color: '#94a3b8' }}>[ XXX ]</td>
                                                   <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>g</td>
                                                 </tr>
                                                 <tr style={{ background: '#f8f8f8', fontWeight: 'bold' }}>
                                                   <td style={{ border: '1px solid black', padding: '8px', textTransform: 'uppercase' }}>Teor de Betume (Encontrado)</td>
                                                   <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontSize: '14px', color: '#94a3b8' }}>[ X.XX ]</td>
                                                   <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>%</td>
                                                 </tr>
                                               </tbody>
                                             </table>
                                             <div style={{ padding: '24px', border: '1px dashed #cbd5e1', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                                                 [ Tabela de Granulometria e Gráfico Dinâmico visíveis no Laudo Oficial ]
                                             </div>
                                           </div>
                                         );
                                      }

                                      // GENERICO
                                      return (
                                         <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px', fontSize: '12px', border: '1px solid black' }}>
                                            <thead>
                                              <tr style={{ background: '#f0f0f0' }}>
                                                <th style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }} colSpan={2}>FICHA GENÉRICA DO ENSAIO</th>
                                              </tr>
                                              <tr>
                                                <th style={{ border: '1px solid black', padding: '8px', width: '50%' }}>Propriedade</th>
                                                <th style={{ border: '1px solid black', padding: '8px', width: '50%' }}>Valor Padrão</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {ensaioPreview.campos?.filter((c:any) => c.tipo !== 'system').map((campo:any) => (
                                                 <tr key={campo.id}>
                                                   <td style={{ border: '1px solid black', padding: '6px', fontWeight: 'bold' }}>{campo.label}</td>
                                                   <td style={{ border: '1px solid black', padding: '6px', color: '#94a3b8' }}>[ Aguardando Coleta ]</td>
                                                 </tr>
                                              ))}
                                            </tbody>
                                         </table>
                                      );
                                   })()}
                                      </div>

                                     {/* PARECER / STATUS */}
                                     <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '24px', border: '1px solid black', fontSize: '12px' }}>
                                       <tbody>
                                          <tr>
                                            <td style={{ border: '1px solid black', padding: '12px', background: '#f0f0f0', width: '25%', textAlign: 'center', fontWeight: 'bold' }}>SITUAÇÃO DO LOTE</td>
                                            <td style={{ border: '1px solid black', padding: '12px', textAlign: 'center', fontSize: '16px', fontWeight: 'bold', color: '#94a3b8' }}>
                                              [ AGUARDANDO STATUS ]
                                            </td>
                                          </tr>
                                          <tr>
                                            <td style={{ border: '1px solid black', padding: '12px', width: '25%', textAlign: 'center', fontWeight: 'bold' }}>OBSERVAÇÕES</td>
                                            <td style={{ border: '1px solid black', padding: '12px', fontStyle: 'italic', fontSize: '11px', color: '#64748b' }}>
                                              * [ Observações Normativas inseridas no momento do laudo ]<br/>
                                              * Assinado digitalmente através de Autenticação Segura via Plataforma Cloud/GPS.
                                            </td>
                                          </tr>
                                       </tbody>
                                     </table>

                                     <footer style={{ marginTop: '40px', width: '100%', display: 'table', pageBreakInside: 'avoid' }}>
                                        <div style={{ display: 'table-row' }}>
                                           <div style={{ display: 'table-cell', width: '50%', textAlign: 'center', padding: '0 20px' }}>
                                              <div style={{ borderBottom: '1px solid black', height: '40px', marginBottom: '8px' }}></div>
                                              <strong style={{ fontSize: '11px' }}>TÉCNICO / LABORATORISTA COLETOR</strong><br/>
                                              <span style={{ fontSize: '10px' }}>Registro Eletrônico: MOCKED***</span>
                                           </div>
                                           <div style={{ display: 'table-cell', width: '50%', textAlign: 'center', padding: '0 20px' }}>
                                              <div style={{ borderBottom: '1px solid black', height: '40px', marginBottom: '8px' }}></div>
                                              <strong style={{ fontSize: '11px' }}>ENGENHEIRO RESPONSÁVEL</strong><br/>
                                              <span style={{ fontSize: '10px' }}>Validação / Auditoria Direcional</span>
                                           </div>
                                        </div>
                                     </footer>
                                   </div>

                                   {ensaioPreview.campos?.find((c:any) => c.id === '__sys_template_path') && (
                                       <div style={{ marginTop: '32px', textAlign: 'center' }}>
                                            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: '#334155', fontWeight: 600 }}>Pré-visualização do Modelo Excel CBUQ Integrado:</h4>
                                            <iframe 
                                               src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(ensaioPreview.campos.find((c:any) => c.id === '__sys_template_path').path)}`} 
                                               width="100%" 
                                               height="350px" 
                                               frameBorder="0"
                                               style={{ border: '1px solid #cbd5e1', borderRadius: '4px' }}
                                            ></iframe>
                                            <a href={ensaioPreview.campos.find((c:any) => c.id === '__sys_template_path').path} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: '12px', fontSize: '0.8rem', color: 'hsl(var(--primary))', textDecoration: 'underline' }}>Ou efetue o Download Original</a>
                                       </div>
                                   )}
                               </div>
                           </div>
                        ) : (
                           <div>
                              <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'hsla(160, 84%, 39%, 0.1)', color: 'hsl(var(--secondary))', marginBottom: '24px' }}>
                                <FileSpreadsheet size={48} />
                              </div>
                              <h3 style={{ fontSize: '1.2rem', marginBottom: '12px' }}>Construtor Dinâmico (Parser de Fórmulas)</h3>
                              <p style={{ color: 'hsl(var(--text-muted))', maxWidth: '500px', marginBottom: '24px', lineHeight: 1.6 }}>Exclusivo para Gestores. Especifique os campos de coleta que devem constar no aplicativo dos Fiscais. O PaviLab abstrará os formulários em React Native automaticamente.</p>
                              
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px' }}>
                                 <div className="input-group">
                                   <label className="input-label">Identificador Técnico Interno</label>
                                   <input className="input-field" placeholder="Ex: penetracao_cone" value={novoEnsaioSlug} onChange={e => setNovoEnsaioSlug(e.target.value)} />
                                 </div>
                                 <div className="input-group">
                                   <label className="input-label">Título Exibido no Painel</label>
                                   <input className="input-field" placeholder="Ex: Ensaio de Penetração Dinâmica" value={novoEnsaioNome} onChange={e => setNovoEnsaioNome(e.target.value)} />
                                 </div>
                                 <div className="input-group">
                                   <label className="input-label">Campos de Coleta de Dados (Separados por Vírgula)</label>
                                   <textarea className="input-field" style={{ minHeight: '100px' }} placeholder="Ex: Umidade Inicial, Peso Retido, Tara, Leitura Extensômetro..." value={novoEnsaioCampos} onChange={e => setNovoEnsaioCampos(e.target.value)} />
                                   <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>Apenas insumos numéricos. O sistema cuidará das tipagens.</p>
                                 </div>
                                 <div className="input-group">
                                   <label className="input-label">Anexar Planilha Base (.xlsx vazio)</label>
                                   <input 
                                      type="file" 
                                      className="input-field" 
                                      accept=".xlsx,.xls" 
                                      style={{ padding: '8px' }}
                                      onChange={e => {
                                         if(e.target.files && e.target.files[0]) {
                                            setNovoEnsaioPlanilha(e.target.files[0]);
                                         }
                                      }}
                                   />
                                   {novoEnsaioPlanilha && <p style={{ fontSize: '0.8rem', color: 'hsl(var(--primary))', marginTop: '4px' }}>Arquivo anexado: {novoEnsaioPlanilha.name}</p>}
                                 </div>

                                 <button className="btn-primary" style={{ width: '100%', marginTop: '8px' }} onClick={handleCriarEnsaio}>
                                    <PlusCircle size={18} /> Publicar Padrão na Biblioteca
                                 </button>
                              </div>
                           </div>
                        )}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
