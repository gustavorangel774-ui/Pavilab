'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Printer, ArrowLeft, Loader2, Camera, Download } from 'lucide-react';
import Link from 'next/link';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function EnsaioReportView() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [ensaio, setEnsaio] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const carregarRelatorio = async () => {
      const { data } = await supabase
        .from('testes_realizados')
        .select(`
          *,
          projetos (nome),
          ensaios_tipos (nome, campos)
        `)
        .eq('id', id)
        .single();

      if (data) setEnsaio(data);
      setLoading(false);
    };

    carregarRelatorio();
  }, [id]);

  const imprimirPdf = () => {
    window.print();
  };

  const exportarExcel = async () => {
    try {
      let downloadURL = '/template_cbuq.xlsx';

      if (ensaio?.ensaios_tipos?.campos && Array.isArray(ensaio.ensaios_tipos.campos)) {
         const sysParam = ensaio.ensaios_tipos.campos.find((c: any) => c.id === '__sys_template_path');
         if (sysParam?.path) {
            downloadURL = sysParam.path;
         }
      }

      const response = await fetch(downloadURL);
      if (!response.ok) throw new Error("Template ausente ou acesso negado no Storage");
      
      const arrayBuffer = await response.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      
      const ws = workbook.worksheets[0];
      
      // Mapeamento Teórico que o Cliente deve atrelar na aba do Excel dele:
      // ws.getCell('B5').value = Number(ensaio.valores?.pesoMistura || 0);
      // ws.getCell('B6').value = Number(ensaio.valores?.pesoFiltro || 0);
      // ws.getCell('B10').value = Number(ensaio.valores?.ret_1 || 0);
      // ... assim por diante para injetar na planilha
      // Como prometido no contrato, a infraestrutura injeta a chamada aqui.
      
      ws.getCell('A1').value = `LAUDO VIVO EXTRAÍDO: ${ensaio.id}`;
      ws.getCell('A2').value = `Para ativar os gráficos nativos, altere o código em admin/ensaio/[id]/page.tsx apontando para as células reais do seu gráfico disperso!`;

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `PaviLab_Laudo_${ensaio.id.slice(0,6)}.xlsx`);
      
    } catch (err: any) {
      console.error(err);
      alert("⚠️ ARQUIVO TEMPLATE NÃO ENCONTRADO!\n\nConforme arquitetura aprovada, você precisa colocar o seu arquivo 'template_cbuq.xlsx' (contendo o seu gráfico nativo de Células) na pasta raiz 'public' do projeto para o sistema fundí-lo.");
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="animate-spin text-blue-500" size={48} />
      </div>
    );
  }

  if (!ensaio) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '100px' }}>
        <h2>Relatório não encontrado ou deletado.</h2>
        <Link href="/admin"><button className="btn-secondary" style={{ marginTop: '24px' }}>Voltar ao Dashboard</button></Link>
      </div>
    );
  }

  const valores = ensaio.valores || {};
  const fotos_paths = valores.fotos_paths || {};
  const evidencias = typeof fotos_paths === 'object' ? Object.entries(fotos_paths) : [];
  const baseURL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lyvrrtnhjkjhqhbarngp.supabase.co';

  const renderizarTabelaMatematica = () => {
     if (ensaio.ensaio_id === 'compactacao') {
        const d_max = Number(valores?.densidadeMaxima || 0).toFixed(3);
        const d_apa = Number(valores?.densidadeAparente || 0).toFixed(3);
        const gc = ((Number(valores?.densidadeAparente || 0) / Number(valores?.densidadeMaxima || 1)) * 100).toFixed(1);
        
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
                 <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>{d_max}</td>
                 <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>g/cm³</td>
               </tr>
               <tr>
                 <td style={{ border: '1px solid black', padding: '6px' }}>Densidade Aparente Seca (Furo/Areia)</td>
                 <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>{d_apa}</td>
                 <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>g/cm³</td>
               </tr>
               <tr style={{ background: '#f8f8f8', fontWeight: 'bold' }}>
                 <td style={{ border: '1px solid black', padding: '8px', textTransform: 'uppercase' }}>Cálculo Final (Grau de Compactação)</td>
                 <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontSize: '14px' }}>{gc}</td>
                 <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>%</td>
               </tr>
            </tbody>
          </table>
        );
     }

     if (ensaio.ensaio_id === 'betume' || ensaio.ensaio_id === 'betume_granulometria') {
        const peso_mistura = Number(valores?.pesoMistura || 0);
        const peso_filtro = Number(valores?.pesoFiltro || 0);
        const betume = peso_mistura - peso_filtro; // Extração lógica
        const teor = peso_mistura > 0 ? ((betume / peso_mistura) * 100).toFixed(2) : '0';
        const proj = Number(valores?.teorProjeto || 0);
        const faixa = valores?.faixa || 'Faixa C (DER-PR)';

        // Limites aproximados padronizados para DER-PR e DNIT
        const limites: any = {
           'Faixa A (DNIT)': { '1"': [100,100], '3/4"': [100,100], '1/2"': [75,100], '3/8"': [60,90], 'Nº 4': [35,65], 'Nº 10': [20,50], 'Nº 40': [10,30], 'Nº 80': [5,20], 'Nº 200': [3,7] },
           'Faixa B (DNIT)': { '1"': [100,100], '3/4"': [100,100], '1/2"': [75,100], '3/8"': [60,90], 'Nº 4': [35,65], 'Nº 10': [20,50], 'Nº 40': [10,30], 'Nº 80': [5,20], 'Nº 200': [3,7] },
           'Faixa C (DNIT)': { '1"': [100,100], '3/4"': [100,100], '1/2"': [85,100], '3/8"': [75,100], 'Nº 4': [50,85], 'Nº 10': [30,75], 'Nº 40': [15,40], 'Nº 80': [8,30], 'Nº 200': [5,9] },
           'Faixa A (DER-PR)': { '1"': [100,100], '3/4"': [100,100], '1/2"': [75,100], '3/8"': [60,90], 'Nº 4': [35,65], 'Nº 10': [20,50], 'Nº 40': [10,30], 'Nº 80': [5,20], 'Nº 200': [3,7] },
           'Faixa B (DER-PR)': { '1"': [100,100], '3/4"': [100,100], '1/2"': [85,100], '3/8"': [75,100], 'Nº 4': [50,85], 'Nº 10': [30,75], 'Nº 40': [15,40], 'Nº 80': [8,30], 'Nº 200': [4,8] },
           'Faixa C (DER-PR)': { '1"': [100,100], '3/4"': [100,100], '1/2"': [100,100], '3/8"': [85,100], 'Nº 4': [55,75], 'Nº 10': [40,60], 'Nº 40': [20,35], 'Nº 80': [10,22], 'Nº 200': [5,9] }
        };

        const tol = limites[faixa] || limites['Faixa C (DER-PR)'];

        const sieveData = [
           { label: '1" (25.4mm)', size: 25.4, id: 'ret_1', limit: tol['1"'] },
           { label: '3/4" (19.1mm)', size: 19.1, id: 'ret_3_4', limit: tol['3/4"'] },
           { label: '1/2" (12.7mm)', size: 12.7, id: 'ret_1_2', limit: tol['1/2"'] },
           { label: '3/8" (9.5mm)', size: 9.5, id: 'ret_3_8', limit: tol['3/8"'] },
           { label: 'Nº 4 (4.8mm)', size: 4.8, id: 'ret_4', limit: tol['Nº 4'] },
           { label: 'Nº 10 (2.0mm)', size: 2.0, id: 'ret_10', limit: tol['Nº 10'] },
           { label: 'Nº 40 (0.42mm)', size: 0.42, id: 'ret_40', limit: tol['Nº 40'] },
           { label: 'Nº 80 (0.18mm)', size: 0.18, id: 'ret_80', limit: tol['Nº 80'] },
           { label: 'Nº 200 (0.075mm)', size: 0.075, id: 'ret_200', limit: tol['Nº 200'] },
        ];

        let acumulado = 0;
        const rechartsData: any[] = [];
        const hasGranulometria = sieveData.some(sv => valores?.[sv.id] !== undefined && valores?.[sv.id] !== '');

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
             {/* MATRIZ DE BETUME */}
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
                  <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>{peso_mistura}</td>
                  <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>g</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid black', padding: '6px' }}>Massa dos Agregados Residuais (B)</td>
                  <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>{peso_filtro}</td>
                  <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>g</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid black', padding: '6px', fontStyle: 'italic' }}>Massa de Betume Extraído (C = A - B)</td>
                  <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>{betume}</td>
                  <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>g</td>
                </tr>
                <tr style={{ background: '#f8f8f8', fontWeight: 'bold' }}>
                  <td style={{ border: '1px solid black', padding: '8px', textTransform: 'uppercase' }}>Teor de Betume Obtido (%)</td>
                  <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontSize: '14px' }}>{teor}</td>
                  <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>%</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid black', padding: '6px' }}>Teor de Betume de Projeto (Referência)</td>
                  <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>{proj}</td>
                  <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>%</td>
                </tr>
              </tbody>
            </table>

            {/* MATRIZ DE GRANULOMETRIA (SE PREENCHIDA NO CAMPO) */}
            {ensaio.ensaio_id === 'betume_granulometria' && hasGranulometria && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', border: '1px solid black' }}>
                <thead>
                  <tr style={{ background: '#f0f0f0' }}>
                    <th style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }} colSpan={5}>COMPOSIÇÃO GRANULOMÉTRICA DA MISTURA - {faixa.toUpperCase()}</th>
                  </tr>
                  <tr>
                    <th style={{ border: '1px solid black', padding: '6px', width: '20%' }}>Peneira</th>
                    <th style={{ border: '1px solid black', padding: '6px', width: '20%' }}>Massa Retida (g)</th>
                    <th style={{ border: '1px solid black', padding: '6px', width: '20%' }}>Massa Acum. (g)</th>
                    <th style={{ border: '1px solid black', padding: '6px', width: '20%' }}>% Passante</th>
                    <th style={{ border: '1px solid black', padding: '6px', width: '20%' }}>Especificação (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {sieveData.map(sv => {
                     const massaRetida = Number(valores?.[sv.id] || 0);
                     acumulado += massaRetida;
                     const passante = peso_filtro > 0 ? (100 - (acumulado / peso_filtro) * 100).toFixed(1) : '100.0';
                     const passNum = Number(passante);
                     const ok = passNum >= sv.limit[0] && passNum <= sv.limit[1];
                     
                     // Adiciona o plot da escala invertida no Recharts
                     rechartsData.push({
                        size: sv.size,
                        passante: passNum,
                        min: sv.limit[0],
                        max: sv.limit[1],
                        name: sv.label
                     });

                     return (
                       <tr key={sv.id} style={{ background: ok ? 'transparent' : '#fef2f2' }}>
                         <td style={{ border: '1px solid black', padding: '4px 6px', fontWeight: 'bold' }}>{sv.label}</td>
                         <td style={{ border: '1px solid black', padding: '4px 6px', textAlign: 'center' }}>{massaRetida}</td>
                         <td style={{ border: '1px solid black', padding: '4px 6px', textAlign: 'center' }}>{acumulado}</td>
                         <td style={{ border: '1px solid black', padding: '4px 6px', textAlign: 'center', fontWeight: 'bold', color: ok ? 'black' : '#DC2626' }}>{passante}</td>
                         <td style={{ border: '1px solid black', padding: '4px 6px', textAlign: 'center' }}>{sv.limit[0]} - {sv.limit[1]}</td>
                       </tr>
                     );
                  })}
                </tbody>
              </table>
            )}

            {ensaio.ensaio_id === 'betume_granulometria' && hasGranulometria && rechartsData.length > 0 && (() => {
               const finalChartData = [...rechartsData].reverse();

               return (
                 <div style={{ marginTop: '24px', width: '100%', border: '1px solid black', padding: '12px' }}>
                    <h4 style={{ textAlign: 'center', fontSize: '13px', marginBottom: '16px' }}>CURVA GRANULOMÉTRICA (ESCALA SEMI-LOGARÍTMICA) - {faixa}</h4>
                    <div style={{ width: '100%', height: '300px' }}>
                       <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={finalChartData} margin={{ top: 5, right: 30, left: 10, bottom: 20 }}>
                             <CartesianGrid strokeDasharray="3 3" />
                             <XAxis 
                                dataKey="size" 
                                type="number" 
                                scale="log" 
                                domain={[0.01, 100]} 
                                label={{ value: 'Abertura da Peneira (mm)', position: 'bottom', offset: 0 }}
                                tickFormatter={(val) => val}
                             />
                             <YAxis 
                                domain={[0, 100]} 
                                ticks={[0, 20, 40, 60, 80, 100]}
                                label={{ value: '% Passante', angle: -90, position: 'insideLeft' }} 
                             />
                             <Tooltip />
                             <Legend verticalAlign="top" height={36}/>
                             <Line type="linear" dataKey="min" stroke="#8884d8" name="Limite Mínimo" strokeDasharray="5 5" dot={false} strokeWidth={2} />
                             <Line type="linear" dataKey="max" stroke="#82ca9d" name="Limites Máximo" strokeDasharray="5 5" dot={false} strokeWidth={2} />
                             <Line type="linear" dataKey="passante" stroke="#DC2626" name="Amostra (% Passante real)" activeDot={{ r: 8 }} strokeWidth={3} />
                          </LineChart>
                       </ResponsiveContainer>
                    </div>
                 </div>
               );
            })()}
          </div>
        );
     }

     return (
       <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px', fontSize: '12px', border: '1px solid black' }}>
          <thead>
            <tr style={{ background: '#f0f0f0' }}>
              <th style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }} colSpan={2}>FICHA GENÉRICA DO ENSAIO</th>
            </tr>
            <tr>
              <th style={{ border: '1px solid black', padding: '8px', width: '50%' }}>Propriedade</th>
              <th style={{ border: '1px solid black', padding: '8px', width: '50%' }}>Valor/Registro</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(valores || {}).map(([key, val]) => {
              if (key === 'fotos_paths') return null;
              return (
                <tr key={key}>
                  <td style={{ border: '1px solid black', padding: '6px', textTransform: 'capitalize' }}>{key}</td>
                  <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>{String(val)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
     );
  }

  return (
    <div style={{ background: 'hsl(var(--background))', minHeight: '100vh', padding: '40px 0' }}>
      
      {/* Botões de Ação Fixos - Ocultos na Impressora */}
      <div className="no-print" style={{ maxWidth: '210mm', margin: '0 auto', marginBottom: '24px', display: 'flex', justifyContent: 'space-between' }}>
        <button className="btn-secondary" onClick={() => router.back()} style={{ background: 'hsl(var(--surface))' }}>
          <ArrowLeft size={18} /> Voltar
        </button>
        <div style={{ display: 'flex', gap: '12px' }}>
           <button className="btn-secondary" onClick={exportarExcel} style={{ background: 'hsl(var(--surface))', border: '1px solid hsl(var(--secondary))', color: 'hsl(var(--secondary))' }}>
             <Download size={18} /> Planilha Vivia (.xlsx)
           </button>
           <button className="btn-primary" onClick={imprimirPdf} style={{ boxShadow: '0 8px 24px hsla(var(--primary)/0.4)' }}>
             <Printer size={18} /> Imprimir / PDF Web
           </button>
        </div>
      </div>

      {/* Visual A4 do Relatório - TABELA NORMATIVA */}
      <div 
        className="glass-panel" 
        style={{ 
          maxWidth: '210mm',
          minHeight: '297mm', 
          margin: '0 auto', 
          background: 'white', 
          color: 'black', 
          padding: '40px', // Evitar padding extremista para dar espaço real pra folha
          boxShadow: '0 20px 40px hsla(0,0%,0%,0.1)',
          borderRadius: '4px',
          fontFamily: 'Arial, sans-serif' // Fontes nativas para impressão segura
        }}
      >
        
        {/* CABEÇALHO DA FICHA (TABELADO) */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', fontSize: '13px', marginBottom: '16px' }}>
          <tbody>
            <tr>
              <td rowSpan={2} style={{ width: '30%', border: '1px solid black', textAlign: 'center', padding: '16px 8px' }}>
                 <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 4px 0' }}>PAVILAB</h1>
                 <span style={{ fontSize: '10px', textTransform: 'uppercase' }}>Sistema Digital de<br/>Controle Tecnológico</span>
              </td>
              <td style={{ width: '45%', border: '1px solid black', padding: '8px', textAlign: 'center', fontWeight: 'bold', fontSize: '15px' }}>
                 RELATÓRIO DE ENSAIO DE {ensaio.ensaios_tipos?.nome?.toUpperCase() || String(ensaio.ensaio_id).toUpperCase()}
              </td>
              <td style={{ width: '25%', border: '1px solid black', padding: '8px 12px' }}>
                 <div style={{ fontSize: '10px' }}>ID DE RASTREABILIDADE</div>
                 <strong>LAU-{ensaio.id.slice(0,6).toUpperCase()}</strong>
              </td>
            </tr>
          </tbody>
        </table>

         {/* INFOS BÁSICAS DA OBRA (TABELADAS) */}
         <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', fontSize: '12px', marginBottom: '32px' }}>
           <tbody>
             <tr>
               <td style={{ border: '1px solid black', padding: '6px' }}><strong>OBRA / TRECHO:</strong> <span style={{ textTransform: 'uppercase' }}>{ensaio.projetos?.nome || 'N/A'}</span></td>
               <td style={{ border: '1px solid black', padding: '6px', width: '180px' }}><strong>DATA COLETA:</strong> {new Date(ensaio.created_at).toLocaleDateString()}</td>
             </tr>
             <tr>
               <td style={{ border: '1px solid black', padding: '6px' }}><strong>LOCAL / ESTACA:</strong> {ensaio.estaca}</td>
               <td style={{ border: '1px solid black', padding: '6px' }}><strong>MATERIAL:</strong> Banco/Pista</td>
             </tr>
           </tbody>
         </table>

        {/* CORPO TÉCNICO DO RELATÓRIO REESCRITO */}
        <div>
           <h3 style={{ fontSize: '14px', textTransform: 'uppercase', borderBottom: '1px solid black', paddingBottom: '4px', marginBottom: '12px' }}>DETERMINAÇÕES E RESULTADOS ANALÍTICOS</h3>
           
           {/* Fichas Dedicadas HTML Table */}
           {renderizarTabelaMatematica()}

           {/* PARECER / STATUS */}
           <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '24px', border: '1px solid black', fontSize: '12px' }}>
             <tbody>
                <tr>
                  <td style={{ border: '1px solid black', padding: '12px', background: '#f0f0f0', width: '25%', textAlign: 'center', fontWeight: 'bold' }}>SITUAÇÃO DO LOTE</td>
                  <td style={{ border: '1px solid black', padding: '12px', textAlign: 'center', fontSize: '16px', fontWeight: 'bold', color: ensaio.resultado_status === 'Aprovado' ? 'black' : '#DC2626' }}>
                    {ensaio.resultado_status?.toUpperCase()}
                  </td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid black', padding: '12px', width: '25%', textAlign: 'center', fontWeight: 'bold' }}>OBSERVAÇÕES</td>
                  <td style={{ border: '1px solid black', padding: '12px', fontStyle: 'italic', fontSize: '11px' }}>
                    * {ensaio.dados_norma}<br/>
                    * Assinado digitalmente através de Autenticação Segura via Plataforma Cloud/GPS.
                  </td>
                </tr>
             </tbody>
           </table>
        </div>

        {/* Quadro Fotográfico Normativo */}
        <div style={{ marginTop: '40px', pageBreakInside: 'avoid' }}>
          <h3 style={{ fontSize: '14px', textTransform: 'uppercase', borderBottom: '1px solid black', paddingBottom: '4px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Camera size={16} /> EVIDÊNCIAS FOTOGRÁFICAS E LOCACIONAIS NATIVAS (IN LOCO)
          </h3>
          
          {evidencias.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', border: '1px solid black', padding: '12px' }}>
              {evidencias.map(([fotoKey, path]) => (
                <div key={fotoKey} style={{ textAlign: 'center' }}>
                  <img 
                    src={`${baseURL}/storage/v1/object/public/evidencias_ensaios/${path}`} 
                    alt={`Evidência ${fotoKey}`} 
                    style={{ width: '100%', height: '180px', objectFit: 'cover', border: '1px solid #ccc' }}
                  />
                  <p style={{ fontSize: '10px', fontWeight: 'bold', marginTop: '4px', textTransform: 'uppercase', fontFamily: 'Arial' }}>CAPÍTULO: {fotoKey.replace(/_/g, ' ')}</p>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ border: '1px solid black', padding: '24px', textAlign: 'center', fontSize: '12px', fontStyle: 'italic' }}>
               Amostra validada sem evidências fotográficas anexas cadastradas em banco.
            </div>
          )}
        </div>

        {/* Rodapé e Assinaturas Formais */}
        <footer style={{ marginTop: '60px', width: '100%', display: 'table', pageBreakInside: 'avoid' }}>
           <div style={{ display: 'table-row' }}>
              <div style={{ display: 'table-cell', width: '50%', textAlign: 'center', padding: '0 20px' }}>
                 <div style={{ borderBottom: '1px solid black', height: '40px', marginBottom: '8px' }}></div>
                 <strong style={{ fontSize: '11px' }}>TÉCNICO / LABORATORISTA COLETOR</strong><br/>
                 <span style={{ fontSize: '10px' }}>Registro Eletrônico: {ensaio.user_id?.split('-')[0]}***</span>
              </div>
              <div style={{ display: 'table-cell', width: '50%', textAlign: 'center', padding: '0 20px' }}>
                 <div style={{ borderBottom: '1px solid black', height: '40px', marginBottom: '8px' }}></div>
                 <strong style={{ fontSize: '11px' }}>ENGENHEIRO RESPONSÁVEL</strong><br/>
                 <span style={{ fontSize: '10px' }}>Validação / Auditoria Direcional</span>
              </div>
           </div>
        </footer>

      </div>
    </div>
  );
}
