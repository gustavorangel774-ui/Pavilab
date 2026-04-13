import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://lyvrrtnhjkjhqhbarngp.supabase.co', 'sb_publishable_6opa3TTDKhGmmjWL0OIZRw_9QvpIdZA');

const mockProjetos = [
  { nome: "Rodovia Castelo Branco - Trecho 2", estacas: ["Estaca 10", "Estaca 15", "Estaca 20"] },
  { nome: "Rodoanel Norte", estacas: ["Estaca 01", "Estaca 05", "Estaca 12"] },
  { nome: "BR-116 Ampliação", estacas: ["Estaca 100", "Estaca 110", "Estaca 120"] }
];

const mockEnsaios = [
  { 
    id: 'compactacao', 
    nome: 'Grau de Compactação (GC)', 
    campos: [
      { id: 'densidadeAparente', label: 'Densidade Aparente Seca (g/cm³)', tipo: 'number' }, 
      { id: 'densidadeMaxima', label: 'Densidade Máxima de Projeto (g/cm³)', tipo: 'number' },
    ] 
  },
  { 
    id: 'betume_granulometria', 
    nome: 'CBUQ: Teor de Betume e Granulometria', 
    campos: [
      { id: 'faixa', label: 'Faixa Granulométrica (Especificação)', tipo: 'select', options: ['Faixa A (DNIT)', 'Faixa B (DNIT)', 'Faixa C (DNIT)', 'Faixa A (DER-PR)', 'Faixa B (DER-PR)', 'Faixa C (DER-PR)'] },
      { id: 'pesoMistura', label: 'Massa Total da Mistura Asfáltica (g)', tipo: 'number' }, 
      { id: 'pesoFiltro', label: 'Massa dos Agregados Residuais (g)', tipo: 'number' },
      { id: 'teorProjeto', label: 'Teor de Betume de Projeto (%)', tipo: 'number' },
      { id: 'ret_1', label: 'Peso Retido - Peneira 1" (g)', tipo: 'number' },
      { id: 'ret_3_4', label: 'Peso Retido - Peneira 3/4" (g)', tipo: 'number' },
      { id: 'ret_1_2', label: 'Peso Retido - Peneira 1/2" (g)', tipo: 'number' },
      { id: 'ret_3_8', label: 'Peso Retido - Peneira 3/8" (g)', tipo: 'number' },
      { id: 'ret_4', label: 'Peso Retido - Peneira Nº 4 (g)', tipo: 'number' },
      { id: 'ret_10', label: 'Peso Retido - Peneira Nº 10 (g)', tipo: 'number' },
      { id: 'ret_40', label: 'Peso Retido - Peneira Nº 40 (g)', tipo: 'number' },
      { id: 'ret_80', label: 'Peso Retido - Peneira Nº 80 (g)', tipo: 'number' },
      { id: 'ret_200', label: 'Peso Retido - Peneira Nº 200 (g)', tipo: 'number' }
    ] 
  },
  { 
    id: 'granulometria', 
    nome: 'Granulometria (Solos, BGS e Agregados)', 
    campos: [
      { id: 'pesoMistura', label: 'Massa Total Seca da Amostra (g)', tipo: 'number' }, 
      { id: 'ret_2', label: 'Peso Retido - Peneira 2" (g)', tipo: 'number' },
      { id: 'ret_1_5', label: 'Peso Retido - Peneira 1 1/2" (g)', tipo: 'number' },
      { id: 'ret_1', label: 'Peso Retido - Peneira 1" (g)', tipo: 'number' },
      { id: 'ret_3_4', label: 'Peso Retido - Peneira 3/4" (g)', tipo: 'number' },
      { id: 'ret_1_2', label: 'Peso Retido - Peneira 1/2" (g)', tipo: 'number' },
      { id: 'ret_3_8', label: 'Peso Retido - Peneira 3/8" (g)', tipo: 'number' },
      { id: 'ret_4', label: 'Peso Retido - Peneira Nº 4 (g)', tipo: 'number' },
      { id: 'ret_10', label: 'Peso Retido - Peneira Nº 10 (g)', tipo: 'number' },
      { id: 'ret_40', label: 'Peso Retido - Peneira Nº 40 (g)', tipo: 'number' },
      { id: 'ret_80', label: 'Peso Retido - Peneira Nº 80 (g)', tipo: 'number' },
      { id: 'ret_200', label: 'Peso Retido - Peneira Nº 200 (g)', tipo: 'number' }
    ] 
  },
  {
    id: 'equivalente_areia',
    nome: 'Equivalente de Areia (EA)',
    campos: [
      { id: 'leituraAreia', label: 'Leitura Nível da Areia (h1)', tipo: 'number' },
      { id: 'leituraFinos', label: 'Leitura Nível Argiloso (h2)', tipo: 'number' }
    ]
  }
];

async function seed() {
    console.log('Seeding projetos...');
    const { data: projetosData, error: errProj } = await supabase.from('projetos').insert(mockProjetos).select();
    if(errProj) console.error(errProj);
    
    console.log('Seeding ensaios_tipos...');
    const { error: errEns } = await supabase.from('ensaios_tipos').upsert(mockEnsaios).select();
    if(errEns) console.error(errEns);

    console.log('Removendo legacy betume...');
    await supabase.from('ensaios_tipos').delete().eq('id', 'betume');
    await supabase.from('testes_realizados').delete().eq('ensaio_id', 'betume');

    console.log('Done!');
}
seed();
