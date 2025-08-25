package com.example.tabbi

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.Button
import androidx.compose.material.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * Entry point activity displaying tasks loaded from Google Sheets.
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val repo = SheetRepository(this)
        val tasks = mutableStateListOf<Task>()

        setContent {
            LaunchedEffect(Unit) { tasks.addAll(repo.fetchTasks()) }
            TaskList(tasks = tasks, onDone = { task ->
                repo.markDone(task)
                task.completed = true
            })
        }
    }
}

/**
 * Composable list of tasks with color-coded status.
 * @param tasks list of task items
 * @param onDone callback when user marks task as done
 */
@Composable
fun TaskList(tasks: List<Task>, onDone: (Task) -> Unit) {
    LazyColumn(modifier = Modifier.fillMaxSize()) {
        items(tasks.size) { index ->
            val task = tasks[index]
            val color = TimeUtils.statusColor(task)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(color)
                    .padding(12.dp)
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(text = "${task.date} ${task.timeOfDay}")
                    Text(text = "${task.medication} ${task.dosage}")
                }
                if (!task.completed) {
                    Button(onClick = { onDone(task) }) {
                        Text("✔")
                    }
                }
            }
        }
    }
}
