<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\Message;
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
Your job is to help customers ONLY with support-related queries such as order tracking, refunds, account issues, billing, shipping, product questions, complaints, and escalations.

SCOPE RESTRICTION (STRICTLY ENFORCED):
- You must ONLY answer questions related to customer support topics.
- If a customer asks a general knowledge question, trivia, coding help, math, science, history, or anything NOT related to customer support, politely decline and redirect them.
- Example decline: "I appreciate your curiosity! However, I'm specifically designed to help with customer support topics like orders, refunds, account issues, and more. How can I help you with any of those?"
- NEVER answer off-topic questions, even if you know the answer. Stay in your role.

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
        $this->groqApiKey = config('services.groq.api_key');
    }

    /**
     * Handle an incoming chat message and return an AI response.
     */
    public function chat(Request $request): JsonResponse
    {
        $request->validate([
            'message'         => 'required|string|max:1000',
            'session_id'      => 'nullable|string|max:100',
            'conversation_id' => 'nullable|integer',
            'history'         => 'nullable|array|max:20',
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

        // ── Build conversation history ──────────────────
        // Optionally resolve authenticated user from bearer token
        $user = auth('sanctum')->user();
        $conversation = null;
        $historyForApi = $request->input('history', []);

        // If authenticated and has conversation_id, load history from DB
        if ($user && $request->input('conversation_id')) {
            $conversation = $user->conversations()->find($request->input('conversation_id'));

            if ($conversation) {
                // Load last 10 messages from DB for context
                $dbMessages = $conversation->messages()
                    ->orderBy('created_at', 'desc')
                    ->take(10)
                    ->get()
                    ->reverse()
                    ->values();

                $historyForApi = $dbMessages->map(fn($m) => [
                    'role'    => $m->role,
                    'content' => $m->content,
                ])->toArray();
            }
        }

        $messages = $this->buildMessages(
            $historyForApi,
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

            $replyText  = $parsed['reply'] ?? trim($rawReply);
            $sentiment  = $parsed['sentiment'] ?? 'neutral';
            $suggestions = $parsed['suggestions'] ?? [];

            // ── Persist messages for authenticated users ─────
            if ($user && $conversation) {
                // Save user message
                $conversation->messages()->create([
                    'role'    => 'user',
                    'content' => $request->input('message'),
                ]);

                // Save bot reply
                $conversation->messages()->create([
                    'role'            => 'assistant',
                    'content'         => $replyText,
                    'sentiment'       => $sentiment,
                    'suggestions'     => $suggestions,
                    'expert_analysis' => $analysis,
                ]);

                // Update conversation title from first user message
                if ($conversation->title === 'New Chat') {
                    $conversation->update([
                        'title' => mb_substr($request->input('message'), 0, 60),
                    ]);
                }

                $conversation->touch();
            }

            return response()->json([
                'reply'           => $replyText,
                'sentiment'       => $sentiment,
                'suggestions'     => $suggestions,
                'session_id'      => $request->input('session_id'),
                'conversation_id' => $conversation?->id,
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
