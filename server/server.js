const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

const { OpenAI } = require('openai');

dotenv.config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL =
  process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1"

const openai = new OpenAI({
  apiKey: OPENROUTER_API_KEY,
  baseURL: OPENROUTER_BASE_URL,
  defaultHeaders: {
    "HTTP-Referer": "https://github.com/OpenRouterTeam/openrouter-examples",
  },
  // dangerouslyAllowBrowser: true, // Enable this if you used OAuth to fetch a user-scoped `apiKey` above. See https://openrouter.ai/docs#oauth to learn how.
})

const app = express();
app.use(cors());
app.use(express.json());


// Add this test endpoint before your chat endpoint
app.post('/api/test', (req, res) => {
    res.json({ message: 'Backend connection successful!' });
  });

  app.post('/api/chat', async (req, res) => {
    try {
      const { message } = req.body;
      console.log('1. Received request from frontend with message:', message);
      
      console.log('2. Making OpenRouter request...');
      

      // Streaming responses
      const stream = await openai.chat.completions.create({
        model: "openai/gpt-4",
        messages: [{ role: "user", content: message }],
        stream: true,
      })
      for await (const part of stream) {
        const content = part.choices[0]?.delta?.content || "";
        // Send the content to the frontend
        console.log(content);
        res.write(content);  
      }
      res.end();

    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ 
        error: 'Something went wrong',
        details: error.message 
      });
    }
  });
  

const startServer = async (initialPort) => {
  let currentPort = initialPort;
  
  const tryPort = (port) => {
    return new Promise((resolve, reject) => {
      const server = app.listen(port)
        .once('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            resolve(false);
          } else {
            reject(err);
          }
        })
        .once('listening', () => {
          resolve(server);
        });
    });
  };

  while (currentPort < initialPort + 100) { // Try up to 100 ports
    try {
      const server = await tryPort(currentPort);
      if (server) {
        console.log(`Server running on port ${currentPort}`);
        // Store the active port so the frontend can use it
        app.locals.port = currentPort;
        return server;
      }
      console.log(`Port ${currentPort} in use, trying ${currentPort + 1}...`);
      currentPort++;
    } catch (err) {
      console.error('Error starting server:', err);
      process.exit(1);
    }
  }
  
  console.error('Could not find an available port');
  process.exit(1);
};

const PORT = process.env.PORT || 5000;
startServer(PORT);