import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common'
import { TreasuryService } from './treasury.service'

@Controller('treasury')
export class TreasuryController {
  constructor(private readonly treasury: TreasuryService) {}

  // ── Writes ──

  @Post('deploy-to-strategy')
  deployToStrategy(@Body() dto: { strategy: string; amount: string }) {
    return this.treasury.deployToStrategy(
      dto.strategy as `0x${string}`,
      BigInt(dto.amount),
    )
  }

  @Post('receive-from-strategy')
  receiveFromStrategy(@Body() dto: { amount: string }) {
    return this.treasury.receiveFromStrategy(BigInt(dto.amount))
  }

  @Post('register-position')
  registerPosition(@Body() dto: { tokenId: string; initialValue: string }) {
    return this.treasury.registerPosition(
      BigInt(dto.tokenId),
      BigInt(dto.initialValue),
    )
  }

  @Post('close-position')
  closePosition(@Body() dto: { tokenId: string; returnedAssets: string }) {
    return this.treasury.closePosition(
      BigInt(dto.tokenId),
      BigInt(dto.returnedAssets),
    )
  }

  @Post('update-position-value')
  updatePositionValue(@Body() dto: { tokenId: string; value: string }) {
    return this.treasury.updatePositionValue(
      BigInt(dto.tokenId),
      BigInt(dto.value),
    )
  }

  @Post('mark-withdrawal-ready')
  markWithdrawalReady(@Body() dto: { requestId: string }) {
    return this.treasury.markWithdrawalReady(BigInt(dto.requestId))
  }

  @Post('finalize-withdrawal')
  finalizeWithdrawal(@Body() dto: { requestId: string }) {
    return this.treasury.finalizeWithdrawal(BigInt(dto.requestId))
  }

  @Post('collect-fees')
  collectFees() {
    return this.treasury.collectFees()
  }

  @Post('claim-fees')
  claimFees(@Body() dto: { recipient: string }) {
    return this.treasury.claimFees(dto.recipient as `0x${string}`)
  }

  @Post('approve-strategy')
  approveStrategy(@Body() dto: { strategy: string }) {
    return this.treasury.approveStrategy(dto.strategy as `0x${string}`)
  }

  @Post('remove-strategy')
  removeStrategy(@Body() dto: { strategy: string }) {
    return this.treasury.removeStrategy(dto.strategy as `0x${string}`)
  }

  // ── Reads ──

  @Get('total-assets')
  totalAssets() {
    return this.treasury.calculateTotalAssets()
  }

  @Get('price-per-share')
  pricePerShare() {
    return this.treasury.pricePerShare()
  }

  @Get('positions/:tokenId')
  position(@Param('tokenId') tokenId: string) {
    return this.treasury.getPosition(BigInt(tokenId))
  }

  @Get('users/:address')
  userPosition(@Param('address') address: string) {
    return this.treasury.getUserPosition(address as `0x${string}`)
  }

  @Get('active-positions')
  activePositions() {
    return this.treasury.getActivePositionIds()
  }

  @Get('assets-to-invest')
  assetsToInvest() {
    return this.treasury.assetsToInvest()
  }

  @Get('deployed-assets')
  deployedAssets() {
    return this.treasury.deployedAssets()
  }

  @Get('reserved-assets')
  reservedAssets() {
    return this.treasury.reservedAssets()
  }

  @Get('total-shares')
  totalShares() {
    return this.treasury.totalShares()
  }

  @Get('accrued-fees')
  accruedFees() {
    return this.treasury.accruedFees()
  }

  @Get('fee-bps')
  feeBps() {
    return this.treasury.feeBps()
  }
}
