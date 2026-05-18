package com.theophiledonato.lueurs

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import androidx.activity.result.ActivityResult
import app.tauri.Logger
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@TauriPlugin
class FolderPickerPlugin(private val activity: Activity) : Plugin(activity) {

    @Command
    fun pickFolder(invoke: Invoke) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
            addFlags(
                Intent.FLAG_GRANT_READ_URI_PERMISSION or
                Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
                Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
            )
        }
        startActivityForResult(invoke, intent, "folderPickerResult")
    }

    @ActivityCallback
    fun folderPickerResult(invoke: Invoke, result: ActivityResult) {
        when (result.resultCode) {
            Activity.RESULT_OK -> {
                val uri = result.data?.data
                if (uri != null) {
                    val path = resolveToPath(uri)
                    if (path != null) {
                        Logger.info("FolderPicker", "dossier sélectionné : $path")
                        val ret = JSObject()
                        ret.put("path", path)
                        invoke.resolve(ret)
                    } else {
                        invoke.reject("Impossible de résoudre le chemin depuis : $uri")
                    }
                } else {
                    invoke.reject("Aucun dossier sélectionné")
                }
            }
            Activity.RESULT_CANCELED -> invoke.reject("cancelled")
            else -> invoke.reject("Résultat inconnu : ${result.resultCode}")
        }
    }

    private fun resolveToPath(uri: Uri): String? {
        return try {
            val docId = DocumentsContract.getTreeDocumentId(uri) ?: return null
            when {
                docId == "primary" -> "/storage/emulated/0"
                docId.startsWith("primary:") -> {
                    val rel = docId.removePrefix("primary:")
                    "/storage/emulated/0/$rel".trimEnd('/')
                }
                else -> {
                    // Stockage externe (carte SD) : "XXXX-XXXX:path/to/folder"
                    val colon = docId.indexOf(':')
                    if (colon < 0) return null
                    val volume = docId.substring(0, colon)
                    val rel = docId.substring(colon + 1)
                    if (rel.isEmpty()) "/storage/$volume"
                    else "/storage/$volume/$rel".trimEnd('/')
                }
            }
        } catch (e: Exception) {
            Logger.warn("FolderPicker", "échec résolution URI $uri : ${e.message}")
            null
        }
    }
}
