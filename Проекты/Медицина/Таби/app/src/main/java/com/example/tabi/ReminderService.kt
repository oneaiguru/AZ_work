package com.example.tabi

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Background service showing reminders in the notification tray.
 */
class ReminderService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    /**
     * Called when the service starts. Displays a persistent notification.
     */
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val channelId = "tabi_reminder"
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O &&
            manager.getNotificationChannel(channelId) == null) {
            val channel = NotificationChannel(
                channelId, "Tabi Reminders", NotificationManager.IMPORTANCE_HIGH
            )
            manager.createNotificationChannel(channel)
        }
        val notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle("Таби")
            .setContentText("Есть невыполненные действия")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .build()
        startForeground(1, notification)
        return START_STICKY
    }
}
