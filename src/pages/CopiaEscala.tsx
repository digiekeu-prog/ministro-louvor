/**
 * Página auxiliar: mostra a escala em JSON e deixa copiar.
 *
 * Para que serve: quando o banco do servidor está fora do ar (cota do Neon),
 * o ministro ainda tem a escala salva **no aparelho dele**. Esta página
 * remonta a escala a partir desse cache e mostra o JSON pronto para copiar —
 * é o jeito de gerar a cópia estática (`npm run snapshot`) sem o banco no ar.
 *
 * Não é preciso login e não mostra nada que a pessoa não tenha no próprio
 * aparelho (o cache é local). A URL é `/copia/<id da escala>`.
 */

import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, Copy, LoaderCircle } from 'lucide-react'
import { Button, Card } from '../components/ui'
import { escalaDoCache } from '../lib/escalaLocal'

export function CopiaEscalaPage() {
  const { id } = useParams()
  const [copiado, setCopiado] = useState(false)

  const json = useMemo(() => {
    const escala = escalaDoCache(id ?? '')
    if (!escala) return null
    return JSON.stringify({ escala, geradoEm: new Date().toISOString() }, null, 2)
  }, [id])

  async function copiar() {
    if (!json) return
    try {
      await navigator.clipboard.writeText(json)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2500)
    } catch {
      setCopiado(false)
    }
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-3xl px-4 py-10">
      <Card className="p-5 sm:p-7">
        <h1 className="font-display text-xl font-bold text-white">Cópia da escala</h1>

        {json ? (
          <>
            <p className="mt-2 text-sm text-zinc-400">
              Toque em copiar e cole no WhatsApp (ou envie para quem vai montar a cópia
              estática). O texto leva a equipe, as funções e o repertório com letra e cifra.
            </p>
            <Button className="mt-4" onClick={() => void copiar()}>
              {copiado ? (
                <>
                  <CheckCircle2 size={15} /> Copiado
                </>
              ) : (
                <>
                  <Copy size={15} /> Copiar
                </>
              )}
            </Button>
            <textarea
              readOnly
              value={json}
              className="mt-4 h-72 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-[0.7rem] text-zinc-300"
            />
          </>
        ) : (
          <div className="mt-4 flex items-center gap-2 text-sm text-zinc-400">
            <LoaderCircle size={16} className="animate-spin" />
            Este aparelho não tem a escala salva. Abra o app uma vez com a internet para
            guardar a escala aqui.
          </div>
        )}

        <Link
          to={`/escala/${id ?? ''}`}
          className="mt-6 inline-block text-xs text-neon-cyan underline-offset-4 hover:underline"
        >
          Ver a escala
        </Link>
      </Card>
    </div>
  )
}
