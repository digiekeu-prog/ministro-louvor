/**
 * Interface do "banco" do ministerial.
 *
 * Existem duas implementações:
 *  - Postgres (Neon) no ar, em produção;
 *  - um arquivo JSON local, para desenvolvimento sem banco.
 */

import type { Collection, SyncChange, SyncOp } from '../../src/lib/syncState'

export interface Store {
  /** Cria o schema (idempotente). */
  ensure(): Promise<void>
  /** Log inteiro (ou só de uma coleção). */
  allChanges(collection?: Collection): Promise<SyncChange[]>
  /** Operações posteriores a uma versão. */
  changesSince(seq: number, limit?: number): Promise<SyncChange[]>
  /** Acrescenta operações ao log. */
  append(ops: SyncOp[], actor: string | null): Promise<SyncChange[]>
  /** Valor de metadado (ex.: o segredo dos tokens). */
  meta(key: string): Promise<string | null>
  /** Grava metadado. */
  setMeta(key: string, value: string): Promise<void>
}
