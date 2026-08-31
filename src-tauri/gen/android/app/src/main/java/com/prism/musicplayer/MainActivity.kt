package com.prism.musicplayer

import android.os.Bundle
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  companion object {
    init {
      try {
        System.loadLibrary("c++_shared")
      } catch (e: Throwable) {
        e.printStackTrace()
      }
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }
}
