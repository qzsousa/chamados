

function criarChamado(dados) {
  const ss = SpreadsheetApp.openById('SEU_ID_DA_PLANILHA');
  const aba = ss.getSheetByName('Respostas'); // mesma estrutura do Forms atual

  let linkAnexo = '';
  if (dados.anexoBase64) {
    const blob = Utilities.newBlob(Utilities.base64Decode(dados.anexoBase64), dados.anexoTipo, dados.anexoNome);
    const pasta = DriveApp.getFolderById('SEU_ID_DA_PASTA');
    linkAnexo = pasta.createFile(blob).getUrl();
  }

  const protocolo = Utilities.formatDate(new Date(), 'GMT-3', 'yyMMdd') + '-' + Math.floor(Math.random()*900+100);

  aba.appendRow([
    new Date(), dados.escola, dados.nome, dados.cargo,
    dados.categoria, dados.descricao, dados.urgencia, linkAnexo, protocolo
  ]);

  if (dados.urgencia === 'Alta') {
    MailApp.sendEmail('leste3.setec@educacao.sp.gov.br',
      'Chamado de ALTA urgência — ' + dados.escola,
      dados.descricao);
  }

  return protocolo;
}