<?php

namespace App\Http\Controllers;

use App\Services\ExpertSystem;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ChatController extends Controller
{
    private string $groqApiKey;
    private string $groqApiUrl = 'https://api.groq.com/openai/v1/chat/completions';
    private string $model = 'llama-3.3-70b-versatile';

    private string $systemPrompt = <<<PROMPT
You are a professional and empathetic customer support assistant.
Your job is to help customers with their queries in a friendly, concise, and helpful manner.

Guidelines:
- Always be polite, patient, and understanding
- Keep responses concise and to the point (2-4 sentences usually)
- If a customer is frustrated, acknowledge their feelings first
- For complex issues like refunds or account problems, ask for their order/account ID
- If you cannot resolve an issue, offer to escalate to a human agent
- Do not make up policies; say "I'll check that for you" if unsure
- Use simple, clear language — avoid jargon

CRITICAL: You must ALWAYS respond in valid JSON with exactly these fields:
{
  "reply": "Your helpful response text here",
  "sentiment": "positive | neutral | concerned",
  "suggestions": ["Follow-up 1", "Follow-up 2"]
}

The "sentiment" field reflects the CUSTOMER's emotional state:
- "positive" if the customer seems happy or satisfied
- "neutral" if the customer has a straightforward query
- "concerned" if the customer seems frustrated or has an urgent issue

The "suggestions" field should contain 2-3 contextually relevant follow-up questions the customer might ask next.
PROMPT;

    public function __construct()
    {
        // Read directly from env to bypass Railway's build-time config cache
        $this->groqApiKey = env('GROQ_API_KEY') ?: config('services.groq.api_key', '');
    }

    /**
     * Handle an incoming chat message and return an AI response.
     */
    public function chat(Request $request): JsonResponse
    {
        $request->validate([
            'message'    => 'required|string|max:1000',
            'session_id' => 'nullable|string|max:100',
            'history'    => 'nullable|array|max:20',
            'history.*.role'    => 'required_with:history|in:user,assistant',
            'history.*.content' => 'required_with:history|string|max:2000',
        ]);

        // ── Expert System Analysis ──────────────────────
        $expert = new ExpertSystem();
        $analysis = $expert->analyze($request->input('message'));

        // Inject expert context into the conversation
        $expertContext = sprintf(
            '[Expert System Context — Intent: %s | Priority: %s | Suggested Action: %s]',
            $analysis['intent'],
            $analysis['priority'],
            $analysis['action']
        );

        $messages = $this->buildMessages(
            $request->input('history', []),
            $request->input('message'),
            $expertContext
        );

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $this->groqApiKey,
                'Content-Type'  => 'application/json',
            ])
            ->timeout(30)
            ->post($this->groqApiUrl, [
                'model'           => $this->model,
                'messages'        => $messages,
                'max_tokens'      => 512,
                'temperature'     => 0.7,
                'response_format' => ['type' => 'json_object'],
            ]);

            if ($response->failed()) {
                Log::error('Groq API error', [
                    'status' => $response->status(),
                    'body'   => $response->body(),
                ]);

                return response()->json([
                    'error' => 'AI service is temporarily unavailable. Please try again.',
                ], 503);
            }

            $data     = $response->json();
            $rawReply = $data['choices'][0]['message']['content'] ?? '{}';
            $parsed   = json_decode($rawReply, true) ?? [];

            return response()->json([
                'reply'           => $parsed['reply'] ?? trim($rawReply),
                'sentiment'       => $parsed['sentiment'] ?? 'neutral',
                'suggestions'     => $parsed['suggestions'] ?? [],
                'session_id'      => $request->input('session_id'),
                'tokens'          => $data['usage']['total_tokens'] ?? null,
                'expert_analysis' => $analysis,
            ]);

        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            Log::error('Groq connection failed', ['error' => $e->getMessage()]);

            return response()->json([
                'error' => 'Connection to AI service failed. Please check your internet connection.',
            ], 504);
        }
    }

    /**
     * Build the messages array for the Groq API.
     */
    private function buildMessages(array $history, string $currentMessage, string $expertContext = ''): array
    {
        $messages = [
            ['role' => 'system', 'content' => $this->systemPrompt],
        ];

        foreach (array_slice($history, -10) as $turn) {
            $messages[] = [
                'role'    => $turn['role'],
                'content' => $turn['content'],
            ];
        }

        // Prepend expert context to the user message
        $userContent = $expertContext
            ? $expertContext . "\n\nCustomer message: " . $currentMessage
            : $currentMessage;

        $messages[] = [
            'role'    => 'user',
            'content' => $userContent,
        ];

        return $messages;
    }

    /**
     * Health check endpoint.
     */
    public function health(): JsonResponse
    {
        return response()->json([
            'status'  => 'ok',
            'service' => 'customer-support-chatbot',
        ]);
    }
}
