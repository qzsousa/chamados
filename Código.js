// ==================== CONFIGURAÇÃO ====================
const SHEET_CHAMADOS = 'Chamados';
const EMAIL_RESPONSAVEIS = ['responsavel1@ureleste3.sp.gov.br']; // ajustar
const URGENCIA_ALTA = 'Alta (impactando funcionamento da escola)';
const TECNICOS = ['CAROL', 'CHARLES', 'FABIO', 'GUILHERME', 'HEBERT', 'JOSEMIR', 'JOÃO', 'VALDEIR'];

// ==================== MAPEAMENTO FIXO ESCOLA → TÉCNICO ====================
const LISTA_ESCOLAS_TECNICOS = [
  { escola: "E.E. ADHEMAR ANTONIO PRADO PROFESSOR", tecnico: "GUILHERME" },
  { escola: "E.E. ALCIDES BOSCOLO PROFESSOR", tecnico: "JOÃO" },
  { escola: "E.E. ANDRE NUNES JUNIOR", tecnico: "CHARLES" },
  { escola: "E.E. ANISIO TEIXEIRA PROFESSOR", tecnico: "CAROL" },
  { escola: "E.E. ANTONIETA DE SOUZA ALCANTARA", tecnico: "CHARLES" },
  { escola: "E.E. ANTONIO CARLOS BRASILEIRO DE ALMEIDA JOBIM TOM JOBIM", tecnico: "CHARLES" },
  { escola: "E.E. AQUILINO RIBEIRO", tecnico: "VALDEIR" },
  { escola: "E.E. BARRO BRANCO II", tecnico: "HEBERT" },
  { escola: "E.E. BELIZE", tecnico: "VALDEIR" },
  { escola: "E.E. COHAB ITAQUERA IV", tecnico: "FABIO" },
  { escola: "E.E. BENJAMIN SAMUEL BLOOM", tecnico: "VALDEIR" },
  { escola: "E.E. BERNARDIM RIBEIRO", tecnico: "VALDEIR" },
  { escola: "E.E. BRENO ROSSI, MAESTRO", tecnico: "HEBERT" },
  { escola: "E.E. CANDIDO PROCOPIO FERREIRA DE CAMARGO PROFESSOR", tecnico: "HEBERT" },
  { escola: "E.E. CARLOS HENRIQUE LIBERALLI PROFESSOR", tecnico: "GUILHERME" },
  { escola: "E.E. CARMELINDA MARQUES PEREIRA PROFESSORA", tecnico: "JOÃO" },
  { escola: "E.E. CESAR DONATO CALABREZ /LEILA DINIZ", tecnico: "JOSEMIR" },
  { escola: "E.E. CESAR DONATO CALABREZ", tecnico: "JOSEMIR" },
  { escola: "E.E. CHARLOTTE MARIA SHAW MASON", tecnico: "CHARLES" },
  { escola: "E.E. CHIQUINHA GONZAGA", tecnico: "CAROL" },
  { escola: "E.E. CLÁUDIA DUTRA VIANA PROFESSORA", tecnico: "CHARLES" },
  { escola: "E.E. CONJUNTO HABITACIONAL CARRAOZINHO", tecnico: "HEBERT" },
  { escola: "E.E. CONJUNTO HABITACIONAL ITAQUERA IV", tecnico: "FABIO" },
  { escola: "E.E. DECIO FERRAZ ALVIM", tecnico: "CHARLES" },
  { escola: "E.E. DJANIRA", tecnico: "HEBERT" },
  { escola: "E.E. ERNESTINA DEL BUONO TRAMA PROFESSORA", tecnico: "CAROL" },
  { escola: "E.E. ESTHER DE FIGUEIREDO FERRAZ", tecnico: "GUILHERME" },
  { escola: "E.E. FABIO AGAZZI", tecnico: "JOSEMIR" },
  { escola: "E.E. FADLO HAIDAR", tecnico: "FABIO" },
  { escola: "E.E. FERNANDO MAURO PIRES DA ROCHA DEPUTADO", tecnico: "JOÃO" },
  { escola: "E.E. FERNANDO PESSOA", tecnico: "JOÃO" },
  { escola: "E.E. FLORIANO PEIXOTO", tecnico: "CHARLES" },
  { escola: "E.E. FRANCISCO DE ASSIS P. CORRÊA", tecnico: "CAROL" },
  { escola: "E.E. FREDERICO MARIANO", tecnico: "JOSEMIR" },
  { escola: "E.E. GERALDINO DOS SANTOS DEPUTADO", tecnico: "HEBERT" },
  { escola: "E.E. GUERRA JUNQUEIRO", tecnico: "CHARLES" },
  { escola: "E.E. HAYDEE HIDALGO PROFESSORA", tecnico: "CAROL" },
  { escola: "E.E. HERBERT JOSÉ DE SOUZA – BETINHO", tecnico: "GUILHERME" },
  { escola: "E.E. HUMBERTO BAPTISTELLI", tecnico: "JOÃO" },
  { escola: "E.E. HUMBERTO DANTAS", tecnico: "JOSEMIR" },
  { escola: "E.E. INDIANA ZUYCHER SIMOES DE JESUS PROFESSORA", tecnico: "GUILHERME" },
  { escola: "E.E. ISAAC SCHRAIBER", tecnico: "CHARLES" },
  { escola: "E.E. JARDIM DOM ANGELICO", tecnico: "CHARLES" },
  { escola: "E.E. JARDIM IGUATEMI", tecnico: "VALDEIR" },
  { escola: "E.E. JARDIM LIMOEIRO III", tecnico: "JOÃO" },
  { escola: "E.E. JARDIM PEDRA BRANCA", tecnico: "VALDEIR" },
  { escola: "E.E. JARDIM WILMA FLOR", tecnico: "VALDEIR" },
  { escola: "E.E. JOAO CASTELLANO PROFESSOR", tecnico: "CAROL" },
  { escola: "E.E. JOAQUIM SILVERIO GOMES DOS REIS PROFESSOR", tecnico: "GUILHERME" },
  { escola: "E.E. JORGE LUIS BORGES", tecnico: "JOÃO" },
  { escola: "E.E. JOSUÉ DE CASTRO", tecnico: "HEBERT" },
  { escola: "E.E. JUAN CARLOS ONETTI ESCRITOR", tecnico: "CAROL" },
  { escola: "E.E. LEILA DINIZ", tecnico: "JOSEMIR" },
  { escola: "E.E. LEÔNIDAS DA SILVA", tecnico: "HEBERT" },
  { escola: "E.E. LIMA BARRETO", tecnico: "JOÃO" },
  { escola: "E.E. LUIZ ROSANOVA PROFESSOR", tecnico: "JOSEMIR" },
  { escola: "E.E. LUIZ VAZ DE CAMOES", tecnico: "GUILHERME" },
  { escola: "E.E. MARCOS ANTONIO COSTA PROFESSOR", tecnico: "GUILHERME" },
  { escola: "E.E. MARIA ANTONIETA FERRAZ BIBLIOTECARIA", tecnico: "HEBERT" },
  { escola: "E.E. MARIA DE LOURDES ARANHA DE ASSIS PACHECO PROFESSORA", tecnico: "CAROL" },
  { escola: "E.E. MARIA TEREZA SIMÕES DE ALMEIDA", tecnico: "VALDEIR" },
  { escola: "E.E. MARIUMA BUAZAR MAUAD", tecnico: "JOÃO" },
  { escola: "E.E. MOACYR AMARAL DOS SANTOS", tecnico: "HEBERT" },
  { escola: "E.E. MOZART TAVARES DE LIMA PROFESSOR", tecnico: "CAROL" },
  { escola: "E.E. OSWALDO GAGLIARDI", tecnico: "VALDEIR" },
  { escola: "E.E. PATRÍCIA GALVÃO – PAGU", tecnico: "VALDEIR" },
  { escola: "E.E. PAULO ROLIM ROSA PROF", tecnico: "VALDEIR" },
  { escola: "E.E. PAULO SARASATE GOVERNADOR", tecnico: "JOSEMIR" },
  { escola: "E.E. PEDRO TAQUES", tecnico: "VALDEIR" },
  { escola: "E.E. RECANTO VERDE SOL", tecnico: "HEBERT" },
  { escola: "E.E. RITA PINTO DE ARAUJO PROFESSORA", tecnico: "CHARLES" },
  { escola: "E.E. ROCCA DORDALL", tecnico: "JOSEMIR" },
  { escola: "E.E. ROQUE THEOPHILO", tecnico: "HEBERT" },
  { escola: "E.E. ROSA PARKS", tecnico: "CHARLES" },
  { escola: "E.E. RUY DE MELLO JUNQUEIRA", tecnico: "JOÃO" },
  { escola: "E.E. SALIM FARAH MALUF PROFESSOR", tecnico: "GUILHERME" },
  { escola: "E.E. SALVADOR ALLENDE GOSSENS PRESIDENTE", tecnico: "CAROL" },
  { escola: "E.E. SATURNINO PEREIRA PROFESSOR", tecnico: "VALDEIR" },
  { escola: "E.E. SEBASTIAO FARIA ZIMBRES PROFESSOR", tecnico: "JOSEMIR" },
  { escola: "E.E. SERGIO ESTANISLAU CAMARGO", tecnico: "JOSEMIR" },
  { escola: "E.E. SERGIO ROCHA KIEHL PROFESSOR", tecnico: "JOSEMIR" },
  { escola: "E.E. SILVANA EVANGELISTA PROFESSORA", tecnico: "CHARLES" },
  { escola: "E.E. SIMAO MATHIAS PROFESSOR", tecnico: "JOÃO" },
  { escola: "E.E. SUMIE IWATA PROFESSORA", tecnico: "CAROL" },
  { escola: "E.E. VILA BELA", tecnico: "HEBERT" },
  { escola: "E.E. YERVANT KISSAJIKIAN", tecnico: "GUILHERME" },
  { escola: "E.E. ZIPORA RUBINSTEIN PROFESSORA", tecnico: "VALDEIR" }
];

// ==================== ROTEAMENTO ====================
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('DashboardMatriz');
  return template.evaluate()
    .setTitle('Chamados - Painel de Gestão')
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
      'Última Atualização', 'Histórico', 'Técnico Resolução'
    ]);
    sheet.setFrozenRows(1);
  }
  garantirColunaTecnicoResolucao(sheet);
  return sheet;
}

function garantirColunaTecnicoResolucao(sheet) {
  const ultimaColuna = sheet.getLastColumn();
  const header = sheet.getRange(1, 1, 1, ultimaColuna).getValues()[0];
  if (header.indexOf('Técnico Resolução') === -1) {
    sheet.getRange(1, ultimaColuna + 1).setValue('Técnico Resolução');
  }
}

// ==================== MAPEAMENTO ====================
function normalizarNomeEscola(nome) {
  return String(nome || '')
    .toUpperCase()
    .replace(/^E\.?E\.?\s*/i, '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getMapaTecnicos() {
  const mapa = {};
  LISTA_ESCOLAS_TECNICOS.forEach(item => {
    const chave = normalizarNomeEscola(item.escola);
    if (chave) {
      mapa[chave] = item.tecnico;
      const semSufixo = chave
        .replace(/\s+(PROFESSOR|PROFESSORA|DEPUTADO|GOVERNADOR|PRESIDENTE|MAESTRO|DOUTOR|BIBLIOTECARIA|ESCRITOR|PROF|PROFESSOR(A)?)$/i, '')
        .trim();
      if (semSufixo && semSufixo !== chave) mapa[semSufixo] = item.tecnico;
      const semJunior = chave.replace(/\s+(JUNIOR|FILHO|NETO)$/i, '').trim();
      if (semJunior && semJunior !== chave) mapa[semJunior] = item.tecnico;
    }
  });
  return mapa;
}

function getTecnicos() {
  return TECNICOS;
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

// ==================== MIGRAÇÃO SEGURA ====================
function migrarRespostasExistentes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetRespostas = ss.getSheetByName('Respostas ao formulário 1');
  const sheetChamados = getOrCreateSheetChamados();

  if (!sheetRespostas) {
    Logger.log('Aba "Respostas ao formulário 1" não encontrada. Abortando.');
    return;
  }

  const dadosChamados = sheetChamados.getDataRange().getValues();
  const cabecalhoChamados = dadosChamados[0];
  const idxChamados = {
    timestamp: cabecalhoChamados.indexOf('Timestamp'),
    unidade: cabecalhoChamados.indexOf('Unidade'),
    solicitante: cabecalhoChamados.indexOf('Solicitante'),
    tipo: cabecalhoChamados.indexOf('Tipo'),
    descricao: cabecalhoChamados.indexOf('Descrição')
  };

  const chamadosExistentes = new Set();
  dadosChamados.slice(1).forEach(row => {
    const chave = gerarChaveUnica(
      row[idxChamados.timestamp],
      row[idxChamados.unidade],
      row[idxChamados.solicitante],
      row[idxChamados.tipo],
      row[idxChamados.descricao]
    );
    chamadosExistentes.add(chave);
  });

  const dadosRespostas = sheetRespostas.getDataRange().getValues();
  const cabecalho = dadosRespostas[0];
  const linhas = dadosRespostas.slice(1);

  const idx = {
    unidade: cabecalho.indexOf('UNIDADE ESCOLAR'),
    solicitante: cabecalho.indexOf('Nome do solicitante'),
    funcao: cabecalho.indexOf('2- Função'),
    tipo: cabecalho.indexOf('Tipo de Solicitação'),
    descricao: cabecalho.indexOf('Descrição do Problema'),
    urgencia: cabecalho.indexOf('Urgência'),
    anexo: cabecalho.indexOf('Anexos.  \nFotos ou prints do problema.'),
    timestamp: cabecalho.indexOf('Carimbo de data/hora')
  };

  if (idx.unidade === -1 || idx.timestamp === -1) {
    Logger.log('Colunas obrigatórias não encontradas. Abortando.');
    return;
  }

  let contadorNovos = 0;
  const protocolosExistentes = new Set(
    sheetChamados.getRange(2, 1, sheetChamados.getLastRow() - 1, 1).getValues().flat().map(String)
  );

  linhas.forEach(linha => {
    const timestamp = new Date(linha[idx.timestamp]);
    const unidade = String(linha[idx.unidade] || '').trim();
    const solicitante = String(linha[idx.solicitante] || '').trim();
    const tipo = String(linha[idx.tipo] || '').trim();
    const descricao = String(linha[idx.descricao] || '').trim();

    const chave = gerarChaveUnica(timestamp, unidade, solicitante, tipo, descricao);
    if (chamadosExistentes.has(chave)) return;

    const dataStr = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'yyyyMMdd');
    const protocolosDaData = sheetChamados.getRange(2, 1, sheetChamados.getLastRow() - 1, 1).getValues().flat()
      .filter(p => String(p).includes(dataStr));
    const seq = protocolosDaData.length + 1;
    let protocolo = `CH-${dataStr}-${String(seq).padStart(4, '0')}`;
    let tentativa = 0;
    while (protocolosExistentes.has(protocolo)) {
      tentativa++;
      protocolo = `CH-${dataStr}-${String(seq + tentativa).padStart(4, '0')}`;
    }
    protocolosExistentes.add(protocolo);

    sheetChamados.appendRow([
      protocolo,
      timestamp,
      unidade,
      solicitante,
      linha[idx.funcao] || '',
      tipo,
      descricao,
      linha[idx.urgencia] || '',
      linha[idx.anexo] || '',
      'Aberto',
      '',
      timestamp,
      'Migrado automaticamente do histórico do Forms'
    ]);

    contadorNovos++;
    chamadosExistentes.add(chave);
  });

  Logger.log(`Migração concluída: ${contadorNovos} novo(s) chamado(s) importado(s).`);
}

function gerarChaveUnica(timestamp, unidade, solicitante, tipo, descricao) {
  const data = timestamp instanceof Date ? timestamp.getTime() : new Date(timestamp).getTime();
  const normalizar = (texto) => {
    return String(texto || '')
      .toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };
  return `${data}|${normalizar(unidade)}|${normalizar(solicitante)}|${normalizar(tipo)}|${normalizar(descricao)}`;
}

// ==================== DADOS ====================
function sanitizarValor(v) {
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return '';
    return v.toISOString();
  }
  if (v === null || v === undefined) return '';
  return v;
}

function linhaParaObjeto(cabecalho, row) {
  const obj = {};
  cabecalho.forEach((col, i) => { obj[col] = sanitizarValor(row[i]); });
  return obj;
}

function getChamadosMatriz() {
  const sheet = getOrCreateSheetChamados();
  const dados = sheet.getDataRange().getValues();
  if (dados.length < 1) throw new Error('A aba Chamados está vazia (sem cabeçalho).');
  const cabecalho = dados[0];
  const mapaTecnicos = getMapaTecnicos();

  return dados.slice(1).map(row => {
    const obj = linhaParaObjeto(cabecalho, row);
    const escolaNormalizada = normalizarNomeEscola(obj.Unidade);
    const tecnico = mapaTecnicos[escolaNormalizada] || '';
    obj.TecnicoSetor = tecnico;
    if (!tecnico) {
      Logger.log(`Escola não mapeada: "${obj.Unidade}" -> normalizada: "${escolaNormalizada}"`);
    }
    return obj;
  });
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

      return { sucesso: true };
    }
  }
  return { sucesso: false, mensagem: 'Protocolo não encontrado.' };
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

// ==================== NOVA FUNÇÃO: ATUALIZAÇÃO EM LOTE ====================
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