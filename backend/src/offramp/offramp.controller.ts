import { Controller, Get, Post, Param, Body, Query, Inject } from '@nestjs/common'
import { type WalletClient } from 'viem'
import { WALLET_CLIENT } from '../modules/viem.provider'
import { OfframpService } from './offramp.service'

@Controller('offramp')
export class OfframpController {
  constructor(
    private readonly offramp: OfframpService,
    @Inject(WALLET_CLIENT) private readonly walletClient: WalletClient,
  ) {}

  @Get('rate')
  rate(@Query('currency') currency = 'USD') {
    return this.offramp.getRate(currency)
  }

  @Get('beneficiary')
  beneficiary() {
    return { address: this.walletClient.account!.address }
  }

  @Post('request')
  createRequest(@Body() body: {
    userAddress: string
    amountG: string
    amountFiat: string
    rateUsed: string
    targetCurrency: string
    usdcRecipient?: string
    beneficiary?: string
    txHash?: string
  }) {
    return this.offramp.createRequest(body)
  }

  @Get('requests')
  getRequests(@Query('address') address?: string) {
    return this.offramp.getRequests(address)
  }

  @Get('requests/:id')
  getRequest(@Param('id') id: string) {
    return this.offramp.getRequests().then(rows => rows.find(r => r.id === Number(id)))
  }
}
