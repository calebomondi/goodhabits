import { Inject, Injectable } from '@nestjs/common'
import { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { and, eq } from 'drizzle-orm'
import { DRIZZLE } from '../drizzle/drizzle.module'
import { positionRegistry } from '../drizzle/schema/position-registry'

@Injectable()
export class PositionRegistryService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
  ) {}

  async registerPosition(tokenId: bigint, tickLower: number, tickUpper: number): Promise<void> {
    await this.db.insert(positionRegistry).values({
      tokenId,
      tickLower,
      tickUpper,
      isActive: true,
    }).onConflictDoUpdate({
      target: positionRegistry.tokenId,
      set: { isActive: true, tickLower, tickUpper },
    })
  }

  async findActivePositionInTickRange(tickLower: number, tickUpper: number): Promise<bigint | null> {
    const positions = await this.db.select()
      .from(positionRegistry)
      .where(and(
        eq(positionRegistry.isActive, true),
        eq(positionRegistry.tickLower, tickLower),
        eq(positionRegistry.tickUpper, tickUpper),
      ))
      .limit(1)
    return positions.length > 0 ? positions[0].tokenId : null
  }

  async deactivatePosition(tokenId: bigint): Promise<void> {
    await this.db.update(positionRegistry)
      .set({ isActive: false })
      .where(eq(positionRegistry.tokenId, tokenId))
  }
}
