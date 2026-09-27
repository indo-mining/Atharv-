package com.atharvai.app.data

data class ChatMessage(
    val role: String,
    val content: String,
    val timestamp: Long = System.currentTimeMillis()
)

data class ChatRequest(
    val message: String,
    val history: List<ChatMessage>,
    val userId: String
)

data class ChatResponse(
    val success: Boolean = false,
    val reply: String? = null,
    val response: String? = null,
    val message: String? = null,
    val answer: String? = null,
    val content: String? = null
)

data class MemoryItem(
    val id: Any? = null,
    val user_id: String? = null,
    val memory: String? = null,
    val created_at: String? = null
)

data class MemoryResponse(
    val success: Boolean = false,
    val memories: List<MemoryItem>? = null
)

data class MemoryRequest(
    val userId: String,
    val memory: String
)
