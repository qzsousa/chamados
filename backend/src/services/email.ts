import { env } from '../config/env'
import { getEmailsContato, EmailContato } from './normalization'

const STATUS_LABEL: Record<string, string> = {
  ABERTO: 'Aberto',
  ANDAMENTO: 'Em andamento',
  COMUNICADO: 'Comunicado',
  RESOLVIDO: 'Resolvido',
}

const STATUS_BADGE: Record<string, string> = {
  ABERTO: '#fef3c7;#92400e',
  ANDAMENTO: '#dbeafe;#1e40af',
  COMUNICADO: '#e0e7ff;#3730a3',
  RESOLVIDO: '#ecfdf5;#065f46',
}

function getSender() {
  return {
    name: 'SETEC URE Leste 3',
    email: 'chamadossetec@gmail.com',
  }
}

async function sendBrevoEmail(to: string, subject: string, text: string, html: string): Promise<void> {
  if (!env.BREVO_API_KEY) {
    console.warn('[email] BREVO_API_KEY não configurada — envio ignorado')
    return
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': env.BREVO_API_KEY!,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'SETEC URE Leste 3', email: 'chamadossetec@gmail.com' },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error(`[email] Falha ao enviar para ${to}: Brevo ${res.status}: ${err}`)
    }
  } catch (err) {
    // Nunca propagar exceção: falha de e-mail não deve derrubar a requisição
    // (Express 4 + erro async não tratado = processo Node inteiro crasha)
    console.error(`[email] Falha ao enviar para ${to}:`, err)
  }
}

function obterDestinatarios(unidade: string, solicitante: string, emailSolicitante: string | null): { email: string; nome: string }[] {
  const dests: { email: string; nome: string }[] = []
  const seen = new Set<string>()

  const add = (email: string, nome: string) => {
    const e = (email || '').trim().toLowerCase()
    if (!e || seen.has(e)) return
    seen.add(e)
    dests.push({ email: e, nome })
  }

  // emails da escola (lista interna)
  for (const c of getEmailsContato(unidade)) {
    add(c.email, c.nome)
  }

  // email do solicitante
  if (emailSolicitante) {
    add(emailSolicitante, solicitante)
  }

  return dests
}

export async function notificarChamadoStatusAlterado(chamado: {
  protocolo: string
  unidade: string
  solicitante: string
  tipo: string
  descricao: string
  status: string
  descricaoResolucao?: string | null
  tecnicoResolucao?: string | null
  email: string | null
}) {
  const label = STATUS_LABEL[chamado.status] || chamado.status
  const [badgeBg, badgeColor] = (STATUS_BADGE[chamado.status] || '#f3f4f6;#111827').split(';')
  const resolucao = (chamado.descricaoResolucao || '').trim()

  const destinatarios = obterDestinatarios(chamado.unidade, chamado.solicitante, chamado.email)
  if (destinatarios.length === 0) {
    console.log(`[email] Nenhum destinatário para ${chamado.protocolo}`)
    return
  }

  const assunto = `Atualização do chamado ${chamado.protocolo} — ${label}`
  const textoBase = `O status do seu chamado foi atualizado para "${label}".\n\nProtocolo: ${chamado.protocolo}\nUnidade: ${chamado.unidade}\nSolicitante: ${chamado.solicitante}\nTipo: ${chamado.tipo}${resolucao ? `\n\nO que foi feito:\n${resolucao}` : ''}\n\nObrigado por entrar em contato com o SETEC — URE Leste 3.`

  for (const dest of destinatarios) {
    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 28px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
        <div style="display: inline-block; background: ${badgeBg}; color: ${badgeColor}; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 20px; margin-bottom: 14px;">Status: ${label}</div>
        <h2 style="font-size: 18px; color: #111827; margin: 0 0 4px;">Seu chamado foi atualizado</h2>
        <p style="font-family: 'Courier New', monospace; font-size: 13px; color: #6b7280; margin: 0 0 20px;">${chamado.protocolo}</p>
        <table style="width: 100%; font-size: 14px; color: #374151; border-collapse: collapse;">
          <tr><td style="padding: 6px 0; color: #9ca3af; width: 110px;">Unidade</td><td style="padding: 6px 0;">${chamado.unidade}</td></tr>
          <tr><td style="padding: 6px 0; color: #9ca3af;">Solicitante</td><td style="padding: 6px 0;">${chamado.solicitante}</td></tr>
          <tr><td style="padding: 6px 0; color: #9ca3af;">Tipo</td><td style="padding: 6px 0;">${chamado.tipo}</td></tr>
          <tr><td style="padding: 6px 0; color: #9ca3af; vertical-align: top;">Descrição</td><td style="padding: 6px 0;">${chamado.descricao}</td></tr>
          ${chamado.tecnicoResolucao ? `<tr><td style="padding: 6px 0; color: #9ca3af;">Técnico</td><td style="padding: 6px 0;">${chamado.tecnicoResolucao}</td></tr>` : ''}
          ${resolucao ? `<tr><td style="padding: 6px 0; color: #9ca3af; vertical-align: top;">O que foi feito</td><td style="padding: 6px 0;">${resolucao.replace(/\n/g, '<br>')}</td></tr>` : ''}
        </table>
        <p style="font-size: 12.5px; color: #9ca3af; margin-top: 22px;">Em caso de dúvidas, fale conosco pelo e-mail lt3.seintec@educacao.sp.gov.br.</p>
      </div>`

    await sendBrevoEmail(dest.email, assunto, textoBase, html)
  }
}

export async function notificarChamadoCriado(chamado: {
  protocolo: string
  unidade: string
  solicitante: string
  tipo: string
  descricao: string
  email: string | null
}) {
  const destinatarios = obterDestinatarios(chamado.unidade, chamado.solicitante, chamado.email)
  if (destinatarios.length === 0) {
    console.log(`[email] Nenhum destinatário para ${chamado.protocolo}`)
    return
  }

  const assunto = `Chamado registrado — ${chamado.protocolo}`
  const texto = `Seu chamado foi registrado com sucesso.\n\nProtocolo: ${chamado.protocolo}\nUnidade: ${chamado.unidade}\nSolicitante: ${chamado.solicitante}\nTipo: ${chamado.tipo}\n\nGuarde o número de protocolo. Esta é uma mensagem automática, não responda.`

  for (const dest of destinatarios) {
    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 28px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
        <div style="display: inline-block; background: #eff6ff; color: #1e40af; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 20px; margin-bottom: 14px;">Chamado registrado</div>
        <h2 style="font-size: 18px; color: #111827; margin: 0 0 4px;">Recebemos seu chamado</h2>
        <p style="font-family: 'Courier New', monospace; font-size: 13px; color: #6b7280; margin: 0 0 20px;">${chamado.protocolo}</p>
        <table style="width: 100%; font-size: 14px; color: #374151; border-collapse: collapse;">
          <tr><td style="padding: 6px 0; color: #9ca3af; width: 110px;">Unidade</td><td style="padding: 6px 0;">${chamado.unidade}</td></tr>
          <tr><td style="padding: 6px 0; color: #9ca3af;">Solicitante</td><td style="padding: 6px 0;">${chamado.solicitante}</td></tr>
          <tr><td style="padding: 6px 0; color: #9ca3af;">Tipo</td><td style="padding: 6px 0;">${chamado.tipo}</td></tr>
          <tr><td style="padding: 6px 0; color: #9ca3af; vertical-align: top;">Descrição</td><td style="padding: 6px 0;">${chamado.descricao}</td></tr>
        </table>
        <p style="font-size: 12.5px; color: #9ca3af; margin-top: 22px;">Guarde o protocolo acima. Esta é uma mensagem automática, por favor não responda.</p>
      </div>`

    await sendBrevoEmail(dest.email, assunto, texto, html)
  }
}

export async function notificarChamadoConcluido(chamado: {
  protocolo: string
  unidade: string
  solicitante: string
  tipo: string
  descricao: string
  descricaoResolucao?: string | null
  email: string | null
}) {
  // Mantido para compatibilidade — usa o mesmo fluxo de status alterado
  await notificarChamadoStatusAlterado({
    ...chamado,
    status: 'RESOLVIDO',
    descricaoResolucao: chamado.descricaoResolucao,
    email: chamado.email,
  })
}