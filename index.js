// AINO-V3 - Final Backend Code
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');

// Initialize clients
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Initialize Express App
const app = express();
app.use(cors());
app.use(express.json());

// Main API Route
app.post('/api/generate-reflection', async (req, res) => {
  console.log('Received request to generate reflection.');

  try {
    // Part 1: Get the user's story from the request.
    const { userStory } = req.body;
    if (!userStory) {
      console.log('Error: User story is required.');
      return res.status(400).json({ error: 'User story is required.' });
    }

    // Part 2: Generate the written apology with Google Gemini.
    console.log('Calling Gemini API...');
    const prompt = `You are an empathetic reflection AI. A user will provide a story of a time they were hurt. Your task is to write a heartfelt and sincere apology from the perspective of the person who caused the hurt. Do not be defensive. Acknowledge the user's pain. Be specific if possible based on their story. The user's story is: "${userStory}" Write the apology now.`;
    const geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await geminiModel.generateContent(prompt);
    const geminiResponse = await result.response;
    const writtenApology = geminiResponse.text();
    console.log('Successfully received written apology from Gemini.');

    // Part 3: Generate the voice apology with OpenAI TTS.
    console.log('Calling OpenAI Audio API...');
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: writtenApology,
    });
    const audioBuffer = Buffer.from(await mp3.arrayBuffer());
    const audioBase64 = audioBuffer.toString('base64');
    console.log('Successfully received audio from OpenAI.');

    // **** NEW - Part 4: Send the result to Zapier ****
    console.log('Sending data to Zapier webhook...');
    const zapierWebhookUrl = process.env.ZAPIER_WEBHOOK_URL;
    if (zapierWebhookUrl) {
      await fetch(zapierWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          writtenApology: writtenApology,
          audioBase64: audioBase64,
          originalStory: userStory, // Sending original story too, just in case
        }),
      });
      console.log('Successfully sent data to Zapier.');
    } else {
      console.log('Zapier Webhook URL not configured. Skipping step.');
    }
    
    // Part 5: Send a simple success response back to the Webflow site.
    res.status(200).json({ message: 'Success' });

  } catch (error) {
    console.error('An error occurred during generation:', error);
    res.status(500).json({ error: 'Failed to generate reflection.' });
  }
});

// For Vercel deployment
module.exports = app;