<?php

use App\Http\Controllers\ChatController;
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

Route::prefix('chat')->group(function () {

    // Main chat endpoint
    Route::post('/', [ChatController::class, 'chat']);

    // Health check
    Route::get('/health', [ChatController::class, 'health']);
});
