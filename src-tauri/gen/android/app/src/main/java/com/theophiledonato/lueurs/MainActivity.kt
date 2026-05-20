package com.theophiledonato.lueurs

import android.os.Bundle
import android.view.View
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)

    // SDK 35+ force l'edge-to-edge : adjustResize seul ne redimensionne plus le WebView.
    // On applique manuellement les insets (system bars + IME) en padding sur le content view
    // pour que window.innerHeight reflète la zone visible quand le clavier est ouvert.
    val content = findViewById<View>(android.R.id.content)
    ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
      val sys = insets.getInsets(WindowInsetsCompat.Type.systemBars())
      val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
      view.setPadding(sys.left, sys.top, sys.right, maxOf(sys.bottom, ime.bottom))
      WindowInsetsCompat.CONSUMED
    }
  }
}
