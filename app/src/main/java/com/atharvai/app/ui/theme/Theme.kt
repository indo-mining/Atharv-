package com.atharvai.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val AtharvColors =
    lightColorScheme()

@Composable
fun AtharvTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = AtharvColors,
        content = content
    )
}
