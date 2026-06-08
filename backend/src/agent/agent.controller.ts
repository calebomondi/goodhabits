import { Body, Controller, Post } from '@nestjs/common'
import { AgentService, type ChatRequest, type ChatResponse } from './agent.service'

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('chat')
  async chat(@Body() body: ChatRequest): Promise<ChatResponse> {
    return this.agentService.chat(body)
  }
}
