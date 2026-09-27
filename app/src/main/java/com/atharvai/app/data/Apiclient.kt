package com.atharvai.app.data

import com.google.gson.Gson
import com.google.gson.JsonParser
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

class ApiClient {

    private val gson = Gson()

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(90, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val jsonType =
        "application/json; charset=utf-8".toMediaType()

    suspend fun sendChat(
        userId: String,
        message: String,
        history: List<ChatMessage>
    ): String {

        val payload = mapOf(
            "message" to message,
            "history" to history.map {
                mapOf(
                    "role" to it.role,
                    "content" to it.content
                )
            },
            "userId" to userId
        )

        val body = gson.toJson(payload)
            .toRequestBody(jsonType)

        val request = Request.Builder()
            .url(ApiConfig.BASE_URL + ApiConfig.CHAT)
            .post(body)
            .addHeader("Accept", "application/json")
            .build()

        client.newCall(request).execute().use { response ->

            val text = response.body?.string().orEmpty()

            if (!response.isSuccessful) {
                throw IOException(
                    "Server error ${response.code}: ${extractError(text)}"
                )
            }

            if (text.isBlank()) {
                throw IOException("Atharv returned an empty response.")
            }

            return extractReply(text)
        }
    }

    suspend fun getMemories(
        userId: String
    ): List<MemoryItem> {

        val url =
            "${ApiConfig.BASE_URL}${ApiConfig.MEMORY}?userId=$userId"

        val request = Request.Builder()
            .url(url)
            .get()
            .addHeader("Accept", "application/json")
            .build()

        client.newCall(request).execute().use { response ->

            val text = response.body?.string().orEmpty()

            if (!response.isSuccessful) {
                throw IOException(
                    "Memory error ${response.code}: ${extractError(text)}"
                )
            }

            val result =
                gson.fromJson(text, MemoryResponse::class.java)

            return result.memories ?: emptyList()
        }
    }

    suspend fun addMemory(
        userId: String,
        memory: String
    ) {

        val payload = MemoryRequest(
            userId = userId,
            memory = memory
        )

        val body = gson.toJson(payload)
            .toRequestBody(jsonType)

        val request = Request.Builder()
            .url(ApiConfig.BASE_URL + ApiConfig.MEMORY)
            .post(body)
            .addHeader("Accept", "application/json")
            .build()

        client.newCall(request).execute().use { response ->

            val text = response.body?.string().orEmpty()

            if (!response.isSuccessful) {
                throw IOException(
                    "Memory save error ${response.code}: ${extractError(text)}"
                )
            }
        }
    }

    suspend fun deleteMemory(
        userId: String,
        id: String
    ) {

        val url =
            "${ApiConfig.BASE_URL}${ApiConfig.MEMORY}?id=$id&userId=$userId"

        val request = Request.Builder()
            .url(url)
            .delete()
            .addHeader("Accept", "application/json")
            .build()

        client.newCall(request).execute().use { response ->

            val text = response.body?.string().orEmpty()

            if (!response.isSuccessful) {
                throw IOException(
                    "Memory delete error ${response.code}: ${extractError(text)}"
                )
            }
        }
    }

    private fun extractReply(json: String): String {

        return try {

            val root =
                JsonParser.parseString(json).asJsonObject

            val candidates = listOf(
                "reply",
                "response",
                "message",
                "answer",
                "content"
            )

            for (key in candidates) {
                if (root.has(key) &&
                    !root.get(key).isJsonNull
                ) {
                    val value =
                        root.get(key).asString

                    if (value.isNotBlank()) {
                        return value
                    }
                }
            }

            if (root.has("data") &&
                root.get("data").isJsonObject
            ) {

                val data =
                    root.getAsJsonObject("data")

                for (key in listOf(
                    "reply",
                    "response"
                )) {

                    if (data.has(key) &&
                        !data.get(key).isJsonNull
                    ) {

                        val value =
                            data.get(key).asString

                        if (value.isNotBlank()) {
                            return value
                        }
                    }
                }
            }

            throw IOException(
                "Atharv did not return a response."
            )

        } catch (error: Exception) {

            if (error is IOException) {
                throw error
            }

            throw IOException(
                "Invalid server response."
            )
        }
    }

    private fun extractError(
        json: String
    ): String {

        return try {

            val root =
                JsonParser.parseString(json).asJsonObject

            if (root.has("error")) {
                root.get("error").asString
            } else {
                "Unknown server error."
            }

        } catch (_: Exception) {

            "Unable to connect to Atharv AI."
        }
    }
}
