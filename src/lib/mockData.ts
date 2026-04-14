export const mockProjetos = [
  { id: 1, nome: "Rodovia Castelo Branco - Trecho 2", estacas: ["Estaca 10", "Estaca 15", "Estaca 20"] },
  { id: 2, nome: "Rodoanel Norte", estacas: ["Estaca 01", "Estaca 05", "Estaca 12"] },
  { id: 3, nome: "BR-116 Ampliação", estacas: ["Estaca 100", "Estaca 110", "Estaca 120"] }
];

export const mockEnsaios = [
  { 
    id: 'compactacao', 
    nome: 'Grau de Compactação (GC)', 
    campos: [
      { id: 'densidadeAparente', label: 'Densidade Aparente Seca (g/cm³)', tipo: 'number' }, 
      { id: 'densidadeMaxima', label: 'Densidade Máxima de Projeto (g/cm³)', tipo: 'number' },
    ] 
  },
  { 
    id: 'betume', 
    nome: 'Teor de Betume', 
    campos: [
      { id: 'pesoMistura', label: 'Peso da Mistura (g)', tipo: 'number' }, 
      { id: 'pesoFiltro', label: 'Peso do Filtro (g)', tipo: 'number' },
      { id: 'teorProjeto', label: 'Teor de Projeto (%)', tipo: 'number' }
    ] 
  },
  { 
    id: 'granulometria', 
    nome: 'Granulometria (Solos, BGS e Agregados)', 
    campos: [
      { id: 'peneira1polegada', label: 'Passante Peneira 1" (%)', tipo: 'number' }, 
      { id: 'peneira3_4', label: 'Passante Peneira 3/4" (%)', tipo: 'number' },
      { id: 'peneira1_2', label: 'Passante Peneira 1/2" (%)', tipo: 'number' },
      { id: 'peneira3_8', label: 'Passante Peneira 3/8" (%)', tipo: 'number' },
      { id: 'peneiraN4', label: 'Passante Peneira N° 4 (%)', tipo: 'number' },
      { id: 'peneiraN10', label: 'Passante Peneira N° 10 (%)', tipo: 'number' },
      { id: 'peneiraN40', label: 'Passante Peneira N° 40 (%)', tipo: 'number' },
      { id: 'peneiraN200', label: 'Passante Peneira N° 200 (%)', tipo: 'number' }
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

// Dados Mockados de Análises de Business Intelligence (Recharts)

// Gráfico 1: Teor de Betume por Obra/Estaca (Linha de Limites)
export const graficoBetume = [
  { name: 'Estaca 10', valor: 4.8, limiteInf: 4.5, limiteSup: 5.5, projeto: 5.0 },
  { name: 'Estaca 15', valor: 5.1, limiteInf: 4.5, limiteSup: 5.5, projeto: 5.0 },
  { name: 'Estaca 20', valor: 5.6, limiteInf: 4.5, limiteSup: 5.5, projeto: 5.0 }, // Rompeu o limite superior!
  { name: 'Estaca 25', valor: 5.3, limiteInf: 4.5, limiteSup: 5.5, projeto: 5.0 },
  { name: 'Estaca 30', valor: 5.0, limiteInf: 4.5, limiteSup: 5.5, projeto: 5.0 },
  { name: 'Estaca 35', valor: 4.9, limiteInf: 4.5, limiteSup: 5.5, projeto: 5.0 },
];

// Gráfico 2: Granulometria - Curva DNIT Faixa C
export const graficoGranulometria = [
  { peneira: '1"', minFaixaC: 100, maxFaixaC: 100, ensaio: 100 },
  { peneira: '3/4"', minFaixaC: 75, maxFaixaC: 100, ensaio: 88 },
  { peneira: '1/2"', minFaixaC: 60, maxFaixaC: 90, ensaio: 72 },
  { peneira: '3/8"', minFaixaC: 45, maxFaixaC: 75, ensaio: 58 },
  { peneira: 'N° 4', minFaixaC: 30, maxFaixaC: 55, ensaio: 44 },
  { peneira: 'N° 10', minFaixaC: 22, maxFaixaC: 40, ensaio: 31 },
  { peneira: 'N° 40', minFaixaC: 8, maxFaixaC: 22, ensaio: 15 },
  { peneira: 'N° 200', minFaixaC: 3, maxFaixaC: 8, ensaio: 5 },
];

// Gráfico 3: Equivalente de Areia Histórico Diário (Barras)
export const graficoEquivalenteAreia = [
  { dia: 'Seg', media: 62, minimoNorma: 55 },
  { dia: 'Ter', media: 58, minimoNorma: 55 },
  { dia: 'Qua', media: 54, minimoNorma: 55 }, // Reprovado abaixo de 55
  { dia: 'Qui', media: 68, minimoNorma: 55 },
  { dia: 'Sex', media: 71, minimoNorma: 55 },
];

export const ensaiosRealizados = [
  { id: 101, laboratorista: "João Silva", obra: "Rodovia Castelo Branco", ensaio: "Grau de Compactação", resultado: "Aprovado", dadosNorma: "GC: 100.2% | DNER 043/95" },
  { id: 102, laboratorista: "Carlos Souza", obra: "Rodoanel Norte", ensaio: "Teor de Betume", resultado: "Aprovado", dadosNorma: "Teor: 5.1% | Desvio: +0.1%" },
  { id: 103, laboratorista: "Ana Beatriz", obra: "BR-116 Ampliação", ensaio: "Granulometria", resultado: "Aprovado", dadosNorma: "Curva contínua dentro da Faixa C do DNIT" },
  { id: 104, laboratorista: "Marcos Lima", obra: "BR-116 Ampliação", ensaio: "Equivalente de Areia", resultado: "Reprovado", dadosNorma: "EA: 52% | Exigido: ≥ 55% | DNER-ME 054/97" },
];
