const express = require('express');
const router = express.Router();
require('dotenv').config();

router.post('/check', async (req, res) => {
  const { age, weight, conditions, challengeDetails } = req.body;

  const prompt = `You are an AI fitness & health advisor. A user wants to participate in a FitConquest physical fitness challenge: ${challengeDetails}.
Here is their health information:
- Age: ${age || 'Not specified'}
- Weight: ${weight || 'Not specified'}
- Medical Conditions: ${conditions || 'None stated'}

Based on this, should they perform the challenge? What are the safety limits or recommendations? Keep your advice under 4 sentences. 
Respond ONLY with a valid stringified JSON object matching this exact shape:
{
  "advice": "your 4 sentence advice here",
  "max_safe_reps": "a strict integer limit on how many consecutive reps they can safely do before taking a break, based on their health constraint. If completely healthy, you can put 25 or 50. If dangerous, put 5 or 10."
}
Do NOT include any markdown blocks or other text.`;

  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error('GROQ_API_KEY is not defined in the environment!');
      return res.status(500).json({ error: 'Groq API Key missing on server' });
    }

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: prompt }],
        temperature: 1,
        max_completion_tokens: 8192,
        top_p: 1,
        reasoning_effort: 'medium',
        stream: false
      })
    });
    
    const data = await groqRes.json();
    if (!groqRes.ok) {
      console.error("Groq API Error:", data);
      throw new Error(data.error?.message || 'Unknown Groq Error');
    }
    
    const contentRaw = data.choices[0].message.content.replace(/```json|```/g, "").trim();
    const contentObj = JSON.parse(contentRaw);

    res.json({ 
        advice: contentObj.advice,
        max_safe_reps: Number(contentObj.max_safe_reps)
    });
  } catch (err) {
    console.error("Health Check Exception:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
