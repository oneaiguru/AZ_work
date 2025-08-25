package com.example.tabbi

import androidx.compose.ui.graphics.Color
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter

/**
 * Utility object for time-of-day calculations and color selection.
 */
object TimeUtils {
    private val formatter = DateTimeFormatter.ofPattern("dd.MM.yyyy")

    /**
     * Calculate color for task based on current time and completion status.
     * @param task task to evaluate
     * @return color: yellow when due, red when overdue, green when done
     */
    fun statusColor(task: Task): Color {
        if (task.completed) return Color.Green
        val now = LocalTime.now()
        val date = LocalDate.parse(task.date, formatter)
        val target = when (task.timeOfDay.lowercase()) {
            "утро" -> LocalTime.of(6, 0)
            "день" -> LocalTime.of(13, 0)
            else -> LocalTime.of(18, 0)
        }
        val due = date.atTime(target)
        return when {
            now.isAfter(target.plusHours(7)) && LocalDate.now().isAfter(date) -> Color.Red
            now.isAfter(target) && LocalDate.now() == date -> Color.Yellow
            else -> Color.White
        }
    }
}
