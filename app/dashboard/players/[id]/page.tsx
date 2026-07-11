import { players } from '@/lib/basketball/mock-data'
import { PlayerDetail } from './player-detail'

export function generateStaticParams() {
  return players.map((player) => ({ id: player.id }))
}

export default async function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PlayerDetail id={id} />
}
