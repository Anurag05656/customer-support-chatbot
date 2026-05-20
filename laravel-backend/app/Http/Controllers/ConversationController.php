<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConversationController extends Controller
{
    /**
     * List all conversations for the authenticated user.
     */
    public function index(Request $request): JsonResponse
    {
        $conversations = $request->user()
            ->conversations()
            ->select('id', 'title', 'created_at', 'updated_at')
            ->get();

        return response()->json(['conversations' => $conversations]);
    }

    /**
     * Create a new conversation.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'title' => 'nullable|string|max:255',
        ]);

        $conversation = $request->user()->conversations()->create([
            'title' => $request->input('title', 'New Chat'),
        ]);

        return response()->json([
            'conversation' => $conversation,
        ], 201);
    }

    /**
     * Get a single conversation with all its messages.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $conversation = $request->user()
            ->conversations()
            ->with('messages')
            ->findOrFail($id);

        return response()->json(['conversation' => $conversation]);
    }

    /**
     * Update a conversation's title.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'title' => 'required|string|max:255',
        ]);

        $conversation = $request->user()
            ->conversations()
            ->findOrFail($id);

        $conversation->update(['title' => $request->input('title')]);

        return response()->json(['conversation' => $conversation]);
    }

    /**
     * Delete a conversation.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $conversation = $request->user()
            ->conversations()
            ->findOrFail($id);

        $conversation->delete();

        return response()->json(['message' => 'Conversation deleted.']);
    }
}
