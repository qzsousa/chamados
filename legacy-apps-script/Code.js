// ==================== CONFIGURAÇÃO ====================
const SHEET_CHAMADOS = 'Chamados';
const EMAIL_RESPONSAVEIS = ['responsavel1@ureleste3.sp.gov.br']; // ajustar
const URGENCIA_ALTA = 'Alta (impactando funcionamento da escola)';
const TECNICOS = ['CAROL', 'CHARLES', 'FABIO', 'GUILHERME', 'HEBERT', 'JOSEMIR', 'JOÃO', 'VALDEIR'];

// Planilha externa de inventário
const ID_PLANILHA_INVENTARIO = '1HyfNcETaINc0ZKcvM0pUPqlv94gwkNlYlwIpvCBxV8o';
const ABA_INVENTARIO = 'Base de Dados';
const ABA_EQUIPAMENTOS = 'Equipamentos';

// ==================== LISTA PADRONIZADA DE ESCOLAS (FORMS) ====================
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

// ==================== MAPEAMENTO ESCOLA → TÉCNICO (atualizado) ====================
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

// ==================== E-MAILS DE CONTATO POR ESCOLA ====================
// Cada escola possui um e-mail fixo de contato.
// Escolas que dividem o mesmo prédio (nome separado por "/") têm e-mails
// próprios: cadastre cada escola de forma individual (a resolução trata o
// nome composto automaticamente, retornando os dois e-mails com identificação).
//
// Formato: 'NOME DA ESCOLA (individual)': 'email@educacao.sp.gov.br'
const LISTA_ESCOLAS_EMAILS = {
  'E.E. ADHEMAR ANTONIO PRADO': 'e003244a@educacao.sp.gov.br',
  'E.E. ALCIDES BOSCOLO': 'e003177a@educacao.sp.gov.br',
  'E.E. ANDRÉ NUNES JUNIOR': 'e003311a@educacao.sp.gov.br',
  'E.E. ANÍSIO TEIXEIRA': 'e037047a@educacao.sp.gov.br',
  'E.E. ANTONIETA DE SOUZA ALCÂNTARA': 'e902615a@educacao.sp.gov.br',
  'E.E. ANTONIO CARLOS BRASILEIRO DE ALMEIDA JOBIM - TOM JOBIM': 'e352573a@educacao.sp.gov.br',
  'E.E. AQUILINO RIBEIRO': 'e904302a@educacao.sp.gov.br',
  'E.E. BARRO BRANCO II': 'e926048a@educacao.sp.gov.br',
  'E.E. BELIZE': 'e284324a@educacao.sp.gov.br',
  'E.E. BENJAMIN SAMUEL BLOOM': 'e011788a@educacao.sp.gov.br',
  'E.E. BERNADIM RIBEIRO': 'e906189a@educacao.sp.gov.br',
  'E.E. BRENO ROSSI, MAESTRO': 'e916730a@educacao.sp.gov.br',
  'E.E. CÂNDIDO PROCÓPIO F. CAMARGO': 'e904922a@educacao.sp.gov.br',
  'E.E. CARLOS HENRIQUE LIBERALLI': 'e039251a@educacao.sp.gov.br',
  'E.E. CARMELINDA M. PEREIRA': 'e909166a@educacao.sp.gov.br',
  'E.E. CESAR DONATO CALABREZ': 'e902627a@educacao.sp.gov.br',
  'E.E. CHARLOTTE MARIA SHAW MASON': 'e011791a@educacao.sp.gov.br',
  'E.E. CHIQUINHA GONZAGA': 'e011795a@educacao.sp.gov.br',
  'E.E. CLAUDIA DUTRA VIANA': 'e438112a@educacao.sp.gov.br',
  'E.E. COHAB CARRÃOZINHO': 'e921464a@educacao.sp.gov.br',
  'E.E. COHAB ITAQUERA IV': 'e916766a@educacao.sp.gov.br',
  'E.E. DÉCIO FERRAZ ALVIM': 'e003128a@educacao.sp.gov.br',
  'E.E. DJANIRA': 'e011787a@educacao.sp.gov.br',
  'E.E. ERNESTINA DEL B. TRAMA': 'e037084a@educacao.sp.gov.br',
  'E.E. ESTHER FIGUEIREDO FERRAZ': 'e925226a@educacao.sp.gov.br',
  'E.E. FABIO AGAZZI': 'e907029a@educacao.sp.gov.br',
  'E.E. FADLO HAIDAR': 'e044337a@educacao.sp.gov.br',
  'E.E. FERNANDO MAURO P. ROCHA, DEPUTADO': 'e902724a@educacao.sp.gov.br',
  'E.E. FERNANDO PESSOA': 'e904284a@educacao.sp.gov.br',
  'E.E. FLORIANO PEIXOTO': 'e011786a@educacao.sp.gov.br',
  'E.E. FRANCISCO DE ASSIS P. CORRÊA': 'e043746a@educacao.sp.gov.br',
  'E.E. FREDERICO MARIANO': 'e048707a@educacao.sp.gov.br',
  'E.E. GERALDINO DOS SANTOS, DEPUTADO': 'e910831a@educacao.sp.gov.br',
  'E.E. GUERRA JUNQUEIRO': 'e904314a@educacao.sp.gov.br',
  'E.E. HAYDEÉ HIDALGO': 'e922146a@educacao.sp.gov.br',
  'E.E. HERBERT JOSÉ DE SOUZA - BETINHO': 'e011798a@educacao.sp.gov.br',
  'E.E. HUMBERTO BAPTISTELLI': 'e447663a@educacao.sp.gov.br',
  'E.E. HUMBERTO DANTAS': 'e037059a@educacao.sp.gov.br',
  'E.E. INDIANA ZUYCHER S. DE JESUS': 'e048677a@educacao.sp.gov.br',
  'E.E. ISAAC SCHIRAIBER': 'e909117a@educacao.sp.gov.br',
  'E.E. JARDIM DOM ANGÉLICO': 'e267971a@educacao.sp.gov.br',
  'E.E. JARDIM IGUATEMI': 'e923266a@educacao.sp.gov.br',
  'E.E. JARDIM LIMOEIRO III': 'e925412a@educacao.sp.gov.br',
  'E.E. JARDIM PEDRA BRANCA': 'e433482a@educacao.sp.gov.br',
  'E.E. JARDIM WILMA FLOR': 'e922900a@educacao.sp.gov.br',
  'E.E. JOÃO CASTELLANO': 'e902718a@educacao.sp.gov.br',
  'E.E. JOAQUIM SILVÉRIO G. DOS REIS': 'e048665a@educacao.sp.gov.br',
  'E.E. JORGE LUIS BORGES': 'e907017a@educacao.sp.gov.br',
  'E.E. JOSUÉ DE CASTRO': 'e011797a@educacao.sp.gov.br',
  'E.E. JUAN CARLOS ONETTI': 'e412173a@educacao.sp.gov.br',
  'E.E. LEILA DINIZ': 'e011792a@educacao.sp.gov.br',
  'E.E. LEÔNIDAS DA SILVA': 'e011799a@educacao.sp.gov.br',
  'E.E. LIMA BARRETO': 'e011796a@educacao.sp.gov.br',
  'E.E. LUIS VAZ DE CAMÕES': 'e902883a@educacao.sp.gov.br',
  'E.E. LUIZ ROSANOVA': 'e003141a@educacao.sp.gov.br',
  'E.E. MARCOS ANTONIO COSTA': 'e923916a@educacao.sp.gov.br',
  'E.E. MARIA ANTONIETA FERRAZ BIBLIOTECARIA': 'e904582a@educacao.sp.gov.br',
  'E.E. MARIA DE LOURDES A. A. PACHECO': 'e906980a@educacao.sp.gov.br',
  'E.E. MARIA TEREZA SIMÕES DE ALMEIDA PROFESSORA': 'e011793a@educacao.sp.gov.br',
  'E.E. MARIUMA BUAZAR MAUAD': 'e904296a@educacao.sp.gov.br',
  'E.E. MOACYR AMARAL DOS SANTOS': 'e048653a@educacao.sp.gov.br',
  'E.E. MOZART TAVARES DE LIMA': 'e036961a@educacao.sp.gov.br',
  'E.E. OSWALDO GAGLIARDI': 'e908368a@educacao.sp.gov.br',
  'E.E. PATRÍCIA GALVÃO - PAGU': 'e011789a@educacao.sp.gov.br',
  'E.E. PAULO ROLIM ROSA': 'e922912a@educacao.sp.gov.br',
  'E.E. PAULO SARASATE GOVERNADOR': 'e036812a@educacao.sp.gov.br',
  'E.E. PEDRO TAQUES': 'e003256a@educacao.sp.gov.br',
  'E.E. RECANTO VERDE SOL': 'e267983a@educacao.sp.gov.br',
  'E.E. RITA PINTO DE ARAUJO': 'e003323a@educacao.sp.gov.br',
  'E.E. ROCCA DORDALL': 'e037060a@educacao.sp.gov.br',
  'E.E. ROQUE THEOPHILO': 'e268276a@educacao.sp.gov.br',
  'E.E. ROSA PARKS': 'e011790a@educacao.sp.gov.br',
  'E.E. RUY DE MELLO JUNQUEIRA': 'e920277a@educacao.sp.gov.br',
  'E.E. SALIM FARAH MALUF': 'e044325a@educacao.sp.gov.br',
  'E.E. SALVADOR ALLENDE GOSSENS': 'e906967a@educacao.sp.gov.br',
  'E.E. SATURNINO PEREIRA': 'e909185a@educacao.sp.gov.br',
  'E.E. SEBASTIÃO FARIAS ZIMBRES': 'e003268a@educacao.sp.gov.br',
  'E.E. SERGIO ESTANISTLAU DE CAMARGO': 'e914712a@educacao.sp.gov.br',
  'E.E. SERGIO ROCHA KIEHL': 'e916785a@educacao.sp.gov.br',
  'E.E. SILVANA EVANGELISTA': 'e923278a@educacao.sp.gov.br',
  'E.E. SIMÃO MATHIAS': 'e916742a@educacao.sp.gov.br',
  'E.E. SUMIE IWATA': 'e909129a@educacao.sp.gov.br',
  'E.E. VILA BELA': 'e923047a@educacao.sp.gov.br',
  'E.E. YERVANT KISSAJIKIAN': 'e906207a@educacao.sp.gov.br',
  'E.E. ZÍPORA RUBISTEIN': 'e914721a@educacao.sp.gov.br'
};

// ==================== ROTEAMENTO ====================
function doGet(e) {
  const pagina = e.parameter.pagina
  const token = e.parameter.token || '';

  // URL antiga do forms: exibe aviso de redirecionamento para o novo endereço
  if (pagina === 'forms'){
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Atende Leste 3 — Novo endereço')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  if (pagina === 'filtrado' && token) {
    const sessao = validarSessao(token);
    if (sessao && sessao.valido) {
      try {
        const template = HtmlService.createTemplateFromFile('DashboardFiltrado');
        return template.evaluate()
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
          .setTitle('Painel de Chamados - URE Leste 3')
          .addMetaTag('viewport', 'width=device-width, initial-scale=1');
      } catch (e) {
        Logger.log('❌ Erro ao carregar DashboardFiltrado: ' + e.message);
        return HtmlService.createHtmlOutput('<h1>Erro</h1><p>' + e.message + '</p>');
      }
    }
  }

  // Padrão: Matriz (sem login)
  if (pagina === 'matriz'){
  const template = HtmlService.createTemplateFromFile('DashboardMatriz_v2');
  return template.evaluate()
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setTitle('Chamados - Painel de Gestão v2')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
    const template = HtmlService.createTemplateFromFile('Login');
    return template.evaluate()
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .setTitle('Login - Sistema de Chamados')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ==================== TRIGGER ====================
function onFormSubmit(e) {
  const sheetChamados = getOrCreateSheetChamados();

  const respostas = {};
  e.response.getItemResponses().forEach(item => {
    respostas[item.getItem().getTitle()] = item.getResponse();
  });

  const timestamp = new Date();
  const protocolo = gerarProtocolo(sheetChamados);

  sheetChamados.appendRow([
    protocolo,
    timestamp,
    (respostas['UNIDADE ESCOLAR'] || '').trim(),
    (respostas['Nome do solicitante'] || '').trim(),
    respostas['2- Função'] || '',
    (respostas['Tipo de Solicitação'] || '').trim(),
    respostas['Descrição do Problema'] || '',
    respostas['Urgência'] || '',
    respostas['Anexos.  \nFotos ou prints do problema.'] || '',
    'Aberto',
    '',
    timestamp,
    ''
  ]);

  if (respostas['Urgência'] === URGENCIA_ALTA) {
    notificarAltaPrioridade(protocolo, respostas);
  }
}

function getOrCreateSheetChamados() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_CHAMADOS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_CHAMADOS);
    sheet.appendRow([
      'ID', 'Timestamp', 'Unidade', 'Solicitante', 'Função', 'Tipo',
      'Descrição', 'Urgência', 'Anexo', 'Status', 'Responsável',
      'Última Atualização', 'Histórico', 'Técnico Resolução', 'Email'
    ]);
    sheet.setFrozenRows(1);
  }
  garantirColunaTecnicoResolucao(sheet);
  garantirColunaEmail(sheet);
  return sheet;
}

function garantirColunaEmail(sheet) {
  const ultimaColuna = sheet.getLastColumn();
  const header = sheet.getRange(1, 1, 1, ultimaColuna).getValues()[0];
  if (header.indexOf('Email') === -1) {
    sheet.getRange(1, ultimaColuna + 1).setValue('Email');
  }
}

function garantirColunaTecnicoResolucao(sheet) {
  const ultimaColuna = sheet.getLastColumn();
  const header = sheet.getRange(1, 1, 1, ultimaColuna).getValues()[0];
  if (header.indexOf('Técnico Resolução') === -1) {
    sheet.getRange(1, ultimaColuna + 1).setValue('Técnico Resolução');
  }
}

// ==================== NORMALIZAÇÃO ====================
function normalizarNomeEscola(nome) {
  return String(nome || '')
    .toUpperCase()
    .replace(/^E\.?E\.?\s*/i, '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizarTexto(texto) {
  return String(texto || '')
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getMapaTecnicos() {
  const mapa = {};
  LISTA_ESCOLAS_TECNICOS.forEach(item => {
    const chave = normalizarNomeEscola(item.escola);
    if (chave) {
      mapa[chave] = item.tecnico;
      // Adiciona variações sem sufixos comuns
      const semSufixo = chave
        .replace(/\s+(PROFESSOR|PROFESSORA|DEPUTADO|GOVERNADOR|PRESIDENTE|MAESTRO|DOUTOR|BIBLIOTECARIA|ESCRITOR|PROF|PROFESSOR(A)?)$/i, '')
        .trim();
      if (semSufixo && semSufixo !== chave) mapa[semSufixo] = item.tecnico;
    }
  });
  return mapa;
}

function getTecnicos() {
  return TECNICOS;
}

function getMapaEmails() {
  const mapa = {};
  Object.keys(LISTA_ESCOLAS_EMAILS).forEach(escola => {
    const email = LISTA_ESCOLAS_EMAILS[escola];
    const chave = normalizarNomeEscola(escola);
    if (chave && email) mapa[chave] = { nome: escola, email: email };
  });
  return mapa;
}

/**
 * Retorna a lista de e-mails de contato de uma escola.
 * Escolas com nome composto (separadas por "/") retornam um e-mail por escola,
 * cada um com seu nome de identificação.
 * @param {string} escola - Nome da escola (como aparece no chamado).
 * @returns {Array<{nome:string, email:string}>}
 */
function getEmailsContato(escola) {
  const nome = String(escola || '').trim();
  if (!nome) return [];
  const mapa = getMapaEmails();

  const chave = normalizarNomeEscola(nome);
  if (mapa[chave]) return [mapa[chave]];

  if (nome.includes('/')) {
    const resultado = [];
    nome.split('/').forEach(parte => {
      const p = parte.trim();
      if (!p) return;
      const pChave = normalizarNomeEscola(p);
      if (mapa[pChave]) resultado.push(mapa[pChave]);
    });
    return resultado;
  }

  return [];
}

function gerarProtocolo(sheet) {
  const hoje = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  const lastRow = sheet.getLastRow();
  let seq = 1;
  if (lastRow > 1) {
    const protocolos = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
    seq = protocolos.filter(p => String(p).includes(hoje)).length + 1;
  }
  return `CH-${hoje}-${String(seq).padStart(4, '0')}`;
}

function notificarAltaPrioridade(protocolo, respostas) {
  const unidade = respostas['UNIDADE ESCOLAR'] || '-';
  const solicitante = respostas['Nome do solicitante'] || '-';
  const funcao = respostas['2- Função'] || '-';
  const tipo = respostas['Tipo de Solicitação'] || '-';
  const descricao = respostas['Descrição do Problema'] || '-';

  const assunto = `Novo chamado de alta prioridade — ${protocolo} (${unidade})`;
  const textoAlternativo = `Novo chamado de alta prioridade aberto.\n\nProtocolo: ${protocolo}\nUnidade: ${unidade}\nSolicitante: ${solicitante} (${funcao})\nTipo: ${tipo}\nDescrição: ${descricao}`;

  const corpoHtml = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 28px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
      <div style="display: inline-block; background: #fef2f2; color: #b91c1c; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 20px; margin-bottom: 14px;">Alta prioridade</div>
      <h2 style="font-size: 18px; color: #111827; margin: 0 0 4px;">Novo chamado aberto</h2>
      <p style="font-family: 'Courier New', monospace; font-size: 13px; color: #6b7280; margin: 0 0 20px;">${protocolo}</p>
      <table style="width: 100%; font-size: 14px; color: #374151; border-collapse: collapse;">
        <tr><td style="padding: 6px 0; color: #9ca3af; width: 110px;">Unidade</td><td style="padding: 6px 0;">${unidade}</td></tr>
        <tr><td style="padding: 6px 0; color: #9ca3af;">Solicitante</td><td style="padding: 6px 0;">${solicitante} (${funcao})</td></tr>
        <tr><td style="padding: 6px 0; color: #9ca3af;">Tipo</td><td style="padding: 6px 0;">${tipo}</td></tr>
        <tr><td style="padding: 6px 0; color: #9ca3af; vertical-align: top;">Descrição</td><td style="padding: 6px 0;">${descricao}</td></tr>
      </table>
      <p style="font-size: 12.5px; color: #9ca3af; margin-top: 22px;">Acesse o sistema para tratar este chamado.</p>
    </div>`;

  EMAIL_RESPONSAVEIS.forEach(email => {
    MailApp.sendEmail({ to: email, subject: assunto, body: textoAlternativo, htmlBody: corpoHtml, name: 'Sistema de Chamados — URE Leste 3' });
  });
}

// ==================== CORRIGIR NOMES NA ABA CHAMADOS ====================
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

  function normalizar(texto) {
    return String(texto || '')
      .toUpperCase()
      .replace(/^E\.?E\.?\s*/i, '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Mapa: normalizado -> nome padronizado
  const mapaCorrespondencia = {};
  NOMES_PADRONIZADOS.forEach(nome => {
    const chave = normalizar(nome);
    if (!mapaCorrespondencia[chave]) {
      mapaCorrespondencia[chave] = nome;
    }
  });

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

    // 1. Correspondência exata
    if (mapaCorrespondencia[normalizadoAtual]) {
      padronizado = mapaCorrespondencia[normalizadoAtual];
    }

    // 2. Substring
    if (!padronizado) {
      for (const [chave, nome] of Object.entries(mapaCorrespondencia)) {
        if (chave.includes(normalizadoAtual) || normalizadoAtual.includes(chave)) {
          padronizado = nome;
          break;
        }
      }
    }

    // 3. Primeira parte (antes da barra)
    if (!padronizado) {
      const primeiraParteAtual = nomeAtual.split(/[\/\-—–]/)[0].trim();
      const normalizadoPrimeiraParte = normalizar(primeiraParteAtual);
      for (const [chave, nome] of Object.entries(mapaCorrespondencia)) {
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

// ==================== MIGRAÇÃO DEFINITIVA (COM VERIFICAÇÃO DE DUPLICATAS) ====================
/**
 * Migra chamados da aba "Respostas ao formulário 1" para a aba "Chamados".
 * Adiciona uma coluna "Migrado" na aba de respostas e processa apenas linhas não migradas.
 * ANTES DE INSERIR, verifica se o chamado já existe na aba "Chamados" (por conteúdo).
 * Se existir, pula a inserção e marca como migrado.
 */
function migrarRespostasExistentes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetRespostas = ss.getSheetByName('Respostas ao formulário 1');
  const sheetChamados = getOrCreateSheetChamados();

  if (!sheetRespostas) {
    Logger.log('❌ Aba "Respostas ao formulário 1" não encontrada.');
    return;
  }

  // ===== 1. GARANTIR COLUNA "MIGRADO" NA ABA DE RESPOSTAS =====
  garantirColunaMigrado(sheetRespostas);

  // ===== 2. CARREGAR DADOS =====
  const dadosRespostas = sheetRespostas.getDataRange().getValues();
  const cabecalhoRespostas = dadosRespostas[0];
  const linhas = dadosRespostas.slice(1);

  const idx = {
    timestamp: cabecalhoRespostas.indexOf('Carimbo de data/hora'),
    unidade: cabecalhoRespostas.indexOf('UNIDADE ESCOLAR'),
    solicitante: cabecalhoRespostas.indexOf('Nome do solicitante'),
    funcao: cabecalhoRespostas.indexOf('2- Função'),
    tipo: cabecalhoRespostas.indexOf('Tipo de Solicitação'),
    descricao: cabecalhoRespostas.indexOf('Descrição do Problema'),
    urgencia: cabecalhoRespostas.indexOf('Urgência'),
    anexo: cabecalhoRespostas.indexOf('Anexos.  \nFotos ou prints do problema.'),
    migrado: cabecalhoRespostas.indexOf('Migrado')
  };

  // ===== 3. CARREGAR TODOS OS CHAMADOS EXISTENTES (para verificar duplicatas) =====
  const dadosChamados = sheetChamados.getDataRange().getValues();
  const cabecalhoChamados = dadosChamados[0];
  const idxChamados = {
    id: cabecalhoChamados.indexOf('ID'),
    timestamp: cabecalhoChamados.indexOf('Timestamp'),
    unidade: cabecalhoChamados.indexOf('Unidade'),
    solicitante: cabecalhoChamados.indexOf('Solicitante'),
    funcao: cabecalhoChamados.indexOf('Função'),
    tipo: cabecalhoChamados.indexOf('Tipo'),
    descricao: cabecalhoChamados.indexOf('Descrição'),
    urgencia: cabecalhoChamados.indexOf('Urgência'),
    anexo: cabecalhoChamados.indexOf('Anexo'),
    status: cabecalhoChamados.indexOf('Status'),
    responsavel: cabecalhoChamados.indexOf('Responsável'),
    ultimaAtualizacao: cabecalhoChamados.indexOf('Última Atualização'),
    historico: cabecalhoChamados.indexOf('Histórico'),
    tecnicoResolucao: cabecalhoChamados.indexOf('Técnico Resolução')
  };

  // Cria um Set com chaves normalizadas de TODOS os chamados existentes
  const chavesExistentes = new Set();
  dadosChamados.slice(1).forEach(row => {
    // Usa uma chave composta baseada nos dados principais (Unidade, Descrição, Solicitante, Timestamp)
    const unidade = normalizarNomeEscola(row[idxChamados.unidade] || '');
    const descricao = normalizarTexto(row[idxChamados.descricao] || '');
    const solicitante = normalizarTexto(row[idxChamados.solicitante] || '');
    const tipo = normalizarTexto(row[idxChamados.tipo] || '');
    const timestamp = new Date(row[idxChamados.timestamp]).getTime();
    // A chave inclui timestamp (em ms) + texto normalizado para alta precisão
    const chave = `${timestamp}|${descricao}|${solicitante}|${tipo}`;
    chavesExistentes.add(chave);
  });

  Logger.log(`📋 Encontrados ${chavesExistentes.size} chamados existentes na aba Chamados.`);

  // ===== 4. PROCESSAR LINHAS NÃO MIGRADAS =====
  let inseridos = 0;
  let ignorados = 0;
  let duplicadosEncontrados = 0;

  linhas.forEach((linha, index) => {
    const linhaNumero = index + 2;

    // Verifica se já foi migrado (coluna Migrado = "SIM")
    if (idx.migrado !== -1 && linha[idx.migrado] === 'SIM') {
      ignorados++;
      return;
    }

    const timestamp = new Date(linha[idx.timestamp]);
    const unidade = String(linha[idx.unidade] || '').trim();
    const solicitante = String(linha[idx.solicitante] || '').trim();
    const funcao = String(linha[idx.funcao] || '').trim();
    const tipo = String(linha[idx.tipo] || '').trim();
    const descricao = String(linha[idx.descricao] || '').trim();
    const urgencia = String(linha[idx.urgencia] || '').trim();
    const anexo = String(linha[idx.anexo] || '').trim();

    if (!unidade || !timestamp) {
      marcarComoMigrado(sheetRespostas, linhaNumero);
      ignorados++;
      return;
    }

    // Normaliza os campos para comparação
    const unidadeNorm = normalizarNomeEscola(unidade);
    const descricaoNorm = normalizarTexto(descricao);
    const solicitanteNorm = normalizarTexto(solicitante);
    const tipoNorm = normalizarTexto(tipo);
    const chave = `${timestamp.getTime()}|${descricaoNorm}|${solicitanteNorm}|${tipoNorm}`;

    // === VERIFICA SE JÁ EXISTE NA ABA CHAMADOS ===
    if (chavesExistentes.has(chave)) {
      // Já existe, marca como migrado e pula (não insere duplicata)
      marcarComoMigrado(sheetRespostas, linhaNumero);
      duplicadosEncontrados++;
      ignorados++;
      return;
    }

    // Gera ID determinístico
    const dataStr = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'yyyyMMdd');
    const seq = String(linhaNumero).padStart(4, '0');
    const id = `CH-${dataStr}-${seq}`;

    // Padroniza o nome da escola
    const unidadePadronizada = padronizarNomeEscola(unidade);

    // Insere o novo chamado
    sheetChamados.appendRow([
      id,
      timestamp,
      unidadePadronizada,
      solicitante,
      funcao,
      tipo,
      descricao,
      urgencia,
      anexo,
      'Aberto',
      '',
      timestamp,
      'Migrado automaticamente (padronizado)',
      ''
    ]);

    // Adiciona a chave ao Set de existentes para evitar duplicatas na mesma execução
    chavesExistentes.add(chave);
    marcarComoMigrado(sheetRespostas, linhaNumero);
    inseridos++;
  });

  Logger.log(`✅ Migração concluída: ${inseridos} inseridos, ${ignorados} ignorados (já migrados ou duplicados), ${duplicadosEncontrados} duplicatas evitadas.`);
  return `✅ Migração concluída: ${inseridos} inseridos, ${ignorados} ignorados, ${duplicadosEncontrados} duplicatas evitadas.`;
}

/**
 * Padroniza o nome da escola (tenta encontrar na lista NOMES_PADRONIZADOS).
 * Se não encontrar, retorna o nome original.
 */
function padronizarNomeEscola(nome) {
  const normalizado = normalizarNomeEscola(nome);
  // Tenta encontrar na lista padronizada
  for (const padrao of NOMES_PADRONIZADOS) {
    if (normalizarNomeEscola(padrao) === normalizado) {
      return padrao;
    }
  }
  // Se não encontrar, retorna o nome original
  return nome;
}

function garantirColunaMigrado(sheet) {
  const cabecalho = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (cabecalho.indexOf('Migrado') === -1) {
    sheet.getRange(1, sheet.getLastColumn() + 1).setValue('Migrado');
    sheet.getRange(2, sheet.getLastColumn(), sheet.getLastRow() - 1, 1).setValue('');
  }
}

function marcarComoMigrado(sheet, linhaNumero) {
  const cabecalho = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idxMigrado = cabecalho.indexOf('Migrado');
  if (idxMigrado !== -1) {
    sheet.getRange(linhaNumero, idxMigrado + 1).setValue('SIM');
  }
}

// ==================== REMOVER DUPLICATAS ====================
/**
 * Remove duplicatas da aba "Chamados" com base no conteúdo:
 * Unidade + Descrição + Solicitante + Timestamp + Tipo.
 * Mantém apenas a primeira ocorrência de cada grupo.
 * ATENÇÃO: Faça backup da planilha antes de executar!
 */
function removerDuplicatasCompleto() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Chamados');
  if (!sheet) {
    Logger.log('❌ Aba "Chamados" não encontrada.');
    return '❌ Aba "Chamados" não encontrada.';
  }

  const dados = sheet.getDataRange().getValues();
  if (dados.length < 2) {
    Logger.log('Nenhum dado para processar.');
    return 'Nenhum dado para processar.';
  }

  const cabecalho = dados[0];
  const idxUnidade = cabecalho.indexOf('Unidade');
  const idxSolicitante = cabecalho.indexOf('Solicitante');
  const idxTipo = cabecalho.indexOf('Tipo');
  const idxDescricao = cabecalho.indexOf('Descrição');
  const idxTimestamp = cabecalho.indexOf('Timestamp');

  if (idxUnidade === -1 || idxDescricao === -1 || idxTimestamp === -1) {
    Logger.log('❌ Colunas necessárias não encontradas.');
    return '❌ Colunas necessárias não encontradas.';
  }

  function normalizar(texto) {
    return String(texto || '')
      .toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const vistos = new Map();
  const linhasParaRemover = [];

  for (let i = 1; i < dados.length; i++) {
    const linha = dados[i];
    const unidade = normalizar(linha[idxUnidade]);
    const solicitante = normalizar(linha[idxSolicitante] || '');
    const tipo = normalizar(linha[idxTipo] || '');
    const descricao = normalizar(linha[idxDescricao] || '');
    const timestamp = String(linha[idxTimestamp] || '').trim();
    const chave = `${unidade}|${solicitante}|${tipo}|${descricao}|${timestamp}`;

    if (vistos.has(chave)) {
      linhasParaRemover.push(i + 1);
    } else {
      vistos.set(chave, i + 1);
    }
  }

  linhasParaRemover.reverse().forEach(rowNum => {
    sheet.deleteRow(rowNum);
  });

  const msg = `✅ Removidas ${linhasParaRemover.length} linhas duplicadas.`;
  Logger.log(msg);
  return msg;
}

// ==================== REMOVER POR IDS ====================
function removerChamadosPorIds(ids) {
  if (!ids || ids.length === 0) {
    return { sucesso: false, mensagem: 'Nenhum ID fornecido.' };
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Chamados');
  if (!sheet) {
    return { sucesso: false, mensagem: 'Aba "Chamados" não encontrada.' };
  }

  const dados = sheet.getDataRange().getValues();
  if (dados.length < 2) {
    return { sucesso: false, mensagem: 'Nenhum dado na planilha.' };
  }

  const cabecalho = dados[0];
  const idxID = cabecalho.indexOf('ID');
  if (idxID === -1) {
    return { sucesso: false, mensagem: 'Coluna "ID" não encontrada.' };
  }

  const idsSet = new Set(ids);
  const linhasParaRemover = [];

  for (let i = 1; i < dados.length; i++) {
    const id = String(dados[i][idxID] || '').trim();
    if (idsSet.has(id)) {
      linhasParaRemover.push(i + 1);
    }
  }

  if (linhasParaRemover.length === 0) {
    return { sucesso: true, removidos: 0, mensagem: 'Nenhum ID correspondente encontrado.' };
  }

  linhasParaRemover.reverse().forEach(rowNum => {
    sheet.deleteRow(rowNum);
  });

  return {
    sucesso: true,
    removidos: linhasParaRemover.length,
    mensagem: `${linhasParaRemover.length} chamado(s) removido(s).`
  };
}

// ==================== DADOS PARA O DASHBOARD ====================
function getChamadosMatriz() {
  const sheet = getOrCreateSheetChamados();
  const dados = sheet.getDataRange().getValues();
  if (dados.length < 1) throw new Error('A aba Chamados está vazia (sem cabeçalho).');
  const cabecalho = dados[0];
  const mapaTecnicos = getMapaTecnicos();
  const mapaInventario = getMapaInventario();

  const mapaPorConteudo = {};
  dados.slice(1).forEach(row => {
    const obj = linhaParaObjeto(cabecalho, row);
    const id = obj.ID;
    if (!id) return;
    const chave = `${obj.Unidade || ''}|${obj.Descrição || ''}|${obj.Solicitante || ''}|${obj.Timestamp || ''}`;
    if (!mapaPorConteudo[chave]) {
      const escolaNormalizada = normalizarNomeEscola(obj.Unidade);
      
      // 1. Tenta correspondência exata no mapa
      let inventario = mapaInventario[escolaNormalizada];
      
      // 2. Se não encontrou, tenta correspondência por substring
      if (!inventario) {
        const chaves = Object.keys(mapaInventario);
        for (const chaveMapa of chaves) {
          // Verifica se a chave do mapa contém a escola normalizada ou vice-versa
          if (chaveMapa.includes(escolaNormalizada) || escolaNormalizada.includes(chaveMapa)) {
            inventario = mapaInventario[chaveMapa];
            break;
          }
        }
      }
      
      // 3. Se ainda não encontrou, tenta com a primeira parte do nome (antes da barra)
      if (!inventario) {
        const primeiraParte = obj.Unidade.split(/[\/\-—–]/)[0].trim();
        const primeiraParteNorm = normalizarNomeEscola(primeiraParte);
        const chaves = Object.keys(mapaInventario);
        for (const chaveMapa of chaves) {
          if (chaveMapa.includes(primeiraParteNorm) || primeiraParteNorm.includes(chaveMapa)) {
            inventario = mapaInventario[chaveMapa];
            break;
          }
        }
      }

      const tecnico = mapaTecnicos[escolaNormalizada] || '';
      obj.TecnicoSetor = tecnico;
      obj.Inventario = inventario || 'Não informado';
      obj.EmailsContato = getEmailsContato(obj.Unidade);
      mapaPorConteudo[chave] = obj;
    }
  });

  return Object.values(mapaPorConteudo);
}

function getMapaInventario() {
  // Não usar cache para garantir dados atualizados (opcional)
  // const cache = CacheService.getScriptCache();
  // const cacheKey = 'mapaInventario';
  // const cached = cache.get(cacheKey);
  // if (cached) return JSON.parse(cached);

  const mapa = {};
  try {
    const ss = SpreadsheetApp.openById(ID_PLANILHA_INVENTARIO);
    const sheet = ss.getSheetByName(ABA_INVENTARIO);
    if (!sheet) {
      Logger.log('⚠️ Aba "Base de Dados" não encontrada na planilha de inventário.');
      return mapa;
    }

    const dados = sheet.getDataRange().getValues();
    if (dados.length < 2) return mapa;

    const cabecalho = dados[0];
    const idxEscola = cabecalho.indexOf('Escola');
    const idxStatus = cabecalho.indexOf('Status do Inventário');
    if (idxEscola === -1 || idxStatus === -1) {
      Logger.log('⚠️ Colunas "Escola" ou "Status do Inventário" não encontradas.');
      return mapa;
    }

    dados.slice(1).forEach(row => {
      const escola = String(row[idxEscola] || '').trim();
      const status = String(row[idxStatus] || '').trim();
      if (!escola || !status) return;

      // Gera múltiplas chaves para cada escola
      const chaves = gerarChavesInventario(escola);
      chaves.forEach(chave => {
        if (chave) {
          // Se já existir uma chave com status diferente, mantém a primeira (ou poderia sobrescrever)
          if (!mapa[chave]) {
            mapa[chave] = status;
          }
        }
      });
    });
  } catch (e) {
    Logger.log('❌ Erro ao ler planilha de inventário: ' + e.message);
  }

  // Salva no cache (opcional)
  // cache.put(cacheKey, JSON.stringify(mapa), 3600);
  return mapa;
}

/**
 * Gera múltiplas variações do nome da escola para aumentar a chance de correspondência.
 */
function gerarChavesInventario(nome) {
  const chaves = new Set();
  const nomeOriginal = nome.trim();
  chaves.add(nomeOriginal);

  // Remove "E.E." do início
  const semEE = nomeOriginal.replace(/^E\.?E\.?\s*/i, '').trim();
  chaves.add(semEE);

  // Normaliza (remove acentos, pontuação, espaços extras)
  const normalizado = normalizarNomeEscola(nomeOriginal);
  chaves.add(normalizado);

  // Pega a primeira parte antes de "/" ou "—" ou "-"
  const primeiraParte = nomeOriginal.split(/[\/\-—–]/)[0].trim();
  chaves.add(primeiraParte);
  chaves.add(normalizarNomeEscola(primeiraParte));

  // Pega a segunda parte (depois da barra) se existir
  const partes = nomeOriginal.split(/[\/\-—–]/);
  if (partes.length > 1) {
    const segundaParte = partes[1].trim();
    chaves.add(segundaParte);
    chaves.add(normalizarNomeEscola(segundaParte));
  }

  return Array.from(chaves);
}

function limparCacheInventario() {
  CacheService.getScriptCache().remove('mapaInventario');
  Logger.log('Cache do inventário limpo.');
}

function getEquipamentos() {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'equipamentos';
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const equipamentos = [];
  try {
    const ss = SpreadsheetApp.openById(ID_PLANILHA_INVENTARIO);
    Logger.log('✅ Planilha aberta: ' + ss.getName());
    const sheet = ss.getSheetByName(ABA_EQUIPAMENTOS);
    if (!sheet) {
      const abas = ss.getSheets().map(s => s.getName());
      Logger.log('⚠️ Aba "Equipamentos" NÃO encontrada. Abas disponíveis: ' + abas.join(', '));
      return equipamentos;
    }
    Logger.log('✅ Aba "Equipamentos" encontrada: ' + sheet.getName());

    const dados = sheet.getDataRange().getValues();
    Logger.log('📊 Total de linhas (incl. cabeçalho): ' + dados.length);
    if (dados.length < 2) {
      Logger.log('⚠️ Aba vazia ou só tem cabeçalho');
      return equipamentos;
    }

    const cabecalho = dados[0];
    Logger.log('📋 Cabeçalho: ' + cabecalho.join(' | '));
    
    // Aceita variações de nomes de colunas (case-insensitive)
    const findCol = (nomes) => {
      const lower = cabecalho.map(c => String(c).toLowerCase().trim());
      for (const n of nomes) {
        const idx = lower.indexOf(n.toLowerCase());
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const idxId = findCol(['id', 'equipamento_id', 'codigo']);
    const idxNome = findCol(['equipment_name', 'nome', 'equipamento', 'nome_equipamento']);
    const idxCategoria = findCol(['category', 'categoria', 'tipo']);
    const idxMarca = findCol(['brand', 'marca', 'fabricante']);
    const idxModelo = findCol(['model', 'modelo', 'versao']);

    Logger.log('🔍 Índices encontrados - id:' + idxId + ', nome:' + idxNome + ', categoria:' + idxCategoria + ', marca:' + idxMarca + ', modelo:' + idxModelo);

    if (idxId === -1 || idxNome === -1 || idxCategoria === -1 || idxMarca === -1 || idxModelo === -1) {
      Logger.log('⚠️ Colunas não encontradas. Esperado (qualquer um): id/equipamento_id/codigo, equipment_name/nome/equipamento, category/categoria/tipo, brand/marca/fabricante, model/modelo/versao');
      return equipamentos;
    }

    let count = 0;
    dados.slice(1).forEach((row, i) => {
      const id = String(row[idxId] || '').trim();
      const nome = String(row[idxNome] || '').trim();
      const categoria = String(row[idxCategoria] || '').trim();
      const marca = String(row[idxMarca] || '').trim();
      const modelo = String(row[idxModelo] || '').trim();
      if (id && nome && categoria && marca && modelo) {
        equipamentos.push({ id, nome, categoria, marca, modelo });
        count++;
      } else if (i < 5) {
        Logger.log('⏭️ Linha ' + (i+2) + ' ignorada (vazia/incompleta): id="' + id + '", nome="' + nome + '", cat="' + categoria + '", marca="' + marca + '", modelo="' + modelo + '"');
      }
    });
    Logger.log('✅ Equipamentos válidos carregados: ' + count);
  } catch (e) {
    Logger.log('❌ Erro ao ler aba Equipamentos: ' + e.message + '\n' + e.stack);
  }

  cache.put(cacheKey, JSON.stringify(equipamentos), 3600);
  return equipamentos;
}

function getCategoriasEquipamentos() {
  const equipamentos = getEquipamentos();
  const categorias = [...new Set(equipamentos.map(e => e.categoria))].sort();
  return categorias;
}

function getMarcasPorCategoria(categoria) {
  const equipamentos = getEquipamentos();
  const marcas = [...new Set(equipamentos.filter(e => e.categoria === categoria).map(e => e.marca))].sort();
  return marcas;
}

function getModelosPorCategoriaMarca(categoria, marca) {
  const equipamentos = getEquipamentos();
  const modelos = [...new Set(equipamentos.filter(e => e.categoria === categoria && e.marca === marca).map(e => e.modelo))].sort();
  return modelos;
}

function getEquipamentosFiltrados(categoria, marca, modelo) {
  const equipamentos = getEquipamentos();
  return equipamentos.filter(e => {
    const matchCategoria = !categoria || e.categoria === categoria;
    const matchMarca = !marca || e.marca === marca;
    const matchModelo = !modelo || e.modelo === modelo;
    return matchCategoria && matchMarca && matchModelo;
  });
}

function linhaParaObjeto(cabecalho, row) {
  const obj = {};
  cabecalho.forEach((col, i) => { obj[col] = sanitizarValor(row[i]); });
  return obj;
}

function sanitizarValor(v) {
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return '';
    return v.toISOString();
  }
  if (v === null || v === undefined) return '';
  return v;
}

function atualizarStatusChamado(protocolo, novoStatus, responsavel, tecnicoResolucao) {
  const sheet = getOrCreateSheetChamados();
  const dados = sheet.getDataRange().getValues();
  const cabecalho = dados[0];
  const idxTecnico = cabecalho.indexOf('Técnico Resolução');

  for (let i = 1; i < dados.length; i++) {
    if (dados[i][0] === protocolo) {
      sheet.getRange(i + 1, 10).setValue(novoStatus);
      sheet.getRange(i + 1, 11).setValue(responsavel);
      sheet.getRange(i + 1, 12).setValue(new Date());

      if (tecnicoResolucao && idxTecnico !== -1) {
        sheet.getRange(i + 1, idxTecnico + 1).setValue(tecnicoResolucao);
      }

      const historicoAtual = dados[i][12] || '';
      let entradaHistorico = `[${new Date().toLocaleString('pt-BR')}] Status alterado para "${novoStatus}" por ${responsavel}`;
      if (tecnicoResolucao) entradaHistorico += ` (técnico: ${tecnicoResolucao})`;
      sheet.getRange(i + 1, 13).setValue((`${historicoAtual}\n${entradaHistorico}`).trim());

      const statusAnterior = dados[i][9];
      if (String(novoStatus).trim().toUpperCase() === 'RESOLVIDO' && String(statusAnterior).trim().toUpperCase() !== 'RESOLVIDO') {
        notificarChamadoConcluido(cabecalho, dados[i]);
      }

      return { sucesso: true };
    }
  }
  return { sucesso: false, mensagem: 'Protocolo não encontrado.' };
}

function notificarChamadoConcluido(cabecalho, linha) {
  const idxUnidade = cabecalho.indexOf('Unidade');
  const idxSolicitante = cabecalho.indexOf('Solicitante');
  const idxTipo = cabecalho.indexOf('Tipo');
  const idxDescricao = cabecalho.indexOf('Descrição');
  const idxEmail = cabecalho.indexOf('Email');

  const protocolo = linha[0] || '';
  const unidade = idxUnidade !== -1 ? linha[idxUnidade] : '';
  const solicitante = idxSolicitante !== -1 ? linha[idxSolicitante] : '';
  const tipo = idxTipo !== -1 ? linha[idxTipo] : '';
  const descricao = idxDescricao !== -1 ? linha[idxDescricao] : '';

  let destinatarios = getEmailsContato(unidade);

  if (destinatarios.length === 0 && idxEmail !== -1) {
    const emailForm = String(linha[idxEmail] || '').trim();
    if (emailForm) destinatarios = [{ nome: solicitante, email: emailForm }];
  }

  if (destinatarios.length === 0) {
    Logger.log('Nenhum e-mail de contato para notificar conclusão do chamado ' + protocolo);
    return;
  }

  const assunto = `Chamado concluído — ${protocolo} (${unidade})`;
  const textoAlternativoBase = `Seu chamado foi concluído.\n\nProtocolo: ${protocolo}\nUnidade: ${unidade}\nSolicitante: ${solicitante}\nTipo: ${tipo}\n\nObrigado por entrar em contato com o SETEC — URE Leste 3.`;

  destinatarios.forEach(dest => {
    const corpoHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 28px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
        <div style="display: inline-block; background: #ecfdf5; color: #065f46; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 20px; margin-bottom: 14px;">Chamado concluído</div>
        <h2 style="font-size: 18px; color: #111827; margin: 0 0 4px;">Seu chamado foi resolvido</h2>
        <p style="font-family: 'Courier New', monospace; font-size: 13px; color: #6b7280; margin: 0 0 20px;">${protocolo}</p>
        <table style="width: 100%; font-size: 14px; color: #374151; border-collapse: collapse;">
          <tr><td style="padding: 6px 0; color: #9ca3af; width: 110px;">Unidade</td><td style="padding: 6px 0;">${unidade}</td></tr>
          <tr><td style="padding: 6px 0; color: #9ca3af;">Solicitante</td><td style="padding: 6px 0;">${solicitante}</td></tr>
          <tr><td style="padding: 6px 0; color: #9ca3af;">Tipo</td><td style="padding: 6px 0;">${tipo}</td></tr>
          <tr><td style="padding: 6px 0; color: #9ca3af; vertical-align: top;">Descrição</td><td style="padding: 6px 0;">${descricao}</td></tr>
        </table>
        <p style="font-size: 12.5px; color: #9ca3af; margin-top: 22px;">Agradecemos o contato. Em caso de dúvidas, fale conosco pelo e-mail lt3.setec@educacao.sp.gov.br.</p>
      </div>`;

    try {
      MailApp.sendEmail({
        to: dest.email,
        subject: assunto,
        body: textoAlternativoBase,
        htmlBody: corpoHtml,
        name: 'Sistema de Chamados — URE Leste 3'
      });
    } catch (e) {
      Logger.log('Erro ao enviar e-mail de conclusão para ' + dest.email + ': ' + e.message);
    }
  });
}

function responderChamado(protocolo, textoResposta, responsavel) {
  const sheet = getOrCreateSheetChamados();
  const dados = sheet.getDataRange().getValues();

  for (let i = 1; i < dados.length; i++) {
    if (dados[i][0] === protocolo) {
      const historicoAtual = dados[i][12] || '';
      const novaEntrada = `[${new Date().toLocaleString('pt-BR')}] ${responsavel}: ${textoResposta}`;
      sheet.getRange(i + 1, 13).setValue((historicoAtual + '\n' + novaEntrada).trim());
      sheet.getRange(i + 1, 12).setValue(new Date());
      sheet.getRange(i + 1, 11).setValue(responsavel);
      return { sucesso: true };
    }
  }
  return { sucesso: false, mensagem: 'Protocolo não encontrado.' };
}

function atualizarChamadosEmLote(payload) {
  const { ids, novoStatus, tecnicoResolucao, resposta, responsavel } = payload;
  const sheet = getOrCreateSheetChamados();
  const dados = sheet.getDataRange().getValues();
  const cabecalho = dados[0];
  const idxProtocolo = 0;
  const idxStatus = cabecalho.indexOf('Status');
  const idxResponsavel = cabecalho.indexOf('Responsável');
  const idxUltimaAtualizacao = cabecalho.indexOf('Última Atualização');
  const idxHistorico = cabecalho.indexOf('Histórico');
  const idxTecnicoResolucao = cabecalho.indexOf('Técnico Resolução');

  let atualizados = 0;
  const agora = new Date();

  for (let i = 1; i < dados.length; i++) {
    const protocolo = dados[i][idxProtocolo];
    if (ids.includes(protocolo)) {
      sheet.getRange(i + 1, idxStatus + 1).setValue(novoStatus);
      sheet.getRange(i + 1, idxResponsavel + 1).setValue(responsavel);
      sheet.getRange(i + 1, idxUltimaAtualizacao + 1).setValue(agora);

      if (tecnicoResolucao && idxTecnicoResolucao !== -1) {
        sheet.getRange(i + 1, idxTecnicoResolucao + 1).setValue(tecnicoResolucao);
      }

      const historicoAtual = dados[i][idxHistorico] || '';
      let entrada = `[${agora.toLocaleString('pt-BR')}] Status alterado para "${novoStatus}" por ${responsavel}`;
      if (tecnicoResolucao) entrada += ` (técnico: ${tecnicoResolucao})`;
      if (resposta) entrada += `\n[${agora.toLocaleString('pt-BR')}] ${responsavel}: ${resposta}`;
      sheet.getRange(i + 1, idxHistorico + 1).setValue((historicoAtual + '\n' + entrada).trim());

      const statusAnterior = dados[i][idxStatus];
      if (String(novoStatus).trim().toUpperCase() === 'RESOLVIDO' && String(statusAnterior).trim().toUpperCase() !== 'RESOLVIDO') {
        notificarChamadoConcluido(cabecalho, dados[i]);
      }

      atualizados++;
    }
  }

  return { sucesso: true, atualizados: atualizados };
}

function getChamadosAltaPrioridadeAbertos() {
  const sheet = getOrCreateSheetChamados();
  const dados = sheet.getDataRange().getValues();
  const cabecalho = dados[0];
  const idxUrgencia = cabecalho.indexOf('Urgência');
  const idxStatus = cabecalho.indexOf('Status');

  return dados.slice(1)
    .filter(row => row[idxUrgencia] === URGENCIA_ALTA && row[idxStatus] === 'Aberto')
    .map(row => linhaParaObjeto(cabecalho, row));
}

function criarChamado(payload) {
  const sheet = getOrCreateSheetChamados();
  const protocolo = gerarProtocolo(sheet);
  const timestamp = new Date();

  let anexoUrl = '';
  if (payload.anexoBase64 && payload.anexoNome) {
    try {
      const blob = Utilities.newBlob(
        Utilities.base64Decode(payload.anexoBase64),
        payload.anexoTipo || 'application/octet-stream',
        payload.anexoNome
      );
      
      // Buscar pasta pelo caminho: SCE-V2/database/anexos chamados SETEC
      const pasta = obterOuCriarPastaAnexos();
      
      // Nome do arquivo: data_protocolo_nomeoriginal
      const dataStr = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      const extensao = payload.anexoNome.split('.').pop();
      const nomeBase = payload.anexoNome.replace(/\.[^/.]+$/, '');
      const novoNome = `${dataStr}_${protocolo}_${nomeBase}.${extensao}`;
      
      const arquivo = pasta.createFile(blob);
      arquivo.setName(novoNome);
      arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      anexoUrl = arquivo.getUrl();
    } catch (e) {
      Logger.log('Erro ao salvar anexo: ' + e.message);
      anexoUrl = 'Erro ao salvar anexo: ' + e.message;
    }
  }

  const tecnicoSetor = getTecnicoPorEscola(payload.unidade);

  const emailContato = (payload.emailSolic || payload.email || '').trim();

  sheet.appendRow([
    protocolo,
    timestamp,
    payload.unidade,
    payload.solicitante,
    payload.funcao,
    payload.tipo,
    payload.descricao,
    payload.urgencia,
    anexoUrl,
    'Aberto',
    '',
    timestamp,
    `Chamado criado via HTML Form em ${timestamp.toLocaleString('pt-BR')}`,
    tecnicoSetor,
    emailContato
  ]);

  if (payload.urgencia === URGENCIA_ALTA) {
    notificarAltaPrioridadeHtml(protocolo, payload);
  }

  notificarChamadoCriado(protocolo, payload);

  return protocolo;
}

function notificarChamadoCriado(protocolo, payload) {
  const emailSolicitante = (payload.emailSolic || payload.email || '').trim();
  if (!emailSolicitante) return;

  const assunto = `Chamado registrado — ${protocolo}`;
  const textoAlternativo = `Seu chamado foi registrado com sucesso.\n\nProtocolo: ${protocolo}\nUnidade: ${payload.unidade || ''}\nSolicitante: ${payload.solicitante || ''}\nTipo: ${payload.tipo || ''}\n\nGuarde o número de protocolo. Esta é uma mensagem automática, não responda.`;

  const corpoHtml = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 28px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
      <div style="display: inline-block; background: #eff6ff; color: #1e40af; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 20px; margin-bottom: 14px;">Chamado registrado</div>
      <h2 style="font-size: 18px; color: #111827; margin: 0 0 4px;">Recebemos seu chamado</h2>
      <p style="font-family: 'Courier New', monospace; font-size: 13px; color: #6b7280; margin: 0 0 20px;">${protocolo}</p>
      <table style="width: 100%; font-size: 14px; color: #374151; border-collapse: collapse;">
        <tr><td style="padding: 6px 0; color: #9ca3af; width: 110px;">Unidade</td><td style="padding: 6px 0;">${payload.unidade || ''}</td></tr>
        <tr><td style="padding: 6px 0; color: #9ca3af;">Solicitante</td><td style="padding: 6px 0;">${payload.solicitante || ''}</td></tr>
        <tr><td style="padding: 6px 0; color: #9ca3af;">Tipo</td><td style="padding: 6px 0;">${payload.tipo || ''}</td></tr>
        <tr><td style="padding: 6px 0; color: #9ca3af; vertical-align: top;">Descrição</td><td style="padding: 6px 0;">${payload.descricao || ''}</td></tr>
      </table>
      <p style="font-size: 12.5px; color: #9ca3af; margin-top: 22px;">Guarde o protocolo acima. Esta é uma mensagem automática, por favor não responda.</p>
    </div>`;

  try {
    MailApp.sendEmail({
      to: emailSolicitante,
      subject: assunto,
      body: textoAlternativo,
      htmlBody: corpoHtml,
      name: 'Sistema de Chamados — URE Leste 3',
      noReply: true
    });
  } catch (e) {
    Logger.log('Erro ao enviar e-mail de confirmação para ' + emailSolicitante + ': ' + e.message);
  }
}

function obterOuCriarPastaAnexos() {
  // Caminho: SCE V2/database/Anexos Chamados SETEC
  const pastasRaiz = DriveApp.getFoldersByName('SCE V2');
  let pastaRaiz;
  if (pastasRaiz.hasNext()) {
    pastaRaiz = pastasRaiz.next();
  } else {
    pastaRaiz = DriveApp.createFolder('SCE V2');
  }
  
  const pastasDb = pastaRaiz.getFoldersByName('database');
  let pastaDb;
  if (pastasDb.hasNext()) {
    pastaDb = pastasDb.next();
  } else {
    pastaDb = pastaRaiz.createFolder('database');
  }
  
  const pastasAnexos = pastaDb.getFoldersByName('Anexos Chamados SETEC');
  let pastaAnexos;
  if (pastasAnexos.hasNext()) {
    pastaAnexos = pastasAnexos.next();
  } else {
    pastaAnexos = pastaDb.createFolder('Anexos Chamados SETEC');
  }
  
  return pastaAnexos;
}

function getTecnicoPorEscola(escola) {
  const mapa = getMapaTecnicos();
  const chave = normalizarNomeEscola(escola);
  return mapa[chave] || '';
}

function notificarAltaPrioridadeHtml(protocolo, payload) {
  const assunto = `Novo chamado de alta prioridade — ${protocolo} (${payload.unidade})`;
  const textoAlternativo = `Novo chamado de alta prioridade aberto.\n\nProtocolo: ${protocolo}\nUnidade: ${payload.unidade}\nSolicitante: ${payload.solicitante} (${payload.funcao})\nTipo: ${payload.tipo}\nDescrição: ${payload.descricao}`;

  const corpoHtml = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 28px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
      <div style="display: inline-block; background: #fef2f2; color: #b91c1c; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 20px; margin-bottom: 14px;">Alta prioridade</div>
      <h2 style="font-size: 18px; color: #111827; margin: 0 0 4px;">Novo chamado aberto</h2>
      <p style="font-family: 'Courier New', monospace; font-size: 13px; color: #6b7280; margin: 0 0 20px;">${protocolo}</p>
      <table style="width: 100%; font-size: 14px; color: #374151; border-collapse: collapse;">
        <tr><td style="padding: 6px 0; color: #9ca3af; width: 110px;">Unidade</td><td style="padding: 6px 0;">${payload.unidade}</td></tr>
        <tr><td style="padding: 6px 0; color: #9ca3af;">Solicitante</td><td style="padding: 6px 0;">${payload.solicitante} (${payload.funcao})</td></tr>
        <tr><td style="padding: 6px 0; color: #9ca3af;">Tipo</td><td style="padding: 6px 0;">${payload.tipo}</td></tr>
        <tr><td style="padding: 6px 0; color: #9ca3af; vertical-align: top;">Descrição</td><td style="padding: 6px 0;">${payload.descricao}</td></tr>
      </table>
      <p style="font-size: 12.5px; color: #9ca3af; margin-top: 22px;">Acesse o sistema para tratar este chamado.</p>
    </div>`;

  EMAIL_RESPONSAVEIS.forEach(email => {
    MailApp.sendEmail({
      to: email,
      subject: assunto,
      body: textoAlternativo,
      htmlBody: corpoHtml,
      name: 'Sistema de Chamados — URE Leste 3'
    });
  });
}

// ==================== AUTENTICAÇÃO OTP ====================

function getOrCreateSheetOtpPendente() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('OtpPendente');
  if (!sheet) {
    sheet = ss.insertSheet('OtpPendente');
    sheet.appendRow(['email', 'code', 'criadoEm', 'expiraEm', 'nivel', 'filial']);
  }
  return sheet;
}
/**
 * Envia um código OTP para o e-mail do usuário.
 * @param {string} email - E-mail do usuário.
 * @returns {object} { sucesso: true/false, mensagem: string }
 */
/**
 * Envia um código OTP para o e-mail do usuário.
 * @param {string} email - E-mail do usuário.
 * @returns {object} { sucesso: true/false, mensagem: string }
 */
function solicitarOTP(email) {
  email = email.trim().toLowerCase();
  Logger.log('📧 Solicitação OTP para: ' + email);

  const usuarios = getUsuarios();
  Logger.log('👥 Usuários encontrados: ' + usuarios.map(u => u.email + ' (' + u.status + ')').join(', '));

  const usuario = usuarios.find(u => u.email === email && u.status === 'Ativo');
  if (!usuario) {
    Logger.log('❌ Usuário não encontrado ou inativo: ' + email);
    return { sucesso: false, mensagem: 'Usuário não encontrado ou inativo.' };
  }
  Logger.log('✅ Usuário encontrado: ' + usuario.nome + ', Nível: ' + usuario.nivel + ', Filial: ' + usuario.filial);

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiraEm = new Date(Date.now() + 10 * 60 * 1000);
  Logger.log('🔑 Código gerado: ' + code);

  const sheet = getOrCreateSheetOtpPendente();
  sheet.appendRow([email, code, new Date(), expiraEm, usuario.nivel, usuario.filial]);
  Logger.log('📝 OTP salvo na aba OtpPendente.');

  const assunto = '🔐 Seu código de acesso - Sistema de Chamados URE Leste 3';
  const corpo = `
    Olá ${usuario.nome},

    Seu código de acesso único é:

    🔑 ${code}

    Este código é válido por 10 minutos.

    Acesse o sistema para visualizar seus chamados.
  `;
  MailApp.sendEmail({
    to: email,
    subject: assunto,
    body: corpo,
    name: 'Sistema de Chamados URE Leste 3'
  });
  Logger.log('📧 E-mail enviado para: ' + email);

  return { sucesso: true, mensagem: 'Código enviado para seu e-mail.' };
}

/**
 * Verifica o código OTP e cria uma sessão.
 * @param {string} email - E-mail do usuário.
 * @param {string} code - Código OTP.
 * @returns {object} { sucesso: true/false, token: string, nivel: string, filial: string, nome: string }
 */
function verificarOTP(email, code) {
  email = email.trim().toLowerCase();
  code = code.trim();

  Logger.log('🔍 Verificando OTP para:', email);

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('OtpPendente');
  if (!sheet) {
    Logger.log('❌ Aba OtpPendente não encontrada.');
    return { sucesso: false, mensagem: 'Nenhum código pendente.' };
  }

  const dados = sheet.getDataRange().getValues();
  const cabecalho = dados[0];
  const idxEmail = cabecalho.indexOf('email');
  const idxCode = cabecalho.indexOf('code');
  const idxExpira = cabecalho.indexOf('expiraEm');
  const idxNivel = cabecalho.indexOf('nivel');
  const idxFilial = cabecalho.indexOf('filial');

  let linhaEncontrada = -1;
  let usuario = null;

  for (let i = 1; i < dados.length; i++) {
    if (dados[i][idxEmail] === email && String(dados[i][idxCode]) === code) {
      const expira = new Date(dados[i][idxExpira]);
      if (expira > new Date()) {
        usuario = {
          email: dados[i][idxEmail],
          nivel: dados[i][idxNivel],
          filial: dados[i][idxFilial]
        };
        linhaEncontrada = i + 1;
        break;
      }
    }
  }

  if (!usuario) {
    Logger.log('❌ Código inválido ou expirado para:', email);
    return { sucesso: false, mensagem: 'Código inválido ou expirado.' };
  }

  // Remove o código usado
  if (linhaEncontrada > 0) {
    sheet.deleteRow(linhaEncontrada);
    Logger.log('🗑️ Código removido da fila.');
  }

  // Gera token
  const token = Utilities.getUuid();
  const expiraSessao = new Date(Date.now() + 8 * 60 * 60 * 1000);
  Logger.log('🔑 Token gerado:', token);

  // === SALVA NA ABA SESSOES ===
  const sheetSessoes = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sessoes');
  if (!sheetSessoes) {
    Logger.log('⚠️ Aba Sessoes não encontrada. Criando...');
    SpreadsheetApp.getActiveSpreadsheet().insertSheet('Sessoes');
  }
  // Garante que o cabeçalho existe
  const cabecalhoSessoes = sheetSessoes.getRange(1, 1, 1, 6).getValues()[0];
  if (cabecalhoSessoes[0] !== 'token') {
    sheetSessoes.getRange(1, 1, 1, 6).setValues([['token', 'email', 'nivel', 'filial', 'criadoEm', 'expiraEm']]);
  }
  sheetSessoes.appendRow([token, usuario.email, usuario.nivel, usuario.filial, new Date(), expiraSessao]);
  Logger.log('✅ Token salvo na aba Sessoes.');

  // Busca nome do usuário
  const usuarios = getUsuarios();
  const userData = usuarios.find(u => u.email === usuario.email);

  return {
    sucesso: true,
    token: token,
    nivel: usuario.nivel,
    filial: usuario.filial,
    nome: userData ? userData.nome : usuario.email
  };
}

/**
 * Valida um token de sessão.
 * @param {string} token - Token da sessão.
 * @returns {object} { valido: true/false, nivel: string, filial: string, email: string }
 */
function validarSessao(token) {
  if (!token) return { valido: false };

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sessoes');
  if (!sheet) return { valido: false };

  const dados = sheet.getDataRange().getValues();
  const cabecalho = dados[0];
  const idxToken = cabecalho.indexOf('token');
  const idxExpira = cabecalho.indexOf('expiraEm');
  const idxNivel = cabecalho.indexOf('nivel');
  const idxFilial = cabecalho.indexOf('filial');
  const idxEmail = cabecalho.indexOf('email');

  for (let i = 1; i < dados.length; i++) {
    if (dados[i][idxToken] === token) {
      const expira = new Date(dados[i][idxExpira]);
      if (expira > new Date()) {
        return {
          valido: true,
          nivel: dados[i][idxNivel],
          filial: dados[i][idxFilial],
          email: dados[i][idxEmail]
        };
      }
    }
  }
  return { valido: false };
}

/**
 * Retorna a lista de usuários (da aba Usuarios).
 */
function getUsuarios() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Usuarios');
  if (!sheet) return [];
  const dados = sheet.getDataRange().getValues();
  const cabecalho = dados[0];
  const idxEmail = cabecalho.indexOf('email');
  const idxNome = cabecalho.indexOf('nome');
  const idxNivel = cabecalho.indexOf('nivel');
  const idxFilial = cabecalho.indexOf('filial');
  const idxStatus = cabecalho.indexOf('status');

  return dados.slice(1).map(row => ({
    email: row[idxEmail],
    nome: row[idxNome],
    nivel: row[idxNivel],
    filial: row[idxFilial],
    status: row[idxStatus]
  }));
}

/**
 * Faz logout (remove a sessão).
 * @param {string} token - Token da sessão.
 */
function fazerLogout(token) {
  if (!token) return;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sessoes');
  if (!sheet) return;
  const dados = sheet.getDataRange().getValues();
  for (let i = 1; i < dados.length; i++) {
    if (dados[i][0] === token) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

function debugSessao(token) {
  const sessao = validarSessao(token);
  return {
    valido: sessao ? sessao.valido : false,
    nivel: sessao ? sessao.nivel : null,
    filial: sessao ? sessao.filial : null,
    email: sessao ? sessao.email : null
  };
}

// ==================== DADOS FILTRADOS POR PERFIL ====================
/**
 * Retorna os chamados filtrados conforme o perfil do usuário logado.
 * @param {string} token - Token da sessão.
 * @returns {array} Lista de chamados filtrados.
 */
function getChamadosFiltrados(token) {
  Logger.log('🔍 getChamadosFiltrados chamado com token: ' + token);
  const sessao = validarSessao(token);

  if (!sessao || !sessao.valido) {
    throw new Error('Sessão inválida.');
  }

  Logger.log('NIVEL: [' + sessao.nivel + '] FILIAL: [' + sessao.filial + '] EMAIL: [' + sessao.email + ']');

  const sheet = getOrCreateSheetChamados();
  const dados = sheet.getDataRange().getValues();
  if (dados.length < 1) throw new Error('A aba Chamados está vazia (sem cabeçalho).');
  const cabecalho = dados[0];
  const mapaTecnicos = getMapaTecnicos();
  const mapaInventario = getMapaInventario();

  let linhas = dados.slice(1);

  // Filtra conforme o perfil
  const nivel = String(sessao.nivel || '').trim().toLowerCase();
  Logger.log('👤 Nível do usuário: [' + nivel + ']');

  if (nivel === 'filial') {
    const unidade = normalizarNomeEscola(sessao.filial);
    Logger.log('🏫 Filtrando por unidade (normalizada): [' + unidade + ']');
    linhas = linhas.filter(row => {
      const unidadeRow = normalizarNomeEscola(row[cabecalho.indexOf('Unidade')]);
      return unidadeRow === unidade;
    });
  } else if (nivel === 'tecnico') {
    const email = sessao.email;
    const usuarios = getUsuarios();
    const user = usuarios.find(u => u.email === email);
    const nomeTecnico = user ? user.nome : email;
    const nomeTecnicoNorm = normalizarNomeEscola(nomeTecnico);
    Logger.log('🔧 Filtrando por técnico (normalizado): [' + nomeTecnicoNorm + ']');
    linhas = linhas.filter(row => {
      const tecSetor = normalizarNomeEscola(row[cabecalho.indexOf('TecnicoSetor')] || '');
      const tecResolucao = normalizarNomeEscola(row[cabecalho.indexOf('Técnico Resolução')] || '');
      return tecSetor === nomeTecnicoNorm || tecResolucao === nomeTecnicoNorm;
    });
  } else {
    Logger.log('📊 Usuário é Matriz (sem filtro)');
  }

  Logger.log(`📊 Total de linhas após filtro: ${linhas.length}`);

  const mapaPorConteudo = {};
  linhas.forEach(row => {
    const obj = linhaParaObjeto(cabecalho, row);
    const id = obj.ID;
    if (!id) return;
    const chave = `${obj.Unidade || ''}|${obj.Descrição || ''}|${obj.Solicitante || ''}|${obj.Timestamp || ''}`;
    if (!mapaPorConteudo[chave]) {
      const escolaNormalizada = normalizarNomeEscola(obj.Unidade);
      const tecnico = mapaTecnicos[escolaNormalizada] || '';
      obj.TecnicoSetor = tecnico;
      obj.Inventario = mapaInventario[escolaNormalizada] || 'Não informado';
      obj.EmailsContato = getEmailsContato(obj.Unidade);
      mapaPorConteudo[chave] = obj;
    }
  });

  Logger.log(`✅ Chamados filtrados (após deduplicação): ${Object.keys(mapaPorConteudo).length}`);
  return Object.values(mapaPorConteudo);
}
function diagnosticarOtpPendente() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('OtpPendente');
  if (!sheet) {
    Logger.log('❌ Aba OtpPendente não existe. Criando...');
getOrCreateSheetOtpPendente();
  sheet = ss.getSheetByName('OtpPendente');
}
const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
Logger.log('📋 Colunas da aba OtpPendente:', header.join(', '));
const esperado = ['email', 'code', 'criadoEm', 'expiraEm', 'nivel', 'filial'];
const faltando = esperado.filter(col => !header.includes(col));
if (faltando.length) {
  Logger.log('⚠️ Colunas faltando:', faltando.join(', '));
  // Adiciona as colunas faltantes
  const ultimaColuna = sheet.getLastColumn();
  faltando.forEach((col, idx) => {
    sheet.getRange(1, ultimaColuna + idx + 1).setValue(col);
  });
  Logger.log('✅ Colunas adicionadas:', faltando.join(', '));
} else {
  Logger.log('✅ Todas as colunas estão corretas.');
}
}

/**
 * TESTE: Execute esta função no editor do Apps Script para ver logs detalhados
 * do carregamento de equipamentos.
 */
function testarCarregamentoEquipamentos() {
  Logger.log('=== TESTE CARREGAMENTO EQUIPAMENTOS ===');
  const equipamentos = getEquipamentos();
  Logger.log('Total retornado: ' + equipamentos.length);
  if (equipamentos.length > 0) {
    Logger.log('Primeiros 5:');
    equipamentos.slice(0, 5).forEach((e, i) => {
      Logger.log('  ' + (i+1) + '. ' + JSON.stringify(e));
    });
    Logger.log('Categorias únicas: ' + [...new Set(equipamentos.map(e => e.categoria))].join(', '));
  }
  return equipamentos;
}