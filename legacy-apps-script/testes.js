/**
 * CORRIGE OS NOMES NA ABA "CHAMADOS" USANDO A LISTA PADRONIZADA
 * Substitui cada nome da coluna "Unidade" pelo nome padronizado correspondente.
 */
function corrigirNomesChamados() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Chamados');
  if (!sheet) {
    Logger.log('❌ Aba "Chamados" não encontrada.');
    return;
  }
const LISTA_ESCOLAS_TECNICOS = [
  { escola: "E.E. ADHEMAR ANTONIO PRADO", tecnico: "GUILHERME" },
  { escola: "E.E. ALCIDES BOSCOLO", tecnico: "JOÃO" },
  { escola: "E.E. ANDRÉ NUNES JUNIOR", tecnico: "CHARLES" },
  { escola: "E.E. ANTONIETA DE SOUZA ALCÂNTARA  / CHARLOTTE MARIA SHAW MASON", tecnico: "CHARLES" },
  { escola: "E.E. AQUILINO RIBEIRO  / MARIA TEREZA SIMÕES DE ALMEIDA PROFESSORA", tecnico: "VALDEIR" },
  { escola: "E.E. ANÍSIO TEIXEIRA", tecnico: "CAROL" },
  { escola: "E.E. ANTONIO CARLOS BRASILEIRO DE ALMEIDA JOBIM - TOM JOBIM", tecnico: "CHARLES" },
  { escola: "E.E. BARRO BRANCO II / LEÔNIDAS DA SILVA", tecnico: "HEBERT" },
  { escola: "E.E. BELIZE / BENJAMIN SAMUEL BLOOM", tecnico: "VALDEIR" },
  { escola: "E.E. BERNADIM RIBEIRO", tecnico: "VALDEIR" },
  { escola: "E.E. BRENO ROSSI, MAESTRO", tecnico: "HEBERT" },
  { escola: "E.E. CÂNDIDO PROCÓPIO F. CAMARGO", tecnico: "HEBERT" },
  { escola: "E.E. CARLOS HENRIQUE LIBERALLI", tecnico: "GUILHERME" },
  { escola: "E.E. CARMELINDA M. PEREIRA  / LIMA BARRETO", tecnico: "JOÃO" },
  { escola: "E.E. CESAR DONATO CALABREZ /LEILA DINIZ", tecnico: "JOSEMIR" },
  { escola: "E.E. CLAUDIA DUTRA VIANA / ROSA PARKS", tecnico: "CHARLES" },
  { escola: "E.E. COHAB CARRÃOZINHO", tecnico: "HEBERT" },
  { escola: "E.E. COHAB ITAQUERA IV", tecnico: "FABIO" },
  { escola: "E.E. DÉCIO FERRAZ ALVIM / FLORIANO PEIXOTO", tecnico: "CHARLES" },
  { escola: "E.E. ERNESTINA DEL B. TRAMA", tecnico: "CAROL" },
  { escola: "E.E. ESTHER FIGUEIREDO FERRAZ", tecnico: "GUILHERME" },
  { escola: "E.E. FABIO AGAZZI", tecnico: "JOSEMIR" },
  { escola: "E.E. FADLO HAIDAR", tecnico: "FABIO" },
  { escola: "E.E. FERNANDO MAURO P. ROCHA, DEPUTADO", tecnico: "JOÃO" },
  { escola: "E.E. FERNANDO PESSOA", tecnico: "JOÃO" },
  { escola: "E.E. FRANCISCO DE ASSIS P. CORRÊA", tecnico: "CAROL" },
  { escola: "E.E. FREDERICO MARIANO", tecnico: "JOSEMIR" },
  { escola: "E.E. GERALDINO DOS SANTOS, DEPUTADO  / JOSUÉ DE CASTRO", tecnico: "HEBERT" },
  { escola: "E.E. GUERRA JUNQUEIRO", tecnico: "CHARLES" },
  { escola: "E.E. HAYDEÉ HIDALGO", tecnico: "CAROL" },
  { escola: "E.E. HUMBERTO BAPTISTELLI", tecnico: "JOÃO" },
  { escola: "E.E. HUMBERTO DANTAS", tecnico: "JOSEMIR" },
  { escola: "E.E. INDIANA ZUYCHER S. DE JESUS", tecnico: "GUILHERME" },
  { escola: "E.E. ISAAC SCHIRAIBER", tecnico: "CHARLES" },
  { escola: "E.E. JARDIM DOM ANGÉLICO", tecnico: "CHARLES" },
  { escola: "E.E. JARDIM IGUATEMI", tecnico: "VALDEIR" },
  { escola: "E.E. JARDIM LIMOEIRO III", tecnico: "JOÃO" },
  { escola: "E.E. JARDIM PEDRA BRANCA / PATRÍCIA GALVÃO - PAGU", tecnico: "VALDEIR" },
  { escola: "E.E. JARDIM WILMA FLOR", tecnico: "VALDEIR" },
  { escola: "E.E. JOÃO CASTELLANO", tecnico: "CAROL" },
  { escola: "E.E. JOAQUIM SILVÉRIO G. DOS REIS", tecnico: "GUILHERME" },
  { escola: "E.E. JORGE LUIS BORGES", tecnico: "JOÃO" },
  { escola: "E.E. JUAN CARLOS ONETTI", tecnico: "CAROL" },
  { escola: "E.E. LUIS VAZ DE CAMÕES", tecnico: "GUILHERME" },
  { escola: "E.E. LUIZ ROSANOVA", tecnico: "JOSEMIR" },
  { escola: "E.E. MARCOS ANTONIO COSTA  / HERBERT JOSÉ DE SOUZA - BETINHO", tecnico: "GUILHERME" },
  { escola: "E.E. MARIA ANTONIETA FERRAZ BIBLIOTECARIA", tecnico: "HEBERT" },
  { escola: "E.E. MARIA DE LOURDES A. A. PACHECO / CHIQUINHA GONZAGA", tecnico: "CAROL" },
  { escola: "E.E. MARIUMA BUAZAR MAUAD", tecnico: "JOÃO" },
  { escola: "E.E. MOACYR AMARAL DOS SANTOS", tecnico: "HEBERT" },
  { escola: "E.E. MOZART TAVARES DE LIMA", tecnico: "CAROL" },
  { escola: "E.E. OSWALDO GAGLIARDI", tecnico: "VALDEIR" },
  { escola: "E.E. PAULO ROLIM ROSA", tecnico: "VALDEIR" },
  { escola: "E.E. PAULO SARASATE GOVERNADOR", tecnico: "JOSEMIR" },
  { escola: "E.E. PEDRO TAQUES", tecnico: "VALDEIR" },
  { escola: "E.E. RECANTO VERDE SOL  / DJANIRA", tecnico: "HEBERT" },
  { escola: "E.E. RITA PINTO DE ARAUJO", tecnico: "CHARLES" },
  { escola: "E.E. ROCCA DORDALL", tecnico: "JOSEMIR" },
  { escola: "E.E. ROQUE THEOPHILO", tecnico: "HEBERT" },
  { escola: "E.E. RUY DE MELLO JUNQUEIRA", tecnico: "JOÃO" },
  { escola: "E.E. SALIM FARAH MALUF", tecnico: "GUILHERME" },
  { escola: "E.E. SALVADOR ALLENDE GOSSENS", tecnico: "CAROL" },
  { escola: "E.E. SATURNINO PEREIRA", tecnico: "VALDEIR" },
  { escola: "E.E. SEBASTIÃO FARIAS ZIMBRES", tecnico: "JOSEMIR" },
  { escola: "E.E. SERGIO ESTANISTLAU DE CAMARGO", tecnico: "JOSEMIR" },
  { escola: "E.E. SERGIO ROCHA KIEHL", tecnico: "JOSEMIR" },
  { escola: "E.E. SILVANA EVANGELISTA", tecnico: "CHARLES" },
  { escola: "E.E. SIMÃO MATHIAS", tecnico: "JOÃO" },
  { escola: "E.E. SUMIE IWATA", tecnico: "CAROL" },
  { escola: "E.E. VILA BELA", tecnico: "HEBERT" },
  { escola: "E.E. YERVANT KISSAJIKIAN", tecnico: "GUILHERME" },
  { escola: "E.E. ZÍPORA RUBISTEIN", tecnico: "VALDEIR" }
];
  // ===== LISTA PADRONIZADA (a mesma que você usou no Forms) =====
  const NOMES_PADRONIZADOS = [
    "E.E. ADHEMAR ANTONIO PRADO",
    "E.E. ALCIDES BOSCOLO",
    "E.E. ANDRÉ NUNES JUNIOR",
    "E.E. ANTONIETA DE SOUZA ALCÂNTARA  / CHARLOTTE MARIA SHAW MASON",
    "E.E. AQUILINO RIBEIRO  / MARIA TEREZA SIMÕES DE ALMEIDA PROFESSORA",
    "E.E. ANÍSIO TEIXEIRA",
    "E.E. ANTONIO CARLOS BRASILEIRO DE ALMEIDA JOBIM - TOM JOBIM",
    "E.E. BARRO BRANCO II / LEÔNIDAS DA SILVA",
    "E.E. BELIZE / BENJAMIN SAMUEL BLOOM",
    "E.E. BERNADIM RIBEIRO",
    "E.E. BRENO ROSSI, MAESTRO",
    "E.E. CÂNDIDO PROCÓPIO F. CAMARGO",
    "E.E. CARLOS HENRIQUE LIBERALLI",
    "E.E. CARMELINDA M. PEREIRA  / LIMA BARRETO",
    "E.E. CESAR DONATO CALABREZ /LEILA DINIZ",
    "E.E. CLAUDIA DUTRA VIANA / ROSA PARKS",
    "E.E. COHAB CARRÃOZINHO",
    "E.E. COHAB ITAQUERA IV",
    "E.E. DÉCIO FERRAZ ALVIM / FLORIANO PEIXOTO",
    "E.E. ERNESTINA DEL B. TRAMA",
    "E.E. ESTHER FIGUEIREDO FERRAZ",
    "E.E. FABIO AGAZZI",
    "E.E. FADLO HAIDAR",
    "E.E. FERNANDO MAURO P. ROCHA, DEPUTADO",
    "E.E. FERNANDO PESSOA",
    "E.E. FRANCISCO DE ASSIS P. CORRÊA",
    "E.E. FREDERICO MARIANO",
    "E.E. GERALDINO DOS SANTOS, DEPUTADO  / JOSUÉ DE CASTRO",
    "E.E. GUERRA JUNQUEIRO",
    "E.E. HAYDEÉ HIDALGO",
    "E.E. HUMBERTO BAPTISTELLI",
    "E.E. HUMBERTO DANTAS",
    "E.E. INDIANA ZUYCHER S. DE JESUS",
    "E.E. ISAAC SCHIRAIBER",
    "E.E. JARDIM DOM ANGÉLICO",
    "E.E. JARDIM IGUATEMI",
    "E.E. JARDIM LIMOEIRO III",
    "E.E. JARDIM PEDRA BRANCA / PATRÍCIA GALVÃO - PAGU",
    "E.E. JARDIM WILMA FLOR",
    "E.E. JOÃO CASTELLANO",
    "E.E. JOAQUIM SILVÉRIO G. DOS REIS",
    "E.E. JORGE LUIS BORGES",
    "E.E. JUAN CARLOS ONETTI",
    "E.E. LUIS VAZ DE CAMÕES",
    "E.E. LUIZ ROSANOVA",
    "E.E. MARCOS ANTONIO COSTA  / HERBERT JOSÉ DE SOUZA - BETINHO",
    "E.E. MARIA ANTONIETA FERRAZ BIBLIOTECARIA",
    "E.E. MARIA DE LOURDES A. A. PACHECO / CHIQUINHA GONZAGA",
    "E.E. MARIUMA BUAZAR MAUAD",
    "E.E. MOACYR AMARAL DOS SANTOS",
    "E.E. MOZART TAVARES DE LIMA",
    "E.E. OSWALDO GAGLIARDI",
    "E.E. PAULO ROLIM ROSA",
    "E.E. PAULO SARASATE GOVERNADOR",
    "E.E. PEDRO TAQUES",
    "E.E. RECANTO VERDE SOL  / DJANIRA",
    "E.E. RITA PINTO DE ARAUJO",
    "E.E. ROCCA DORDALL",
    "E.E. ROQUE THEOPHILO",
    "E.E. RUY DE MELLO JUNQUEIRA",
    "E.E. SALIM FARAH MALUF",
    "E.E. SALVADOR ALLENDE GOSSENS",
    "E.E. SATURNINO PEREIRA",
    "E.E. SEBASTIÃO FARIAS ZIMBRES",
    "E.E. SERGIO ESTANISTLAU DE CAMARGO",
    "E.E. SERGIO ROCHA KIEHL",
    "E.E. SILVANA EVANGELISTA",
    "E.E. SIMÃO MATHIAS",
    "E.E. SUMIE IWATA",
    "E.E. VILA BELA",
    "E.E. YERVANT KISSAJIKIAN",
    "E.E. ZÍPORA RUBISTEIN"
  ];

  // ===== FUNÇÃO DE NORMALIZAÇÃO =====
  function normalizar(texto) {
    return String(texto || '')
      .toUpperCase()
      .replace(/^E\.?E\.?\s*/i, '') // remove E.E.
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
      .replace(/[^A-Z0-9 ]/g, ' ') // pontuação vira espaço
      .replace(/\s+/g, ' ') // espaços múltiplos
      .trim();
  }

  // ===== PREPARA MAPA PARA CORRESPONDÊNCIA =====
  // Mapa: normalizado -> nome padronizado
  const mapaCorrespondencia = {};
  NOMES_PADRONIZADOS.forEach(nome => {
    const chave = normalizar(nome);
    if (!mapaCorrespondencia[chave]) {
      mapaCorrespondencia[chave] = nome;
    }
  });

  // ===== PROCESSAR ABA CHAMADOS =====
  const dados = sheet.getDataRange().getValues();
  const cabecalho = dados[0];
  const idxUnidade = cabecalho.indexOf('Unidade');
  if (idxUnidade === -1) {
    Logger.log('❌ Coluna "Unidade" não encontrada em Chamados.');
    return;
  }

  let atualizados = 0;
  let naoEncontrados = 0;
  const naoEncontradosLista = [];

  for (let i = 1; i < dados.length; i++) {
    const nomeAtual = String(dados[i][idxUnidade] || '').trim();
    if (!nomeAtual) continue;

    const normalizadoAtual = normalizar(nomeAtual);
    let padronizado = null;

    // 1. Tenta correspondência exata no mapa
    if (mapaCorrespondencia[normalizadoAtual]) {
      padronizado = mapaCorrespondencia[normalizadoAtual];
    }

    // 2. Tenta correspondência por substring (contém)
    if (!padronizado) {
      for (const [chave, nome] of Object.entries(mapaCorrespondencia)) {
        if (chave.includes(normalizadoAtual) || normalizadoAtual.includes(chave)) {
          padronizado = nome;
          break;
        }
      }
    }

    // 3. Tenta pela primeira parte (antes da barra)
    if (!padronizado) {
      const primeiraParteAtual = nomeAtual.split(/[\/\-—–]/)[0].trim();
      const normalizadoPrimeiraParte = normalizar(primeiraParteAtual);
      for (const [chave, nome] of Object.entries(mapaCorrespondencia)) {
        // Verifica se a primeira parte da chave corresponde
        const primeiraParteChave = chave.split(/[\/\-—–]/)[0].trim();
        if (primeiraParteChave === normalizadoPrimeiraParte || 
            primeiraParteChave.includes(normalizadoPrimeiraParte) ||
            normalizadoPrimeiraParte.includes(primeiraParteChave)) {
          padronizado = nome;
          break;
        }
      }
    }

    if (padronizado && padronizado !== nomeAtual) {
      sheet.getRange(i + 1, idxUnidade + 1).setValue(padronizado);
      atualizados++;
    } else if (!padronizado) {
      naoEncontradosLista.push(`"${nomeAtual}" -> normalizado: "${normalizadoAtual}"`);
      naoEncontrados++;
    }
  }

  Logger.log(`✅ Atualizados: ${atualizados} | Não encontrados: ${naoEncontrados}`);
  if (naoEncontradosLista.length > 0) {
    Logger.log('=== NOMES NÃO ENCONTRADOS NA LISTA PADRONIZADA ===');
    naoEncontradosLista.forEach(item => Logger.log(item));
  }

  return `Atualizados: ${atualizados} | Não encontrados: ${naoEncontrados}`;
}

function diagnosticarNomesInventario() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetChamados = ss.getSheetByName('Chamados');
  
  // Abre a planilha de inventário pelo ID
  const ssInventario = SpreadsheetApp.openById(ID_PLANILHA_INVENTARIO);
  const sheetInventario = ssInventario.getSheetByName(ABA_INVENTARIO);

  if (!sheetChamados || !sheetInventario) {
    Logger.log('❌ Uma das abas não foi encontrada.');
    return;
  }

  // Pega todos os nomes da aba Chamados (coluna "Unidade")
  const dadosChamados = sheetChamados.getDataRange().getValues();
  const cabecalhoChamados = dadosChamados[0];
  const idxUnidade = cabecalhoChamados.indexOf('Unidade');
  if (idxUnidade === -1) {
    Logger.log('❌ Coluna "Unidade" não encontrada em Chamados.');
    return;
  }

  const nomesChamados = new Set();
  dadosChamados.slice(1).forEach(row => {
    const nome = String(row[idxUnidade] || '').trim();
    if (nome) nomesChamados.add(nome);
  });

  // Pega todos os nomes do Inventário (coluna "Escola")
  const dadosInventario = sheetInventario.getDataRange().getValues();
  const cabecalhoInventario = dadosInventario[0];
  const idxEscola = cabecalhoInventario.indexOf('Escola');
  if (idxEscola === -1) {
    Logger.log('❌ Coluna "Escola" não encontrada no Inventário.');
    return;
  }

  const nomesInventario = new Set();
  dadosInventario.slice(1).forEach(row => {
    const nome = String(row[idxEscola] || '').trim();
    if (nome) nomesInventario.add(nome);
  });

  Logger.log(`📋 Total de nomes únicos em Chamados: ${nomesChamados.size}`);
  Logger.log(`📋 Total de nomes únicos no Inventário: ${nomesInventario.size}`);

  // Verifica quais nomes de Chamados NÃO estão no Inventário
  const naoEncontrados = [];
  nomesChamados.forEach(nome => {
    if (!nomesInventario.has(nome)) {
      naoEncontrados.push(nome);
    }
  });

  if (naoEncontrados.length === 0) {
    Logger.log('✅ TODOS os nomes de Chamados estão no Inventário (exatamente iguais)!');
  } else {
    Logger.log(`❌ ${naoEncontrados.length} nomes de Chamados NÃO estão no Inventário:`);
    naoEncontrados.slice(0, 20).forEach(nome => {
      Logger.log(`  "${nome}"`);
    });
  }

  // Também mostra os primeiros 10 nomes do inventário para referência
  Logger.log('=== AMOSTRA DE NOMES DO INVENTÁRIO (primeiros 10) ===');
  const amostraInv = Array.from(nomesInventario).slice(0, 10);
  amostraInv.forEach(nome => Logger.log(`  "${nome}"`));
}
/**
 * PREENCHE O CAMPO "Técnico Resolução" NOS CHAMADOS RESOLVIDOS QUE ESTÃO VAZIOS.
 * Utiliza o técnico do setor (mapeamento escola → técnico) para preencher.
 * NÃO SOBRESCREVE os campos já preenchidos manualmente.
 * 
 * Execute manualmente no editor de scripts ou agende como trigger.
 * @returns {string} Mensagem com a quantidade de chamados atualizados.
 */
function preencherTecnicoResolucaoFaltantes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Chamados');
  if (!sheet) {
    Logger.log('❌ Aba "Chamados" não encontrada.');
    return '❌ Aba "Chamados" não encontrada.';
  }

  const dados = sheet.getDataRange().getValues();
  if (dados.length < 2) {
    Logger.log('Nenhum dado na planilha.');
    return 'Nenhum dado na planilha.';
  }

  const cabecalho = dados[0];
  const idxStatus = cabecalho.indexOf('Status');
  const idxTecnicoResolucao = cabecalho.indexOf('Técnico Resolução');
  const idxUnidade = cabecalho.indexOf('Unidade');

  if (idxStatus === -1 || idxTecnicoResolucao === -1 || idxUnidade === -1) {
    Logger.log('❌ Colunas necessárias não encontradas.');
    return '❌ Colunas necessárias não encontradas.';
  }

  // ===== CONSTRÓI O MAPA DE TÉCNICOS POR ESCOLA =====
  // Usa a mesma lista que você já tem no backend (LISTA_ESCOLAS_TECNICOS)
  // Se você não tiver essa lista definida globalmente, defina-a aqui.
  // Caso já exista, basta usar diretamente.
  const mapaTecnicos = {};
  if (typeof LISTA_ESCOLAS_TECNICOS !== 'undefined') {
    LISTA_ESCOLAS_TECNICOS.forEach(item => {
      const chave = normalizarNomeEscola(item.escola);
      if (chave) {
        mapaTecnicos[chave] = item.tecnico;
      }
    });
  } else {
    // Fallback: se a lista não estiver disponível, usa uma lista fixa básica.
    // Você pode copiar a LISTA_ESCOLAS_TECNICOS aqui ou ajustar.
    Logger.log('⚠️ LISTA_ESCOLAS_TECNICOS não encontrada. Usando fallback vazio.');
    // Se necessário, defina um fallback aqui.
  }

  let atualizados = 0;
  let ignoradosJaPreenchidos = 0;
  let semTecnico = 0;

  for (let i = 1; i < dados.length; i++) {
    const status = dados[i][idxStatus];
    const tecResolucao = dados[i][idxTecnicoResolucao];
    const unidade = dados[i][idxUnidade];

    // Pula se não for Resolvido
    if (status !== 'Resolvido') continue;

    // Se já tem técnico de resolução preenchido, ignora (não sobrescreve)
    if (tecResolucao && tecResolucao.trim() !== '') {
      ignoradosJaPreenchidos++;
      continue;
    }

    // Busca o técnico do setor para a unidade
    const escolaNormalizada = normalizarNomeEscola(unidade);
    const tecnico = mapaTecnicos[escolaNormalizada];

    if (tecnico) {
      sheet.getRange(i + 1, idxTecnicoResolucao + 1).setValue(tecnico);
      atualizados++;
    } else {
      semTecnico++;
      Logger.log(`⚠️ Escola sem técnico mapeado: "${unidade}" (normalizado: "${escolaNormalizada}")`);
    }
  }

  const msg = `✅ Atualizados: ${atualizados} chamados.
  ⏭️ Já preenchidos (ignorados): ${ignoradosJaPreenchidos}.
  ⚠️ Sem técnico mapeado: ${semTecnico}.`;

  Logger.log(msg);
  return msg;
}