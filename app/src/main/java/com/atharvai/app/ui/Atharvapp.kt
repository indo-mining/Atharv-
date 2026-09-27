package com.atharvai.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.atharvai.app.AtharvViewModel
import com.atharvai.app.data.ChatMessage

@Composable
fun AtharvApp(
    viewModel: AtharvViewModel
) {

    val messages by
        viewModel.messages.collectAsState()

    val memories by
        viewModel.memories.collectAsState()

    val loading by
        viewModel.isLoading.collectAsState()

    val error by
        viewModel.error.collectAsState()

    var input by remember {
        mutableStateOf("")
    }

    var showMemory by remember {
        mutableStateOf(false)
    }

    var memoryInput by remember {
        mutableStateOf("")
    }

    val listState =
        rememberLazyListState()

    LaunchedEffect(messages.size) {

        if (messages.isNotEmpty()) {

            listState.animateScrollToItem(
                messages.lastIndex
            )
        }
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {

        Column(
            modifier = Modifier.fillMaxSize()
        ) {

            TopBar(
                onNewChat = {
                    viewModel.newChat()
                    input = ""
                },
                onMemory = {
                    showMemory = true
                    viewModel.loadMemories()
                }
            )

            if (error != null) {

                ErrorBar(
                    error = error!!,
                    onClose = {
                        viewModel.clearError()
                    }
                )
            }

            if (messages.isEmpty()) {

                WelcomeScreen()

            } else {

                LazyColumn(
                    state = listState,
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp),
                    verticalArrangement =
                        Arrangement.spacedBy(10.dp)
                ) {

                    items(
                        items = messages,
                        key = {
                            "${it.timestamp}_${it.role}_${it.content.hashCode()}"
                        }
                    ) { message ->

                        MessageBubble(message)
                    }

                    if (loading) {

                        item {

                            ThinkingBubble()
                        }
                    }
                }
            }

            InputBar(
                value = input,
                enabled = !loading,
                onValueChange = {
                    if (it.length <= 12000) {
                        input = it
                    }
                },
                onSend = {

                    val text =
                        input.trim()

                    if (text.isNotEmpty()) {

                        input = ""

                        viewModel.sendMessage(text)
                    }
                }
            )
        }
    }

    if (showMemory) {

        MemoryDialog(
            memories = memories,
            input = memoryInput,
            onInputChange = {
                memoryInput = it
            },
            onAdd = {

                if (memoryInput.trim().isNotEmpty()) {

                    viewModel.addMemory(
                        memoryInput
                    )

                    memoryInput = ""
                }
            },
            onDelete = {
                viewModel.deleteMemory(it)
            },
            onClose = {
                showMemory = false
            }
        )
    }
}

@Composable
private fun TopBar(
    onNewChat: () -> Unit,
    onMemory: () -> Unit
) {

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(
                start = 8.dp,
                end = 8.dp,
                top = 8.dp,
                bottom = 4.dp
            ),
        verticalAlignment =
            Alignment.CenterVertically
    ) {

        Icon(
            imageVector = Icons.Default.SmartToy,
            contentDescription = null,
            modifier = Modifier.size(34.dp)
        )

        Spacer(
            modifier = Modifier.width(10.dp)
        )

        Column(
            modifier = Modifier.weight(1f)
        ) {

            Text(
                text = "ATHARV",
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.titleLarge
            )

            Text(
                text = "Your AI. Every Language. Every Question.",
                style = MaterialTheme.typography.labelSmall
            )
        }

        IconButton(
            onClick = onMemory
        ) {

            Text(
                text = "🧠"
            )
        }

        IconButton(
            onClick = onNewChat
        ) {

            Icon(
                imageVector = Icons.Default.Add,
                contentDescription = "New Chat"
            )
        }
    }
}

@Composable
private fun WelcomeScreen() {

    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        contentAlignment =
            Alignment.Center
    ) {

        Column(
            horizontalAlignment =
                Alignment.CenterHorizontally
        ) {

            Text(
                text = "ATHARV",
                style =
                    MaterialTheme.typography.displaySmall,
                fontWeight =
                    FontWeight.Bold
            )

            Spacer(
                modifier = Modifier.height(8.dp)
            )

            Text(
                text =
                    "Your AI. Every Language. Every Question.",
                style =
                    MaterialTheme.typography.bodyLarge
            )

            Spacer(
                modifier = Modifier.height(16.dp)
            )

            Text(
                text =
                    "Ask anything to get started.",
                style =
                    MaterialTheme.typography.bodyMedium
            )
        }
    }
}

@Composable
private fun MessageBubble(
    message: ChatMessage
) {

    val isUser =
        message.role == "user"

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement =
            if (isUser)
                Arrangement.End
            else
                Arrangement.Start
    ) {

        Card(
            modifier = Modifier
                .fillMaxWidth(
                    if (isUser) 0.88f else 0.94f
                ),
            shape =
                RoundedCornerShape(18.dp)
        ) {

            Column(
                modifier = Modifier.padding(14.dp)
            ) {

                Text(
                    text =
                        if (isUser)
                            "You"
                        else
                            "Atharv",
                    fontWeight =
                        FontWeight.Bold
                )

                Spacer(
                    modifier =
                        Modifier.height(5.dp)
                )

                Text(
                    text = message.content,
                    style =
                        MaterialTheme.typography.bodyLarge
                )
            }
        }
    }
}

@Composable
private fun ThinkingBubble() {

    Card(
        modifier =
            Modifier.fillMaxWidth(0.65f),
        shape =
            RoundedCornerShape(18.dp)
    ) {

        Row(
            modifier =
                Modifier.padding(14.dp),
            verticalAlignment =
                Alignment.CenterVertically
        ) {

            CircularProgressIndicator(
                modifier =
                    Modifier.size(20.dp),
                strokeWidth = 2.dp
            )

            Spacer(
                modifier =
                    Modifier.width(10.dp)
            )

            Text(
                text = "Atharv soch raha hai..."
            )
        }
    }
}

@Composable
private fun InputBar(
    value: String,
    enabled: Boolean,
    onValueChange: (String) -> Unit,
    onSend: () -> Unit
) {

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .padding(10.dp),
        verticalAlignment =
            Alignment.Bottom
    ) {

        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            enabled = enabled,
            modifier =
                Modifier.weight(1f),
            placeholder = {
                Text("Message Atharv...")
            },
            maxLines = 5
        )

        Spacer(
            modifier =
                Modifier.width(8.dp)
        )

        IconButton(
            onClick = onSend,
            enabled =
                enabled &&
                value.trim().isNotEmpty()
        ) {

            Icon(
                imageVector = Icons.Default.Send,
                contentDescription = "Send"
            )
        }
    }
}

@Composable
private fun ErrorBar(
    error: String,
    onClose: () -> Unit
) {

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(8.dp)
    ) {

        Row(
            modifier =
                Modifier.padding(10.dp),
            verticalAlignment =
                Alignment.CenterVertically
        ) {

            Text(
                text = error,
                modifier =
                    Modifier.weight(1f)
            )

            TextButton(
                onClick = onClose
            ) {

                Text("Close")
            }
        }
    }
}

@Composable
private fun MemoryDialog(
    memories: List<com.atharvai.app.data.MemoryItem>,
    input: String,
    onInputChange: (String) -> Unit,
    onAdd: () -> Unit,
    onDelete: (String) -> Unit,
    onClose: () -> Unit
) {

    AlertDialog(
        onDismissRequest = onClose,
        title = {
            Text("🧠 Atharv Memory")
        },
        text = {

            Column {

                OutlinedTextField(
                    value = input,
                    onValueChange = {
                        if (it.length <= 1000) {
                            onInputChange(it)
                        }
                    },
                    modifier =
                        Modifier.fillMaxWidth(),
                    placeholder = {
                        Text("Add something to remember...")
                    },
                    maxLines = 4
                )

                Spacer(
                    modifier =
                        Modifier.height(10.dp)
                )

                Button(
                    onClick = onAdd,
                    enabled =
                        input.trim().isNotEmpty()
                ) {

                    Text("Add Memory")
                }

                Spacer(
                    modifier =
                        Modifier.height(10.dp)
                )

                if (memories.isEmpty()) {

                    Text(
                        "No saved memories yet."
                    )

                } else {

                    LazyColumn(
                        modifier =
                            Modifier.heightIn(
                                max = 250.dp
                            )
                    ) {

                        items(
                            memories,
                            key = {
                                it.id.toString()
                            }
                        ) { memory ->

                            Row(
                                modifier =
                                    Modifier
                                        .fillMaxWidth()
                                        .padding(
                                            vertical = 6.dp
                                        ),
                                verticalAlignment =
                                    Alignment.CenterVertically
                            ) {

                                Text(
                                    text =
                                        memory.memory
                                            ?: "",
                                    modifier =
                                        Modifier.weight(1f)
                                )

                                IconButton(
                                    onClick = {

                                        val id =
                                            memory.id
                                                ?.toString()
                                                ?: return@IconButton

                                        onDelete(id)
                                    }
                                ) {

                                    Icon(
                                        imageVector =
                                            Icons.Default.Delete,
                                        contentDescription =
                                            "Delete"
                                    )
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {

            TextButton(
                onClick = onClose
            ) {

                Text("Close")
            }
        }
    )
}
