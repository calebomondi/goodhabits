import { Controller, Get, Post, Body, Query } from '@nestjs/common'
import { InvestmentService } from './investment.service'

// PLACEHOLDER: Investment withdrawal endpoints
// In the future POST /request will trigger on-chain requestWithdrawal()
// and a worker will process the queue.

@Controller('investment')
export class InvestmentController {
  constructor(private readonly investment: InvestmentService) {}

  @Post('request')
  createRequest(@Body() body: {
    userAddress: string
    amountG: string
  }) {
    return this.investment.createRequest(body)
  }

  @Get('requests')
  getRequests(@Query('user') user?: string) {
    return this.investment.getRequests(user)
  }
}
