<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\ConversationController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| All routes here are automatically prefixed with /api and use the
| 'api' middleware group.
|
*/

// ── Public Auth Routes ──────────────────────────────
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login',    [AuthController::class, 'login']);
});

// ── Protected Routes (require Sanctum token) ────────
Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/user',    [AuthController::class, 'user']);

    // Conversations CRUD
    Route::apiResource('conversations', ConversationController::class);
});

// ── Chat (accessible to both guests and auth users) ─
Route::prefix('chat')->group(function () {

    // Main chat endpoint — works for guests too, auth is optional
    Route::post('/', [ChatController::class, 'chat']);

    // Health check
    Route::get('/health', [ChatController::class, 'health']);
});
