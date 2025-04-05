import React, { useState, useEffect } from 'react';
import './App.css';
import MiniKitProvider from './components/MiniKitProvider';
import { MiniKit, VerifyCommandInput, VerificationLevel, ISuccessResult } from '@worldcoin/minikit-js'

function App() {
  const [messages, setMessages] = useState([]);
  // const [serverLogs, setServerLogs] = useState([]);
  const [input, setInput] = useState('');
  const [streamingText, setStreamingText] = useState('');

  const [connectionStatus, setConnectionStatus] = useState('Testing connection...');
  const [currentResponse, setCurrentResponse] = useState('');

  // Test connection on component mount
  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      const data = await response.json();
      setConnectionStatus(data.message);
    } catch (error) {
      setConnectionStatus('Connection failed: ' + error.message);
    }
  };

  const sendMessage = async (message) => {
    try {
      // Add user message to chat
      setMessages(prev => [...prev, { role: 'user', content: message }]);
      setStreamingText(''); // Clear previous response

      const response = await fetch('http://localhost:5001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      // Read the response as a stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // Read the stream
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        // Decode the chunk and update the current response
        const text = decoder.decode(value);
        setStreamingText(prev => prev + text);
      }

      // After stream is complete, add the full response to messages
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: streamingText 
      }]);

    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { 
        role: 'system', 
        content: `Error: ${error.message}` 
      }]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  };

  const handleVerification = async () => {
    try {
      const verifyPayload = {
        action: 'voting-action', // Replace with your action ID from Developer Portal
        signal: '0x12312', // Optional additional data
        verification_level: VerificationLevel.Orb, // Orb | Device
      };

      if (MiniKit.isInstalled()) {
        const result = await MiniKit.verify(verifyPayload);
        console.log('Verification result:', result);
        // Handle successful verification
        setMessages(prev => [...prev, { 
          role: 'system', 
          content: 'Verification successful!' 
        }]);
      } else {
        console.log('MiniKit not installed');
        setMessages(prev => [...prev, { 
          role: 'system', 
          content: 'Please open this app in World App' 
        }]);
      }
    } catch (error) {
      console.error('Verification error:', error);
      setMessages(prev => [...prev, { 
        role: 'system', 
        content: `Verification error: ${error.message}` 
      }]);
    }
  };

  return (
    <MiniKitProvider>

    <div className="App">
    <div className="chat-container">
      {/* Display previous messages */}
      {messages.map((msg, index) => (
        <div key={index} className={`message ${msg.role}`}>
          <strong>{msg.role === 'user' ? 'You' : 'Assistant'}:</strong> {msg.content}
        </div>
      ))}
      

      {/* Streaming response with debug info */}
      {(
        <div className="message assistant streaming">
          <strong>Assistant:</strong> 
          <div className="streaming-content">
            {streamingText || 'Waiting for response...'}
          </div>
        </div>
      )}
    </div>

    <div className="verification-section">
      <button 
        onClick={handleVerification}
        className="verify-button"
      >
        Verify with World ID
      </button>
    </div>

    <form onSubmit={handleSubmit} className="input-form">
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type a message..."
        className="chat-input"
      />
      <button type="submit" className="send-button">Send</button>
    </form>
  </div>
  </MiniKitProvider>

  );
}

export default App;