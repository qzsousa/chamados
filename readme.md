# Sistema de Chamados — URE Leste 3

## Objetivo

Substituir o processo atual de abertura e acompanhamento de chamados técnicos (hoje feito via Google Forms + validação manual em planilha) por um painel de gestão com visual mais claro, filtros, e visibilidade em tempo real de chamados de alta prioridade — sem exigir que as unidades escolares aprendam um sistema novo.

## Como funciona hoje

- **Abertura do chamado**: continua via **Google Forms**, já em uso pelas escolas. Nenhuma mudança do lado de quem abre o chamado.
- **Processamento automático**: um script (Google Apps Script) roda a cada nova resposta do Forms, gera um protocolo único (`CH-AAAAMMDD-NNNN`), grava numa planilha estruturada (`Chamados`) e dispara e-mail de alerta imediato quando a urgência é **Alta**.
- **Painel de gestão (dashboard)**: uma página web (hospedada no próprio Google Apps Script) mostra todos os chamados em tempo real, com:
  - KPIs (abertos, em andamento, encerrados, alta prioridade ativa)
  - Gráficos de tendência (chamados por dia) e distribuição por status/urgência
  - Lista compacta dos chamados (escola, categoria, descrição), com scroll interno e filtros por unidade, categoria, status, urgência, técnico responsável e período
  - Modal de detalhe por chamado: histórico, alteração de status, campo de resposta pra unidade, e registro de qual técnico resolveu (lista fixa dos 8 técnicos + opção de digitar outro nome)
  - Atualização automática (pensado para funcionar numa TV de sala, sem precisar recarregar manualmente)

## Decisões importantes

- **Sem categorização fixa no Forms**: o campo "Tipo de Solicitação" continua como texto livre (não dá pra padronizar sem mexer no formulário já em uso); a organização por categoria é feita no dashboard.
- **Login removido**: uma primeira versão previa autenticação por e-mail (OTP) com perfis diferentes (Matriz, AdminFilial, Unidade). Depois de dificuldades técnicas persistentes de sessão, o projeto foi simplificado para **acesso direto ao painel completo**, sem login — o controle de acesso fica a cargo da própria implantação do Google Apps Script (restrição por domínio institucional).
- **Mapeamento técnico ↔ escola**: uma planilha auxiliar (`Setores`) associa cada escola a um técnico de campo responsável; essa informação aparece automaticamente no painel.

## Stack técnica

- Google Apps Script (backend + frontend via HtmlService)
- Google Sheets como banco de dados (abas: `Respostas ao formulário`, `Chamados`, `Setores`)
- Google Forms como porta de entrada
- Google Charts para os gráficos do dashboard

## Status atual

Em ajuste fino de layout e funcionalidades (filtros adicionais, lista compacta de chamados, campo de técnico responsável pela resolução). Núcleo funcional (abertura → processamento → painel) já operante.
