package com.example.tabi

/**
 * Domain model describing a scheduled action.
 */
data class Task(
    val date: String,
    val timeOfDay: String,
    var completed: Boolean,
    val medication: String,
    val dosage: String,
    var rowIndex: Int = 0   // index in sheet for updates
)
