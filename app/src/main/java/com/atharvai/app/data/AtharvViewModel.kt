package com.atharvai.app

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.atharvai.app.data.ApiClient
import com.atharvai.app.data.ChatMessage
import com.atharvai.app.data.MemoryItem
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID

class AtharvViewModel(
    private val api: ApiClient,
    private val context: Context
) : ViewModel() {

    private val preferences =
        context.getSharedPreferences(
            "atharv_preferences",
            Context.MODE_PRIVATE
        )

    private val _messages =
        MutableStateFlow<List<ChatMessage>>(emptyList())

    val messages: StateFlow<List<ChatMessage>> =
        _messages.asStateFlow()

    private val _memories =
        MutableStateFlow<List<MemoryItem>>(emptyList())

    val memories: StateFlow<List<MemoryItem>> =
        _memories.asStateFlow()

    private val _isLoading =
        MutableStateFlow(false)

    val isLoading: StateFlow<Boolean> =
        _isLoading.asStateFlow()

    private val _error =
        MutableStateFlow<String?>(null)

    val error: StateFlow<String?> =
        _error.asStateFlow()

    private val userId: String
        get() {

            val existing =
                preferences.getString(
                    "user_id",
                    null
                )

            if (!existing.isNullOrBlank()) {
                return existing
            }

            val newId =
                UUID.randomUUID().toString()

            preferences.edit()
                .putString("user_id", newId)
                .apply()

            return newId
        }

    fun sendMessage(text: String) {

        val message =
            text.trim()

        if (message.isEmpty()) return

        if (message.length > 12000) {
            _error.value =
                "Message maximum 12000 characters ka ho sakta hai."
            return
        }

        val userMessage =
            ChatMessage(
                role = "user",
                content = message
            )

        _messages.value =
            _messages.value + userMessage

        _error.value = null
        _isLoading.value = true

        viewModelScope.launch {

            try {

                val history =
                    _messages.value
                        .dropLast(1)
                        .takeLast(30)

                val reply =
                    api.sendChat(
                        userId = userId,
                        message = message,
                        history = history
                    )

                _messages.value =
                    _messages.value +
                        ChatMessage(
                            role = "assistant",
                            content = reply
                        )

            } catch (error: Exception) {

                _error.value =
                    error.message
                        ?: "Atharv se response nahi mil paaya."

            } finally {

                _isLoading.value = false
            }
        }
    }

    fun newChat() {

        _messages.value =
            emptyList()

        _error.value = null
    }

    fun loadMemories() {

        viewModelScope.launch {

            try {

                _memories.value =
                    api.getMemories(userId)

            } catch (error: Exception) {

                _error.value =
                    error.message
                        ?: "Memory load nahi ho paayi."
            }
        }
    }

    fun addMemory(text: String) {

        val memory =
            text.trim()

        if (memory.isEmpty()) return

        if (memory.length > 1000) {
            _error.value =
                "Memory maximum 1000 characters ki ho sakti hai."
            return
        }

        viewModelScope.launch {

            try {

                api.addMemory(
                    userId,
                    memory
                )

                loadMemories()

            } catch (error: Exception) {

                _error.value =
                    error.message
                        ?: "Memory save nahi ho paayi."
            }
        }
    }

    fun deleteMemory(id: String) {

        viewModelScope.launch {

            try {

                api.deleteMemory(
                    userId,
                    id
                )

                loadMemories()

            } catch (error: Exception) {

                _error.value =
                    error.message
                        ?: "Memory delete nahi ho paayi."
            }
        }
    }

    fun clearError() {
        _error.value = null
    }

    class Factory(
        private val context: Context
    ) : ViewModelProvider.Factory {

        override fun <T : ViewModel> create(
            modelClass: Class<T>
        ): T {

            if (
                modelClass.isAssignableFrom(
                    AtharvViewModel::class.java
                )
            ) {

                @Suppress("UNCHECKED_CAST")
                return AtharvViewModel(
                    ApiClient(),
                    context.applicationContext
                ) as T
            }

            throw IllegalArgumentException(
                "Unknown ViewModel"
            )
        }
    }
}
