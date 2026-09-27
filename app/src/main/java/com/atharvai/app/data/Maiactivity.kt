package com.atharvai.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.viewmodel.compose.viewModel
import com.atharvai.app.ui.AtharvApp
import com.atharvai.app.ui.theme.AtharvTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        enableEdgeToEdge()

        setContent {

            val viewModel: AtharvViewModel =
                viewModel(
                    factory = AtharvViewModel.Factory(
                        applicationContext
                    )
                )

            AtharvTheme {
                AtharvApp(viewModel)
            }
        }
    }
}
