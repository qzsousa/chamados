import { Router } from 'express'
import { isZodError } from '../utils/zodError'
import { authMiddleware, attachUserRecord, requireRole, AuthenticatedRequest } from '../middleware/auth'
import { ChatIASchema, consultarIA } from '../services/ia'

const router = Router()

/**
 * Ponte entre o navegador e os provedores de LLM.
 *
 * ADMIN apenas: e o mesmo perfil que ja ve a tela no portal. O proxy e caro
 * (cota da chave e do servidor), entao nao entra na conta de quem so abre
 * chamado.
 *
 * A chave nao vem no corpo nem na URL - ela fica no ambiente do backend. E o que
 * separa isto de um `VITE_GEMINI_API_KEY`, que o Vite joga no bundle e qualquer
 * pessoa le no console.
 */
router.post(
  '/chat',
  authMiddleware,
  attachUserRecord,
  requireRole('ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    const body = ChatIASchema.parse(req.body)
    const { provedor, resposta } = await consultarIA(body)
    return res.json({ provedor, ...(resposta as object) })
  },
)

export default router