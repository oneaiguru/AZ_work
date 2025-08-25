package com.example.tabbi

import android.content.Context
import com.google.gson.Gson
import java.io.InputStreamReader

/**
 * Reads configuration describing target Google Sheets.
 */
object ConfigManager {
    data class SheetConfig(val id: String, val range: String, val credentials: String)
    data class Config(val sheets: List<SheetConfig>)

    /**
     * Load configuration from assets/config.json.
     * @param context Android context
     * @return list of sheet configurations
     */
    fun load(context: Context): List<SheetConfig> {
        context.assets.open("config.json").use { input ->
            return Gson().fromJson(InputStreamReader(input), Config::class.java).sheets
        }
    }
}
