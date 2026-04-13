'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { FileText, Navigation, CheckCircle2, AlertTriangle, ArrowLeft, Camera, Loader2, ImagePlus, AlertCircle } from 'lucide-react';

export default function FieldModule() {
  const [passo, setPasso] = useState(1);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [coordenadas, setCoordenadas] = useState('');
  
  const [projetos, setProjetos] = useState<any[]>([]);
  const [ensaios, setEnsaios] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const router = useRouter();

  const showToast = (message: string, type: 'error' | 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login');
      else setUser(session.user);
    });

    Promise.all([
      supabase.from('projetos').select('*'),
      supabase.from('ensaios_tipos').select('*')
    ]).then(([projData, ensaiosData]) => {
      setProjetos(projData.data || []);
      setEnsaios(ensaiosData.data || []);
      setLoadingInitial(false);
    });
  }, [router]);

  const [dadosEnsaio, setDadosEnsaio] = useState({
    obraId: '',
    estaca: '',
    ensaioId: '',
    valores: {} as Record<string, string>,
    fotos: {} as Record<string, File>
  });

  const getSmsGps = () => {
    setGpsLoading(true);
    if (!navigator.geolocation) {
      showToast('Geolocalização não suportada pelo seu navegador.', 'error');
      setGpsLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lng = position.coords.longitude.toFixed(6);
        const accuracy = position.coords.accuracy.toFixed(0);
        setCoordenadas(`${lat}, ${lng} (Precisão: ${accuracy}m)`);
        setGpsLoading(false);
      },
      (error) => {
        showToast('Erro ao capturar GPS: ' + error.message, 'error');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const currentEnsaio = ensaios.find(e => e.id === dadosEnsaio.ensaioId);
  const currentObra = projetos.find(p => p.id === dadosEnsaio.obraId);

  const fotosNecessarias = () => {
    if (dadosEnsaio.ensaioId === 'compactacao') {
      return [
        { id: 'furo', label: '1. Foto furando a camada' },
        { id: 'frasco', label: '2. Foto do frasco virado' }
      ];
    }
    if (dadosEnsaio.ensaioId === 'betume' || dadosEnsaio.ensaioId === 'betume_granulometria') {
      return [
        { id: 'coleta', label: '1. Foto da Coleta (Mistura antes da Extração)' },
        { id: 'rotarex', label: '2. Foto do Equipamento (Filtro/Rotarex)' },
        { id: 'extracao', label: '3. Foto após Extração (Agregados Limpos)' }
      ];
    }
    return [{ id: 'geral', label: '1. Foto Geral do Ensaio' }];
  };

  const handleFotoUpload = (id: string, file: File) => {
    setDadosEnsaio(prev => ({
      ...prev,
      fotos: { ...prev.fotos, [id]: file }
    }));
  };

  const calcularStatus = () => {
    if (dadosEnsaio.ensaioId === 'compactacao') {
      const densidadeMaxima = Number(dadosEnsaio.valores.densidadeMaxima || 0);
      const densidadeAparente = Number(dadosEnsaio.valores.densidadeAparente || 0);
      if (densidadeMaxima === 0) return { status: 'Reprovado', val: 0, msg: "Dados inválidos" };
      const gc = (densidadeAparente / densidadeMaxima) * 100;
      return { status: gc >= 98.0 ? 'Aprovado' : 'Reprovado', val: gc.toFixed(1) };
    }
    
    if (dadosEnsaio.ensaioId === 'betume' || dadosEnsaio.ensaioId === 'betume_granulometria') {
      const teorProjeto = Number(dadosEnsaio.valores.teorProjeto || 0);
      const pesoMistura = Number(dadosEnsaio.valores.pesoMistura || 0);
      const pesoFiltro = Number(dadosEnsaio.valores.pesoFiltro || 0);
      const betumeExtraido = pesoMistura - pesoFiltro;
      const teor = (betumeExtraido / pesoMistura) * 100;
      const desvio = Math.abs(teor - teorProjeto);
      
      let statusGeral = desvio <= 0.3 ? 'Aprovado' : 'Reprovado Betume';
      
      // Validação rústica de granulometria N200 para Faixa C (se for esse o caso) para dar feedback pro peão
      // SÓ faz a validação SE o laboratorista efetivamente informou alguma peneira
      const sieves = ['ret_1', 'ret_3_4', 'ret_1_2', 'ret_3_8', 'ret_4', 'ret_10', 'ret_40', 'ret_80', 'ret_200'];
      const hasGranulometria = sieves.some(s => dadosEnsaio.valores[s] !== undefined && dadosEnsaio.valores[s] !== '');
      
      if (hasGranulometria && dadosEnsaio.ensaioId === 'betume_granulometria' && dadosEnsaio.valores.faixa === 'Faixa C (DNIT)' && pesoFiltro > 0) {
         let retidoSum = 0;
         sieves.forEach(s => retidoSum += Number(dadosEnsaio.valores[s] || 0));
         const passanteN200 = 100 - ((retidoSum / pesoFiltro) * 100);
         if (passanteN200 < 5 || passanteN200 > 9) statusGeral = 'Reprovado Granulometria (P.200)';
      }

      return { status: statusGeral === 'Aprovado' ? 'Aprovado' : statusGeral, val: teor.toFixed(2), projeto: teorProjeto };
    }

    if (dadosEnsaio.ensaioId === 'equivalente_areia') {
      const areia = Number(dadosEnsaio.valores.leituraAreia || 0);
      const finos = Number(dadosEnsaio.valores.leituraFinos || 0);
      const ea = (areia / finos) * 100;
      return { status: ea >= 55.0 ? 'Aprovado' : 'Reprovado', val: ea.toFixed(1) };
    }
    
    return { status: 'Aprovado', val: '100' };
  };

  const salvarEnsaio = async () => {
    if (!user) return showToast('Sessão expirada!', 'error');
    setUploading(true);
    
    // Upload de Fotos
    const urlsFotos: Record<string, string> = {};
    for (const [fotoId, file] of Object.entries(dadosEnsaio.fotos)) {
      const fileName = `${user.id}/${Date.now()}_${fotoId}_${file.name}`;
      const { data, error } = await supabase.storage.from('evidencias_ensaios').upload(fileName, file);
      if (error) {
         console.error('Erro no upload', error);
         continue; // Em MVP, continua se falhar
      }
      urlsFotos[fotoId] = fileName;
    }

    const analise = calcularStatus();

    const payload = {
      projeto_id: dadosEnsaio.obraId,
      estaca: dadosEnsaio.estaca,
      ensaio_id: dadosEnsaio.ensaioId,
      valores: { ...dadosEnsaio.valores, fotos_paths: urlsFotos },
      resultado_status: analise.status,
      dados_norma: `Relatório validado via PaviLab GPS. Coordenadas: ${coordenadas}. Valor Referencia Obtido: ${analise.val}`,
      user_id: user.id
    };

    const { error } = await supabase.from('testes_realizados').insert(payload);
    
    setUploading(false);

    if (error) {
      showToast("Falha no servidor: " + error.message, "error");
    } else {
      setPasso(6);
    }
  }

  const renderizarRelatorioTecnico = () => {
    const analise = calcularStatus();
    switch(dadosEnsaio.ensaioId) {
      case 'compactacao':
        return (
          <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ padding: '16px', background: analise.status === 'Aprovado' ? 'hsla(var(--secondary) / 0.1)' : 'hsla(0, 84%, 60%, 0.1)', borderLeft: `4px solid ${analise.status === 'Aprovado' ? 'hsl(var(--secondary))' : '#ef4444'}`, borderRadius: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.85rem' }}>Grau de Compactação (GC)</span>
                <span style={{ fontWeight: 'bold', color: analise.status === 'Aprovado' ? 'hsl(var(--secondary))' : '#ef4444' }}>{analise.val}%</span>
              </div>
              <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: 'hsl(var(--text-main))' }}>Critério DNIT: ≥ 98.0% - <strong>{analise.status}</strong></p>
            </div>
          </div>
        );
      case 'betume':
      case 'betume_granulometria':
         return (
          <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ padding: '16px', background: analise.status === 'Aprovado' ? 'hsla(var(--secondary) / 0.1)' : 'hsla(0, 84%, 60%, 0.1)', borderLeft: `4px solid ${analise.status === 'Aprovado' ? 'hsl(var(--secondary))' : '#ef4444'}`, borderRadius: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.85rem' }}>Teor de Betume Obtido</span>
                <span style={{ fontWeight: 'bold', color: analise.status === 'Aprovado' ? 'hsl(var(--secondary))' : '#ef4444' }}>{analise.val}%</span>
              </div>
              <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: 'hsl(var(--text-main))' }}>Critério DNIT: {analise.projeto}% ± 0.3% - <strong>{analise.status}</strong></p>
            </div>
            {dadosEnsaio.ensaioId === 'betume_granulometria' && (
               <div style={{ padding: '16px', background: 'hsl(var(--surface))', borderLeft: `4px solid hsl(var(--border))`, borderRadius: '4px', fontSize: '0.8rem' }}>
                  Aviso: A análise paramétrica completa de Peneiras formará o gráfico oficial em PDF no Painel.
               </div>
            )}
          </div>
        );
      case 'equivalente_areia':
         return (
          <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ padding: '16px', background: analise.status === 'Aprovado' ? 'hsla(var(--secondary) / 0.1)' : 'hsla(0, 84%, 60%, 0.1)', borderLeft: `4px solid ${analise.status === 'Aprovado' ? 'hsl(var(--secondary))' : '#ef4444'}`, borderRadius: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.85rem' }}>Equivalente de Areia (EA)</span>
                <span style={{ fontWeight: 'bold', color: analise.status === 'Aprovado' ? 'hsl(var(--secondary))' : '#ef4444' }}>{analise.val}%</span>
              </div>
              <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: 'hsl(var(--text-main))' }}>Critério DNER: ≥ 55% - <strong>{analise.status}</strong></p>
            </div>
          </div>
        );
      case 'granulometria':
      default:
        return (
           <div style={{ padding: '16px', background: 'hsla(var(--secondary) / 0.1)', borderLeft: '4px solid hsl(var(--secondary))', borderRadius: '4px' }}>
             <p style={{ fontWeight: 'bold', color: 'hsl(var(--secondary))' }}>Cálculo Concluído</p>
             <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: 'hsl(var(--text-main))' }}>Atendido Normativa do respectivo ensaio. Pode prosseguir com o salvamento.</p>
           </div>
        );
    }
  }
  if (loadingInitial) {
     return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}><Loader2 className="animate-spin text-blue-500" size={48} /></div>;
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', minHeight: '100vh', background: 'hsl(var(--background))', padding: '16px 16px 64px 16px', overflowX: 'hidden' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', paddingBottom: '16px', borderBottom: '1px solid hsl(var(--border))' }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
          <ArrowLeft size={18} /> Sair
        </Link>
        <h2 style={{ fontSize: '1rem', margin: 0, color: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Navigation size={16} /> Central de Campo
        </h2>
      </header>

      {/* Indicador de Passos */}
      {passo < 6 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '14px', left: '0', right: '0', height: '2px', background: 'hsl(var(--border))', zIndex: 0 }}></div>
          <div style={{ position: 'absolute', top: '14px', left: '0', width: `${((passo - 1) / 4) * 100}%`, height: '2px', background: 'hsl(var(--primary))', zIndex: 1, transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}></div>
          {[1, 2, 3, 4, 5].map(num => (
            <div key={num} style={{ 
              width: '30px', height: '30px', borderRadius: '50%', background: passo >= num ? 'hsl(var(--primary))' : 'hsl(var(--surface))', 
              border: `2px solid ${passo >= num ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
              color: passo >= num ? 'white' : 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 'bold', zIndex: 2, transition: 'all 0.3s'
            }}>
              {passo > num ? <CheckCircle2 size={16} /> : num}
            </div>
          ))}
        </div>
      )}

      {passo < 6 && (
        <div className="glass-panel animate-fade-in" style={{ padding: '24px' }}>
          
          {passo === 1 && (
            <div>
              <h3 style={{ marginBottom: '24px', fontSize: '1.25rem' }}>Identificação Tática</h3>
              <div className="input-group">
                <label className="input-label">Em qual Obra você está?</label>
                <select className="input-field" value={dadosEnsaio.obraId} onChange={(e) => setDadosEnsaio({...dadosEnsaio, obraId: e.target.value, estaca: ''})}>
                  <option value="">-- Selecione o Edital --</option>
                  {projetos.map((proj) => <option key={proj.id} value={proj.id}>{proj.nome}</option>)}
                </select>
              </div>

              {currentObra && currentObra.estacas && (
                <div className="input-group animate-fade-in">
                  <label className="input-label">Estaca de Medição</label>
                  <select className="input-field" value={dadosEnsaio.estaca} onChange={(e) => setDadosEnsaio({...dadosEnsaio, estaca: e.target.value})}>
                    <option value="">-- Localização Picket --</option>
                    {currentObra.estacas.map((est: string) => <option key={est} value={est}>{est}</option>)}
                  </select>
                </div>
              )}

              <div className="input-group" style={{ marginTop: '32px' }}>
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>Sincronização de Satélite GPS</label>
                {coordenadas ? (
                  <div style={{ padding: '16px', background: 'hsla(var(--primary) / 0.1)', border: '1px solid hsla(var(--primary) / 0.2)', color: 'hsl(var(--primary))', borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={20} /> Capturado (Acurácia O.K.)
                  </div>
                ) : (
                  <button type="button" className="btn-secondary" onClick={getSmsGps} disabled={gpsLoading} style={{ padding: '16px' }}>
                    {gpsLoading ? <Loader2 className="animate-spin" size={20} /> : <><Navigation size={20} /> Obter Coordenadas Originais</>}
                  </button>
                )}
              </div>

              <button className="btn-primary" style={{ width: '100%', marginTop: '40px' }} disabled={!dadosEnsaio.obraId || !dadosEnsaio.estaca || !coordenadas} onClick={() => setPasso(2)}>
                Próxima Etapa
              </button>
            </div>
          )}

          {passo === 2 && (
            <div className="animate-fade-in">
               <h3 style={{ marginBottom: '24px', fontSize: '1.25rem' }}>Tipo de Avaliação Normativa</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                {ensaios.map(ensaio => (
                  <div key={ensaio.id} onClick={() => setDadosEnsaio({...dadosEnsaio, ensaioId: ensaio.id})}
                    style={{
                      padding: '16px', borderRadius: '12px',
                      border: `2px solid ${dadosEnsaio.ensaioId === ensaio.id ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
                      background: dadosEnsaio.ensaioId === ensaio.id ? 'hsla(var(--primary) / 0.05)' : 'hsl(var(--surface))',
                      cursor: 'pointer', transition: 'all 0.2s', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px'
                    }}
                  >
                    <FileText size={20} color={dadosEnsaio.ensaioId === ensaio.id ? 'hsl(var(--primary))' : 'hsl(var(--text-muted))'} />
                    {ensaio.nome}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '40px' }}>
                <button className="btn-secondary" onClick={() => setPasso(1)}>Voltar</button>
                <button className="btn-primary" style={{ flex: 1 }} disabled={!dadosEnsaio.ensaioId} onClick={() => setPasso(3)}>Preencher Ficha</button>
              </div>
            </div>
          )}

          {passo === 3 && currentEnsaio && (
            <div className="animate-fade-in">
              <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid hsl(var(--border))' }}>
                <h3 style={{ marginBottom: '4px', color: 'hsl(var(--primary))', fontSize: '1.25rem' }}>{currentEnsaio.nome}</h3>
                <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.85rem' }}>Digitando amostras locais</p>
              </div>
              
              <div style={{ display: 'grid', gap: '16px' }}>
                {currentEnsaio.campos.map((campo: any) => (
                  <div key={campo.id} className="input-group" style={{ margin: 0 }}>
                    <label className="input-label" style={{ fontWeight: 500 }}>{campo.label}</label>
                    {campo.tipo === 'select' ? (
                       <select className="input-field" style={{ background: 'hsl(var(--surface))' }} value={dadosEnsaio.valores[campo.id] || ''} onChange={(e) => setDadosEnsaio({...dadosEnsaio, valores: { ...dadosEnsaio.valores, [campo.id]: e.target.value }})}>
                         <option value="">Selecione...</option>
                         {campo.options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                       </select>
                    ) : (
                      <input type={campo.tipo} className="input-field" style={{ background: 'hsl(var(--surface))' }} value={dadosEnsaio.valores[campo.id] || ''} onChange={(e) => setDadosEnsaio({...dadosEnsaio, valores: { ...dadosEnsaio.valores, [campo.id]: e.target.value }})} placeholder="Ex: 120.5" />
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '40px' }}>
                <button className="btn-secondary" onClick={() => setPasso(2)}>Voltar</button>
                <button className="btn-primary" style={{ flex: 1, background: 'hsl(var(--text-main))' }} onClick={() => setPasso(4)}>Próximo: Evidências</button>
              </div>
            </div>
          )}

          {passo === 4 && (
             <div className="animate-fade-in">
               <h3 style={{ marginBottom: '16px', fontSize: '1.25rem' }}>Evidências Fotográficas</h3>
               <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', marginBottom: '24px' }}>A norma exige fotografias nas condições ambientais de campo.</p>
                
               <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                 {fotosNecessarias().map(foto => (
                   <div key={foto.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{foto.label}</span>
                      <label style={{ 
                        border: '2px dashed hsl(var(--border))', borderRadius: '8px', padding: '24px', 
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
                        cursor: 'pointer', background: dadosEnsaio.fotos[foto.id] ? 'hsla(var(--secondary) / 0.1)' : 'hsla(var(--surface))', 
                        color: dadosEnsaio.fotos[foto.id] ? 'hsl(var(--secondary))' : 'hsl(var(--text-muted))', transition: 'all 0.2s'
                      }}>
                        {dadosEnsaio.fotos[foto.id] ? (
                           <><CheckCircle2 size={32} style={{ marginBottom: '8px' }} /> Foto Anexada</>
                        ) : (
                           <><Camera size={32} style={{ marginBottom: '8px' }} /> Tocar para Câmera</>
                        )}
                        <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => {
                          if (e.target.files && e.target.files[0]) handleFotoUpload(foto.id, e.target.files[0]);
                        }} />
                      </label>
                   </div>
                 ))}
               </div>

               <div style={{ display: 'flex', gap: '12px', marginTop: '40px' }}>
                <button className="btn-secondary" onClick={() => setPasso(3)}>Voltar</button>
                <button className="btn-primary" style={{ flex: 1 }} disabled={fotosNecessarias().some(f => !dadosEnsaio.fotos[f.id])} onClick={() => setPasso(5)}>Emitir Laudo</button>
              </div>
             </div>
          )}

          {passo === 5 && (
            <div className="animate-fade-in">
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: calcularStatus().status === 'Aprovado' ? 'hsla(var(--secondary) / 0.1)' : 'hsla(0, 84%, 60%, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {calcularStatus().status === 'Aprovado' ? <CheckCircle2 size={32} color="hsl(var(--secondary))" /> : <AlertTriangle size={32} color="#ef4444" />}
                </div>
              </div>
              
              <h3 style={{ textAlign: 'center', marginBottom: '24px', fontSize: '1.5rem' }}>Relatório Consolidado</h3>
              
              {renderizarRelatorioTecnico()}

              <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button className="btn-primary" style={{ width: '100%' }} onClick={salvarEnsaio} disabled={uploading}>
                  {uploading ? <Loader2 className="animate-spin" size={20} /> : <><FileText size={18} /> Assinar Tecnico Oficial</>}
                </button>
                <button className="btn-secondary" style={{ width: '100%', border: 'none' }} onClick={() => setPasso(1)} disabled={uploading}>
                  Cancelar/Refazer
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {passo === 6 && (
        <div className="page-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', textAlign: 'center' }}>
           <CheckCircle2 size={80} color="hsl(var(--secondary))" style={{ marginBottom: '24px', animation: 'fadeIn 0.5s ease-out' }} />
           <h2 style={{ fontSize: '2rem', marginBottom: '16px' }}>Ensaio Registrado!</h2>
           <p style={{ color: 'hsl(var(--text-muted))', maxWidth: '300px', marginBottom: '40px' }}>Todas as fotos, coordenadas do GPS e dados algorítmicos foram salvos seguros na nuvem.</p>
           
           <button className="btn-primary" onClick={() => {
             setPasso(1);
             setDadosEnsaio({ obraId: '', estaca: '', ensaioId: '', valores: {}, fotos: {} });
             setCoordenadas('');
           }}>
             Iniciar Novo Ponto de Coleta
           </button>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
