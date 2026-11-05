import type { Member, Presence, Service, ServiceSong, Song } from './types'

const DAY = 86400000

function iso(offsetDays: number) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`
}

export const seedMembers: Member[] = [
  {
    id: 'mem_danilo',
    name: 'Danilo Moreira',
    phone: '(11) 98888-1200',
    category: 'admin',
    skills: ['Ministro', 'Teclado', 'Backing Vocal'],
    hue: 190,
    active: true,
    notes: 'Ministro líder da equipe.',
  },
  {
    id: 'mem_renata',
    name: 'Renata Lima',
    phone: '(11) 97777-3412',
    category: 'vocal',
    skills: ['Backing Vocal', 'Coral'],
    hue: 275,
    active: true,
  },
  {
    id: 'mem_wesley',
    name: 'Wesley Prado',
    phone: '(11) 96666-7788',
    category: 'instrumentista',
    skills: ['Teclado'],
    hue: 205,
    active: true,
  },
  {
    id: 'mem_joao',
    name: 'João Pedro Alves',
    phone: '(11) 95555-9012',
    category: 'instrumentista',
    skills: ['Guitarra', 'Violão'],
    hue: 42,
    active: true,
  },
  {
    id: 'mem_camila',
    name: 'Camila Ferreira',
    phone: '(11) 94444-2255',
    category: 'instrumentista',
    skills: ['Violão'],
    hue: 330,
    active: true,
  },
  {
    id: 'mem_marcos',
    name: 'Marcos Vinícius',
    phone: '(11) 93333-8811',
    category: 'instrumentista',
    skills: ['Baixo'],
    hue: 150,
    active: true,
  },
  {
    id: 'mem_thiago',
    name: 'Thiago Ribeiro',
    phone: '(11) 92222-5500',
    category: 'instrumentista',
    skills: ['Bateria', 'Percussão'],
    hue: 18,
    active: true,
  },
  {
    id: 'mem_paula',
    name: 'Paula Mendes',
    phone: '(11) 91111-4433',
    category: 'vocal',
    skills: ['Backing Vocal', 'Vocal Solo'],
    hue: 262,
    active: true,
  },
  {
    id: 'mem_yuri',
    name: 'Yuri Santos',
    phone: '(11) 90000-7781',
    category: 'vocal',
    skills: ['Coral', 'Backing Vocal'],
    hue: 95,
    active: true,
  },
  {
    id: 'mem_lucas',
    name: 'Lucas Andrade',
    phone: '(11) 98888-0099',
    category: 'instrumentista',
    skills: ['Cajón', 'Percussão'],
    hue: 230,
    active: false,
    notes: 'Em hiatus até o mês que vem.',
  },
  {
    id: 'mem_rafael',
    name: 'Rafael Nunes',
    // Equipe técnica: sem e-mail — só visualiza a escala pelo link público.
    phone: '(11) 98888-4421',
    category: 'tecnica',
    skills: ['Mesa de som', 'Projeção'],
    hue: 48,
    active: true,
    notes: 'Opera a mesa de som e a projeção.',
  },
]

const now = new Date().toISOString()

export const seedSongs: Song[] = [
  {
    id: 'song_doces',
    title: 'A Doçura do Teu Falar',
    artist: 'Diante do Trono, Fernanda Brum, Eyshila',
    link: 'https://www.youtube.com/watch?v=NNiMcbucVpA&list=RDNNiMcbucVpA&start_radio=1',
    key: 'A',
    progression: 'A | D | E | F#m',
    bpm: 72,
  },
  {
    id: 'song_coracao',
    title: 'O Que Diz Meu Coração',
    artist: 'Fernanda Brum',
    link: 'https://www.youtube.com/watch?v=g_ImJKuldpU',
    key: 'D',
    progression: 'D | A | Bm | G',
    bpm: 76,
  },
  {
    id: 'song_fiel',
    title: 'Fiel a Mim',
    artist: 'Eyshila',
    link: 'https://www.youtube.com/watch?v=YpVOtGszqdM',
    key: 'G',
    progression: 'G | C | D | Em',
    bpm: 74,
  },
  {
    id: 'song_exercitos',
    title: 'Senhor dos Exércitos',
    artist: 'Isaias Saad',
    link: 'https://www.youtube.com/watch?v=OnFAsLOlEKo',
    key: 'E',
    progression: 'E | A | B | C#m',
    bpm: 68,
  },
  {
    id: 'song_oceano',
    title: 'Oceano',
    artist: 'Djavan',
    link: 'https://www.youtube.com/watch?v=MWh78SM5G7k',
    key: 'Bb',
    progression: 'Bb | Eb | F | Gm',
    bpm: 64,
  },
  {
    id: 'song_calarei',
    title: 'Não Me Calarei',
    artist: 'Aline Barros',
    link: 'https://www.youtube.com/watch?v=RJzahWF86uo',
    key: 'C',
    progression: 'C | G | Am | F',
    bpm: 84,
  },
  {
    id: 'song_teamar',
    title: 'Te Amar',
    artist: 'Nívea Soares',
    link: 'https://www.youtube.com/watch?v=q62nCWB28d0',
    key: 'A',
    progression: 'A | D | E | F#m',
    bpm: 78,
  },
  {
    id: 'song_alabastro',
    title: 'Vaso de Alabastro',
    artist: 'Fernanda Brum',
    link: 'https://www.youtube.com/watch?v=1Cb2j0FJGGI',
    key: 'G',
    progression: 'G | C | D | Em',
    bpm: 72,
  },
  {
    id: 'song_grande',
    title: 'Grande é o Senhor',
    artist: 'Morada',
    link: 'https://www.youtube.com/watch?v=-FdwIdtQcqA',
    key: 'D',
    progression: 'D | A | Bm | G',
    bpm: 70,
  },
  {
    id: 'song_grace',
    title: 'Amazing Grace',
    artist: 'John Newton',
    link: 'https://www.youtube.com/watch?v=o9IMdDzoaws',
    key: 'G',
    progression: 'G | C | D | Em',
    chords: `G                              C
Amazing grace! how sweet the sound
                   G                    C
That saved a wretch like me!
        G         D          Em
I once was lost, but now am found
        C         G
Was blind, but now I see.

     G                    C
'Twas grace that taught my heart to fear,
         G              D        Em
And grace my fears relieved;
        C        G
How precious did that grace appear
        D       G
The hour I first believed!`,    bpm: 92,
    // Letra em domínio público (John Newton, 1779) — exemplo completo.
    lyrics: `Amazing grace! how sweet the sound
That saved a wretch like me!
I once was lost, but now am found,
Was blind, but now I see.

'Twas grace that taught my heart to fear,
And grace my fears relieved;
How precious did that grace appear
The hour I first believed!

Through many dangers, toils and snares,
I have already come;
'Tis grace hath brought me safe thus far,
And grace will lead me home.

And when on Jordan's stormy banks
I stand, and mine eyes behold,
The promised land of Canaan
O'er Jordan's rolling flow.

'Tis grace hath guided me thus far,
And shall at last lead me,
To bliss where I shall endless be
In perfect love with Thee.`,
  },
]

/** Copia uma musica do catalogo global para o culto (preserva link, letra e cifra). */
function pick(songId: string): ServiceSong {
  const source = seedSongs.find((song) => song.id === songId)
  if (!source) return { title: 'Musica desconhecida' }
  const { id: _id, ...rest } = source
  return { ...rest }
}
export const seedServices: Service[] = [
  {
    id: 'svc_domingo',
    title: 'Culto Domingo — Manhã',
    date: iso(0),
    time: '09:00',
    location: 'Templo Central',
    status: 'confirmado',
    songs: [pick('song_doces'), pick('song_coracao'), pick('song_fiel'), pick('song_exercitos')],
    notes: 'Levar transparências. Chegar 30 min antes para o teste de som.',
    createdAt: now,
    updatedAt: now,
    slots: [
      { id: 's1', category: 'vocal', functionName: 'Ministro', memberId: 'mem_danilo' },
      { id: 's2', category: 'vocal', functionName: 'Backing Vocal', memberId: 'mem_renata' },
      { id: 's3', category: 'vocal', functionName: 'Backing Vocal', memberId: 'mem_paula' },
      { id: 's4', category: 'vocal', functionName: 'Coral', memberId: 'mem_yuri' },
      { id: 's5', category: 'instrumentista', functionName: 'Teclado', memberId: 'mem_wesley' },
      { id: 's6', category: 'instrumentista', functionName: 'Violão', memberId: 'mem_camila' },
      { id: 's7', category: 'instrumentista', functionName: 'Baixo', memberId: 'mem_marcos' },
      { id: 's8', category: 'instrumentista', functionName: 'Guitarra', memberId: 'mem_joao' },
      { id: 's9', category: 'instrumentista', functionName: 'Bateria', memberId: 'mem_thiago' },
      { id: 's1t', category: 'tecnica', functionName: 'Mesa de som', memberId: 'mem_rafael' },
      { id: 's2t', category: 'tecnica', functionName: 'Projeção' },
    ],
  },
  {
    id: 'svc_quarta',
    title: 'Encontro de Jovens',
    date: iso(3),
    time: '19:30',
    location: 'Sala 2',
    status: 'rascunho',
    songs: [pick('song_exercitos'), pick('song_teamar')],
    notes: 'Ainda falta fechar a Guitarra.',
    createdAt: now,
    updatedAt: now,
    slots: [
      { id: 's10', category: 'vocal', functionName: 'Ministro', memberId: 'mem_danilo' },
      { id: 's11', category: 'vocal', functionName: 'Backing Vocal', memberId: 'mem_paula' },
      { id: 's12', category: 'instrumentista', functionName: 'Teclado', memberId: 'mem_wesley' },
      { id: 's13', category: 'instrumentista', functionName: 'Violão', memberId: 'mem_joao' },
      { id: 's14', category: 'instrumentista', functionName: 'Baixo' },
    ],
  },
  {
    id: 'svc_sabado',
    title: 'Culto Sábado — Noite',
    date: iso(6),
    time: '20:00',
    location: 'Templo Central',
    status: 'rascunho',
    songs: [pick('song_grace'), pick('song_grande')],
    createdAt: now,
    updatedAt: now,
    slots: [
      { id: 's15', category: 'vocal', functionName: 'Ministro', memberId: 'mem_danilo' },
      { id: 's16', category: 'instrumentista', functionName: 'Teclado' },
    ],
  },
  {
    id: 'svc_passado',
    title: 'Culto Domingo — Noite',
    date: iso(-7),
    time: '19:00',
    location: 'Templo Central',
    status: 'realizado',
    songs: [pick('song_calarei'), pick('song_alabastro'), pick('song_oceano')],
    createdAt: now,
    updatedAt: now,
    slots: [
      { id: 's17', category: 'vocal', functionName: 'Ministro', memberId: 'mem_danilo' },
      { id: 's18', category: 'vocal', functionName: 'Backing Vocal', memberId: 'mem_renata' },
      { id: 's19', category: 'instrumentista', functionName: 'Teclado', memberId: 'mem_wesley' },
      { id: 's20', category: 'instrumentista', functionName: 'Baixo', memberId: 'mem_marcos' },
    ],
  },
]

export const seedPresence: Presence[] = [
  { memberId: 'mem_danilo', serviceId: 'svc_domingo', confirmed: true, respondedAt: now },
  { memberId: 'mem_wesley', serviceId: 'svc_domingo', confirmed: true, respondedAt: now },
  { memberId: 'mem_renata', serviceId: 'svc_domingo', confirmed: false },
]

export const SEED_VERSION = `v1-${DAY}`
