import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Inicializacija Gemini
const genAI = new GoogleGenerativeAI('');  // ⬅️ TVOJ KEY!

const MCP_SERVER_URL = 'http://localhost:3002';

// Pridobi seznam orodij iz MCP serverja
async function getTools() {
  const response = await fetch(`${MCP_SERVER_URL}/tools`);
  const data = await response.json();
  return data.tools;
}

// Kliči orodje na MCP serverju
async function callTool(name, args) {
  const response = await fetch(`${MCP_SERVER_URL}/call-tool`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, arguments: args })
  });
  return await response.json();
}

async function chatWithGemini(userMessage, history = []) {
  const tools = await getTools();
  
  const geminiTools = {
    functionDeclarations: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }))
  };

  const systemInstruction = `Si asistent za SQL bazo zaposlenih. Imaš dostop do naslednjih orodij:

1. mysql:listEmployees - Uporabi to orodje za pridobitev seznama zaposlenih in njihovih plač. To orodje NE potrebuje nobenih parametrov.

2. mysql:salaryFor - Uporabi to orodje za pridobitev plače za specifičnega zaposlenega. Potrebuje parameter "name" (polno ime).

3. mysql:executeSQL - Uporabi to samo za kompleksne SQL poizvedbe.

POMEMBNO:
- Ko uporabnik vpraša za imena zaposlenih, seznam zaposlenih, plače, itd. VEDNO uporabi orodje mysql:listEmployees TAKOJ.
- NE sprašuj uporabnika za SQL poizvedbe
- NE sprašuj za imena tabel ali stolpcev
- SAMODEJNO izberi pravilno orodje in ga pokliči
- Tabela employees ima stolpce: emp_no, first_name, last_name, birth_date, gender, hire_date
- KO DOBIŠ PODATKE IZ ORODJA, VRNI SAMO RAW JSON BREZ DODATNEGA BESEDILA
- Če orodje vrne JSON, ti vrni SAMO ta JSON brez komentarjev`;

  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash-exp',
    systemInstruction: systemInstruction
  });

  const chat = model.startChat({
    history: history,
    tools: [geminiTools]
  });

  let iterations = 0;
  const maxIterations = 10;
  let currentMessage = userMessage;

  while (iterations < maxIterations) {
    iterations++;
    
    const result = await chat.sendMessage(currentMessage);
    const response = result.response;

    console.log(`\n=== Iteracija ${iterations} ===`);

    const functionCalls = response.functionCalls();
    
    if (!functionCalls || functionCalls.length === 0) {
      const fullResponse = response.text();
      console.log('Končen odgovor:', fullResponse);

      // ➕ JSON PARSER
      try {
        const jsonMatch = fullResponse.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          return {
            response: jsonMatch[1],
            iterations: iterations
          };
        }

        const parsed = JSON.parse(fullResponse);
        return {
          response: JSON.stringify(parsed),
          iterations: iterations
        };
      } catch (e) {
        // Ni JSON – vrni tekst
      }

      return {
        response: fullResponse,
        iterations: iterations
      };
    }

    const functionResponses = [];
    
    for (const call of functionCalls) {
      console.log(`📞 Kličem orodje: ${call.name}`, call.args);
      
      try {
        const result = await callTool(call.name, call.args);

        let resultText = '';
        if (result.content && Array.isArray(result.content)) {
          resultText = result.content
            .filter(c => c.type === 'text')
            .map(c => c.text)
            .join('\n');
        }
        
        console.log('✓ Rezultat orodja:', resultText.substring(0, 200) + '...');

        functionResponses.push({
          functionResponse: {
            name: call.name,
            response: {
              result: resultText
            }
          }
        });
      } catch (error) {
        console.error('✗ Napaka pri klicu orodja:', error);
        functionResponses.push({
          functionResponse: {
            name: call.name,
            response: {
              error: error.message
            }
          }
        });
      }
    }

    currentMessage = functionResponses;
  }

  return {
    response: 'Dosegel sem maksimalno število iteracij.',
    iterations: iterations
  };
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Sporočilo je obvezno' });
    }

    const geminiHistory = history.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const result = await chatWithGemini(message, geminiHistory);

    res.json({
      response: result.response,
      iterations: result.iterations
    });

  } catch (error) {
    console.error('Napaka:', error);
    res.status(500).json({ 
      error: 'Napaka pri obdelavi zahteve',
      details: error.message 
    });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    const mcpResponse = await fetch(`${MCP_SERVER_URL}/tools`);
    const mcpOk = mcpResponse.ok;
    res.json({ 
      status: 'ok',
      mcpConnected: mcpOk,
      aiModel: 'Gemini 2.0 Flash'
    });
  } catch {
    res.json({ 
      status: 'ok',
      mcpConnected: false,
      aiModel: 'Gemini 2.0 Flash'
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n✓ Backend server teče na http://localhost:${PORT}`);
  console.log(`✓ AI Model: Google Gemini 2.0 Flash`);
  console.log(`✓ Povezujem se z MCP serverjem na ${MCP_SERVER_URL}\n`);
});
