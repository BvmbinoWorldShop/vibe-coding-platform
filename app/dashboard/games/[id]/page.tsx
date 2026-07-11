import { games } from '@/lib/basketball/mock-data'
import { GameDetail } from './game-detail'

export function generateStaticParams() {
  return games.map((game) => ({ id: game.id }))
}

export default async function GameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <GameDetail id={id} />
}
