import nodemailer from 'nodemailer'
import { env } from '../config/env'
import { getEmailsContato, EmailContato } from './normalization'

function getTransporter() {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) return null
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT || 587,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }
  })
}

async function sendEmail(to: string, subject: string, text: string, html: string) {
  const transporter = getTransporter()
  if (!transporter) {
    console.log(`[email] SMTP não configurado — e-mail não enviado para ${to} (${subject})`)
    return
  }
  try {
    await transporter.sendMail({
      from: env.EMAIL_FROM || env.SMTP_USER,
      to,
      subject,
      text,
      html
    })
  } catch (e) {
    console.error(`[email] Erro ao enviar para ${to}:`, e)
  }
}

function escapar(v: unknown): string {
  return String(v ?? '')
}

// Junta os e-mails de contato da escola + o e-mail do solicitante, sem duplicar
function obterDestinatarios(unidade: string, solicitante: string, emailSolicitante: string | null): EmailContato[] {
  const dests: EmailContato[] = []
  const vistos = new Set<string>()
  const add = (nome: string, email: string) => {
    const e = (email || '').trim().toLowerCase()
    if (!e || vistos.has(e)) return
    vistos.add(e)
    dests.push({ nome, email: e })
  }

  for (const d of getEmailsContato(unidade)) add(d.nome, d.email)
  if (emailSolicitante) add(solicitante, emailSolicitante)

  return dests
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
  let destinatarios: EmailContato[] = getEmailsContato(chamado.unidade)

  if (destinatarios.length === 0 && (chamado.email || '').trim()) {
    destinatarios = [{ nome: chamado.solicitante, email: chamado.email as string }]
  }

  if (destinatarios.length === 0) {
    console.log(`[email] Nenhum e-mail de contato para notificar conclusão do ${chamado.protocolo}`)
    return
  }

  const assunto = `Chamado concluído — ${chamado.protocolo} (${chamado.unidade})`
  const resolucao = (chamado.descricaoResolucao || '').trim()
  const textoBase = `Seu chamado foi concluído.\n\nProtocolo: ${chamado.protocolo}\nUnidade: ${chamado.unidade}\nSolicitante: ${chamado.solicitante}\nTipo: ${chamado.tipo}${resolucao ? `\n\nO que foi feito:\n${resolucao}` : ''}\n\nObrigado por entrar em contato com o SETEC — URE Leste 3.`

  for (const dest of destinatarios) {
    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 28px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
        <div style="display: inline-block; background: #ecfdf5; color: #065f46; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 20px; margin-bottom: 14px;">Chamado concluído</div>
        <h2 style="font-size: 18px; color: #111827; margin: 0 0 4px;">Seu chamado foi resolvido</h2>
        <p style="font-family: 'Courier New', monospace; font-size: 13px; color: #6b7280; margin: 0 0 20px;">${escapar(chamado.protocolo)}</p>
        <table style="width: 100%; font-size: 14px; color: #374151; border-collapse: collapse;">
          <tr><td style="padding: 6px 0; color: #9ca3af; width: 110px;">Unidade</td><td style="padding: 6px 0;">${escapar(chamado.unidade)}</td></tr>
          <tr><td style="padding: 6px 0; color: #9ca3af;">Solicitante</td><td style="padding: 6px 0;">${escapar(chamado.solicitante)}</td></tr>
          <tr><td style="padding: 6px 0; color: #9ca3af;">Tipo</td><td style="padding: 6px 0;">${escapar(chamado.tipo)}</td></tr>
          <tr><td style="padding: 6px 0; color: #9ca3af; vertical-align: top;">Descrição</td><td style="padding: 6px 0;">${escapar(chamado.descricao)}</td></tr>
          ${resolucao ? `<tr><td style="padding: 6px 0; color: #9ca3af; vertical-align: top;">O que foi feito</td><td style="padding: 6px 0;">${escapar(resolucao).replace(/\n/g, '<br>')}</td></tr>` : ''}
        </table>
        <p style="font-size: 12.5px; color: #9ca3af; margin-top: 22px;">Agradecemos o contato. Em caso de dúvidas, fale conosco pelo e-mail lt3.setec@educacao.sp.gov.br.</p>
      </div>`

    await sendEmail(dest.email, assunto, textoBase, html)
  }
}

const STATUS_LABEL: Record<string, string> = {
  ABERTO: 'Aberto',
  ANDAMENTO: 'Em andamento',
  COMUNICADO: 'Comunicado',
  RESOLVIDO: 'Resolvido'
}

const STATUS_BADGE: Record<string, string> = {
  ABERTO: '#fef3c7;#92400e',
  ANDAMENTO: '#dbeafe;#1e40af',
  COMUNICADO: '#e0e7ff;#3730a3',
  RESOLVIDO: '#ecfdf5;#065f46'
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
  const destinatarios = obterDestinatarios(chamado.unidade, chamado.solicitante, chamado.email)

  if (destinatarios.length === 0) {
    console.log(`[email] Nenhum e-mail de contato para notificar mudança de status do ${chamado.protocolo}`)
    return
  }

  const label = STATUS_LABEL[chamado.status] || chamado.status
  const [badgeBg, badgeColor] = (STATUS_BADGE[chamado.status] || '#f3f4f6;#111827').split(';')
  const resolucao = (chamado.descricaoResolucao || '').trim()

  const assunto = `Atualização do chamado ${chamado.protocolo} — ${label}`
  const textoBase = `O status do seu chamado foi atualizado para "${label}".\n\nProtocolo: ${chamado.protocolo}\nUnidade: ${chamado.unidade}\nSolicitante: ${chamado.solicitante}\nTipo: ${chamado.tipo}${resolucao ? `\n\nO que foi feito:\n${resolucao}` : ''}\n\nObrigado por entrar em contato com o SETEC — URE Leste 3.`

  for (const dest of destinatarios) {
    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 28px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
        <div style="display: inline-block; background: ${badgeBg}; color: ${badgeColor}; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 20px; margin-bottom: 14px;">Status: ${label}</div>
        <h2 style="font-size: 18px; color: #111827; margin: 0 0 4px;">Seu chamado foi atualizado</h2>
        <p style="font-family: 'Courier New', monospace; font-size: 13px; color: #6b7280; margin: 0 0 20px;">${escapar(chamado.protocolo)}</p>
        <table style="width: 100%; font-size: 14px; color: #374151; border-collapse: collapse;">
          <tr><td style="padding: 6px 0; color: #9ca3af; width: 110px;">Unidade</td><td style="padding: 6px 0;">${escapar(chamado.unidade)}</td></tr>
          <tr><td style="padding: 6px 0; color: #9ca3af;">Solicitante</td><td style="padding: 6px 0;">${escapar(chamado.solicitante)}</td></tr>
          <tr><td style="padding: 6px 0; color: #9ca3af;">Tipo</td><td style="padding: 6px 0;">${escapar(chamado.tipo)}</td></tr>
          <tr><td style="padding: 6px 0; color: #9ca3af; vertical-align: top;">Descrição</td><td style="padding: 6px 0;">${escapar(chamado.descricao)}</td></tr>
          ${chamado.tecnicoResolucao ? `<tr><td style="padding: 6px 0; color: #9ca3af;">Técnico</td><td style="padding: 6px 0;">${escapar(chamado.tecnicoResolucao)}</td></tr>` : ''}
          ${resolucao ? `<tr><td style="padding: 6px 0; color: #9ca3af; vertical-align: top;">O que foi feito</td><td style="padding: 6px 0;">${escapar(resolucao).replace(/\n/g, '<br>')}</td></tr>` : ''}
        </table>
        <p style="font-size: 12.5px; color: #9ca3af; margin-top: 22px;">Em caso de dúvidas, fale conosco pelo e-mail lt3.seintec@educacao.sp.gov.br.</p>
      </div>`

    await sendEmail(dest.email, assunto, textoBase, html)
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
  if (destinatarios.length === 0) return

  const assunto = `Chamado registrado — ${chamado.protocolo}`
  const textoAlternativo = `Seu chamado foi registrado com sucesso.\n\nProtocolo: ${chamado.protocolo}\nUnidade: ${chamado.unidade}\nSolicitante: ${chamado.solicitante}\nTipo: ${chamado.tipo}\n\nGuarde o número de protocolo. Esta é uma mensagem automática, não responda.`

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 28px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
      <div style="display: inline-block; background: #eff6ff; color: #1e40af; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 20px; margin-bottom: 14px;">Chamado registrado</div>
      <h2 style="font-size: 18px; color: #111827; margin: 0 0 4px;">Recebemos seu chamado</h2>
      <p style="font-family: 'Courier New', monospace; font-size: 13px; color: #6b7280; margin: 0 0 20px;">${escapar(chamado.protocolo)}</p>
      <table style="width: 100%; font-size: 14px; color: #374151; border-collapse: collapse;">
        <tr><td style="padding: 6px 0; color: #9ca3af; width: 110px;">Unidade</td><td style="padding: 6px 0;">${escapar(chamado.unidade)}</td></tr>
        <tr><td style="padding: 6px 0; color: #9ca3af;">Solicitante</td><td style="padding: 6px 0;">${escapar(chamado.solicitante)}</td></tr>
        <tr><td style="padding: 6px 0; color: #9ca3af;">Tipo</td><td style="padding: 6px 0;">${escapar(chamado.tipo)}</td></tr>
        <tr><td style="padding: 6px 0; color: #9ca3af; vertical-align: top;">Descrição</td><td style="padding: 6px 0;">${escapar(chamado.descricao)}</td></tr>
      </table>
      <p style="font-size: 12.5px; color: #9ca3af; margin-top: 22px;">Guarde o protocolo acima. Esta é uma mensagem automática, por favor não responda.</p>
    </div>`

  for (const dest of destinatarios) {
    await sendEmail(dest.email, assunto, textoAlternativo, html)
  }
}