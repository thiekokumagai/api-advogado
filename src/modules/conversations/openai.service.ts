import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

export interface ChatContextItem {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AttachmentContextItem {
  fileName: string;
  extractedText?: string | null;
}

@Injectable()
export class OpenAiService {
  private openai: OpenAI | null = null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && apiKey.trim().length > 0) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  // Zero 'if' hardcoding: takes systemPrompt straight from DB assistant record,
  // appends document attachments context, conversation history, and current message.
  async generateCompletion(
    systemPrompt: string,
    history: ChatContextItem[],
    currentMessage: string,
    attachments: AttachmentContextItem[] = [],
  ): Promise<{ content: string; tokensUsed?: number }> {
    let finalSystemPrompt = systemPrompt;

    if (attachments.length > 0) {
      finalSystemPrompt += '\n\n==================================================\n';
      finalSystemPrompt += 'INSTRUÇÃO DE ACESSO A DOCUMENTOS ANEXADOS:\n';
      finalSystemPrompt += 'O usuário enviou arquivo(s) PDF/DOCX para esta conversa. O sistema JÁ EXTRAIU O TEXTO INTEGRAL de cada documento e forneceu a seguir.\n';
      finalSystemPrompt += 'Você TEM ACESSO DIRETO ao conteúdo textual completo desses anexos. NUNCA RESPONDA dizendo que não pode acessar ou analisar arquivos diretamente, pois todo o texto dos documentos já está disponível abaixo:\n';
      finalSystemPrompt += '==================================================\n';

      attachments.forEach((att, idx) => {
        finalSystemPrompt += `\n--- ARQUIVO ANEXADO Nº ${idx + 1}: ${att.fileName} ---\n`;
        finalSystemPrompt += `Conteúdo do arquivo:\n"""\n${att.extractedText || '(Sem texto extraível no arquivo)'}\n"""\n`;
      });

      finalSystemPrompt += '==================================================\n';
      finalSystemPrompt += 'Examine o texto dos documentos anexados acima e utilize-o como base principal para elaborar a resposta, petição, análise ou parecer solicitado pelo usuário.\n';
    }

    let finalUserMessage = currentMessage;
    if (attachments.length > 0) {
      finalUserMessage = `${currentMessage}\n\n[Analise os documentos anexados: ${attachments.map((a) => a.fileName).join(', ')}]`;
    }

    const messagesPayload: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: finalSystemPrompt },
      ...history.map((h) => ({
        role: h.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: h.content,
      })),
      { role: 'user', content: finalUserMessage },
    ];

    if (!this.openai) {
      // Fallback response generator if OPENAI_API_KEY is not configured yet
      return this.generateMockLegalResponse(finalSystemPrompt, currentMessage, attachments);
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: messagesPayload,
        temperature: 0.3,
        max_tokens: 2500,
      });

      const content = response.choices[0]?.message?.content || 'Não foi possível obter resposta da IA.';
      const tokensUsed = response.usage?.total_tokens;

      return { content, tokensUsed };
    } catch (error: any) {
      console.error('Erro na chamada da API da OpenAI:', error?.message || error);
      throw new Error(`Falha na comunicação com a API da OpenAI: ${error?.message || 'Erro desconhecido'}`);
    }
  }

  private generateMockLegalResponse(
    systemPrompt: string,
    userQuery: string,
    attachments: AttachmentContextItem[],
  ): { content: string; tokensUsed: number } {
    const hasDocs = attachments.length > 0;
    const docNotice = hasDocs
      ? `\n\n📌 **Análise baseada nos documentos anexados (${attachments.map((a) => a.fileName).join(', ')}):**\nOs dados contratuais e fatos indicados no arquivo foram correlacionados com o pedido.`
      : '';

    const content = `### Análise Jurídica Processual

Em atenção à sua solicitação quanto a "**${userQuery}**", apresentamos a fundamentação jurídica recomendada:${docNotice}

#### 1. Do Enquadramento Legal e Jurisprudência
Conforme a legislação processual civil vigente (CPC/2015) e a doutrina majoritária, a tese em questão encontra amparo nos princípios da boa-fé objetiva, do contraditório e da ampla defesa (Art. 5º, LV, CF/88).

#### 2. Fundamentação Recomendada para a Peça
- **Base Legal Principal:** Art. 300 e seguintes do Código de Processo Civil.
- **Precedente STJ:** Recurso Especial de referência pacificando a responsabilidade civil integral e o dever de reparação.

#### 3. Conclusão e Próximos Passos
Recomenda-se a instrução da petição com os documentos comprobatórios das alegações formuladas, requerendo a citação da parte contrária e a procedência integral dos pedidos.

---
*Nota: Para respostas em tempo real com GPT-4o, configure sua chave \`OPENAI_API_KEY\` no arquivo \`.env\` da API NestJS.*`;

    return { content, tokensUsed: 420 };
  }
}
