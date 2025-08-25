package com.example.tabi

import android.content.Context
import com.google.api.services.sheets.v4.Sheets
import com.google.api.services.sheets.v4.model.ValueRange
import com.google.auth.oauth2.GoogleCredentials
import com.google.auth.http.HttpCredentialsAdapter
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport
import com.google.api.client.json.gson.GsonFactory
import java.io.InputStream

/**
 * Handles reading and writing task data in Google Sheets.
 * @param context Android context
 */
class SheetRepository(private val context: Context) {
    private val sheets: Sheets by lazy {
        val cfg = ConfigManager.load(context).first()
        val credentials: InputStream = context.assets.open(cfg.credentials)
        val creds = GoogleCredentials.fromStream(credentials)
            .createScoped(listOf("https://www.googleapis.com/auth/spreadsheets"))
        Sheets.Builder(
            GoogleNetHttpTransport.newTrustedTransport(),
            GsonFactory.getDefaultInstance(),
            HttpCredentialsAdapter(creds)
        ).setApplicationName("Tabi").build()
    }
    private val config = ConfigManager.load(context).first()

    /**
     * Fetch tasks from the configured spreadsheet.
     * @return list of Task objects
     */
    fun fetchTasks(): List<Task> {
        val response: ValueRange =
            sheets.spreadsheets().values().get(config.id, config.range).execute()
        val values = response.getValues() ?: return emptyList()
        return values.drop(1).mapNotNull { row ->
            try {
                Task(
                    date = row[0].toString(),
                    timeOfDay = row[1].toString(),
                    completed = row[2].toString().equals("true", true),
                    medication = row[3].toString(),
                    dosage = row[4].toString()
                )
            } catch (e: Exception) {
                null
            }
        }
    }

    /**
     * Mark task as done in the spreadsheet.
     * @param task task to update
     */
    fun markDone(task: Task) {
        val range = "${config.range.split('!')[0]}!C${task.rowIndex}"
        val body = ValueRange().setValues(listOf(listOf("TRUE")))
        sheets.spreadsheets().values().update(config.id, range, body)
            .setValueInputOption("RAW").execute()
    }
}
